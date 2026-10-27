/** Supported storefront languages. Uzbek URLs have no prefix; Russian lives under /ru. */
export const LOCALES = ["uz", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** "/katalog" -> "/katalog" (uz) or "/ru/katalog" (ru). Keeps query strings. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === "/" || path === "") return `/${locale}`;
  if (path.startsWith("/?")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** Splits an external pathname into its locale and the locale-free path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  // "/uz/…" only appears internally (proxy rewrite), but strip it too so links never double up.
  const m = pathname.match(/^\/(ru|uz)(?=\/|$)(.*)$/);
  if (m) return { locale: m[1] as Locale, path: m[2] || "/" };
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/** Picks the Russian text when available, otherwise the Uzbek original (admin may leave Russian empty). */
export function pick(locale: Locale, uz: string, ru: string | null | undefined): string {
  return locale === "ru" && ru && ru.trim() ? ru : uz;
}

/** "{amount} left" + { amount: "5" } -> "5 left" */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
