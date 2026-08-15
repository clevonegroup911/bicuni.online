import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import {
  billingStatusClass,
  billingStatusLabel,
  formatBillingDate,
  formatMoney,
  invoiceAmountCents,
} from "@/lib/billing/format";

export type InvoiceListItem = {
  id: string;
  number: string | null;
  providerRef: string;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  status: string;
  hostedUrl: string | null;
  pdfUrl: string | null;
  periodEnd: Date | string | null;
  createdAt: Date | string;
  subscriberEmail?: string | null;
};

export function InvoiceTable({
  invoices,
  showSubscriber = false,
  embedded = false,
  framed = false,
  emptyDescription = "Aucune facture n’est encore disponible pour ce compte.",
}: {
  invoices: InvoiceListItem[];
  showSubscriber?: boolean;
  embedded?: boolean;
  framed?: boolean;
  emptyDescription?: string;
}) {
  if (!invoices.length) {
    if (embedded) return <p className="muted">{emptyDescription}</p>;
    return <EmptyState icon={ReceiptText} title="Aucune facture" description={emptyDescription} />;
  }

  return (
    <div className={framed ? "admin-table-wrap glass" : "admin-table-wrap"}>
      <table className="admin-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Numéro</th>
            {showSubscriber ? <th>Compte</th> : null}
            <th>Montant</th>
            <th>Devise</th>
            <th>Statut</th>
            <th>Téléchargement</th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((invoice) => {
            const downloadHref = invoice.pdfUrl || invoice.hostedUrl;
            return (
              <tr key={invoice.id}>
                <td>{formatBillingDate(invoice.createdAt)}</td>
                <td>
                  <strong>{invoice.number ?? invoice.providerRef}</strong>
                  {invoice.periodEnd ? <small>Période jusqu’au {formatBillingDate(invoice.periodEnd)}</small> : null}
                </td>
                {showSubscriber ? <td>{invoice.subscriberEmail ?? "—"}</td> : null}
                <td>{formatMoney(invoiceAmountCents(invoice), invoice.currency)}</td>
                <td>{invoice.currency}</td>
                <td><span className={billingStatusClass(invoice.status)}>{billingStatusLabel(invoice.status)}</span></td>
                <td>
                  {downloadHref ? (
                    <a className="auth-link" href={downloadHref} target="_blank" rel="noopener noreferrer">
                      {invoice.pdfUrl ? "PDF" : "Ouvrir"}
                    </a>
                  ) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
