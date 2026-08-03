export type CheckoutInput = {
  userId: string;
  customerEmail: string;
  planId: string;
  planSlug: string;
  planName: string;
  priceCents: number;
  successUrl: string;
  cancelUrl: string;
};

export interface PaymentGateway {
  createSubscriptionCheckout(input: CheckoutInput): Promise<{ url: string }>;
}
