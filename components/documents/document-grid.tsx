import { BookOpen } from "lucide-react";
import type { ReactNode } from "react";
import { AcademicDocumentCard, type DocumentSummary } from "@/components/documents/document-card";
import { EmptyState } from "@/components/ui/empty-state";

export function DocumentGrid({
  documents,
  emptyAction,
}: {
  documents: DocumentSummary[];
  emptyAction?: ReactNode;
}) {
  if (!documents.length) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Aucun document publié"
        description="Aucun travail validé ne correspond à cette recherche. Les documents privés ou non publiés restent invisibles."
        action={emptyAction}
      />
    );
  }
  return (
    <div className="grid3">
      {documents.map((document) => <AcademicDocumentCard key={document.id} document={document} />)}
    </div>
  );
}
