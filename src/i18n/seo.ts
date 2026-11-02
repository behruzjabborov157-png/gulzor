import type { Metadata } from "next";
import { LOCALES, localePath, type Locale } from "./config";

/** canonical + hreflang alternates for a locale-free path such as "/katalog". */
export function alternates(locale: Locale, path: string): Metadata["alternates"] {
  return {
    canonical: localePath(locale, path),
    languages: { ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])), "x-default": localePath("uz", path) },
  };
}
