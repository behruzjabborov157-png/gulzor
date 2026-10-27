import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { DEFAULT_LOCALE, pick, type Locale } from "@/i18n/config";
import { addDaysISO, hhmmToMinutes, tashkentNow } from "@/lib/time";

export type Zone = typeof schema.deliveryZones.$inferSelect;
export type Region = typeof schema.deliveryRegions.$inferSelect;
export type Slot = typeof schema.timeSlots.$inferSelect;

/** Active regions with their zones (names in the requested language) and active time slots. */
export async function getDeliveryConfig(locale: Locale = DEFAULT_LOCALE) {
  const db = await getDb();
  const regions = await db
    .select()
    .from(schema.deliveryRegions)
    .where(eq(schema.deliveryRegions.isActive, true))
    .orderBy(asc(schema.deliveryRegions.sortOrder), asc(schema.deliveryRegions.name));
  const zones = regions.length
    ? await db
        .select()
        .from(schema.deliveryZones)
        .where(and(eq(schema.deliveryZones.isActive, true), inArray(schema.deliveryZones.regionId, regions.map((r) => r.id))))
        .orderBy(asc(schema.deliveryZones.sortOrder), asc(schema.deliveryZones.fee))
    : [];
  const slots = await db
    .select()
    .from(schema.timeSlots)
    .where(eq(schema.timeSlots.isActive, true))
    .orderBy(asc(schema.timeSlots.sortOrder), asc(schema.timeSlots.startTime));
  return {
    regions: regions
      .map((r) => ({
        ...r,
        name: pick(locale, r.name, r.nameRu),
        zones: zones
          .filter((z) => z.regionId === r.id)
          .map((z) => ({ ...z, name: pick(locale, z.name, z.nameRu), description: pick(locale, z.description, z.descriptionRu) })),
      }))
      .filter((r) => r.zones.length),
    slots,
  };
}

/** Why a slot cannot be booked; the UI translates it (t.checkout.slotReason). */
export type SlotReason = "past" | "full" | "noSameDay" | "cutoff" | "tooSoon" | "pickZone";
export type SlotOption = { id: number; label: string; available: boolean; reason?: SlotReason };

/**
 * Which time slots can still be booked for a date.
 * zone = null means self-pickup.
 */
export function computeSlots(opts: {
  date: string;
  slots: Slot[];
  zone: Pick<Zone, "sameDayEnabled" | "sameDayCutoff" | "minLeadMinutes"> | null;
  pickupPrepMinutes: number;
  prepMinutes: number;
  booked: Map<number, number>;
  now?: Date;
}): SlotOption[] {
  const now = tashkentNow(opts.now);
  const isToday = opts.date === now.date;
  const lead = Math.max(opts.prepMinutes, opts.zone ? opts.zone.minLeadMinutes : opts.pickupPrepMinutes);

  return opts.slots.map((s) => {
    const base = { id: s.id, label: s.label };
    if (opts.date < now.date) return { ...base, available: false, reason: "past" };
    if (s.capacity != null && (opts.booked.get(s.id) ?? 0) >= s.capacity) {
      return { ...base, available: false, reason: "full" };
    }
    if (isToday) {
      if (opts.zone && !opts.zone.sameDayEnabled) return { ...base, available: false, reason: "noSameDay" };
      if (opts.zone && now.minutes > hhmmToMinutes(opts.zone.sameDayCutoff)) {
        return { ...base, available: false, reason: "cutoff" };
      }
      if (hhmmToMinutes(s.startTime) - now.minutes < lead) return { ...base, available: false, reason: "tooSoon" };
    }
    return { ...base, available: true };
  });
}

export async function bookedSlotCounts(date: string): Promise<Map<number, number>> {
  const db = await getDb();
  const rows = await db
    .select({ slotId: schema.orders.slotId, n: sql<number>`count(*)::int` })
    .from(schema.orders)
    .where(
      and(
        eq(schema.orders.deliveryDate, date),
        sql`${schema.orders.status} NOT IN ('cancelled', 'rejected')`,
      ),
    )
    .groupBy(schema.orders.slotId);
  return new Map(rows.filter((r) => r.slotId != null).map((r) => [r.slotId as number, r.n]));
}

export function dateWindow(maxDaysAhead: number, now?: Date) {
  const today = tashkentNow(now).date;
  return { min: today, max: addDaysISO(today, Math.max(0, maxDaysAhead)) };
}
