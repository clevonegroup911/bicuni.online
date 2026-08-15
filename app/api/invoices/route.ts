import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db/client";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const rawLimit = new URL(request.url).searchParams.get("limit");
  const rawPage = new URL(request.url).searchParams.get("page");
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  const page = rawPage === null ? 1 : Number(rawPage);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) return NextResponse.json({ error: "Limite invalide." }, { status: 400 });
  if (!Number.isSafeInteger(page) || page < 1) return NextResponse.json({ error: "Page invalide." }, { status: 400 });
  const where = { subscription: { userId: session.user.id } };
  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      select: { id: true, number: true, amountDueCents: true, amountPaidCents: true, currency: true, status: true, hostedUrl: true, pdfUrl: true, periodStart: true, periodEnd: true, createdAt: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit,
    }),
    db.invoice.count({ where }),
  ]);
  return NextResponse.json({ invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
