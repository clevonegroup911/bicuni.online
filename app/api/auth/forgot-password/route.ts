import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { denyIfRateLimited, requestIdentity } from "@/lib/auth/rate-limit";
import { createOpaqueToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { forgotPasswordSchema } from "@/lib/auth/validators";
import { authEmailTemplate, sendEmail } from "@/lib/email/service";
import { publicOrigin } from "@/lib/http/public-origin";

const neutralMessage = "Si un compte correspond à cette adresse, un email vient d’être envoyé.";

export async function POST(request: Request) {
  const limited = await denyIfRateLimited(
    `forgot:${requestIdentity(request)}`,
    5,
    undefined,
    () => NextResponse.json({ message: neutralMessage }, { status: 202 }),
  );
  if (limited) return limited;
  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: neutralMessage }, { status: 202 });

  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return NextResponse.json({ message: neutralMessage }, { status: 202 });

  const token = createOpaqueToken();
  await db.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await db.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashToken(token), expires: tokenExpiry(1) },
  });

  const baseUrl = publicOrigin(request);
  const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: user.email,
    subject: "Réinitialisation de votre mot de passe BICUNI",
    html: authEmailTemplate("Réinitialiser votre mot de passe", "Ce lien est valable pendant une heure.", "Choisir un nouveau mot de passe", resetUrl),
  });

  return NextResponse.json({ message: neutralMessage }, { status: 202 });
}
