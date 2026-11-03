import { fmt, type Locale } from "@/i18n/config";
import { formatDateISO, formatUZS } from "@/lib/format";
import en from "./en";
import ru from "./ru";

/**
 * Admin and florist panels: gettext-style translation. The Uzbek text is the key, so the code stays readable and
 * Uzbek needs no dictionary. tests/i18n.test.ts checks that every text used in the code has Russian and English.
 */
export const PANEL_COOKIE = "gulzor_panel_lang";

export type PanelDict = Record<string, string>;
export type PanelT = ((text: string, params?: Record<string, string | number | null | undefined>) => string) & {
  /** Money and dates in the panel's language. */
  uzs: (amount: number) => string;
  date: (iso: string, withWeekday?: boolean) => string;
};

export const panelDict = (locale: Locale): PanelDict => (locale === "ru" ? ru : locale === "en" ? en : {});

/** Unknown texts (e.g. user data) stay as they are. */
export function makeT(dict: PanelDict, locale: Locale = "uz"): PanelT {
  const t = (text: string, params?: Record<string, string | number | null | undefined>) =>
    fmt(dict[text] ?? text, params && Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v ?? ""])));
  return Object.assign(t, {
    uzs: (amount: number) => formatUZS(amount, locale),
    date: (iso: string, withWeekday = true) => formatDateISO(iso, withWeekday, locale),
  });
}
