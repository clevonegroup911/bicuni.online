import { Activity, Bell, BookOpen, CreditCard, FileCheck2, Heart, TrendingUp, UploadCloud } from "lucide-react";
import Link from "next/link";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { DashboardStatistics } from "@/components/dashboard/statistics-cards";
import { StatusBadge } from "@/components/documents/status-badge";
import { LogoutButton } from "@/components/auth/logout-button";
import type { DocumentStatus } from "@prisma/client";

type DashboardData = {
  documentCount: number;
  secondaryCount: number;
  publishedCount: number;
  pendingCount: number;
  draftCount?: number;
  favoriteCount?: number;
  subscriptionName?: string | null;
  recent: { id: string; title: string; status: DocumentStatus; updatedAt: Date }[];
};

export function DashboardShell({
  variant = "student",
  data,
}: {
  variant?: "student" | "university" | "admin";
  data: DashboardData;
}) {
  const copy = variant === "admin"
    ? ["Centre de contrôle", "Supervisez la plateforme et la validation éditoriale."]
    : variant === "university"
      ? ["Portail institutionnel", "Pilotez la bibliothèque et l’impact de votre université."]
      : ["Votre espace académique", "Suivez vos dépôts, publications et résultats."];
  const stats = variant === "student"
    ? [
        { icon: BookOpen, value: String(data.documentCount), label: "Documents" },
        { icon: FileCheck2, value: String(data.draftCount ?? 0), label: "Brouillons" },
        { icon: TrendingUp, value: String(data.publishedCount), label: "Publications" },
        { icon: Heart, value: String(data.favoriteCount ?? 0), label: "Favoris" },
      ]
    : [
        { icon: BookOpen, value: String(data.documentCount), label: "Documents" },
        { icon: TrendingUp, value: String(data.publishedCount), label: "Publications" },
        { icon: FileCheck2, value: String(data.pendingCount), label: "À valider" },
        { icon: Activity, value: String(data.secondaryCount), label: "Utilisateurs" },
      ];

  return (
    <div>
      <DashboardHeader
        eyebrow={variant === "student" ? "Espace personnel" : "BICUNI Institution"}
        title={copy[0]}
        description={copy[1]}
        actions={
          <>
            <Link className="button" href="/documents/upload"><UploadCloud size={17} />Nouveau dépôt</Link>
            <LogoutButton />
          </>
        }
      />
      <DashboardStatistics items={stats} />
      <div className="quick-actions">
        <Link className="quick-action" href="/documents/upload"><UploadCloud size={18} /><span>Téléverser<small>Créer un brouillon académique</small></span></Link>
        <Link className="quick-action" href="/dashboard/documents"><BookOpen size={18} /><span>Mes documents<small>Brouillons, soumissions et publications</small></span></Link>
        <Link className="quick-action" href="/dashboard/favorites"><Heart size={18} /><span>Favoris<small>Publications enregistrées</small></span></Link>
        <Link className="quick-action" href="/dashboard/subscription"><CreditCard size={18} /><span>Abonnement<small>{data.subscriptionName ?? "Consulter le statut"}</small></span></Link>
      </div>
      <section className="dashboard-main">
        <article className="glass card activity-panel">
          <div className="panel-head">
            <div>
              <span className="eyebrow"><Activity size={14} />Activité documentaire</span>
              <h2>Documents récents</h2>
            </div>
            <Link href={variant === "admin" ? "/admin/documents" : "/dashboard/documents"} className="button secondary">Voir tout</Link>
          </div>
          {data.recent.length ? data.recent.map((document) => (
            <Link href={`/documents/${document.id}`} className="activity-row" key={document.id}>
              <div>
                <strong>{document.title}</strong>
                <small>Mis à jour {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(document.updatedAt)}</small>
              </div>
              <StatusBadge status={document.status} />
            </Link>
          )) : (
            <div className="empty-state">
              <BookOpen size={28} />
              <h3>Aucun document</h3>
              <p>Votre activité documentaire apparaîtra ici.</p>
              <Link className="button" href="/documents/upload">Déposer un document</Link>
            </div>
          )}
        </article>
        <aside className="dashboard-rail">
          <div className="glass card insight-card">
            <Bell size={18} />
            <span className="eyebrow">À retenir</span>
            <h3>
              {data.pendingCount
                ? `${data.pendingCount} document${data.pendingCount > 1 ? "s" : ""} en attente`
                : "Tout est à jour"}
            </h3>
            <p>Les données affichées proviennent directement de l’activité actuelle de la plateforme.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
