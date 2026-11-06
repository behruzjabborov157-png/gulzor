import { readFile } from "node:fs/promises";
import path from "node:path";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { locationSearchKey, cyrillicToLatin } from "@/lib/translit";

/*
 * Administrative places (region → district/city → settlement → mahalla) and which of them a delivery
 * region and its zones serve. Data: data/locations/uz-soato.json (pdlpad/SOATO, CC BY 4.0).
 */

export type Location = typeof schema.locations.$inferSelect;
export type LocationLevel = Location["level"];
type Db = Awaited<ReturnType<typeof getDb>>;

/** Name in the visitor's language. Russian falls back to the Uzbek Cyrillic name, English to the Latin one. */
export function locationName(l: Pick<Location, "name" | "nameCyrl" | "nameRu" | "nameEn">, locale: string): string {
  if (locale === "ru") return l.nameRu?.trim() || l.nameCyrl?.trim() || l.name;
  if (locale === "en") return l.nameEn?.trim() || l.name;
  return l.name;
}

export function searchTextFor(l: Pick<Location, "name" | "nameCyrl" | "nameRu" | "nameEn">): string {
  return locationSearchKey(l.name, l.nameCyrl, l.nameRu, l.nameEn);
}

/** Full official names of the 14 top-level units (the dataset only has short Cyrillic ones). */
export const REGION_NAMES: Record<string, { uz: string; cyrl: string; ru: string; en: string }> = {
  "1735": { uz: "Qoraqalpog‘iston Respublikasi", cyrl: "Қорақалпоғистон Республикаси", ru: "Республика Каракалпакстан", en: "Republic of Karakalpakstan" },
  "1703": { uz: "Andijon viloyati", cyrl: "Андижон вилояти", ru: "Андижанская область", en: "Andijan Region" },
  "1706": { uz: "Buxoro viloyati", cyrl: "Бухоро вилояти", ru: "Бухарская область", en: "Bukhara Region" },
  "1708": { uz: "Jizzax viloyati", cyrl: "Жиззах вилояти", ru: "Джизакская область", en: "Jizzakh Region" },
  "1710": { uz: "Qashqadaryo viloyati", cyrl: "Қашқадарё вилояти", ru: "Кашкадарьинская область", en: "Kashkadarya Region" },
  "1712": { uz: "Navoiy viloyati", cyrl: "Навоий вилояти", ru: "Навоийская область", en: "Navoi Region" },
  "1714": { uz: "Namangan viloyati", cyrl: "Наманган вилояти", ru: "Наманганская область", en: "Namangan Region" },
  "1718": { uz: "Samarqand viloyati", cyrl: "Самарқанд вилояти", ru: "Самаркандская область", en: "Samarkand Region" },
  "1722": { uz: "Surxondaryo viloyati", cyrl: "Сурхондарё вилояти", ru: "Сурхандарьинская область", en: "Surkhandarya Region" },
  "1724": { uz: "Sirdaryo viloyati", cyrl: "Сирдарё вилояти", ru: "Сырдарьинская область", en: "Syrdarya Region" },
  "1726": { uz: "Toshkent shahri", cyrl: "Тошкент шаҳри", ru: "город Ташкент", en: "Tashkent City" },
  "1727": { uz: "Toshkent viloyati", cyrl: "Тошкент вилояти", ru: "Ташкентская область", en: "Tashkent Region" },
  "1730": { uz: "Farg‘ona viloyati", cyrl: "Фарғона вилояти", ru: "Ферганская область", en: "Fergana Region" },
  "1733": { uz: "Xorazm viloyati", cyrl: "Хоразм вилояти", ru: "Хорезмская область", en: "Khorezm Region" },
};

type Dataset = {
  regions: { soato: string; name: string }[];
  districts: { soato: string; region: string; name: string; lat?: number; lng?: number }[];
  mahallas: { id: string; district: string; name: string; lat?: number; lng?: number }[];
};

export const DATASET_PATH = path.resolve("data/locations/uz-soato.json");

/**
 * Loads the dataset into `locations`. Idempotent: rows are matched by code and existing ones are left alone,
 * so names an admin corrected and places an admin deactivated stay as they are.
 */
