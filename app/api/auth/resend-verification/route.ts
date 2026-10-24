import { NextResponse } from "next/server";
import { denyIfRateLimited, requestIdentity } from "@/lib/auth/rate-limit";
import { RESEND_NEUTRAL_MESSAGE, resendVerificationForEmail } from "@/lib/auth/email-verification";
import { forgotPasswordSchema } from "@/lib/auth/validators";
import { publicOrigin } from "@/lib/http/public-origin";
import { logger } from "@/lib/observability/logger";

export async function POST(request: Request) {
  const limited = await denyIfRateLimited(
    `verify-resend:${requestIdentity(request)}`,
    5,
    undefined,
    () => NextResponse.json({ message: RESEND_NEUTRAL_MESSAGE }, { status: 202 }),
  );
  if (limited) return limited;

  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: RESEND_NEUTRAL_MESSAGE }, { status: 202 });
  }

  try {
    await resendVerificationForEmail({
      email: parsed.data.email,
      baseUrl: publicOrigin(request),
    });
  } catch (error) {
    logger.error("email.verification_resend_route_failed", error);
    // Réponse neutre : ne pas révéler l’échec d’envoi ni l’existence du compte.
    return NextResponse.json({ message: RESEND_NEUTRAL_MESSAGE }, { status: 202 });
  }

  return NextResponse.json({ message: RESEND_NEUTRAL_MESSAGE }, { status: 202 });
}
