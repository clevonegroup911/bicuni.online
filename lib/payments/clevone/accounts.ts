export const PAYMENT_CHANNELS = ["MPESA", "RAWBANK_CDF", "RAWBANK_USD"] as const;
export type PaymentChannelId = (typeof PAYMENT_CHANNELS)[number];

export type ClevoneDestination = {
  channel: PaymentChannelId;
  label: string;
  holder: string;
  account: string;
  currency: "USD" | "CDF";
  swift?: string;
  instructionsFr: string;
  instructionsEn: string;
};

export type ClevoneAccounts = {
  holder: string;
  swift: string;
  destinations: Record<PaymentChannelId, ClevoneDestination>;
};

const HOLDER = "CLEVONE JEAMSON EROISH";
const MPESA = "+243828320130";
const RAWBANK_CDF = "15150-00978276003-95";
const RAWBANK_USD = "15150-00978276002-01";
const SWIFT = "RAWBCDKI";

function envOr(name: string, fallback: string) {
  const value = process.env[name]?.trim();
  return value || fallback;
}

function digitsPhone(value: string) {
  const compact = value.replace(/[^\d+]/g, "");
  if (!/^\+243\d{9}$/.test(compact)) {
    throw new Error("Le numéro M-PESA CLEVONE est invalide.");
  }
  return compact;
}

function rawbankAccount(value: string) {
  const compact = value.replace(/\s+/g, "");
  if (!/^\d{5}-\d{11}-\d{2}$/.test(compact)) {
    throw new Error("Le compte RAWBANK CLEVONE est invalide.");
  }
  return compact;
}

function swiftCode(value: string) {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{4}CD[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(compact)) {
    throw new Error("Le code SWIFT CLEVONE est invalide.");
  }
  return compact;
}

function holderName(value: string) {
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 5 || name.length > 80) {
    throw new Error("Le titulaire CLEVONE est invalide.");
  }
  return name;
}

function allowAccountOverride() {
  return process.env.NODE_ENV !== "production";
}

export function formatMpesaDisplay(msisdn: string) {
  const compact = digitsPhone(msisdn);
  return compact.replace(/^\+243(\d{3})(\d{3})(\d{3})$/, "+243 $1 $2 $3");
}

export function getClevoneAccounts(): ClevoneAccounts {
  const holder = holderName(allowAccountOverride() ? envOr("CLEVONE_ACCOUNT_HOLDER", HOLDER) : HOLDER);
  const swift = swiftCode(allowAccountOverride() ? envOr("CLEVONE_RAWBANK_SWIFT", SWIFT) : SWIFT);
  const mpesa = formatMpesaDisplay(allowAccountOverride() ? envOr("CLEVONE_MPESA_MSISDN", MPESA) : MPESA);
  const cdf = rawbankAccount(allowAccountOverride() ? envOr("CLEVONE_RAWBANK_CDF", RAWBANK_CDF) : RAWBANK_CDF);
  const usd = rawbankAccount(allowAccountOverride() ? envOr("CLEVONE_RAWBANK_USD", RAWBANK_USD) : RAWBANK_USD);

  return {
    holder,
    swift,
    destinations: {
      MPESA: {
        channel: "MPESA",
        label: "M-PESA",
        holder,
        account: mpesa,
        currency: "CDF",
        instructionsFr: "Envoyez le montant exact vers ce numéro M-PESA, puis indiquez la référence de facture dans le message.",
        instructionsEn: "Send the exact amount to this M-PESA number, then include the invoice reference in the message.",
      },
      RAWBANK_CDF: {
        channel: "RAWBANK_CDF",
        label: "RAWBANK CDF",
        holder,
        account: cdf,
        currency: "CDF",
        swift,
        instructionsFr: "Virement RAWBANK en francs congolais uniquement vers ce compte CDF.",
        instructionsEn: "RAWBANK transfer in Congolese francs only to this CDF account.",
      },
      RAWBANK_USD: {
        channel: "RAWBANK_USD",
        label: "RAWBANK USD",
        holder,
        account: usd,
        currency: "USD",
        swift,
        instructionsFr: "Virement RAWBANK en dollars américains uniquement vers ce compte USD.",
        instructionsEn: "RAWBANK transfer in US dollars only to this USD account.",
      },
    },
  };
}

export function destinationFor(channel: PaymentChannelId) {
  return getClevoneAccounts().destinations[channel];
}

export function isPaymentChannel(value: string): value is PaymentChannelId {
  return PAYMENT_CHANNELS.some((channel) => channel === value);
}

export function normalizeAccount(value: string) {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

export function accountsMatch(expected: string, submitted: string) {
  return normalizeAccount(expected) === normalizeAccount(submitted);
}
