import type { Metadata } from "next";
import Link from "next/link";
import { Building2, TriangleAlert } from "lucide-react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { db } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

export const metadata: Metadata = { title: "Universités" };
export const dynamic = "force-dynamic";

export default async function UniversitiesPage() {
  let universities: Awaited<ReturnType<typeof loadUniversities>> = [];
  let unavailable = false;
  try {
    universities = await loadUniversities();
  } catch (error) {
    logger.error("public.universities.unavailable", error);
    unavailable = true;
  }

  return (
    <main className="shell">
      <header className="page-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Universités" }]} />
        <span className="eyebrow">Réseau académique</span>
        <h1>Universités visibles.</h1>
        <p>Seules les institutions ayant au moins une publication validée sont listées. Aucun établissement fictif n’est ajouté.</p>
      </header>
      {unavailable ? (
        <EmptyState
          icon={TriangleAlert}
          title="Liste temporairement indisponible"
          description="Les établissements n’ont pas pu être chargés. Réessayez dans un instant."
        />
      ) : universities.length ? (
        <div className="grid3 universities-grid">
          {universities.map((university) => (
            <Link key={university.id} href={`/search?university=${encodeURIComponent(university.name)}`} className="glass card entity-card card-hover">
              <div className="entity-icon"><Building2 /></div>
              <div>
                <h3>{university.acronym ? `${university.acronym} — ${university.name}` : university.name}</h3>
                <p>
                  {university.city ? `${university.city}, ` : ""}{university.country}
                  {" · "}
                  {university._count.documents} publication{university._count.documents > 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Building2}
          title="Aucune université publiée"
          description="Les établissements apparaîtront ici dès la validation de leurs premières publications."
          action={<a className="button secondary" href="mailto:institutions@bicuni.online">Rejoindre BICUNI</a>}
        />
      )}
    </main>
  );
}

function loadUniversities() {
  return db.university.findMany({
    where: {
      status: "ACTIVE",
      documents: { some: { status: { in: ["APPROVED", "PUBLISHED"] }, deletedAt: null } },
    },
    select: {
      id: true,
      name: true,
      acronym: true,
      country: true,
      city: true,
      _count: {
        select: {
          documents: { where: { status: { in: ["APPROVED", "PUBLISHED"] }, deletedAt: null } },
        },
      },
    },
    orderBy: { name: "asc" },
  });
}
