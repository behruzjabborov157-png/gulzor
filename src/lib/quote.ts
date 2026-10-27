import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { DEFAULT_LOCALE, fmt, pick, type Locale } from "@/i18n/config";
import { getDict, priceErrorText } from "@/i18n/dict";
import { isOrderable, stockState, toPricing, type StockState } from "@/lib/catalog";
import { bookedSlotCounts, computeSlots, dateWindow, getDeliveryConfig, type SlotOption } from "@/lib/delivery";
import { formatUZS } from "@/lib/format";
import { couponDiscount, deliveryFeeFor, MAX_ADDON_QUANTITY, MAX_LINE_QUANTITY, priceLine, type PricedAddon } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";
import { isISODate } from "@/lib/time";

export const cartLineSchema = z.object({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable().optional(),
  stems: z.number().int().positive().max(1001).nullable().optional(),
  color: z.string().max(40).nullable().optional(),
  addons: z
    .array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(MAX_ADDON_QUANTITY) }))
    .max(10)
    .default([]),
  quantity: z.number().int().min(1).max(MAX_LINE_QUANTITY),
});
export type CartLineInput = z.infer<typeof cartLineSchema>;

export const quoteInputSchema = z.object({
  lines: z.array(cartLineSchema).min(0).max(30),
  couponCode: z.string().trim().max(40).optional().nullable(),
  fulfillment: z.enum(["delivery", "pickup"]).optional(),
  zoneId: z.number().int().positive().optional().nullable(),
  date: z.string().optional().nullable(),
  slotId: z.number().int().positive().optional().nullable(),
});
export type QuoteInput = z.infer<typeof quoteInputSchema>;

export type QuotedLine = {
  index: number;
  productId: number;
  slug: string | null;
  /** Name in the customer's language (for display). */
  name: string;
  /** Uzbek originals — stored on the order so the admin panel and Telegram stay in Uzbek. */
  nameUz: string;
  variantNameUz: string | null;
  addonsUz: PricedAddon[];
  image: string | null;
  variantId: number | null;
  variantName: string | null;
  stems: number | null;
  /** Stored colour value (Uzbek option) and its label in the customer's language. */
  color: string | null;
  colorLabel: string | null;
  addons: PricedAddon[];
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  isDemo: boolean;
  prepTimeMinutes: number;
  stock: StockState | "missing";
  error: string | null;
};

export type Quote = {
  lines: QuotedLine[];
  subtotal: number;
  discount: number;
  coupon: { code: string; applied: boolean; message: string } | null;
  deliveryFee: number;
  serviceFee: number;
  serviceFeeLabel: string;
  total: number;
  zone: {
    id: number;
    name: string;
    regionId: number;
    regionName: string;
    nameUz: string;
    regionNameUz: string;
    fee: number;
    freeFrom: number | null;
    minOrder: number | null;
  } | null;
  slots: SlotOption[];
  prepMinutes: number;
  containsDemo: boolean;
  /** Blocking problems (in the customer's language); checkout must not proceed while non-empty. */
  errors: string[];
};

