import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { paymentGateway } from "@/lib/payments/gateway";
import { publicOrigin } from "@/lib/http/public-origin";

const checkoutSchema = z.object({ planSlug: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Plan invalide." }, { status: 400 });

  const plan = await db.plan.findUnique({ where: { slug: parsed.data.planSlug } });
  if (!plan?.active) return NextResponse.json({ error: "Ce plan n’est pas disponible." }, { status: 404 });

  const origin = publicOrigin(request);
  const suppliedKey = request.headers.get("idempotency-key")?.trim();
  if (suppliedKey && !/^[a-zA-Z0-9:_-]{8,128}$/.test(suppliedKey)) {
    return NextResponse.json({ error: "Clé d’idempotence invalide." }, { status: 400 });
  }
  const requestKey = suppliedKey ?? `window:${Math.floor(Date.now() / 300_000)}`;
  const idempotencyKey = createHash("sha256").update(`checkout:${session.user.id}:${plan.id}:${requestKey}`).digest("hex");
  const checkout = await paymentGateway("STRIPE").createSubscriptionCheckout({
    userId: session.user.id,
    customerEmail: session.user.email,
    planId: plan.id,
    planSlug: plan.slug,
    planName: plan.name,
    priceCents: plan.priceCents,
    currency: plan.currency,
    interval: plan.interval,
    successUrl: `${origin}/dashboard?checkout=success`,
    cancelUrl: `${origin}/pricing?checkout=canceled`,
    idempotencyKey,
  });
  return NextResponse.json(checkout);
}
