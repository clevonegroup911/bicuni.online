import type { Metadata } from "next";
import Link from "next/link";
import { Clock3, Search } from "lucide-react";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";

export const metadata: Metadata = { title: "Historique" };

export default async function HistoryPage() {
  const user = await requireActiveSubscriber();
  const [searches, events] = await Promise.all([
    db.searchLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    db.documentHistory.findMany({
      where: { actorId: user.id },
      include: { document: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  return (
    <div>
      <DashboardHeader
        eyebrow="Espace personnel"
        title="Historique."
        description="Recherches et actions documentaires associées à votre compte."
      />
      <section className="admin-dashboard-grid">
        <article className="glass card admin-panel">
          <h2>Recherches récentes</h2>
          {searches.length ? searches.map((item) => (
            <Link className="admin-row" key={item.id} href={`/search?q=${encodeURIComponent(item.query)}`}>
              <span>
                <strong>{item.query}</strong>
                <small>{item.resultCount} résultat{item.resultCount > 1 ? "s" : ""}</small>
              </span>
              <time>{item.createdAt.toLocaleString("fr-FR")}</time>
            </Link>
          )) : (
            <EmptyState icon={Search} title="Aucune recherche enregistrée" description="Vos recherches authentifiées apparaîtront ici." />
          )}
        </article>
        <article className="glass card admin-panel">
          <h2>Actions documentaires</h2>
          {events.length ? events.map((item) => (
            <Link className="admin-row" key={item.id} href={`/documents/${item.documentId}`}>
              <span>
                <strong>{item.action}</strong>
                <small>{item.document.title}</small>
              </span>
              <time>{item.createdAt.toLocaleString("fr-FR")}</time>
            </Link>
          )) : (
            <EmptyState icon={Clock3} title="Aucune action récente" description="Les dépôts, soumissions et mises à jour s’afficheront ici." />
          )}
        </article>
      </section>
    </div>
  );
}
