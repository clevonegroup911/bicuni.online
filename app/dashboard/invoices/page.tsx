import type { Metadata } from "next";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { Pagination, buildPageHref } from "@/components/ui/pagination";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: "Factures" };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireUser();
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const pageSize = 20;
  const where = { subscription: { userId: user.id } };
  const [invoices, total] = await Promise.all([
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count({ where }),
  ]);

  return (
    <div>
      <DashboardHeader
        eyebrow="Facturation"
        title="Factures."
        description="Documents réellement émis par le prestataire de paiement. Aucune facture n’est inventée."
        actions={<Link className="button secondary" href="/dashboard/subscription">Abonnement</Link>}
      />
      <InvoiceTable framed invoices={invoices} />
      <Pagination
        page={page}
        total={total}
        pageSize={pageSize}
        hrefForPage={(next) => buildPageHref("/dashboard/invoices", {}, next)}
      />
    </div>
  );
}
