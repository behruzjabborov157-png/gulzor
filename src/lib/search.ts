/** Search normalisation shared by the catalog query and every place that saves products. */

/** Lower-cases (Unicode-aware, so Cyrillic works on any database locale), drops apostrophe variants and ё→е. */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, "")
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ")
    .trim();
}

type Searchable = {
  name: string;
  nameRu?: string | null;
  shortDescription?: string | null;
  shortDescriptionRu?: string | null;
  flowerVarieties?: string[] | null;
  flowerVarietiesRu?: string[] | null;
};

/** Text stored in products.search_text — both languages, so a search in either finds the product. */
export function buildSearchText(p: Searchable): string {
  return normalizeSearch(
    [p.name, p.nameRu, p.shortDescription, p.shortDescriptionRu, ...(p.flowerVarieties ?? []), ...(p.flowerVarietiesRu ?? [])]
      .filter(Boolean)
      .join(" "),
  );
}
