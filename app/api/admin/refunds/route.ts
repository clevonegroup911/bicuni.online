import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { idempotencyKeyFrom, paymentErrorResponse } from "@/lib/payments/clevone/http";

const schema = z.object({
  publicRef: z.string().min(8).max(40),
  reason: z.string().min(8).max(500),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("admin:payments:confirm", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Demande de remboursement invalide." }, { status: 400 });
    const refund = await clevonePayments.refund({
      publicRef: parsed.data.publicRef,
      actorId: actor.id,
      reason: parsed.data.reason,
      idempotencyKey: idempotencyKeyFrom(request, `refund:${actor.id}:${parsed.data.publicRef}`),
      mfaEnabled: actor.mfaEnabled,
      mfaSecretEnc: actor.mfaSecretEnc,
      totp: parsed.data.totp,
      context: auditRequestContext(request),
    });
    return NextResponse.json({
      id: refund.id,
      status: refund.status,
      note: "Remboursement enregistré dans BICUNI. Aucun virement bancaire n’a été déclenché automatiquement.",
    });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return paymentErrorResponse(error);
  }
}
