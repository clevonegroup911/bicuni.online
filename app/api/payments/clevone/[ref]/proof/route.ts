import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { denyIfRateLimited, requestIdentity } from "@/lib/auth/rate-limit";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { ClevonePaymentError, MAX_PROOF_BYTES } from "@/lib/payments/clevone/types";
import { assertSameOrigin, paymentErrorResponse } from "@/lib/payments/clevone/http";
import { logger } from "@/lib/observability/logger";

const schema = z.object({
  payerName: z.string().min(2).max(80),
  payerPhone: z.string().min(8).max(20),
  providerTxnRef: z.string().min(4).max(64),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3),
  paidAtClient: z.string().min(10).max(40),
  destinationAccount: z.string().min(4).max(64).optional().default(""),
  invoiceRef: z.string().min(4).max(64),
  fileName: z.string().min(1).max(180),
  mimeType: z.enum(["image/jpeg", "image/png", "application/pdf"]),
  sizeBytes: z.number().int().positive().max(MAX_PROOF_BYTES),
});

export async function POST(request: Request, context: { params: Promise<{ ref: string }> }) {
  try {
    assertSameOrigin(request);
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const { ref } = await context.params;
    const limited = await denyIfRateLimited(`clevone-proof:${session.user.id}:${requestIdentity(request)}`, 10, 60 * 60_000);
    if (limited) return limited;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Données de preuve invalides." }, { status: 400 });
    const result = await clevonePayments.submitProof({
      publicRef: ref,
      userId: session.user.id,
      ...parsed.data,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (!(error instanceof ClevonePaymentError)) logger.error("clevone.proof.submit_error", error);
    return paymentErrorResponse(error);
  }
}
