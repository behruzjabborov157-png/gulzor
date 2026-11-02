/** Supported storefront languages. Uzbek URLs have no prefix; Russian lives under /ru, English under /en. */
export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "uz";

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** "/katalog" -> "/katalog" (uz), "/ru/katalog" (ru) or "/en/katalog" (en). Keeps query strings. */
export function localePath(locale: Locale, path: string): string {
  if (locale === DEFAULT_LOCALE) return path;
  if (path === "/" || path === "") return `/${locale}`;
  if (path.startsWith("/?")) return `/${locale}${path.slice(1)}`;
  return `/${locale}${path}`;
}

/** Splits an external pathname into its locale and the locale-free path. */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  // "/uz/…" only appears internally (proxy rewrite), but strip it too so links never double up.
  const m = pathname.match(/^\/(ru|uz|en)(?=\/|$)(.*)$/);
  if (m) return { locale: m[1] as Locale, path: m[2] || "/" };
  return { locale: DEFAULT_LOCALE, path: pathname || "/" };
}

/**
 * Text of an admin-entered field in the visitor's language: the Russian or English version when it is filled in,
 * otherwise the Uzbek original (translations are optional).
 */
export function pick(locale: Locale, uz: string, ru: string | null | undefined, en?: string | null): string {
  const t = locale === "ru" ? ru : locale === "en" ? en : null;
  return t && t.trim() ? t : uz;
}

/** Same as pick() for lists (flower varieties, colours). */
export function pickList(locale: Locale, uz: string[], ru: string[] | null | undefined, en?: string[] | null): string[] {
  const t = locale === "ru" ? ru : locale === "en" ? en : null;
  return t && t.length ? t : uz;
}

/** The i-th item of a translated list (e.g. a colour option), falling back to the Uzbek one. */
export function pickAt(locale: Locale, i: number, uz: string[], ru: string[] | null | undefined, en?: string[] | null): string {
  const t = locale === "ru" ? ru?.[i] : locale === "en" ? en?.[i] : null;
  return t && t.trim() ? t : uz[i];
}

/** Language names in Uzbek, for the back office ("Mijoz tili: rus tili"). */
export const LANGUAGE_NAME_UZ: Record<string, string> = { uz: "o‘zbek tili", ru: "rus tili", en: "ingliz tili" };

/** BCP 47 tag for Intl formatting. */
export const INTL_LOCALE: Record<Locale, string> = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };

/** "{amount} left" + { amount: "5" } -> "5 left" */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in params ? String(params[k]) : m));
}
