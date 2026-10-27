/** Formatting helpers (Uzbek Latin by default, Russian when asked). Pure — safe on client and server. */

type Lang = "uz" | "ru";

const NBSP = " ";

/** 149000 -> "149 000 so‘m" (uz) / "149 000 сум" (ru) */
export function formatUZS(amount: number, locale: Lang = "uz"): string {
  const n = Math.round(amount);
  const sign = n < 0 ? "−" : "";
  const digits = Math.abs(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${digits}${NBSP}${locale === "ru" ? "сум" : "so‘m"}`;
}

export const UZ_MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr",
];
export const UZ_WEEKDAYS = ["yakshanba", "dushanba", "seshanba", "chorshanba", "payshanba", "juma", "shanba"];
/** Genitive month names, as used in dates ("26 октября"). */
const RU_MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const RU_WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

/** "2026-10-26" -> "26-oktabr, dushanba" (uz) / "26 октября, понедельник" (ru) */
export function formatDateISO(iso: string, withWeekday = true, locale: Lang = "uz"): string {
  const [y, m, d] = iso.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  if (locale === "ru") return `${d} ${RU_MONTHS[m - 1]}${withWeekday ? `, ${RU_WEEKDAYS[wd]}` : ""}`;
  return `${d}-${UZ_MONTHS[m - 1]}${withWeekday ? `, ${UZ_WEEKDAYS[wd]}` : ""}`;
}

/** Timestamp -> "26.10.2026 14:05" in Tashkent time (UTC+5). */
export function formatDateTime(value: Date | string): string {
  const d = new Date(new Date(value).getTime() + 5 * 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}.${p(d.getUTCMonth() + 1)}.${d.getUTCFullYear()} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/**
 * Normalises Uzbek phone numbers to +998XXXXXXXXX.
 * Accepts "90 123 45 67", "+998 (90) 123-45-67", "998901234567".
 * Returns null when the input is not a valid Uzbek number.
 */
export function normalizePhone(input: string): string | null {
  let d = input.replace(/\D/g, "");
  if (d.length === 9) d = "998" + d;
  if (d.length !== 12 || !d.startsWith("998")) return null;
  return "+" + d;
}

/** +998901234567 -> "+998 90 123 45 67" */
export function formatPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 12) return phone;
  return `+${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
}

/** Hides the middle of a phone number for public pages. */
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length !== 12) return "***";
  return `+998 ${d.slice(3, 5)} *** ** ${d.slice(10)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[ʻʼ‘’'`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
