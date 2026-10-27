import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getAdmin } from "@/lib/auth";
import { PRODUCT_CSV_COLUMNS, toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await getAdmin();
  if (!admin || admin.role !== "owner") return new Response("Not found", { status: 404 });
  const db = await getDb();
  const products = await db.select().from(schema.products).orderBy(asc(schema.products.id));
  const links = await db
    .select({ productId: schema.productCategories.productId, slug: schema.categories.slug })
    .from(schema.productCategories)
    .innerJoin(schema.categories, eq(schema.categories.id, schema.productCategories.categoryId));

  const rows = products.map((p) => [
    p.slug,
    p.name,
    p.price,
    p.compareAtPrice,
    p.status,
    p.availability,
    p.stockQuantity,
    links.filter((l) => l.productId === p.id).map((l) => l.slug).join("|"),
    p.flowerVarieties.join("|"),
    p.stemCount,
    p.sizeLabel,
    p.shortDescription,
    p.description,
    p.careInstructions,
    p.prepTimeMinutes,
    p.images[0]?.url ?? "",
    p.isDemo ? "1" : "0",
    p.nameRu,
    p.shortDescriptionRu,
    p.descriptionRu,
    p.careInstructionsRu,
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return new Response(toCsv([PRODUCT_CSV_COLUMNS, ...rows]), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gulzor-mahsulotlar-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
