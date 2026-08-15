import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { consumeAuthAttempt, requestIdentity } from "@/lib/auth/rate-limit";
import { createOpaqueToken, hashToken, tokenExpiry } from "@/lib/auth/tokens";
import { forgotPasswordSchema } from "@/lib/auth/validators";
import { authEmailTemplate, sendEmail } from "@/lib/email/service";
import { publicOrigin } from "@/lib/http/public-origin";

const neutralMessage = "Si ce compte attend une vérification, un nouvel email vient d’être envoyé.";

export async function POST(request: Request) {
  if (!await consumeAuthAttempt(`verify-resend:${requestIdentity(request)}`, 5)) return NextResponse.json({ message: neutralMessage }, { status: 202 });
  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: neutralMessage }, { status: 202 });
  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, email: true, emailVerified: true, status: true } });
  if (!user || user.emailVerified || user.status !== "PENDING") return NextResponse.json({ message: neutralMessage }, { status: 202 });

  const token = createOpaqueToken();
  await db.$transaction([
    db.verificationToken.deleteMany({ where: { identifier: user.email } }),
    db.verificationToken.create({ data: { identifier: user.email, token: hashToken(token), expires: tokenExpiry(24) } }),
  ]);
  const verificationUrl = `${publicOrigin(request)}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(user.email)}`;
  await sendEmail({
    to: user.email,
    subject: "Vérifiez votre adresse BICUNI",
    html: authEmailTemplate("Vérification BICUNI", "Ce nouveau lien est valable pendant 24 heures.", "Vérifier mon adresse", verificationUrl),
  });
  return NextResponse.json({ message: neutralMessage }, { status: 202 });
}
