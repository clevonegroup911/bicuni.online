import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { CatalogFilters, parseDocumentType } from "@/components/documents/catalog-filters";
import { DocumentGrid } from "@/components/documents/document-grid";
import { loadCatalogFacets, loadPublicCatalog } from "@/components/documents/load-public-catalog";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, buildPageHref } from "@/components/ui/pagination";
import type { DocumentType } from "@prisma/client";

export const metadata: Metadata = { title: "Bibliothèque" };
export const dynamic = "force-dynamic";

export default async function Library({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; category?: string; type?: string; university?: string; sort?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const type = parseDocumentType(params.type);
  const sort = params.sort === "views" ? "views" : "recent";
  const { result, unavailable } = await loadPublicCatalog({
    page,
    pageSize: 18,
    query: params.q,
    category: params.category,
    type: type as DocumentType | undefined,
    university: params.university,
    sort,
  });
  const filters = await loadCatalogFacets();

  return (
    <main className="shell">
      <header className="page-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Bibliothèque" }]} />
        <span className="eyebrow">Bibliothèque scientifique panafricaine</span>
        <h1>Explorer le savoir.</h1>
        <p>Des publications validées, organisées pour une découverte rapide et une lecture académique fiable.</p>
      </header>
      <CatalogFilters
        path="/library"
        query={params.q}
        category={params.category}
        type={type}
        university={params.university}
        sort={sort}
        categories={filters.categories}
        universities={filters.universities}
      />
      {unavailable ? (
        <EmptyState
          icon={TriangleAlert}
          title="Bibliothèque temporairement indisponible"
          description="Les publications n’ont pas pu être chargées. Réessayez dans un instant."
        />
      ) : (
        <>
          <div className="results-meta">
            <span>{result.total} résultat{result.total > 1 ? "s" : ""}</span>
            {params.q ? <span>pour « {params.q} »</span> : null}
          </div>
          <DocumentGrid
            documents={result.items}
            emptyAction={<Link className="button secondary" href="/search">Modifier la recherche</Link>}
          />
          <Pagination
            page={page}
            total={result.total}
            pageSize={result.pageSize}
            hrefForPage={(next) => buildPageHref("/library", {
              q: params.q,
              category: params.category,
              type: params.type,
              university: params.university,
              sort,
            }, next)}
          />
        </>
      )}
    </main>
  );
}
