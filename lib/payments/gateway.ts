import type { PaymentProvider } from "@prisma/client";
import type { PaymentGateway } from "@/lib/payments/types";
import { StripeGateway } from "@/lib/payments/stripe";

export function paymentGateway(provider: PaymentProvider): PaymentGateway {
  if (provider === "STRIPE") return new StripeGateway();
  throw new Error(`Le fournisseur ${provider} n’est pas encore activé.`);
}
