import { NextResponse } from "next/server";
import { z } from "zod";
import { AdminAuthorizationError, requireAdminApi } from "@/lib/admin/guard";
import { db } from "@/lib/db/client";
import { auditRequestContext } from "@/lib/admin/context";
import { decryptSecret, encryptSecret, generateRecoveryCodes, generateTotpSecret, otpauthUrl, verifyTotp } from "@/lib/payments/clevone/totp";

const confirmSchema = z.object({ totp: z.string().regex(/^\d{6}$/) });

export async function GET(request: Request) {
  try {
    const actor = await requireAdminApi("admin:payments:confirm", request);
    const user = await db.user.findUnique({ where: { id: actor.id }, select: { mfaEnabled: true, mfaEnrolledAt: true } });
    return NextResponse.json({ enabled: Boolean(user?.mfaEnabled), enrolledAt: user?.mfaEnrolledAt ?? null });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireAdminApi("admin:payments:confirm", request);
    const url = new URL(request.url);
    if (url.searchParams.get("confirm") === "1") {
      const parsed = confirmSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return NextResponse.json({ error: "Code MFA invalide." }, { status: 400 });
      const user = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, mfaSecretEnc: true, mfaEnabled: true } });
      if (!user?.mfaSecretEnc) return NextResponse.json({ error: "Aucun secret MFA en attente." }, { status: 409 });
      if (!verifyTotp(decryptSecret(user.mfaSecretEnc), parsed.data.totp)) {
        return NextResponse.json({ error: "Code MFA invalide." }, { status: 403 });
      }
      const recovery = generateRecoveryCodes();
      await db.user.update({
        where: { id: actor.id },
        data: { mfaEnabled: true, mfaEnrolledAt: new Date(), mfaRecoveryHashes: recovery.hashes, mfaFailedAttempts: 0, mfaLockedUntil: null },
      });
      await db.auditLog.create({
        data: { actorId: actor.id, action: "ADMIN_MFA_ENABLED", entityType: "User", entityId: actor.id, ...auditRequestContext(request) },
      });
      return NextResponse.json({ enabled: true, recoveryCodes: recovery.codes });
    }

    const user = await db.user.findUnique({ where: { id: actor.id }, select: { email: true, mfaEnabled: true } });
    if (!user) return NextResponse.json({ error: "Compte introuvable." }, { status: 404 });
    if (user.mfaEnabled) return NextResponse.json({ error: "MFA déjà actif." }, { status: 409 });
    const secret = generateTotpSecret();
    await db.user.update({ where: { id: actor.id }, data: { mfaSecretEnc: encryptSecret(secret), mfaEnabled: false } });
    return NextResponse.json({ otpauth: otpauthUrl(user.email, secret) });
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
