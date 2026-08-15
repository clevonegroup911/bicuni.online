import Stripe from "stripe";
import type { CheckoutInput, PaymentGateway } from "@/lib/payments/types";

const STRIPE_INTERVALS = ["day", "week", "month", "year"] as const;

export function stripeRecurringPrice(input: Pick<CheckoutInput, "priceCents" | "currency" | "interval">) {
  const currency = input.currency.trim().toLowerCase();
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents <= 0) {
    throw new Error("Le montant du plan doit être un entier positif.");
  }
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error("La devise du plan doit être un code ISO à trois lettres.");
  }
  if (!STRIPE_INTERVALS.includes(input.interval as (typeof STRIPE_INTERVALS)[number])) {
    throw new Error("L’intervalle du plan n’est pas pris en charge par Stripe.");
  }
  return {
    currency,
    unit_amount: input.priceCents,
    recurring: { interval: input.interval as (typeof STRIPE_INTERVALS)[number] },
  };
}

let stripeClient: Stripe | undefined;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY n’est pas configurée.");
  stripeClient ??= new Stripe(secretKey, { appInfo: { name: "BICUNI.ONLINE", version: "2.0.0" } });
  return stripeClient;
}

export class StripeGateway implements PaymentGateway {
  async createSubscriptionCheckout(input: CheckoutInput) {
    const price = stripeRecurringPrice(input);
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      customer_email: input.customerEmail,
      client_reference_id: input.userId,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      line_items: [{
        quantity: 1,
        price_data: {
          ...price,
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
