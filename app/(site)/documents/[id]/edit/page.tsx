import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MetadataEditForm } from "@/components/documents/metadata-edit-form";
import { VersionUpload } from "@/components/documents/version-upload";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { db } from "@/lib/db/client";
import { requireUser } from "@/lib/auth/guards";
import { canEditDocument } from "@/lib/documents/permissions";

export const metadata: Metadata = { title: "Modifier le document" };

export default async function EditDocument({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const [document, categories] = await Promise.all([
    db.document.findUnique({ where: { id: (await params).id }, include: { tags: true } }),
    db.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  if (!document || !canEditDocument(user, document)) notFound();
  return (
    <main className="shell">
      <header className="page-hero">
        <Breadcrumb items={[
          { label: "Documents", href: "/dashboard/documents" },
          { label: document.title, href: `/documents/${document.id}` },
          { label: "Édition" },
        ]} />
        <span className="eyebrow">Brouillon</span>
        <h1>Modifier les métadonnées.</h1>
        <p>Enregistrez vos changements avant de quitter. Une nouvelle version de fichier peut être ajoutée ci-dessous.</p>
      </header>
      <MetadataEditForm documentId={document.id} initial={document} categories={categories} />
      <VersionUpload documentId={document.id} />
    </main>
  );
}
