import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { denyIfRateLimited, requestIdentity } from "@/lib/auth/rate-limit";
import { PAYMENT_CHANNELS } from "@/lib/payments/clevone/accounts";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { assertSameOrigin, idempotencyKeyFrom, paymentErrorResponse } from "@/lib/payments/clevone/http";
import { logger } from "@/lib/observability/logger";

const schema = z.object({
  planSlug: z.string().min(1).max(64),
  channel: z.enum(PAYMENT_CHANNELS),
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const session = await auth();
    if (!session?.user?.id || !session.user.email) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }
    const limited = await denyIfRateLimited(`clevone-checkout:${session.user.id}:${requestIdentity(request)}`, 8, 60_000);
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données de commande invalides." }, { status: 400 });
    const idempotencyKey = idempotencyKeyFrom(request, `clevone:${session.user.id}:${parsed.data.planSlug}:${parsed.data.channel}`);
    const result = await clevonePayments.createCheckout({
      userId: session.user.id,
      userEmail: session.user.email,
      planSlug: parsed.data.planSlug,
      channel: parsed.data.channel,
      idempotencyKey,
    });
    return NextResponse.json({
      url: `/pay/${result.publicRef}`,
      publicRef: result.publicRef,
      reused: result.reused,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "ClevonePaymentError") return paymentErrorResponse(error);
    logger.error("clevone.checkout.error", error);
    return paymentErrorResponse(error);
  }
}
