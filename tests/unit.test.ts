import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, toCsv } from "@/lib/csv";
import { computeSlots } from "@/lib/delivery";
import { formatPhoneInput } from "@/components/ui/phone-input";
import { formatUZS, maskPhone, normalizePhone } from "@/lib/format";
import { buildAssetLinks } from "@/lib/twa";
import { couponDiscount, deliveryFeeFor, fromPrice, priceLine, type PricingProduct } from "@/lib/pricing";

const fixed: PricingProduct = { pricingMode: "fixed", price: 149_000, stemPrice: null, minStems: null, maxStems: null, stemStep: 1, variants: [] };
const sized: PricingProduct = {
  ...fixed,
  pricingMode: "variants",
  variants: [
    { id: 1, name: "Kichik", price: 229_000, stemCount: 11, isActive: true },
    { id: 2, name: "Katta", price: 790_000, stemCount: 51, isActive: true },
    { id: 3, name: "Eski", price: 10_000, stemCount: 3, isActive: false },
  ],
};
const perStem: PricingProduct = { ...fixed, pricingMode: "per_stem", stemPrice: 17_000, minStems: 5, maxStems: 101, stemStep: 2 };
const addons = [{ productId: 50, name: "Otkritka", price: 15_000 }];

test("fixed price with add-ons and quantity", () => {
  const r = priceLine(fixed, { quantity: 2, addons: [{ productId: 50, quantity: 1 }] }, addons);
  assert.ok(r.ok);
  assert.equal(r.unitPrice, 164_000);
  assert.equal(r.lineTotal, 328_000);
});

test("variant pricing requires an active variant", () => {
  const big = priceLine(sized, { variantId: 2, quantity: 1 }, []);
  assert.ok(big.ok && big.lineTotal === 790_000);
  assert.equal(priceLine(sized, { variantId: 3, quantity: 1 }, []).ok, false);
  assert.equal(priceLine(sized, { quantity: 1 }, []).ok, false);
  assert.equal(fromPrice(sized), 229_000); // inactive cheaper variant ignored
});

test("per-stem pricing enforces range and odd step", () => {
  const ok = priceLine(perStem, { stems: 11, quantity: 1 }, []);
  assert.ok(ok.ok && ok.lineTotal === 187_000);
  assert.equal(priceLine(perStem, { stems: 10, quantity: 1 }, []).ok, false);
  assert.equal(priceLine(perStem, { stems: 3, quantity: 1 }, []).ok, false);
  assert.equal(priceLine(perStem, { stems: 103, quantity: 1 }, []).ok, false);
  assert.equal(fromPrice(perStem), 85_000);
});

test("invalid quantities and unknown add-ons are rejected", () => {
  assert.equal(priceLine(fixed, { quantity: 0 }, []).ok, false);
  assert.equal(priceLine(fixed, { quantity: 21 }, []).ok, false);
  assert.equal(priceLine(fixed, { quantity: 1.5 }, []).ok, false);
  assert.equal(priceLine(fixed, { quantity: 1, addons: [{ productId: 99, quantity: 1 }] }, addons).ok, false);
  assert.equal(priceLine(fixed, { quantity: 1, addons: [{ productId: 50, quantity: 1 }, { productId: 50, quantity: 1 }] }, addons).ok, false);
});

test("coupon and delivery fee rules", () => {
  const c = { code: "X", type: "percent" as const, value: 10, minSubtotal: 200_000, maxDiscount: 100_000 };
  assert.equal(couponDiscount(c, 150_000), 0);
  assert.equal(couponDiscount(c, 694_000), 69_400);
  assert.equal(couponDiscount(c, 5_000_000), 100_000);
  assert.equal(couponDiscount({ ...c, type: "fixed", value: 500_000, maxDiscount: null }, 300_000), 300_000); // never negative total
  assert.equal(deliveryFeeFor({ fee: 30_000, freeFrom: 700_000 }, 699_999), 30_000);
  assert.equal(deliveryFeeFor({ fee: 30_000, freeFrom: 700_000 }, 700_000), 0);
});

test("formatting and phone normalisation", () => {
  assert.equal(formatUZS(1_450_000), "1 450 000 so‘m");
  assert.equal(normalizePhone("90 123 45 67"), "+998901234567");
  assert.equal(normalizePhone("+998 (93) 765-43-21"), "+998937654321");
  assert.equal(normalizePhone("12345"), null);
  assert.equal(normalizePhone("+7 900 123 45 67"), null);
  assert.equal(maskPhone("+998901234567"), "+998 90 *** ** 67");
});

