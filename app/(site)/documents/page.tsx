import type { Metadata } from "next";
import Link from "next/link";
import type { DocumentType } from "@prisma/client";
import { TriangleAlert } from "lucide-react";
import { CatalogFilters, parseDocumentType } from "@/components/documents/catalog-filters";
import { DocumentGrid } from "@/components/documents/document-grid";
import { loadCatalogFacets, loadPublicCatalog } from "@/components/documents/load-public-catalog";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination, buildPageHref } from "@/components/ui/pagination";

export const metadata: Metadata = { title: "Documents académiques" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage({
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
    pageSize: 12,
    query: params.q,
    category: params.category,
    type: type as DocumentType | undefined,
    university: params.university,
    sort,
  });
  const filters = await loadCatalogFacets();
  const hrefForPage = (next: number) => buildPageHref("/documents", {
    q: params.q,
    category: params.category,
    type: params.type,
    university: params.university,
    sort,
  }, next);

  return (
    <main className="shell">
      <header className="page-hero">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Documents" }]} />
        <span className="eyebrow">Archive académique</span>
        <h1>Documents publiés.</h1>
        <p>Travaux validés, préservés et diffusés par BICUNI. Les brouillons et contenus privés ne sont pas listés.</p>
      </header>
      <CatalogFilters
        path="/documents"
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
          title="Catalogue temporairement indisponible"
          description="Les documents publiés n’ont pas pu être chargés. Réessayez dans un instant."
        />
      ) : (
        <>
          <div className="results-meta">
            <span>{result.total} document{result.total > 1 ? "s" : ""}</span>
            {params.q ? <span>pour « {params.q} »</span> : null}
          </div>
          <DocumentGrid
            documents={result.items}
            emptyAction={<Link className="button secondary" href="/search">Ouvrir la recherche</Link>}
          />
          <Pagination page={page} total={result.total} pageSize={result.pageSize} hrefForPage={hrefForPage} />
        </>
      )}
    </main>
  );
}
