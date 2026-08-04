import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { consumeAuthAttempt, requestIdentity } from "@/lib/auth/rate-limit";
import { createOpaqueToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { registerSchema } from "@/lib/auth/validators";
import { authEmailTemplate, sendEmail } from "@/lib/email/service";

export async function POST(request: Request) {
  if (!consumeAuthAttempt(`register:${requestIdentity(request)}`, 5)) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) {
    return NextResponse.json({ message: "Si cette adresse est disponible, un email de vérification sera envoyé." }, { status: 202 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  const token = createOpaqueToken();
  const verificationHash = hashToken(token);
  const baseUrl = process.env.AUTH_URL ?? new URL(request.url).origin;

  await db.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        passwordHash,
        role: "USER",
        status: "PENDING",
        profile: { create: {} },
      },
    });
    await transaction.verificationToken.create({
      data: {
        identifier: user.email,
        token: verificationHash,
        expires: tokenExpiry(24),
      },
    });
    await transaction.auditLog.create({
      data: { actorId: user.id, action: "AUTH_REGISTER", entityType: "User", entityId: user.id },
    });
  });

  const verificationUrl = `${baseUrl}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(parsed.data.email)}`;
  await sendEmail({
    to: parsed.data.email,
    subject: "Vérifiez votre adresse BICUNI",
    html: authEmailTemplate("Bienvenue sur BICUNI", "Confirmez votre adresse pour activer votre compte.", "Vérifier mon adresse", verificationUrl),
  });

  return NextResponse.json({ message: "Compte créé. Consultez votre email pour l’activer." }, { status: 201 });
}
