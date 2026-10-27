"use client";

import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, localePath, type Locale } from "./config";
import { getDict, type Dict } from "./dict";

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({ locale, children }: { locale: Locale; children: React.ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

/** Dictionary for the current language plus a helper that prefixes internal links. */
export function useT(): { locale: Locale; t: Dict; href: (path: string) => string } {
  const locale = useLocale();
  return { locale, t: getDict(locale), href: (path: string) => localePath(locale, path) };
}
