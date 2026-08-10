import { Prisma, type InstitutionStatus, type InstitutionType, type Role } from "@prisma/client";
import { can } from "../auth/rbac";
import { db } from "../db/client";

export class AdminInstitutionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

type AuditContext = { ipHash: string | null; userAgent: string | null };

export type InstitutionWritable = {
  name: string;
  acronym?: string | null;
  slug: string;
  type: InstitutionType;
  country: string;
  province?: string | null;
  city?: string | null;
  address?: string | null;
  website?: string | null;
  domain?: string | null;
  logoUrl?: string | null;
  status?: InstitutionStatus;
};

export const INSTITUTION_LIST_ORDER = [{ createdAt: "desc" as const }, { id: "desc" as const }];
export const INSTITUTION_PAGE_SIZE = 25;

const INSTITUTION_ROLES: Role[] = ["INSTITUTION_ADMIN", "UNIVERSITY_ADMIN"];

export function isInstitutionScopedRole(role: Role) {
  return INSTITUTION_ROLES.includes(role);
}

export function canManageInstitutionGlobally(role: Role) {
  return role === "SUPER_ADMIN" || role === "ADMIN";
}

export function canReadInstitutionAudit(role: Role) {
  return can(role, "admin:audit:read");
}

export function assertCanCreateInstitution(actorRole: Role) {
  if (!canManageInstitutionGlobally(actorRole)) {
    throw new AdminInstitutionError("Seuls SUPER_ADMIN et ADMIN peuvent créer une institution.", 403);
  }
}

export function assertCanChangeInstitutionStatus(actorRole: Role) {
  if (!canManageInstitutionGlobally(actorRole)) {
    throw new AdminInstitutionError("Seuls SUPER_ADMIN et ADMIN peuvent changer le statut d’une institution.", 403);
  }
}

export function assertStatusTransition(current: InstitutionStatus, next: InstitutionStatus) {
  if (current === next) {
    throw new AdminInstitutionError("Le statut demandé est déjà appliqué.", 409);
  }
  if (current === "ARCHIVED" && next !== "ACTIVE") {
    throw new AdminInstitutionError("Une institution archivée ne peut être que réactivée.", 409);
  }
  const allowed: Record<InstitutionStatus, InstitutionStatus[]> = {
    PENDING: ["ACTIVE", "SUSPENDED", "ARCHIVED"],
    ACTIVE: ["SUSPENDED", "ARCHIVED"],
    SUSPENDED: ["ACTIVE", "ARCHIVED"],
    ARCHIVED: ["ACTIVE"],
  };
  if (!allowed[current].includes(next)) {
    throw new AdminInstitutionError(`Transition de statut interdite : ${current} → ${next}.`, 409);
  }
}

export function slugifyInstitutionName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "institution";
}

function auditActionForStatus(status: InstitutionStatus) {
  if (status === "ACTIVE") return "INSTITUTION_ACTIVATED";
  if (status === "SUSPENDED") return "INSTITUTION_SUSPENDED";
  if (status === "ARCHIVED") return "INSTITUTION_ARCHIVED";
  return "INSTITUTION_STATUS_CHANGED";
}

