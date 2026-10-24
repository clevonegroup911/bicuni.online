import { hash } from "bcryptjs";
import type { Prisma, Role, UserStatus } from "@prisma/client";
import {
  revokeVerificationTokens,
  rotateVerificationToken,
  sendVerificationEmail,
} from "../auth/email-verification";
import { db } from "../db/client";
import { logger } from "../observability/logger";

export class AdminUserError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

type AuditContext = { ipHash: string | null; userAgent: string | null };

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: "Actif",
  PENDING: "En attente de vérification",
  SUSPENDED: "Suspendu",
  DELETED: "Supprimé",
};

export function userStatusLabel(status: UserStatus) {
  return USER_STATUS_LABELS[status] ?? status;
}

export function assertRoleChangeAllowed(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  currentRole: Role;
  currentStatus: UserStatus;
  nextRole: Role;
  activeSuperAdmins: number;
}) {
  if (input.actorId === input.targetId) throw new AdminUserError("Vous ne pouvez pas modifier votre propre rôle.", 403);
  if (input.actorRole !== "SUPER_ADMIN" && (input.currentRole === "SUPER_ADMIN" || input.nextRole === "SUPER_ADMIN")) {
    throw new AdminUserError("Seul un SUPER_ADMIN peut modifier un compte SUPER_ADMIN.", 403);
  }
  if (
    input.currentRole === "SUPER_ADMIN"
    && input.nextRole !== "SUPER_ADMIN"
    && input.currentStatus === "ACTIVE"
    && input.activeSuperAdmins <= 1
  ) {
    throw new AdminUserError("Le dernier SUPER_ADMIN actif ne peut pas être rétrogradé.", 409);
  }
}

export function assertStatusChangeAllowed(input: {
  actorId: string;
  actorRole: Role;
  targetId: string;
  currentRole: Role;
  nextStatus: "ACTIVE" | "SUSPENDED" | "DELETED";
  activeSuperAdmins: number;
}) {
  if (input.actorId === input.targetId) throw new AdminUserError("Vous ne pouvez pas suspendre ou supprimer votre propre compte.", 403);
  if (input.actorRole !== "SUPER_ADMIN" && input.currentRole === "SUPER_ADMIN") {
    throw new AdminUserError("Seul un SUPER_ADMIN peut modifier le statut d’un SUPER_ADMIN.", 403);
  }
  if (input.currentRole === "SUPER_ADMIN" && input.nextStatus !== "ACTIVE" && input.activeSuperAdmins <= 1) {
    throw new AdminUserError("Le dernier SUPER_ADMIN actif ne peut pas être désactivé.", 409);
  }
}

