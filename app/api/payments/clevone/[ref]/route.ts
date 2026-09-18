import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { clevonePayments } from "@/lib/payments/clevone/service";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { getClevoneAccounts } from "@/lib/payments/clevone/accounts";
import { paymentErrorResponse } from "@/lib/payments/clevone/http";
import { maskEmail, maskPhone } from "@/lib/payments/clevone/references";

export async function GET(_request: Request, context: { params: Promise<{ ref: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    const { ref } = await context.params;
    const actor = await db.user.findUnique({ where: { id: session.user.id }, select: { id: true, role: true } });
    const admin = Boolean(actor && can(actor.role, "admin:payments:read"));
    const intent = await clevonePayments.getByPublicRef(ref, { id: session.user.id, admin });
    const accounts = getClevoneAccounts();
    const latest = intent.attempts[0];
    return NextResponse.json({
      publicRef: intent.publicRef,
      status: intent.status,
      matchClass: intent.matchClass,
      riskLevel: intent.riskLevel,
      amountCents: intent.amountCents,
      currency: intent.currency,
      channel: intent.channel,
      expiresAt: intent.expiresAt,
      planName: intent.plan.name,
      destination: accounts.destinations[intent.channel],
      holder: accounts.holder,
      swift: accounts.swift,
      receipt: intent.receipt ? { number: intent.receipt.publicNumber, fingerprint: intent.receipt.fingerprint, confirmedAt: intent.receipt.confirmedAt } : null,
      latestAttempt: latest ? {
        payerName: latest.payerName,
        payerPhone: maskPhone(latest.payerPhone),
        providerTxnRef: latest.providerTxnRef,
        paidAtClient: latest.paidAtClient,
      } : null,
      payerEmail: admin ? maskEmail(intent.user.email) : undefined,
      proofNotPaid: true,
    });
  } catch (error) {
    if (error instanceof ClevonePaymentError) return paymentErrorResponse(error);
    throw error;
  }
}
