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
  nameEn?: string | null;
  shortDescription?: string | null;
  shortDescriptionRu?: string | null;
  shortDescriptionEn?: string | null;
  flowerVarieties?: string[] | null;
  flowerVarietiesRu?: string[] | null;
  flowerVarietiesEn?: string[] | null;
};

/** Text stored in products.search_text — all languages, so a search in any of them finds the product. */
export function buildSearchText(p: Searchable): string {
  return normalizeSearch(
    [
      p.name,
      p.nameRu,
      p.nameEn,
      p.shortDescription,
      p.shortDescriptionRu,
      p.shortDescriptionEn,
      ...(p.flowerVarieties ?? []),
      ...(p.flowerVarietiesRu ?? []),
      ...(p.flowerVarietiesEn ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  );
}
