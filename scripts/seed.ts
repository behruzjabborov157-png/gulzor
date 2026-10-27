import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";
loadEnv();
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";
import { DEFAULT_CHECKOUT, DEFAULT_STORE } from "@/lib/settings";
import { buildSearchText } from "@/lib/search";
import { CARE_BOX, CARE_CUT, CARE_DEFAULT, CARE_PLANT, CATEGORIES, PRODUCTS } from "./seed-data";
import { CARE_RU, CATEGORIES_RU, PRODUCTS_RU, VARIANT_RU } from "./seed-data-ru";

const careRu = new Map([
  [CARE_CUT, CARE_RU.cut],
  [CARE_BOX, CARE_RU.box],
  [CARE_PLANT, CARE_RU.plant],
]);

type Credit = { file: string; title: string; author: string; license: string; source: string };

async function main() {
  const reset = process.argv.includes("--reset");
  // --no-demo: clean production start — categories, time slots and settings only; delivery zones are
  // created switched OFF (enter your real fees first) and no demo products or coupon are added.
  const noDemo = process.argv.includes("--no-demo");
  const db = await getDb();

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.categories);
  if (n > 0 && !reset) {
    console.log(`Catalog already has ${n} categories — skipping. Use "npm run db:seed -- --reset" to wipe catalog/delivery data and reseed (orders are kept).`);
    await closeDb();
    return;
  }

  const creditsFile = path.resolve("public/images/demo/credits.json");
  const credits: Credit[] = fs.existsSync(creditsFile) ? JSON.parse(fs.readFileSync(creditsFile, "utf8")) : [];
  const img = (slug: string, alt: string) => {
    const file = `/images/demo/${slug}.webp`;
    const c = credits.find((x) => x.file === file);
    return { url: file, alt, credit: c?.author, license: c?.license, sourceUrl: c?.source };
  };

  await db.transaction(async (tx) => {
    if (reset) {
      await tx.delete(schema.productCategories);
      await tx.delete(schema.productVariants);
      await tx.update(schema.orderItems).set({ productId: null });
      await tx.delete(schema.favorites);
      await tx.delete(schema.products);
      await tx.delete(schema.categories);
      await tx.delete(schema.timeSlots);
      await tx.delete(schema.deliveryZones);
      await tx.delete(schema.deliveryRegions);
      await tx.delete(schema.coupons);
    }

    const cats = await tx
      .insert(schema.categories)
      .values(
        CATEGORIES.map((c, i) => ({
          slug: c.slug,
          name: c.name,
          kind: c.kind,
          description: c.description,
          nameRu: CATEGORIES_RU[c.slug]?.name ?? null,
          descriptionRu: CATEGORIES_RU[c.slug]?.description ?? null,
          imageUrl: c.image ? `/images/demo/${c.image}.webp` : null,
          sortOrder: i,
        })),
      )
      .returning();
    const catId = new Map(cats.map((c) => [c.slug, c.id]));

    for (const p of noDemo ? [] : PRODUCTS) {
      const mode = p.variants ? "variants" : p.perStem ? "per_stem" : "fixed";
      const ru = PRODUCTS_RU[p.slug];
      const care = p.addon ? "" : (p.care ?? CARE_DEFAULT);
      const [row] = await tx
        .insert(schema.products)
        .values({
          slug: p.slug,
          name: p.name,
          shortDescription: p.short,
          description: p.description,
          careInstructions: care,
          nameRu: ru?.name ?? null,
          shortDescriptionRu: ru?.short ?? null,
          descriptionRu: ru?.description ?? null,
          careInstructionsRu: care ? (careRu.get(care) ?? null) : null,
          sizeLabelRu: ru?.size ?? null,
          flowerVarietiesRu: ru?.flowers ?? [],
          colorOptionsRu: ru?.colors ?? [],
          searchText: buildSearchText({
            name: p.name,
            nameRu: ru?.name,
            shortDescription: p.short,
            shortDescriptionRu: ru?.short,
            flowerVarieties: p.flowers,
            flowerVarietiesRu: ru?.flowers,
          }),
          flowerVarieties: p.flowers,
          stemCount: p.stems ?? null,
          sizeLabel: p.size ?? null,
          primaryCategoryId: catId.get(p.categories[0]) ?? null,
          images: p.images.map((s, i) => img(s, i === 0 ? p.name : `${p.name} — ${i + 1}-rasm`)),
          pricingMode: mode,
          price: p.price ?? 0,
          stemPrice: p.perStem?.price ?? null,
          minStems: p.perStem?.min ?? null,
          maxStems: p.perStem?.max ?? null,
          stemStep: p.perStem?.step ?? 1,
          colorOptions: p.colors ?? [],
          status: "active",
          availability: p.availability ?? "in_stock",
          stockQuantity: p.stock ?? null,
          seasonalMonths: p.seasonalMonths ?? [],
          prepTimeMinutes: p.prep ?? (p.addon ? 0 : 60),
          isAddon: p.addon ?? false,
          isDemo: true,
          isFeatured: p.featured ?? false,
          isNew: p.isNew ?? false,
          isPremium: p.premium ?? false,
          salesCount: p.sales ?? 0,
        })
        .returning();
      if (p.variants) {
        await tx.insert(schema.productVariants).values(
          p.variants.map((v, i) => ({ productId: row.id, name: v.name, nameRu: VARIANT_RU[v.name] ?? null, stemCount: v.stems ?? null, price: v.price, compareAtPrice: v.compareAt ?? null, sortOrder: i })),
        );
      }
      const ids = [...new Set(p.categories.map((s) => catId.get(s)).filter((x): x is number => x != null))];
      // Every non-gift product also belongs to the "guldastalar" or plants listing via its own categories.
      await tx.insert(schema.productCategories).values(ids.map((categoryId) => ({ productId: row.id, categoryId })));
    }

    /* Delivery — DEMO values. Configure real areas, fees and windows in /admin/yetkazib-berish. */
    const [tashkent] = await tx
      .insert(schema.deliveryRegions)
      .values({ slug: "toshkent-shahri", name: "Toshkent shahri", nameRu: "Ташкент", sortOrder: 0, note: "Demo sozlama — haqiqiy hududlar va narxlarni admin panelda kiriting." })
      .returning();
    await tx.insert(schema.deliveryRegions).values({
      slug: "samarqand-shahri",
      name: "Samarqand shahri",
      nameRu: "Самарканд",
      isActive: false,
      sortOrder: 1,
      note: "O‘chirilgan: xizmat yo‘lga qo‘yilganda yoqing.",
    });
    await tx.insert(schema.deliveryZones).values([
      {
        regionId: tashkent.id,
        isActive: !noDemo,
        name: "Markaziy tumanlar",
        description: "Mirobod, Yakkasaroy, Shayxontohur, Yunusobod, Mirzo Ulug‘bek, Chilonzor, Olmazor, Uchtepa, Yashnobod",
        nameRu: "Центральные районы",
        descriptionRu: "Мирабадский, Яккасарайский, Шайхантахурский, Юнусабадский, Мирзо-Улугбекский, Чиланзарский, Алмазарский, Учтепинский, Яшнабадский",
        fee: 30_000,
        freeFrom: 700_000,
        minOrder: 100_000,
        sameDayEnabled: true,
        sameDayCutoff: "18:00",
        minLeadMinutes: 120,
        sortOrder: 0,
      },
      {
        regionId: tashkent.id,
        isActive: !noDemo,
        name: "Chekka tumanlar",
        description: "Sergeli, Bektemir, Yangihayot",
        nameRu: "Отдалённые районы",
        descriptionRu: "Сергелийский, Бектемирский, Янгихаётский",
        fee: 45_000,
        freeFrom: 1_000_000,
        minOrder: 150_000,
        sameDayEnabled: true,
        sameDayCutoff: "17:00",
        minLeadMinutes: 180,
        sortOrder: 1,
      },
    ]);
    await tx.insert(schema.timeSlots).values([
      { label: "09:00 – 12:00", startTime: "09:00", endTime: "12:00", sortOrder: 0 },
      { label: "12:00 – 15:00", startTime: "12:00", endTime: "15:00", sortOrder: 1 },
      { label: "15:00 – 18:00", startTime: "15:00", endTime: "18:00", sortOrder: 2 },
      { label: "18:00 – 21:00", startTime: "18:00", endTime: "21:00", sortOrder: 3 },
    ]);
    if (!noDemo) await tx.insert(schema.coupons).values({ code: "DEMO10", type: "percent", value: 10, minSubtotal: 200_000, maxDiscount: 100_000, isActive: true });

    for (const [key, value] of [
      ["store", DEFAULT_STORE],
      ["checkout", { ...DEFAULT_CHECKOUT, demoMode: !noDemo }],
    ] as const) {
      await tx
        .insert(schema.settings)
        .values({ key, value })
        .onConflictDoNothing();
    }
  });

  console.log(
    noDemo
      ? `Seeded ${CATEGORIES.length} categories, time slots and settings. Delivery zones are OFF — set real fees in /admin/yetkazib-berish, then add products.`
      : `Seeded ${CATEGORIES.length} categories and ${PRODUCTS.length} demo products.`,
  );
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
