import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { RESEND_NEUTRAL_MESSAGE } from "@/lib/auth/email-verification-messages";
import { createOpaqueToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { authEmailTemplate, sendEmail } from "@/lib/email/service";
import { logger } from "@/lib/observability/logger";

export { RESEND_NEUTRAL_MESSAGE };

export type VerifyEmailResult =
  | { ok: true; message: string }
  | { ok: false; status: 400; error: string };

type DbClient = Prisma.TransactionClient | typeof db;

export async function revokeVerificationTokens(client: DbClient, email: string) {
  await client.verificationToken.deleteMany({ where: { identifier: email } });
}

/** Remplace tout jeton existant et renvoie le jeton opaque (jamais journalisé). */
export async function rotateVerificationToken(client: DbClient, email: string) {
  const token = createOpaqueToken();
  await client.verificationToken.deleteMany({ where: { identifier: email } });
  await client.verificationToken.create({
    data: {
      identifier: email,
      token: hashToken(token),
      expires: tokenExpiry(24),
    },
  });
  return token;
}

export async function sendVerificationEmail(input: {
  email: string;
  token: string;
  baseUrl: string;
  title?: string;
  text?: string;
}) {
  const verificationUrl = `${input.baseUrl}/verify-email?token=${encodeURIComponent(input.token)}&email=${encodeURIComponent(input.email)}`;
  await sendEmail({
    to: input.email,
    subject: "Vérifiez votre adresse BICUNI",
    html: authEmailTemplate(
      input.title ?? "Vérification BICUNI",
      input.text ?? "Ce lien est valable pendant 24 heures.",
      "Vérifier mon adresse",
      verificationUrl,
    ),
  });
}

/**
 * Consomme le jeton une seule fois. N’active que les comptes PENDING.
 * Un jeton valide ne peut jamais réactiver SUSPENDED / DELETED (y compris en concurrence).
 */
export async function verifyEmailAddress(email: string, rawToken: string): Promise<VerifyEmailResult> {
  const normalized = email.trim().toLowerCase();
  const tokenHash = hashToken(rawToken);

  return db.$transaction(async (tx) => {
    const verification = await tx.verificationToken.findUnique({ where: { token: tokenHash } });
    if (!verification || verification.identifier !== normalized || verification.expires <= new Date()) {
      return { ok: false as const, status: 400 as const, error: "Ce lien est invalide ou expiré." };
    }

    // Usage unique : consommer avant toute mutation de statut.
    await tx.verificationToken.delete({ where: { token: tokenHash } });

    const activated = await tx.user.updateMany({
      where: { email: normalized, status: "PENDING" },
      data: { emailVerified: new Date(), status: "ACTIVE" },
    });

    if (activated.count === 1) {
      const user = await tx.user.findUnique({ where: { email: normalized }, select: { id: true } });
      if (user) {
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            action: "AUTH_EMAIL_VERIFIED",
            entityType: "User",
            entityId: user.id,
            newValue: { status: "ACTIVE" },
          },
        });
      }
      return { ok: true as const, message: "Adresse vérifiée. Vous pouvez vous connecter." };
    }

    const user = await tx.user.findUnique({
      where: { email: normalized },
      select: { id: true, status: true, emailVerified: true },
    });

    if (user?.status === "SUSPENDED" || user?.status === "DELETED") {
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "AUTH_VERIFY_REFUSED",
          entityType: "User",
          entityId: user.id,
          newValue: { reason: "status_ineligible", status: user.status },
        },
      });
      return {
        ok: false as const,
        status: 400 as const,
        error: "Ce lien ne peut pas activer ce compte. Contactez le support si besoin.",
      };
    }

    if (user?.status === "ACTIVE" && user.emailVerified) {
      return { ok: false as const, status: 400 as const, error: "Ce lien est invalide ou déjà utilisé." };
    }

    return { ok: false as const, status: 400 as const, error: "Ce lien est invalide ou expiré." };
  });
}

/** Renvoi self-service : réponses neutres, uniquement PENDING non vérifié. */
export async function resendVerificationForEmail(input: {
  email: string;
  baseUrl: string;
  actorId?: string | null;
}) {
  const user = await db.user.findUnique({
    where: { email: input.email },
    select: { id: true, email: true, emailVerified: true, status: true },
  });

  if (!user || user.emailVerified || user.status !== "PENDING") {
    return { sent: false as const };
  }

  const token = await db.$transaction(async (tx) => rotateVerificationToken(tx, user.email));

  try {
    await sendVerificationEmail({
      email: user.email,
      token,
      baseUrl: input.baseUrl,
      title: "Vérification BICUNI",
      text: "Ce nouveau lien est valable pendant 24 heures.",
    });
  } catch (error) {
    logger.error("email.verification_resend_failed", error, { userId: user.id });
    throw error;
  }

  await db.auditLog.create({
    data: {
      actorId: input.actorId ?? user.id,
      action: "AUTH_VERIFICATION_RESENT",
      entityType: "User",
      entityId: user.id,
    },
  });

  return { sent: true as const, userId: user.id };
}
