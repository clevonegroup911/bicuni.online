import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { assertSameOrigin, paymentErrorResponse } from "@/lib/payments/clevone/http";
import { logger } from "@/lib/observability/logger";

const schema = z.object({ proofId: z.string().min(1).max(64) });

export async function PATCH(request: Request, context: { params: Promise<{ ref: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const { ref } = await context.params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Identifiant de preuve invalide." }, { status: 400 });
    const result = await clevonePayments.confirmProof({
      publicRef: ref,
      userId: session.user.id,
      proofId: parsed.data.proofId,
    });
    return NextResponse.json(result, { status: result.scanStatus === "CLEAN" ? 200 : 202 });
  } catch (error) {
    if (!(error instanceof ClevonePaymentError)) logger.error("clevone.proof.confirm_error", error);
    return paymentErrorResponse(error);
  }
}
