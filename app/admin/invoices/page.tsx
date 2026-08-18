import Link from "next/link";
import { AdminShell } from "@/components/admin/admin-shell";
import { InvoiceTable } from "@/components/billing/invoice-table";
import { Pagination, buildPageHref } from "@/components/ui/pagination";
import { requirePermission } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata = { title: "Factures" };

export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requirePermission("admin:audit:read");
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const pageSize = 25;
  const [items, total] = await Promise.all([
    db.invoice.findMany({
      include: { subscription: { include: { user: { select: { email: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.invoice.count(),
  ]);

  return (
    <AdminShell user={user}>
      <div className="admin-page">
        <header className="admin-title">
          <span className="eyebrow">Facturation</span>
          <h1>Factures</h1>
          <p>
            {total} facture{total > 1 ? "s" : ""} réellement enregistrée{total > 1 ? "s" : ""} via les webhooks de paiement.
            {" "}
            <Link className="auth-link" href="/admin/payments">Voir les transactions</Link>
          </p>
        </header>
        <InvoiceTable
          framed
          showSubscriber
          emptyDescription="Les factures confirmées par webhook apparaîtront ici."
          invoices={items.map((invoice) => ({
            ...invoice,
            subscriberEmail: invoice.subscription.user.email,
          }))}
        />
        <Pagination
          page={page}
          total={total}
          pageSize={pageSize}
          hrefForPage={(next) => buildPageHref("/admin/invoices", {}, next)}
        />
      </div>
    </AdminShell>
  );
}