export async function importLocations(db?: Db, file = DATASET_PATH): Promise<{ added: number; total: number }> {
  db ??= await getDb();
  // Only migrations read the dataset (scripts/migrate.ts); keep it out of the server bundle tracing.
  const data = JSON.parse(await readFile(/*turbopackIgnore: true*/ file, "utf8")) as Dataset;
  let added = 0;
  const insert = async (rows: (typeof schema.locations.$inferInsert)[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const res = await db
        .insert(schema.locations)
        .values(rows.slice(i, i + 500))
        .onConflictDoNothing({ target: schema.locations.code })
        .returning({ id: schema.locations.id });
      added += res.length;
    }
  };
  const idsByCode = async (codes: string[]) => {
    const map = new Map<string, number>();
    for (let i = 0; i < codes.length; i += 1000) {
      const rows = await db
        .select({ id: schema.locations.id, code: schema.locations.code })
        .from(schema.locations)
        .where(inArray(schema.locations.code, codes.slice(i, i + 1000)));
      for (const r of rows) map.set(r.code!, r.id);
    }
    return map;
  };
  const row = (o: { level: LocationLevel; code: string; parentId: number | null; cyrl: string; uz?: string; ru?: string; en?: string; lat?: number; lng?: number; sortOrder?: number }) => {
    const names = { name: o.uz ?? cyrillicToLatin(o.cyrl), nameCyrl: /[Ѐ-ӿ]/.test(o.cyrl) ? o.cyrl : null, nameRu: o.ru ?? null, nameEn: o.en ?? null };
    return { level: o.level, code: o.code, parentId: o.parentId, ...names, latitude: o.lat ?? null, longitude: o.lng ?? null, searchText: searchTextFor(names), sortOrder: o.sortOrder ?? 0 };
  };

  // Karakalpakstan first, then the regions in SOATO order, as in official lists.
  await insert(
    data.regions.map((r) => {
      const n = REGION_NAMES[r.soato];
      return row({ level: "region", code: r.soato, parentId: null, cyrl: n?.cyrl ?? r.name, uz: n?.uz, ru: n?.ru, en: n?.en, sortOrder: r.soato === "1735" ? 0 : Number(r.soato) });
    }),
  );
  const regionIds = await idsByCode(data.regions.map((r) => r.soato));
  await insert(
    data.districts
      .filter((d) => regionIds.has(d.region))
      .map((d) => row({ level: "district", code: d.soato, parentId: regionIds.get(d.region)!, cyrl: d.name, lat: d.lat, lng: d.lng })),
  );
  const districtIds = await idsByCode(data.districts.map((d) => d.soato));
  await insert(
    data.mahallas
      .filter((m) => districtIds.has(m.district))
      .map((m) => row({ level: "mahalla", code: `m:${m.id}`, parentId: districtIds.get(m.district)!, cyrl: m.name, lat: m.lat, lng: m.lng })),
  );
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.locations);
  await linkDeliveryRegions(db);
  return { added, total: n };
}

/** Imports the dataset only into an empty table (used after migrations on every start, so it must be cheap). */
export async function ensureLocations(db?: Db): Promise<{ added: number; total: number } | null> {
  db ??= await getDb();
  const [any] = await db.select({ id: schema.locations.id }).from(schema.locations).limit(1);
  if (any) return null;
  return importLocations(db);
}

/**
 * Connects delivery regions that have no location yet to the region or city with exactly the same name
 * ("Toshkent shahri" → the Tashkent city region, "Samarqand shahri" → the Samarkand city district).
 */
export async function linkDeliveryRegions(db?: Db) {
  db ??= await getDb();
  const unlinked = await db.select().from(schema.deliveryRegions).where(isNull(schema.deliveryRegions.locationId));
  for (const r of unlinked) {
    const key = locationSearchKey(r.name);
    const hits = await db
      .select({ id: schema.locations.id, name: schema.locations.name })
      .from(schema.locations)
      .where(and(inArray(schema.locations.level, ["region", "district"]), sql`lower(${schema.locations.name}) = ${r.name.toLowerCase()}`));
    const exact = hits.filter((h) => locationSearchKey(h.name) === key);
    if (exact.length === 1) await db.update(schema.deliveryRegions).set({ locationId: exact[0].id }).where(eq(schema.deliveryRegions.id, r.id));
  }
}

/** Active children of a place, in display order. */
export async function childLocations(parentId: number | null, opts: { activeOnly?: boolean; level?: LocationLevel } = {}) {
  const db = await getDb();
  return db
    .select()
    .from(schema.locations)
    .where(
      and(
        parentId == null ? isNull(schema.locations.parentId) : eq(schema.locations.parentId, parentId),
        opts.activeOnly === false ? undefined : eq(schema.locations.isActive, true),
        opts.level ? eq(schema.locations.level, opts.level) : undefined,
      ),
    )
    .orderBy(asc(schema.locations.sortOrder), asc(schema.locations.name));
}

