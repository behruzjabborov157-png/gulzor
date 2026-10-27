/** Asia/Tashkent is UTC+5 with no daylight saving time. */
const OFFSET_MS = 5 * 3600_000;

export function tashkentNow(now: Date = new Date()) {
  const t = new Date(now.getTime() + OFFSET_MS);
  const date = t.toISOString().slice(0, 10);
  const minutes = t.getUTCHours() * 60 + t.getUTCMinutes();
  const month = t.getUTCMonth() + 1;
  return { date, minutes, month };
}

export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function isISODate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(v + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** "14:30" -> 870 */
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function monthOfISO(iso: string): number {
  return Number(iso.slice(5, 7));
}
