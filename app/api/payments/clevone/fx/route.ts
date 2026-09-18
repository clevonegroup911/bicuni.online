import { NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { getActiveUsdCdfRate, publicFxLabel } from "@/lib/payments/clevone/fx";

export async function GET() {
  const rate = await getActiveUsdCdfRate(db);
  if (!rate) {
    return NextResponse.json({
      available: false,
      message: "Le paiement CDF (M-PESA / RAWBANK CDF) est indisponible : aucun taux USD/CDF approuvé. Le paiement RAWBANK USD reste disponible.",
    });
  }
  return NextResponse.json({
    available: true,
    pair: "USD/CDF",
    rateUnits: rate.rateUnits,
    display: `1 USD = ${rate.rateUnits} CDF`,
    source: rate.source,
    effectiveAt: rate.effectiveAt,
    labelFr: publicFxLabel(rate, "fr"),
    labelEn: publicFxLabel(rate, "en"),
  });
}
