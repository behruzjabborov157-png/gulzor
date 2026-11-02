/**
 * Adds the English texts of the demo catalog to a database seeded before English existed.
 * Safe to repeat: only empty English fields are filled, and only demo products are touched.
 *   npm run db:seed-en
 */
import { loadEnv } from "./env";
loadEnv();
import { and, eq, isNull } from "drizzle-orm";
import { closeDb, getDb, schema } from "@/db";
import { buildSearchText } from "@/lib/search";
import { CARE_CUT, CARE_BOX, CARE_PLANT } from "./seed-data";
import { CARE_EN, CATEGORIES_EN, PRODUCTS_EN, VARIANT_EN } from "./seed-data-en";

const careEn = new Map([
  [CARE_CUT, CARE_EN.cut],
  [CARE_BOX, CARE_EN.box],
  [CARE_PLANT, CARE_EN.plant],
]);

async function main() {
  const db = await getDb();
  const counts = { categories: 0, products: 0, variants: 0 };
  for (const [slug, c] of Object.entries(CATEGORIES_EN)) {
    const res = await db
      .update(schema.categories)
      .set({ nameEn: c.name, descriptionEn: c.description })
      .where(and(eq(schema.categories.slug, slug), isNull(schema.categories.nameEn)))
      .returning({ id: schema.categories.id });
    counts.categories += res.length;
  }
  const products = await db.select().from(schema.products).where(and(eq(schema.products.isDemo, true), isNull(schema.products.nameEn)));
  for (const p of products) {
    const en = PRODUCTS_EN[p.slug];
    if (!en) continue;
    const values = {
      nameEn: en.name,
      shortDescriptionEn: en.short,
      descriptionEn: en.description,
      careInstructionsEn: careEn.get(p.careInstructions) ?? null,
      sizeLabelEn: en.size ?? null,
      flowerVarietiesEn: en.flowers,
      colorOptionsEn: en.colors ?? [],
    };
    await db
      .update(schema.products)
      .set({ ...values, searchText: buildSearchText({ ...p, ...values }) })
      .where(eq(schema.products.id, p.id));
    counts.products++;
    for (const [uz, name] of Object.entries(VARIANT_EN)) {
      const res = await db
        .update(schema.productVariants)
        .set({ nameEn: name })
        .where(and(eq(schema.productVariants.productId, p.id), eq(schema.productVariants.name, uz), isNull(schema.productVariants.nameEn)))
        .returning({ id: schema.productVariants.id });
      counts.variants += res.length;
    }
  }
  console.log(`English added: ${counts.categories} categories, ${counts.products} products, ${counts.variants} variants.`);
  await closeDb();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
