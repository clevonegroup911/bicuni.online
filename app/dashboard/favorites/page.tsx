import type { Metadata } from "next";
import Link from "next/link";
import { Heart } from "lucide-react";
import { DocumentGrid } from "@/components/documents/document-grid";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireActiveSubscriber } from "@/lib/auth/guards";
import { db } from "@/lib/db/client";
import { documentInclude, sanitizeDocumentForClient } from "@/lib/documents/document-service";

export const metadata: Metadata = { title: "Favoris" };

export default async function FavoritesPage() {
  const user = await requireActiveSubscriber();
  const favorites = await db.documentFavorite.findMany({
    where: {
      userId: user.id,
      document: { status: { in: ["APPROVED", "PUBLISHED"] }, deletedAt: null },
    },
    include: { document: { include: documentInclude } },
    orderBy: { createdAt: "desc" },
  });
  const documents = favorites.map((item) => sanitizeDocumentForClient(item.document));
  return (
    <div>
      <DashboardHeader
        eyebrow="Espace personnel"
        title="Favoris."
        description="Les publications que vous avez enregistrées. Les documents privés ou non publiés n’apparaissent pas ici."
      />
      {documents.length ? (
        <DocumentGrid documents={documents} />
      ) : (
        <EmptyState
          icon={Heart}
          title="Aucun favori pour le moment"
          description="Ajoutez une publication depuis sa fiche pour la retrouver ici."
          action={<Link className="button" href="/library">Explorer la bibliothèque</Link>}
        />
      )}
    </div>
  );
}
