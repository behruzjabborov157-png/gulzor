import type { Metadata } from "next";
import { localePath, type Locale } from "./config";

/** canonical + hreflang alternates for a locale-free path such as "/katalog". */
export function alternates(locale: Locale, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: { uz: localePath("uz", path), ru: localePath("ru", path), "x-default": localePath("uz", path) },
  };
}