export class AdminUserService {
  async list(input: { q: string; page: number; role?: Role; status?: UserStatus }) {
    const pageSize = 25;
    const where: Prisma.UserWhereInput = {
      ...(input.q ? { OR: [{ name: { contains: input.q, mode: "insensitive" } }, { email: { contains: input.q, mode: "insensitive" } }] } : {}),
      role: input.role,
      status: input.status,
    };
    const [users, total] = await db.$transaction([
      db.user.findMany({ where, select: { id: true, name: true, email: true, image: true, role: true, status: true, emailVerified: true, lastLoginAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * pageSize, take: pageSize }),
      db.user.count({ where }),
    ]);
    return { users, total, page: input.page, pageSize };
  }

  async createAdministrator(actorId: string, actorRole: Role, input: { name: string; email: string; password: string; role: "ADMIN" | "MODERATOR" | "INSTITUTION_ADMIN" | "SUPER_ADMIN" }, context: AuditContext) {
    if (actorRole !== "SUPER_ADMIN") throw new AdminUserError("Seul un SUPER_ADMIN peut créer un administrateur.", 403);
    const existing = await db.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw new AdminUserError("Cette adresse est déjà utilisée.", 409);
    const passwordHash = await hash(input.password, 12);
    return db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash, role: input.role, status: "ACTIVE", emailVerified: new Date(), profile: { create: {} } }, select: { id: true, name: true, email: true, role: true, status: true, createdAt: true } });
      await tx.auditLog.create({ data: { actorId, action: "ADMIN_USER_CREATED", entityType: "User", entityId: user.id, newValue: { role: user.role, status: user.status }, ...context } });
      return user;
    });
  }

  async changeRole(actorId: string, actorRole: Role, targetId: string, role: Role, context: AuditContext) {
    return db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, status: true } });
      if (!target) throw new AdminUserError("Utilisateur introuvable.", 404);
      try {
        assertRoleChangeAllowed({
          actorId,
          actorRole,
          targetId,
          currentRole: target.role,
          currentStatus: target.status,
          nextRole: role,
          activeSuperAdmins: await tx.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
        });
      } catch (error) {
        if (error instanceof AdminUserError) {
          await tx.auditLog.create({
            data: {
              actorId,
              action: "ADMIN_ROLE_CHANGE_DENIED",
              entityType: "User",
              entityId: targetId,
              oldValue: { role: target.role },
              newValue: { role, reason: error.message },
              ...context,
            },
          });
        }
        throw error;
      }
      const user = await tx.user.update({ where: { id: targetId }, data: { role }, select: { id: true, name: true, email: true, role: true, status: true } });
      await tx.auditLog.create({ data: { actorId, action: "ADMIN_ROLE_CHANGED", entityType: "User", entityId: targetId, oldValue: { role: target.role }, newValue: { role }, ...context } });
      return user;
    });
  }

  async changeStatus(actorId: string, actorRole: Role, targetId: string, status: "ACTIVE" | "SUSPENDED" | "DELETED", context: AuditContext) {
    return db.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: targetId },
        select: { id: true, role: true, status: true, email: true, emailVerified: true },
      });
      if (!target) throw new AdminUserError("Utilisateur introuvable.", 404);

      // Un simple changement de statut n’est jamais une preuve de propriété d’email.
      if (status === "ACTIVE") {
        if (target.status === "PENDING") {
          throw new AdminUserError(
            "Un compte en attente ne peut pas être activé manuellement. Renvoyez le lien de vérification.",
            409,
          );
        }
        if (!target.emailVerified) {
          throw new AdminUserError(
            "Impossible de réactiver un compte dont l’adresse email n’est pas vérifiée.",
            409,
          );
        }
        if (target.status !== "SUSPENDED" && target.status !== "DELETED") {
          throw new AdminUserError("Seuls les comptes suspendus ou supprimés peuvent être réactivés.", 409);
        }
      }

      assertStatusChangeAllowed({
        actorId,
        actorRole,
        targetId,
        currentRole: target.role,
        nextStatus: status,
        activeSuperAdmins: await tx.user.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } }),
      });

      if (status === "SUSPENDED" || status === "DELETED") {
        await revokeVerificationTokens(tx, target.email);
      }

      const user = await tx.user.update({
        where: { id: targetId },
        data: { status },
        select: { id: true, name: true, email: true, role: true, status: true, emailVerified: true },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          action: status === "ACTIVE" ? "ADMIN_USER_REACTIVATED" : status === "SUSPENDED" ? "ADMIN_USER_SUSPENDED" : "ADMIN_USER_DELETED",
          entityType: "User",
          entityId: targetId,
          oldValue: { status: target.status },
          newValue: { status },
          ...context,
        },
      });
      return user;
    });
  }

  async resendVerification(
    actorId: string,
    actorRole: Role,
    targetId: string,
    baseUrl: string,
    context: AuditContext,
  ) {
    if (actorRole !== "SUPER_ADMIN") {
      throw new AdminUserError("Seul un SUPER_ADMIN peut renvoyer un lien de vérification.", 403);
    }
    const target = await db.user.findUnique({
      where: { id: targetId },
      select: { id: true, email: true, status: true, emailVerified: true, role: true },
    });
    if (!target) throw new AdminUserError("Utilisateur introuvable.", 404);
    if (target.status !== "PENDING" || target.emailVerified) {
      throw new AdminUserError("Le renvoi de vérification n’est disponible que pour les comptes en attente.", 409);
    }

    const token = await db.$transaction(async (tx) => rotateVerificationToken(tx, target.email));
    try {
      await sendVerificationEmail({
        email: target.email,
        token,
        baseUrl,
        title: "Vérification BICUNI",
        text: "Un administrateur a renvoyé ce lien. Il est valable pendant 24 heures.",
      });
    } catch (error) {
      logger.error("email.admin_verification_resend_failed", error, { userId: target.id });
      throw new AdminUserError("L’email n’a pas pu être envoyé. Réessayez plus tard.", 502);
    }

    await db.auditLog.create({
      data: {
        actorId,
        action: "ADMIN_VERIFICATION_RESENT",
        entityType: "User",
        entityId: target.id,
        ...context,
      },
    });

    return { id: target.id, email: target.email, status: target.status, resent: true as const };
  }

  async listSecurityEvents(userId: string, take = 20) {
    return db.auditLog.findMany({
      where: {
        OR: [
          { entityType: "User", entityId: userId },
          { actorId: userId, action: { startsWith: "AUTH_" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        action: true,
        createdAt: true,
        entityType: true,
        entityId: true,
      },
    });
  }
}
