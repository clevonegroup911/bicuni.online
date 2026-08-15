import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function buildPageHref(path: string, params: Record<string, string | number | undefined>, page: number) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  search.set("page", String(page));
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export function Pagination({
  page,
  total,
  pageSize,
  hrefForPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  hrefForPage: (page: number) => string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav className="pagination-nav" aria-label="Pagination">
      {page > 1 ? (
        <Link className="button secondary" href={hrefForPage(page - 1)}><ChevronLeft size={16} />Précédent</Link>
      ) : (
        <span className="button secondary" aria-disabled="true">Précédent</span>
      )}
      <span>Page {page} sur {pages}</span>
      {page < pages ? (
        <Link className="button secondary" href={hrefForPage(page + 1)}>Suivant<ChevronRight size={16} /></Link>
      ) : (
        <span className="button secondary" aria-disabled="true">Suivant</span>
      )}
    </nav>
  );
}
