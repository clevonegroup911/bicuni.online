import type { Metadata } from "next";
import Link from "next/link";
import { DocumentStatus } from "@prisma/client";
import { BookOpen, UploadCloud } from "lucide-react";
import { DocumentTable } from "@/components/documents/document-table";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db/client";
import { requireActiveSubscriber } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Mes documents" };

export default async function MyDocuments({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireActiveSubscriber();
  const params = await searchParams;
  const status = Object.values(DocumentStatus).find((value) => value === params.status);
  const documents = await db.document.findMany({
    where: { authorId: user.id, status: status ?? { not: "DELETED" } },
    orderBy: { updatedAt: "desc" },
  });
  return (
    <div>
      <DashboardHeader
        eyebrow="Tableau de bord"
        title="Mes documents."
        description="Brouillons, soumissions et publications associés à votre compte."
        actions={<Link className="button" href="/documents/upload"><UploadCloud size={17} />Nouveau document</Link>}
      />
      <form className="toolbar">
        <label className="sr-only" htmlFor="status">Filtrer par statut</label>
        <select id="status" className="input" name="status" defaultValue={status ?? ""}>
          <option value="">Tous les statuts</option>
          {Object.values(DocumentStatus).filter((value) => value !== "DELETED").map((value) => (
            <option key={value} value={value}>{value}</option>
          ))}
        </select>
        <button className="button secondary">Filtrer</button>
      </form>
      {documents.length ? (
        <DocumentTable documents={documents} />
      ) : (
        <EmptyState
          icon={BookOpen}
          title="Aucun document pour ce filtre"
          description="Déposez un travail pour créer votre premier brouillon, ou élargissez le filtre de statut."
          action={<Link className="button" href="/documents/upload">Téléverser un document</Link>}
        />
      )}
    </div>
  );
}
