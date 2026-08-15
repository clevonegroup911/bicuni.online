import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";
import { getStripe } from "@/lib/payments/stripe";
import { publicOrigin } from "@/lib/http/public-origin";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  if (!process.env.STRIPE_SECRET_KEY?.trim()) return NextResponse.json({ error: "Stripe n’est pas configuré." }, { status: 503 });
  const user = await db.user.findUnique({ where: { id: session.user.id }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return NextResponse.json({ error: "Aucun compte de facturation Stripe." }, { status: 404 });
  const portal = await getStripe().billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${publicOrigin(request)}/dashboard/subscription`,
  });
  return NextResponse.json({ url: portal.url });
}
