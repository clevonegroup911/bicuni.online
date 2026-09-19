import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { getStripe } from "@/lib/payments/stripe";
import { paymentGateway } from "@/lib/payments/gateway";
import { publicOrigin } from "@/lib/http/public-origin";
import { logger } from "@/lib/observability/logger";
import { stripeConfiguredFromEnv } from "@/lib/billing/contracts";

const checkoutSchema = z.object({ planSlug: z.string().min(1).max(64) });

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.email || !session.user.id) {
      return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
    }

    const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Plan invalide." }, { status: 400 });

    if (!stripeConfiguredFromEnv()) {
      return NextResponse.json(
        { error: "Le paiement n’est pas encore configuré sur ce serveur." },
        { status: 503 },
      );
    }

    const plan = await db.plan.findUnique({ where: { slug: parsed.data.planSlug } });
    if (!plan?.active) return NextResponse.json({ error: "Ce plan n’est pas disponible." }, { status: 404 });
    if (!Number.isSafeInteger(plan.priceCents) || plan.priceCents <= 0) {
      return NextResponse.json({ error: "Ce plan n’est pas facturable en ligne." }, { status: 400 });
    }

    const origin = publicOrigin(request);
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { stripeCustomerId: true },
    });

    const activeSubscription = await db.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: { in: ["ACTIVE", "PAST_DUE"] },
      },
      select: { id: true },
    });

    if (activeSubscription && user?.stripeCustomerId) {
      const portal = await getStripe().billingPortal.sessions.create({
        customer: user.stripeCustomerId,
        return_url: `${origin}/dashboard/subscription`,
      });
      if (!portal.url) {
        return NextResponse.json({ error: "Impossible d’ouvrir le portail client." }, { status: 502 });
      }
      return NextResponse.json({ url: portal.url, mode: "portal" });
    }

    const suppliedKey = request.headers.get("idempotency-key")?.trim();
    if (suppliedKey && !/^[a-zA-Z0-9:_-]{8,128}$/.test(suppliedKey)) {
      return NextResponse.json({ error: "Clé d’idempotence invalide." }, { status: 400 });
    }
    const requestKey = suppliedKey ?? `window:${Math.floor(Date.now() / 300_000)}`;
    const idempotencyKey = createHash("sha256")
      .update(`checkout:${session.user.id}:${plan.id}:${requestKey}`)
      .digest("hex");

    const checkout = await paymentGateway("STRIPE").createSubscriptionCheckout({
      userId: session.user.id,
      customerEmail: session.user.email,
      planId: plan.id,
      planSlug: plan.slug,
      planName: plan.name,
      priceCents: plan.priceCents,
      currency: plan.currency,
      interval: plan.interval,
      successUrl: `${origin}/dashboard/subscription?checkout=success`,
      cancelUrl: `${origin}/pricing?checkout=canceled`,
      idempotencyKey,
    });

    return NextResponse.json({ ...checkout, mode: "checkout" });
  } catch (error) {
    logger.error("payments.checkout.error", error);
    return NextResponse.json(
      { error: "Impossible de créer la session de paiement." },
      { status: 502 },
    );
  }
}
