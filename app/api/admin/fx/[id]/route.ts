import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { auditRequestContext } from "@/lib/admin/context";
import { db } from "@/lib/db/client";
import { decryptSecret, mfaRequiredForConfirm, verifyTotp } from "@/lib/payments/clevone/totp";
import { ClevonePaymentError } from "@/lib/payments/clevone/types";
import { assertSameOrigin, paymentErrorResponse } from "@/lib/payments/clevone/http";

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().min(8).max(500),
  totp: z.string().regex(/^\d{6}$/).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const actor = await requireAdminApi("admin:payments:confirm", request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Décision de taux invalide." }, { status: 400 });
    if (mfaRequiredForConfirm() || actor.mfaEnabled) {
      if (!actor.mfaEnabled || !actor.mfaSecretEnc || !parsed.data.totp || !verifyTotp(decryptSecret(actor.mfaSecretEnc), parsed.data.totp)) {
        throw new ClevonePaymentError("Code MFA invalide.", 403, "FORBIDDEN");
      }
    }
    const { id } = await context.params;
    const rate = await db.fxRate.findUnique({ where: { id } });
    if (!rate) return NextResponse.json({ error: "Taux introuvable." }, { status: 404 });
    if (rate.status !== "PENDING_APPROVAL") return NextResponse.json({ error: "Ce taux n’est plus en attente." }, { status: 409 });
    if (rate.enteredById === actor.id) {
      throw new ClevonePaymentError("Le second contrôle du taux doit être effectué par un autre administrateur.", 403, "FORBIDDEN");
    }

    if (parsed.data.action === "REJECT") {
      await db.fxRate.update({ where: { id }, data: { status: "REJECTED", approvedById: actor.id, approvedAt: new Date() } });
      await db.auditLog.create({
        data: {
          actorId: actor.id,
          action: "CLEVONE_FX_REJECTED",
          entityType: "FxRate",
          entityId: id,
          oldValue: { status: rate.status, rateUnits: rate.rateUnits },
          newValue: { status: "REJECTED", reason: parsed.data.reason },
          ...auditRequestContext(request),
        },
      });
      return NextResponse.json({ id, status: "REJECTED" });
    }

    await db.$transaction(async (tx) => {
      await tx.fxRate.updateMany({
        where: { pair: rate.pair, status: "ACTIVE", id: { not: id } },
        data: { status: "SUPERSEDED" },
      });
      await tx.fxRate.update({
        where: { id },
        data: { status: "ACTIVE", approvedById: actor.id, approvedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          action: "CLEVONE_FX_ACTIVATED",
          entityType: "FxRate",
          entityId: id,
          oldValue: { status: rate.status, rateUnits: rate.rateUnits },
          newValue: { status: "ACTIVE", rateUnits: rate.rateUnits, reason: parsed.data.reason },
          ...auditRequestContext(request),
        },
      });
    });
    return NextResponse.json({ id, status: "ACTIVE" });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    return paymentErrorResponse(error);
  }
}
