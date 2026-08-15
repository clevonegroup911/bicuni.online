"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export function SearchBox({
  compact = false,
  defaultValue = "",
  destination,
}: {
  compact?: boolean;
  defaultValue?: string;
  destination?: string;
}) {
  const [query, setQuery] = useState(defaultValue);
  const router = useRouter();
  const target = destination ?? (compact ? "/library" : "/search");
  const searchHref = query.trim() ? `/search?q=${encodeURIComponent(query.trim())}` : "/search";

  function go(path: string) {
    const terms = query.trim();
    router.push(terms ? `${path}?q=${encodeURIComponent(terms)}` : path);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    go(target);
  }

  return (
    <form onSubmit={submit} aria-label="Recherche académique" className={`search-bar ${compact ? "compact" : ""}`}>
      <Search size={20} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        aria-label="Termes de recherche"
        placeholder="Titre, auteur, université, année, domaine…"
      />
      {!compact ? (
        <Link href={searchHref} className="icon-button" aria-label="Ouvrir la recherche avancée">
          <SlidersHorizontal size={17} />
        </Link>
      ) : null}
      <button className="button" type="submit">Rechercher</button>
    </form>
  );
}

export const SearchBar = SearchBox;
