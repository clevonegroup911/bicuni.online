import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { paymentGateway } from "@/lib/payments/gateway";

const checkoutSchema = z.object({ planSlug: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });

  const parsed = checkoutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Plan invalide." }, { status: 400 });

  const plan = await db.plan.findUnique({ where: { slug: parsed.data.planSlug } });
  if (!plan?.active) return NextResponse.json({ error: "Ce plan n’est pas disponible." }, { status: 404 });

  const origin = process.env.AUTH_URL ?? new URL(request.url).origin;
  const checkout = await paymentGateway("STRIPE").createSubscriptionCheckout({
    userId: session.user.id,
    customerEmail: session.user.email,
    planId: plan.id,
    planSlug: plan.slug,
    planName: plan.name,
    priceCents: plan.priceCents,
    successUrl: `${origin}/dashboard?checkout=success`,
    cancelUrl: `${origin}/pricing?checkout=canceled`,
  });
  return NextResponse.json(checkout);
}
