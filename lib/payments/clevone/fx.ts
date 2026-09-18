import { ClevonePaymentError } from "./types";
import type { PrismaClient } from "@prisma/client";

export const USD_CDF_PAIR = "USD_CDF";
export const MIN_USD_CDF_RATE = 1;
export const MAX_USD_CDF_RATE = 50_000;

export type FrozenUsdCdfRate = {
  rateId: string;
  pair: typeof USD_CDF_PAIR;
  rateUnits: number;
  source: string;
  effectiveAt: Date;
  expiresAt: Date | null;
};

/**
 * Arrondi documenté : le taux est un entier « CDF pour 1 USD ».
 * Montant CDF (unités minimales) = Math.round(montant_USD_centimes * taux).
 * Exemple : 200 centimes USD × 2850 = 570 000 centimes CDF.
 * Le taux n’est jamais interpolé ni inventé.
 */
export function convertUsdCentsToCdfCents(usdCents: number, cdfPerUsd: number) {
  if (!Number.isSafeInteger(usdCents) || usdCents <= 0) {
    throw new ClevonePaymentError("Montant USD invalide.", 400, "VALIDATION");
  }
  if (!Number.isSafeInteger(cdfPerUsd) || cdfPerUsd < MIN_USD_CDF_RATE || cdfPerUsd > MAX_USD_CDF_RATE) {
    throw new ClevonePaymentError("Taux USD/CDF invalide.", 400, "VALIDATION");
  }
  return Math.round(usdCents * cdfPerUsd);
}

export function assertRateUnits(rateUnits: number) {
  if (!Number.isSafeInteger(rateUnits) || rateUnits < MIN_USD_CDF_RATE || rateUnits > MAX_USD_CDF_RATE) {
    throw new ClevonePaymentError("Le taux USD/CDF doit être un entier positif borné.", 400, "VALIDATION");
  }
  return rateUnits;
}

export async function getActiveUsdCdfRate(
  db: Pick<PrismaClient, "fxRate">,
  at = new Date(),
): Promise<FrozenUsdCdfRate | null> {
  const row = await db.fxRate.findFirst({
    where: {
      pair: USD_CDF_PAIR,
      status: "ACTIVE",
      effectiveAt: { lte: at },
      OR: [{ expiresAt: null }, { expiresAt: { gt: at } }],
    },
    orderBy: [{ approvedAt: "desc" }, { effectiveAt: "desc" }],
  });
  if (!row) return null;
  return {
    rateId: row.id,
    pair: USD_CDF_PAIR,
    rateUnits: row.rateUnits,
    source: row.source,
    effectiveAt: row.effectiveAt,
    expiresAt: row.expiresAt,
  };
}

export function publicFxLabel(rate: FrozenUsdCdfRate, locale: "fr" | "en" = "fr") {
  const since = rate.effectiveAt.toISOString();
  if (locale === "en") {
    return `1 USD = ${rate.rateUnits} CDF. Source: ${rate.source}. Valid since: ${since}.`;
  }
  return `1 USD = ${rate.rateUnits} CDF. Source : ${rate.source}. Valable depuis : ${since}.`;
}
