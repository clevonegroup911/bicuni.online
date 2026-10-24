import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import {
  rotateVerificationToken,
  sendVerificationEmail,
} from "@/lib/auth/email-verification";
import { denyIfRateLimited, requestIdentity } from "@/lib/auth/rate-limit";
import { registerSchema } from "@/lib/auth/validators";
import { publicOrigin } from "@/lib/http/public-origin";
import { logger } from "@/lib/observability/logger";

const createdMessage =
  "Compte créé. Consultez votre email pour l’activer. Si le message n’arrive pas, utilisez « Renvoyer le lien de vérification ».";
const existingMessage =
  "Si cette adresse est disponible, un email de vérification sera envoyé.";

export async function POST(request: Request) {
  const limited = await denyIfRateLimited(
    `register:${requestIdentity(request)}`,
    5,
    undefined,
    () => NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 }),
  );
  if (limited) return limited;

  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: { id: true, status: true, emailVerified: true },
  });
  if (existing) {
    return NextResponse.json({ message: existingMessage }, { status: 202 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const baseUrl = publicOrigin(request);

  const user = await db.$transaction(async (transaction) => {
    const created = await transaction.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "USER",
        status: "PENDING",
        profile: { create: {} },
      },
    });
    await transaction.auditLog.create({
      data: { actorId: created.id, action: "AUTH_REGISTER", entityType: "User", entityId: created.id },
    });
    return created;
  });

  try {
    const token = await db.$transaction(async (tx) => rotateVerificationToken(tx, user.email));
    await sendVerificationEmail({
      email: user.email,
      token,
      baseUrl,
      title: "Bienvenue sur BICUNI",
      text: "Confirmez votre adresse pour activer votre compte.",
    });
  } catch (error) {
    // Compte PENDING conservé : récupération via renvoi, sans doublon à la réinscription.
    logger.error("email.verification_register_failed", error, { userId: user.id });
  }

  return NextResponse.json({ message: createdMessage }, { status: 201 });
}