function publicFields(institution: {
  id: string;
  name: string;
  acronym: string | null;
  slug: string;
  type: InstitutionType;
  country: string;
  province: string | null;
  city: string | null;
  address: string | null;
  website: string | null;
  domain: string | null;
  logoUrl: string | null;
  status: InstitutionStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return institution;
}

function isSlugUniqueViolation(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") return false;
  const target = error.meta?.target;
  if (Array.isArray(target)) return target.some((item) => String(item).toLowerCase().includes("slug"));
  return String(target ?? "").toLowerCase().includes("slug");
}

function mapInstitutionWriteError(error: unknown): never {
  if (isSlugUniqueViolation(error)) {
    throw new AdminInstitutionError("Ce slug d’institution est déjà utilisé.", 409);
  }
  throw error;
}

export class AdminInstitutionService {
  async managedInstitutionIds(actorId: string, actorRole: Role) {
    if (canManageInstitutionGlobally(actorRole)) return null;
    if (!isInstitutionScopedRole(actorRole)) {
      throw new AdminInstitutionError("Permission institutionnelle insuffisante.", 403);
    }
    const managed = await db.university.findMany({
      where: { admins: { some: { id: actorId } } },
      select: { id: true },
      orderBy: INSTITUTION_LIST_ORDER,
    });
    return managed.map((item) => item.id);
  }

  private async assertAccess(actorId: string, actorRole: Role, institutionId: string) {
    const scope = await this.managedInstitutionIds(actorId, actorRole);
    if (scope && !scope.includes(institutionId)) {
      throw new AdminInstitutionError("Accès refusé à cette institution.", 403);
    }
  }

  async list(input: {
    actorId: string;
    actorRole: Role;
    q: string;
    page: number;
    status?: InstitutionStatus;
    type?: InstitutionType;
    country?: string;
  }) {
    const pageSize = INSTITUTION_PAGE_SIZE;
    const scope = await this.managedInstitutionIds(input.actorId, input.actorRole);
    if (scope && scope.length === 0) {
      return { institutions: [], total: 0, page: input.page, pageSize };
    }

    const where: Prisma.UniversityWhereInput = {
      ...(scope ? { id: { in: scope } } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.type ? { type: input.type } : {}),
      ...(input.country ? { country: { equals: input.country, mode: "insensitive" } } : {}),
      ...(input.q
        ? {
            OR: [
              { name: { contains: input.q, mode: "insensitive" } },
              { acronym: { contains: input.q, mode: "insensitive" } },
              { slug: { contains: input.q, mode: "insensitive" } },
              { city: { contains: input.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [institutions, total] = await db.$transaction([
      db.university.findMany({
        where,
        select: {
          id: true,
          name: true,
          acronym: true,
          slug: true,
          type: true,
          country: true,
          city: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { profiles: true, documents: true, admins: true } },
        },
        orderBy: INSTITUTION_LIST_ORDER,
        skip: (input.page - 1) * pageSize,
        take: pageSize,
      }),
      db.university.count({ where }),
    ]);

    return { institutions, total, page: input.page, pageSize };
  }

  async getById(actorId: string, actorRole: Role, id: string) {
    await this.assertAccess(actorId, actorRole, id);
    const institution = await db.university.findUnique({
      where: { id },
      include: {
        admins: { select: { id: true, name: true, email: true, role: true, status: true }, orderBy: [{ name: "asc" }, { id: "asc" }] },
        profiles: {
          select: {
            id: true,
            title: true,
            user: { select: { id: true, name: true, email: true, role: true, status: true } },
          },
          take: 50,
          orderBy: { id: "asc" },
        },
        documents: {
          where: { status: { not: "DELETED" } },
          select: { id: true, title: true, slug: true, status: true, type: true, updatedAt: true },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: 25,
        },
        _count: { select: { profiles: true, documents: true, admins: true, faculties: true } },
      },
    });
    if (!institution) throw new AdminInstitutionError("Institution introuvable.", 404);

    // Audit logs are gated by admin:audit:read — never leak raw admin audit to institution-scoped roles.
    if (!canReadInstitutionAudit(actorRole)) {
      return { ...institution, auditLogs: [] as const, auditLogsVisible: false as const };
    }

    const auditLogs = await db.auditLog.findMany({
      where: { entityType: "University", entityId: id },
      include: { actor: { select: { name: true, email: true, role: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 30,
    });

    return { ...institution, auditLogs, auditLogsVisible: true as const };
  }

  async create(actorId: string, actorRole: Role, input: InstitutionWritable, context: AuditContext) {
    assertCanCreateInstitution(actorRole);
    const slug = input.slug || slugifyInstitutionName(input.name);
    const existing = await db.university.findUnique({ where: { slug }, select: { id: true } });
    if (existing) throw new AdminInstitutionError("Ce slug d’institution est déjà utilisé.", 409);

    try {
      return await db.$transaction(async (tx) => {
        const institution = await tx.university.create({
          data: {
            name: input.name,
            acronym: input.acronym || null,
            slug,
            type: input.type,
            country: input.country,
            province: input.province || null,
            city: input.city || null,
            address: input.address || null,
            website: input.website || null,
            domain: input.domain || null,
            logoUrl: input.logoUrl || null,
            status: input.status ?? "PENDING",
          },
        });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "INSTITUTION_CREATED",
            entityType: "University",
            entityId: institution.id,
            newValue: publicFields(institution),
            ...context,
          },
        });
        return institution;
      });
    } catch (error) {
      mapInstitutionWriteError(error);
    }
  }

  async update(actorId: string, actorRole: Role, id: string, input: InstitutionWritable, context: AuditContext) {
    await this.assertAccess(actorId, actorRole, id);
    const current = await db.university.findUnique({ where: { id } });
    if (!current) throw new AdminInstitutionError("Institution introuvable.", 404);

    if (input.slug !== current.slug) {
      const clash = await db.university.findUnique({ where: { slug: input.slug }, select: { id: true } });
      if (clash && clash.id !== id) throw new AdminInstitutionError("Ce slug d’institution est déjà utilisé.", 409);
    }

    const data: Prisma.UniversityUpdateInput = {
      name: input.name,
      acronym: input.acronym || null,
      slug: input.slug,
      type: input.type,
      country: input.country,
      province: input.province || null,
      city: input.city || null,
      address: input.address || null,
      website: input.website || null,
      domain: input.domain || null,
      logoUrl: input.logoUrl || null,
    };

    try {
      return await db.$transaction(async (tx) => {
        const institution = await tx.university.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            actorId,
            action: "INSTITUTION_UPDATED",
            entityType: "University",
            entityId: id,
            oldValue: publicFields(current),
            newValue: publicFields(institution),
            ...context,
          },
        });
        return institution;
      });
    } catch (error) {
      mapInstitutionWriteError(error);
    }
  }

  async changeStatus(
    actorId: string,
    actorRole: Role,
    id: string,
    status: InstitutionStatus,
    context: AuditContext,
  ) {
    assertCanChangeInstitutionStatus(actorRole);
    return db.$transaction(async (tx) => {
      const current = await tx.university.findUnique({ where: { id } });
      if (!current) throw new AdminInstitutionError("Institution introuvable.", 404);
      assertStatusTransition(current.status, status);
      const institution = await tx.university.update({ where: { id }, data: { status } });
      await tx.auditLog.create({
        data: {
          actorId,
          action: auditActionForStatus(status),
          entityType: "University",
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status },
          ...context,
        },
      });
      return institution;
    });
  }
}
