import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { getStripe } from "@/lib/payments/stripe";

const cancelSchema = z.object({ atPeriodEnd: z.literal(true) }).strict();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const parsed = cancelSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Seule l’annulation en fin de période est autorisée." }, { status: 400 });
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return NextResponse.json({ error: "Stripe n’est pas configuré." }, { status: 503 });
  const subscription = await db.subscription.findFirst({
    where: { userId: session.user.id, provider: "STRIPE", status: { in: ["ACTIVE", "PAST_DUE"] } },
    orderBy: { createdAt: "desc" },
  });
  if (!subscription?.providerRef) return NextResponse.json({ error: "Abonnement Stripe introuvable." }, { status: 404 });
  if (subscription.cancelAtPeriodEnd) return NextResponse.json({ subscription, unchanged: true });

  const idempotencyKey = createHash("sha256").update(`bicuni:cancel:${session.user.id}:${subscription.providerRef}`).digest("hex");
  const remote = await getStripe().subscriptions.update(subscription.providerRef, { cancel_at_period_end: true }, { idempotencyKey });
  const updated = await db.subscription.update({
    where: { id: subscription.id },
    data: { cancelAtPeriodEnd: true, currentPeriodEnd: new Date(remote.current_period_end * 1_000) },
  });
  await db.auditLog.create({ data: { actorId: session.user.id, action: "SUBSCRIPTION_CANCEL_SCHEDULED", entityType: "Subscription", entityId: subscription.id } });
  return NextResponse.json({ subscription: updated });
}