export async function quoteCart(input: QuoteInput, opts: { forCheckout?: boolean; locale?: Locale } = {}): Promise<Quote> {
  const locale = opts.locale ?? DEFAULT_LOCALE;
  const t = getDict(locale).errors.quote;
  const uzs = (n: number) => formatUZS(n, locale);
  const db = await getDb();
  const { checkout } = await getSettings();
  const errors: string[] = [];

  /* ---- Load products, variants and add-ons in bulk ---- */
  const ids = new Set<number>();
  for (const l of input.lines) {
    ids.add(l.productId);
    for (const a of l.addons) ids.add(a.productId);
  }
  const prods = ids.size ? await db.select().from(schema.products).where(inArray(schema.products.id, [...ids])) : [];
  const vars = ids.size
    ? await db.select().from(schema.productVariants).where(inArray(schema.productVariants.productId, [...ids]))
    : [];

  const prodById = new Map(prods.map((x) => [x.id, x]));
  const orderableAddons = prods.filter((x) => x.isAddon && x.status === "active" && isOrderable(stockState(x, [])));
  const addonCatalog = orderableAddons.map((x) => ({ productId: x.id, name: pick(locale, x.name, x.nameRu), price: x.price }));
  const addonCatalogUz = orderableAddons.map((x) => ({ productId: x.id, name: x.name, price: x.price }));

  /* ---- Price every line ---- */
  const demand = new Map<string, number>(); // stock key -> requested quantity
  const lines: QuotedLine[] = input.lines.map((l, index) => {
    const prod = prodById.get(l.productId);
    const base: QuotedLine = {
      index,
      productId: l.productId,
      slug: prod?.slug ?? null,
      name: prod ? pick(locale, prod.name, prod.nameRu) : t.productMissing,
      nameUz: prod?.name ?? t.productMissing,
      variantNameUz: null,
      addonsUz: [],
      image: prod?.images[0]?.url ?? null,
      variantId: l.variantId ?? null,
      variantName: null,
      stems: l.stems ?? null,
      color: l.color ?? null,
      colorLabel: l.color ?? null,
      addons: [],
      quantity: l.quantity,
      unitPrice: 0,
      lineTotal: 0,
      isDemo: prod?.isDemo ?? false,
      prepTimeMinutes: prod?.prepTimeMinutes ?? 0,
      stock: "missing",
      error: null,
    };
    if (!prod || prod.status !== "active") return { ...base, error: t.notForSale };

    const pvs = vars.filter((v) => v.productId === prod.id);
    const stock = stockState(prod, pvs);
    base.stock = stock;
    if (!isOrderable(stock)) return { ...base, error: stock === "out_of_season" ? t.outOfSeason : t.outOfStock };
    if (input.fulfillment === "delivery" && !prod.deliveryEligible) return { ...base, error: t.noDelivery };
    if (input.fulfillment === "pickup" && !prod.pickupEligible) return { ...base, error: t.noPickup };
    if (l.color && prod.colorOptions.length && !prod.colorOptions.includes(l.color)) {
      return { ...base, error: t.colorMissing };
    }
    if (l.color && locale === "ru") base.colorLabel = prod.colorOptionsRu[prod.colorOptions.indexOf(l.color)] || l.color;

    const others = <T extends { productId: number }>(c: T[]) => c.filter((a) => a.productId !== prod.id);
    const priced = priceLine(toPricing(prod, pvs, locale), l, others(addonCatalog));
    if (!priced.ok) return { ...base, error: priceErrorText(locale, priced.error) };
    // Same calculation with Uzbek names, for what gets stored on the order.
    const pricedUz = priceLine(toPricing(prod, pvs), l, others(addonCatalogUz));

    if (prod.pricingMode === "variants" && l.variantId) {
      const k = `v:${l.variantId}`;
      demand.set(k, (demand.get(k) ?? 0) + l.quantity);
    }
    demand.set(`p:${prod.id}`, (demand.get(`p:${prod.id}`) ?? 0) + l.quantity);
    for (const a of priced.addons) demand.set(`p:${a.productId}`, (demand.get(`p:${a.productId}`) ?? 0) + a.quantity * l.quantity);

    return {
      ...base,
      variantName: priced.variantName,
      variantNameUz: pricedUz.ok ? pricedUz.variantName : priced.variantName,
      stems: priced.stems,
      addons: priced.addons,
      addonsUz: pricedUz.ok ? pricedUz.addons : priced.addons,
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal,
    };
  });

  /* ---- Stock limits (aggregated across lines) ---- */
  for (const [key, qty] of demand) {
    const [kind, idStr] = key.split(":");
    const id = Number(idStr);
    const available = kind === "v" ? vars.find((v) => v.id === id)?.stockQuantity : prodById.get(id)?.stockQuantity;
    if (available != null && qty > available) {
      const prod = kind === "v" ? prodById.get(vars.find((v) => v.id === id)!.productId) : prodById.get(id);
      const name = prod ? pick(locale, prod.name, prod.nameRu) : "";
      errors.push(fmt(t.stockLimit, { name, n: available }));
      for (const line of lines) {
        const hit = kind === "v" ? line.variantId === id : line.productId === id || line.addons.some((a) => a.productId === id);
        if (hit && !line.error) line.error = fmt(t.stockLimitLine, { n: available });
      }
    }
  }

  const lineErrors = lines.filter((l) => l.error);
  if (lineErrors.length) errors.push(t.someUnavailable);
  if (opts.forCheckout && lines.length === 0) errors.push(t.emptyCart);

  const valid = lines.filter((l) => !l.error);
  const subtotal = valid.reduce((s, l) => s + l.lineTotal, 0);
  const prepMinutes = valid.reduce((m, l) => Math.max(m, l.prepTimeMinutes), 0);

  /* ---- Coupon ---- */
  let discount = 0;
  let coupon: Quote["coupon"] = null;
  const code = input.couponCode?.trim().toUpperCase();
  if (code) {
    if (!checkout.couponsEnabled) {
      coupon = { code, applied: false, message: t.couponsOff };
    } else {
      const [cp] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, code));
      const now = new Date();
      if (!cp || !cp.isActive || (cp.startsAt && cp.startsAt > now) || (cp.endsAt && cp.endsAt < now)) {
        coupon = { code, applied: false, message: t.couponInvalid };
      } else if (cp.usageLimit != null && cp.usedCount >= cp.usageLimit) {
        coupon = { code, applied: false, message: t.couponExhausted };
      } else if (subtotal < cp.minSubtotal) {
        coupon = { code, applied: false, message: fmt(t.couponMin, { amount: uzs(cp.minSubtotal) }) };
      } else {
        discount = couponDiscount(cp, subtotal);
        coupon = { code, applied: true, message: fmt(t.couponApplied, { amount: uzs(discount) }) };
      }
    }
    if (opts.forCheckout && coupon && !coupon.applied) errors.push(coupon.message);
  }
  const afterDiscount = subtotal - discount;

  /* ---- Delivery ---- */
  let zone: Quote["zone"] = null;
  let deliveryFee = 0;
  if (input.fulfillment === "delivery" && input.zoneId) {
    const [row] = await db
      .select({ z: schema.deliveryZones, r: schema.deliveryRegions })
      .from(schema.deliveryZones)
      .innerJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.deliveryZones.regionId))
      .where(and(eq(schema.deliveryZones.id, input.zoneId), eq(schema.deliveryZones.isActive, true), eq(schema.deliveryRegions.isActive, true)));
    if (!row) {
      errors.push(t.zoneUnavailable);
    } else {
      zone = {
        id: row.z.id,
        name: pick(locale, row.z.name, row.z.nameRu),
        regionId: row.r.id,
        regionName: pick(locale, row.r.name, row.r.nameRu),
        nameUz: row.z.name,
        regionNameUz: row.r.name,
        fee: row.z.fee,
        freeFrom: row.z.freeFrom,
        minOrder: row.z.minOrder,
      };
      deliveryFee = deliveryFeeFor(row.z, afterDiscount);
      if (row.z.minOrder != null && afterDiscount < row.z.minOrder) {
        errors.push(fmt(t.zoneMinOrder, { amount: uzs(row.z.minOrder) }));
      }
    }
  } else if (opts.forCheckout && input.fulfillment === "delivery") {
    errors.push(t.zoneRequired);
  }
  if (input.fulfillment === "pickup" && !checkout.pickupEnabled) errors.push(t.pickupOff);

  /* ---- Date & slot ---- */
  let slots: SlotOption[] = [];
  if (input.date && isISODate(input.date) && input.fulfillment) {
    const win = dateWindow(checkout.maxDaysAhead);
    if (input.date < win.min || input.date > win.max) {
      errors.push(t.dateInvalid);
    } else {
      const { slots: all } = await getDeliveryConfig();
      let zoneRow = null;
      if (zone) {
        [zoneRow] = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.id, zone.id));
      }
      slots = computeSlots({
        date: input.date,
        slots: all,
        zone: input.fulfillment === "pickup" ? null : (zoneRow ?? null),
        pickupPrepMinutes: checkout.pickupPrepMinutes,
        prepMinutes,
        booked: await bookedSlotCounts(input.date),
      });
      if (input.fulfillment === "delivery" && !zoneRow) slots = slots.map((s) => ({ ...s, available: false, reason: "pickZone" as const }));
    }
  } else if (opts.forCheckout) {
    errors.push(t.dateRequired);
  }
  if (opts.forCheckout) {
    const chosen = slots.find((s) => s.id === input.slotId);
    if (!chosen) errors.push(t.slotRequired);
    else if (!chosen.available) errors.push(t.slotUnavailable);
  }

  const serviceFee = valid.length ? checkout.serviceFee : 0;
  const total = afterDiscount + deliveryFee + serviceFee;

  return {
    lines,
    subtotal,
    discount,
    coupon,
    deliveryFee,
    serviceFee,
    serviceFeeLabel: pick(locale, checkout.serviceFeeLabel, checkout.serviceFeeLabelRu),
    total,
    zone,
    slots,
    prepMinutes,
    containsDemo: valid.some((l) => l.isDemo),
    errors: [...new Set(errors)],
  };
}

