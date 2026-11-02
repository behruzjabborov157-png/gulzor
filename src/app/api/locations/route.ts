import { isLocale } from "@/i18n/config";
import { childLocations, locationName } from "@/lib/locations";

export const dynamic = "force-dynamic";

/**
 * Public list of the active places inside one place (e.g. the mahallas of a district) for address pickers:
 *   GET /api/locations?parent=123&lang=ru
 * Loaded on demand, so pages never ship the ~10 000 places of the country.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parent = Number(params.get("parent"));
  if (!Number.isInteger(parent) || parent <= 0) return Response.json({ error: "parent" }, { status: 400 });
  const lang = params.get("lang");
  const locale = lang === "en" || isLocale(lang) ? lang : "uz";
  const rows = await childLocations(parent);
  return Response.json(
    { items: rows.map((l) => ({ id: l.id, name: locationName(l, locale), level: l.level, search: l.searchText })) },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=300" } },
  );
}
