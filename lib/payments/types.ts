export type CheckoutInput = {
  userId: string;
  customerEmail: string;
  planId: string;
  planSlug: string;
  planName: string;
  priceCents: number;
  currency: string;
  interval: string;
  successUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
};

export interface PaymentGateway {
  createSubscriptionCheckout(input: CheckoutInput): Promise<{ url: string }>;
}
