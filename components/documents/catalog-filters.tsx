const TYPES = ["TFC", "MEMOIRE", "THESE", "ARTICLE", "RAPPORT"] as const;

export function CatalogFilters({
  path,
  query,
  category,
  type,
  university,
  sort,
  categories,
  universities,
}: {
  path: string;
  query?: string;
  category?: string;
  type?: string;
  university?: string;
  sort?: string;
  categories: string[];
  universities: string[];
}) {
  return (
    <form className="catalog-toolbar" action={path}>
      <label className="sr-only" htmlFor="catalog-q">Recherche</label>
      <input id="catalog-q" className="input" name="q" defaultValue={query} placeholder="Titre, résumé…" />
      <label className="sr-only" htmlFor="catalog-category">Catégorie</label>
      <select id="catalog-category" className="input" name="category" defaultValue={category ?? ""}>
        <option value="">Toutes les catégories</option>
        {categories.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <label className="sr-only" htmlFor="catalog-type">Type</label>
      <select id="catalog-type" className="input" name="type" defaultValue={type ?? ""}>
        <option value="">Tous les types</option>
        {TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <label className="sr-only" htmlFor="catalog-university">Université</label>
      <select id="catalog-university" className="input" name="university" defaultValue={university ?? ""}>
        <option value="">Toutes les universités</option>
        {universities.map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <label className="sr-only" htmlFor="catalog-sort">Tri</label>
      <select id="catalog-sort" className="input" name="sort" defaultValue={sort ?? "recent"}>
        <option value="recent">Plus récent</option>
        <option value="views">Plus consulté</option>
      </select>
      <button className="button" type="submit">Filtrer</button>
    </form>
  );
}

export function parseDocumentType(value?: string) {
  return TYPES.find((item) => item === value);
}
