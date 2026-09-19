import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { db } from "@/lib/db/client";
import { assertRateUnits, USD_CDF_PAIR } from "@/lib/payments/clevone/fx";
import { decryptSecret, mfaRequiredForConfirm, verifyTotp } from "@/lib/payments/clevone/totp";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { assertSameOrigin, paymentErrorResponse } from "@/lib/payments/clevone/http";

const proposeSchema = z.object({
  rateUnits: z.number().int(),
  source: z.string().trim().min(4).max(120),
  effectiveAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  reason: z.string().min(8).max(500),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

function assertFinancialMfa(actor: { mfaEnabled: boolean; mfaSecretEnc: string | null }, totp?: string) {
  if (!mfaRequiredForConfirm() && !actor.mfaEnabled) return;
  if (!actor.mfaEnabled || !actor.mfaSecretEnc) {
    throw new ClevonePaymentError("MFA administrateur requis pour cette action financière.", 403, "FORBIDDEN");
  }
  if (!totp || !verifyTotp(decryptSecret(actor.mfaSecretEnc), totp)) {
    throw new ClevonePaymentError("Code MFA invalide.", 403, "FORBIDDEN");
  }
}

export async function GET(request: Request) {
  try {
    await requireAdminApi("admin:payments:read", request);
    const rates = await db.fxRate.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        pair: true,
        rateUnits: true,
        source: true,
        effectiveAt: true,
        expiresAt: true,
        status: true,
        enteredById: true,
        approvedById: true,
        approvedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ rates });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return paymentErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdminApi("admin:payments:review", request);
    const parsed = proposeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Taux invalide." }, { status: 400 });
    assertFinancialMfa(actor, parsed.data.totp);
    const rateUnits = assertRateUnits(parsed.data.rateUnits);
    const effectiveAt = new Date(parsed.data.effectiveAt);
    const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;
    if (expiresAt && expiresAt <= effectiveAt) {
      return NextResponse.json({ error: "La date d’expiration doit être postérieure à la date d’effet." }, { status: 400 });
    }
    const created = await db.fxRate.create({
      data: {
        pair: USD_CDF_PAIR,
        rateUnits,
        source: parsed.data.source,
        effectiveAt,
        expiresAt,
        enteredById: actor.id,
        status: "PENDING_APPROVAL",
      },
    });
    await db.auditLog.create({
      data: {
        actorId: actor.id,
        action: "CLEVONE_FX_PROPOSED",
        entityType: "FxRate",
        entityId: created.id,
        newValue: { rateUnits, source: parsed.data.source, effectiveAt, reason: parsed.data.reason },
        ...auditRequestContext(request),
      },
    });
    return NextResponse.json({ id: created.id, status: created.status });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return paymentErrorResponse(error);
  }
}