type Tx = Parameters<Parameters<Awaited<ReturnType<typeof getDb>>["transaction"]>[0]>[0];

/** Atomically reserves (or with sign = -1 releases) stock inside a transaction. Throws StockError if anything ran out. */
export async function adjustStock(tx: Tx, items: { productId: number | null; variantId: number | null; quantity: number; addons: { productId: number; quantity: number }[] }[], sign: 1 | -1 = 1) {
  const take = new Map<string, number>();
  const add = (k: string, n: number) => take.set(k, (take.get(k) ?? 0) + n);
  for (const l of items) {
    if (l.productId) add(`p:${l.productId}`, l.quantity);
    if (l.variantId) add(`v:${l.variantId}`, l.quantity);
    for (const a of l.addons) add(`p:${a.productId}`, a.quantity * l.quantity);
  }
  for (const [key, qty] of take) {
    const [kind, idStr] = key.split(":");
    const id = Number(idStr);
    const t = kind === "p" ? schema.products : schema.productVariants;
    const delta = qty * sign;
    const res = await tx
      .update(t)
      .set({ stockQuantity: sql`CASE WHEN ${t.stockQuantity} IS NULL THEN NULL ELSE ${t.stockQuantity} - ${delta} END` })
      .where(and(eq(t.id, id), sign === 1 ? sql`(${t.stockQuantity} IS NULL OR ${t.stockQuantity} >= ${qty})` : sql`TRUE`))
      .returning({ id: t.id });
    if (sign === 1 && !res.length) throw new StockError();
  }
}

export class StockError extends Error {
  constructor() {
    super("Omborda yetarli mahsulot qolmadi");
  }
}
