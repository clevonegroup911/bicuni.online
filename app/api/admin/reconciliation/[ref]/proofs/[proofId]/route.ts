import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { paymentErrorResponse } from "@/lib/payments/clevone/http";

export async function GET(request: Request, context: { params: Promise<{ ref: string; proofId: string }> }) {
  try {
    const actor = await requireAdminApi("admin:payments:read", request);
    const { proofId } = await context.params;
    const url = await clevonePayments.signedProofUrl(proofId, { id: actor.id, admin: true });
    return NextResponse.json({ url, expiresInSeconds: 300 });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return paymentErrorResponse(error);
  }
}
