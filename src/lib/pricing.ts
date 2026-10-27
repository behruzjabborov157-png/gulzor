/**
 * Pure pricing rules shared by the product page (preview) and the server
 * (authoritative). The server ALWAYS recomputes totals from database prices.
 */

export const MAX_LINE_QUANTITY = 20;
export const MAX_ADDON_QUANTITY = 5;

export type PricingVariant = { id: number; name: string; price: number; stemCount: number | null; isActive: boolean };
export type PricingProduct = {
  pricingMode: "fixed" | "variants" | "per_stem";
  price: number;
  stemPrice: number | null;
  minStems: number | null;
  maxStems: number | null;
  stemStep: number;
  variants: PricingVariant[];
};
export type AddonPrice = { productId: number; name: string; price: number };
export type LineSelection = {
  variantId?: number | null;
  stems?: number | null;
  addons?: { productId: number; quantity: number }[];
  quantity: number;
};
export type PricedAddon = { productId: number; name: string; unitPrice: number; quantity: number };

export type PricedLine =
  | {
      ok: true;
      basePrice: number;
      addonsTotal: number;
      unitPrice: number;
      lineTotal: number;
      variantName: string | null;
      stems: number | null;
      addons: PricedAddon[];
    }
  | { ok: false; error: PriceError };

/** Machine-readable pricing problem; translated with t.errors.price[code] and params. */
export type PriceError = {
  code: "quantity" | "size" | "noPrice" | "stems" | "addonDuplicate" | "addonMissing" | "addonQuantity";
  params?: Record<string, number>;
};

export function priceLine(p: PricingProduct, sel: LineSelection, addonCatalog: AddonPrice[]): PricedLine {
  if (!Number.isInteger(sel.quantity) || sel.quantity < 1 || sel.quantity > MAX_LINE_QUANTITY) {
    return { ok: false, error: { code: "quantity", params: { max: MAX_LINE_QUANTITY } } };
  }

  let basePrice = p.price;
  let variantName: string | null = null;
  let stems: number | null = null;

  if (p.pricingMode === "variants") {
    const v = p.variants.find((x) => x.id === sel.variantId && x.isActive);
    if (!v) return { ok: false, error: { code: "size" } };
    basePrice = v.price;
    variantName = v.name;
    stems = v.stemCount;
  } else if (p.pricingMode === "per_stem") {
    const min = p.minStems ?? 1;
    const max = p.maxStems ?? 201;
    const step = Math.max(1, p.stemStep || 1);
    const n = sel.stems ?? NaN;
    if (!p.stemPrice) return { ok: false, error: { code: "noPrice" } };
    if (!Number.isInteger(n) || n < min || n > max || (n - min) % step !== 0) {
      return { ok: false, error: { code: "stems", params: { min, max } } };
    }
    basePrice = p.stemPrice * n;
    stems = n;
  }

  if (!Number.isFinite(basePrice) || basePrice <= 0) return { ok: false, error: { code: "noPrice" } };

  const addons: PricedAddon[] = [];
  const seen = new Set<number>();
  for (const a of sel.addons ?? []) {
    if (seen.has(a.productId)) return { ok: false, error: { code: "addonDuplicate" } };
    seen.add(a.productId);
    const found = addonCatalog.find((x) => x.productId === a.productId);
    if (!found) return { ok: false, error: { code: "addonMissing" } };
    if (!Number.isInteger(a.quantity) || a.quantity < 1 || a.quantity > MAX_ADDON_QUANTITY) {
      return { ok: false, error: { code: "addonQuantity" } };
    }
    addons.push({ productId: found.productId, name: found.name, unitPrice: found.price, quantity: a.quantity });
  }
  const addonsTotal = addons.reduce((s, a) => s + a.unitPrice * a.quantity, 0);
  const unitPrice = basePrice + addonsTotal;
  return { ok: true, basePrice, addonsTotal, unitPrice, lineTotal: unitPrice * sel.quantity, variantName, stems, addons };
}

/** Lowest price a customer can pay for the product (cards, filters, sorting). */
export function fromPrice(p: PricingProduct): number {
  if (p.pricingMode === "variants") {
    const prices = p.variants.filter((v) => v.isActive).map((v) => v.price);
    return prices.length ? Math.min(...prices) : p.price;
  }
  if (p.pricingMode === "per_stem" && p.stemPrice) return p.stemPrice * (p.minStems ?? 1);
  return p.price;
}

export type CouponRule = {
  code: string;
  type: "percent" | "fixed";
  value: number;
  minSubtotal: number;
  maxDiscount: number | null;
};

export function couponDiscount(c: CouponRule, subtotal: number): number {
  if (subtotal < c.minSubtotal) return 0;
  let d = c.type === "percent" ? Math.floor((subtotal * c.value) / 100) : c.value;
  if (c.maxDiscount != null) d = Math.min(d, c.maxDiscount);
  return Math.max(0, Math.min(d, subtotal));
}

export type DeliveryRule = { fee: number; freeFrom: number | null };

export function deliveryFeeFor(rule: DeliveryRule | null, amount: number): number {
  if (!rule) return 0;
  if (rule.freeFrom != null && amount >= rule.freeFrom) return 0;
  return rule.fee;
}
