import { NextResponse } from "next/server";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { clevonePayments } from "@/lib/payments/clevone/service";
import type { PaymentChannel, PaymentIntentStatus, PaymentRiskLevel } from "@prisma/client";

export async function GET(request: Request) {
  try {
    await requireAdminApi("admin:payments:read", request);
    const url = new URL(request.url);
    const status = url.searchParams.get("status") as PaymentIntentStatus | null;
    const channel = url.searchParams.get("channel") as PaymentChannel | null;
    const currency = url.searchParams.get("currency");
    const riskLevel = url.searchParams.get("risk") as PaymentRiskLevel | null;
    const q = url.searchParams.get("q") ?? undefined;
    const page = Number(url.searchParams.get("page") || "1");
    const result = await clevonePayments.listAdmin({
      status: status || undefined,
      channel: channel || undefined,
      currency: currency || undefined,
      riskLevel: riskLevel || undefined,
      q,
      page,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminAuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
