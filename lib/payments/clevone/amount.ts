import { destinationFor, type PaymentChannelId } from "./accounts";
import { convertUsdCentsToCdfCents, type FrozenUsdCdfRate } from "./fx";
import { ClevonePaymentError } from "./types";

export function quoteChannelAmount(input: {
  priceCents: number;
  currency: string;
  channel: PaymentChannelId;
  usdCdfRate?: FrozenUsdCdfRate | null;
}) {
  const destination = destinationFor(input.channel);
  const planCurrency = input.currency.trim().toUpperCase();
  if (!Number.isSafeInteger(input.priceCents) || input.priceCents <= 0) {
    throw new ClevonePaymentError("Montant de plan invalide.", 400, "VALIDATION");
  }
  if (destination.currency === planCurrency) {
    return { amountCents: input.priceCents, currency: destination.currency, destination, fx: null as FrozenUsdCdfRate | null };
  }
  if (planCurrency === "USD" && destination.currency === "CDF") {
    if (!input.usdCdfRate) {
      throw new ClevonePaymentError(
        "Le paiement CDF est indisponible : aucun taux USD/CDF approuvé. Le paiement USD reste disponible.",
        503,
        "UNCONFIGURED",
      );
    }
    return {
      amountCents: convertUsdCentsToCdfCents(input.priceCents, input.usdCdfRate.rateUnits),
      currency: "CDF" as const,
      destination,
      fx: input.usdCdfRate,
    };
  }
  throw new ClevonePaymentError("Ce canal n’accepte pas la devise du plan.", 400, "VALIDATION");
}

export function providerFromChannel(channel: PaymentChannelId) {
  return channel === "MPESA" ? "MPESA" as const : "RAWBANK" as const;
}
