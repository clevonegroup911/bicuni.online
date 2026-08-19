import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { denyIfRateLimited, requestIdentity } from "@/lib/auth/rate-limit";
import { hashToken } from "@/lib/auth/tokens";
import { resetPasswordSchema } from "@/lib/auth/validators";

export async function POST(request: Request) {
  const limited = await denyIfRateLimited(
    `reset:${requestIdentity(request)}`,
    8,
    undefined,
    () => NextResponse.json({ error: "Trop de tentatives." }, { status: 429 }),
  );
  if (limited) return limited;
  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides.", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const token = await db.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(parsed.data.token) },
  });
  if (!token || token.usedAt || token.expires <= new Date()) {
    return NextResponse.json({ error: "Ce lien est invalide ou expiré." }, { status: 400 });
  }

  const passwordHash = await hash(parsed.data.password, 12);
  await db.$transaction([
    db.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    db.auditLog.create({ data: { actorId: token.userId, action: "AUTH_PASSWORD_RESET", entityType: "User", entityId: token.userId } }),
  ]);

  return NextResponse.json({ message: "Mot de passe modifié. Vous pouvez vous connecter." });
}
