import type { Metadata } from "next";
import { MetadataForm } from "@/components/documents/metadata-form";
import { db } from "@/lib/db/client";
import { requireActiveSubscriber } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Publier un document" };

export default async function UploadPage() {
  await requireActiveSubscriber();
  const [categories, universities] = await Promise.all([
    db.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.university.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        faculties: { select: { id: true, name: true, departments: { select: { id: true, name: true } } } },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
  ]);
  return (
    <main className="shell">
      <header className="page-hero">
        <span className="eyebrow">Dépôt sécurisé</span>
        <h1>Créer un document.</h1>
        <p>Les fichiers restent privés jusqu’à validation institutionnelle.</p>
      </header>
      <MetadataForm taxonomy={{ categories, universities }} />
    </main>
  );
}
