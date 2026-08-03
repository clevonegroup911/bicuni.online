import Stripe from "stripe";
import type { CheckoutInput, PaymentGateway } from "@/lib/payments/types";

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY n’est pas configurée.");
  stripeClient ??= new Stripe(secretKey, { appInfo: { name: "BICUNI.ONLINE", version: "2.0.0" } });
  return stripeClient;
}

export class StripeGateway implements PaymentGateway {
  async createSubscriptionCheckout(input: CheckoutInput) {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: input.customerEmail,
      client_reference_id: input.userId,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      line_items: [{
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: input.priceCents,
          recurring: { interval: "month" },
          product_data: { name: `BICUNI — ${input.planName}` },
        },
      }],
      metadata: { userId: input.userId, planId: input.planId, planSlug: input.planSlug },
      subscription_data: {
        metadata: { userId: input.userId, planId: input.planId, planSlug: input.planSlug },
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe n’a pas retourné d’URL Checkout.");
    return { url: session.url };
  }
}
