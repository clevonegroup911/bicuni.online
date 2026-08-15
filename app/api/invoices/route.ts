import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return NextResponse.json({ error: "Limite invalide." }, { status: 400 });
  const invoices = await db.invoice.findMany({
    where: { subscription: { userId: session.user.id } },
    select: { id: true, number: true, amountDueCents: true, amountPaidCents: true, currency: true, status: true, hostedUrl: true, pdfUrl: true, periodStart: true, periodEnd: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit,
  });
  return NextResponse.json({ invoices });
}