export async function getLocation(id: number) {
  const db = await getDb();
  const [row] = await db.select().from(schema.locations).where(eq(schema.locations.id, id));
  return row ?? null;
}

/** The place and its ancestors, from the top: [region, district, …, place]. */
export async function locationPath(id: number): Promise<Location[]> {
  const out: Location[] = [];
  let cur: Location | null = await getLocation(id);
  while (cur && out.length < 6) {
    out.unshift(cur);
    cur = cur.parentId ? await getLocation(cur.parentId) : null;
  }
  return out;
}

/**
 * Districts a delivery region can deliver to: the districts of its region, or the city itself when the delivery
 * region is a single city. Empty when the delivery region is not linked to a place (then no district is asked).
 */
export async function regionDistricts(locationId: number | null): Promise<Location[]> {
  if (!locationId) return [];
  const loc = await getLocation(locationId);
  if (!loc || !loc.isActive) return [];
  if (loc.level === "region") return childLocations(loc.id, { level: "district" });
  return [loc];
}

/** Zone id → covered location ids (zones missing from the map cover the whole delivery region). */
export async function zoneCoverage(zoneIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (!zoneIds.length) return map;
  const db = await getDb();
  const rows = await db.select().from(schema.zoneLocations).where(inArray(schema.zoneLocations.zoneId, zoneIds));
  for (const r of rows) map.set(r.zoneId, [...(map.get(r.zoneId) ?? []), r.locationId]);
  return map;
}

export function zoneServes(coverage: Map<number, number[]>, zoneId: number, districtId: number): boolean {
  const covered = coverage.get(zoneId);
  return !covered || covered.includes(districtId);
}

/** Is `id` the district itself or a place inside it (settlement, mahalla)? */
export async function isWithin(id: number, districtId: number): Promise<boolean> {
  return (await locationPath(id)).some((l) => l.id === districtId);
}

/** Rough bounding box of Uzbekistan, to reject obviously wrong coordinates. */
export function inUzbekistan(lat: number, lng: number): boolean {
  return lat >= 37 && lat <= 45.7 && lng >= 55.9 && lng <= 73.2;
}

/** Districts ticked in a CoverageFields form; null when the form had no coverage section (leave it unchanged). */
export function coverageFromForm(form: FormData): number[] | null {
  if (form.get("coverage") !== "1") return null;
  return form
    .getAll("districtIds")
    .map((v) => Number(v))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Replaces the districts a zone covers. Ids outside the zone's delivery region are dropped. Returns what was kept. */
export async function setZoneCoverage(zoneId: number, districtIds: number[]): Promise<number[]> {
  const db = await getDb();
  const [row] = await db
    .select({ locationId: schema.deliveryRegions.locationId })
    .from(schema.deliveryZones)
    .innerJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.deliveryZones.regionId))
    .where(eq(schema.deliveryZones.id, zoneId));
  const allowed = new Set((await regionDistricts(row?.locationId ?? null)).map((d) => d.id));
  const keep = [...new Set(districtIds)].filter((id) => allowed.has(id));
  await db.transaction(async (tx) => {
    await tx.delete(schema.zoneLocations).where(eq(schema.zoneLocations.zoneId, zoneId));
    if (keep.length) await tx.insert(schema.zoneLocations).values(keep.map((locationId) => ({ zoneId, locationId })));
  });
  return keep;
}

/** Regions with their districts and cities, for the "which place is this delivery area" picker. */
export async function regionPickerOptions() {
  const db = await getDb();
  const rows = await db
    .select({ id: schema.locations.id, parentId: schema.locations.parentId, level: schema.locations.level, name: schema.locations.name, sortOrder: schema.locations.sortOrder })
    .from(schema.locations)
    .where(and(inArray(schema.locations.level, ["region", "district"]), eq(schema.locations.isActive, true)))
    .orderBy(asc(schema.locations.sortOrder), asc(schema.locations.name));
  return rows
    .filter((r) => r.level === "region")
    .map((r) => ({ id: r.id, name: r.name, districts: rows.filter((d) => d.parentId === r.id).map((d) => ({ id: d.id, name: d.name })) }));
}