test("time slots: cutoff, lead time, capacity, past dates", () => {
  const slots = [
    { id: 1, label: "09–12", startTime: "09:00", endTime: "12:00", capacity: null, isActive: true, sortOrder: 0 },
    { id: 2, label: "15–18", startTime: "15:00", endTime: "18:00", capacity: 2, isActive: true, sortOrder: 1 },
  ];
  const zone = { sameDayEnabled: true, sameDayCutoff: "18:00", minLeadMinutes: 120 };
  // 2026-10-26 10:00 Tashkent = 05:00 UTC
  const now = new Date("2026-10-26T05:00:00Z");
  const today = computeSlots({ date: "2026-10-26", slots, zone, pickupPrepMinutes: 60, prepMinutes: 60, booked: new Map(), now });
  assert.deepEqual(today.map((s) => s.available), [false, true]);
  const full = computeSlots({ date: "2026-10-27", slots, zone, pickupPrepMinutes: 60, prepMinutes: 60, booked: new Map([[2, 2]]), now });
  assert.deepEqual(full.map((s) => s.available), [true, false]);
  const late = computeSlots({ date: "2026-10-26", slots, zone, pickupPrepMinutes: 60, prepMinutes: 60, booked: new Map(), now: new Date("2026-10-26T13:30:00Z") });
  assert.ok(late.every((s) => !s.available)); // 18:30 > cutoff
  const noSameDay = computeSlots({ date: "2026-10-26", slots, zone: { ...zone, sameDayEnabled: false }, pickupPrepMinutes: 60, prepMinutes: 60, booked: new Map(), now });
  assert.ok(noSameDay.every((s) => !s.available));
  const bridal = computeSlots({ date: "2026-10-26", slots, zone, pickupPrepMinutes: 60, prepMinutes: 1440, booked: new Map(), now });
  assert.ok(bridal.every((s) => !s.available)); // needs a day of preparation
  const past = computeSlots({ date: "2026-10-25", slots, zone, pickupPrepMinutes: 60, prepMinutes: 0, booked: new Map(), now });
  assert.ok(past.every((s) => !s.available));
});

test("CSV round trip with quotes, commas, newlines and formula guard", () => {
  const csv = toCsv([["a", "b"], ['say "hi", ok', "line1\nline2"], ["=SUM(A1)", "1"]]);
  const rows = parseCsv(csv);
  assert.deepEqual(rows[1], ['say "hi", ok', "line1\nline2"]);
  assert.equal(rows[2][0], "'=SUM(A1)");
  assert.deepEqual(parseCsv("slug;name\nx;y\n"), [["slug", "name"], ["x", "y"]]);
});

test("phone input formatting while typing", () => {
  assert.equal(formatPhoneInput("901234567"), "+998 90 123 45 67");
  assert.equal(formatPhoneInput("+998901234567"), "+998 90 123 45 67");
  assert.equal(formatPhoneInput("90 12"), "+998 90 12");
  assert.equal(formatPhoneInput("+99"), "+99"); // typing the prefix by hand
  assert.equal(formatPhoneInput("90123456789999"), "+998 90 123 45 67"); // extra digits dropped
  assert.equal(formatPhoneInput(""), "");
});

test("Android app asset links: only served when package and fingerprints are valid", () => {
  const fp = Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0")).join(":");
  assert.equal(buildAssetLinks("", ""), null);
  assert.equal(buildAssetLinks("uz.gulzor.app", ""), null);
  assert.equal(buildAssetLinks("uz.gulzor.app", "AB:CD"), null); // truncated fingerprint
  assert.equal(buildAssetLinks("Gulzor App", fp), null); // not a package name
  const links = buildAssetLinks("uz.gulzor.app", `${fp}, ${fp.toUpperCase()}\n${"FF:".repeat(31)}FF`);
  assert.deepEqual(links?.[0].relation, ["delegate_permission/common.handle_all_urls"]);
  assert.equal(links?.[0].target.package_name, "uz.gulzor.app");
  assert.deepEqual(links?.[0].target.sha256_cert_fingerprints, [fp.toUpperCase(), `${"FF:".repeat(31)}FF`]);
});
