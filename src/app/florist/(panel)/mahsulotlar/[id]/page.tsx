import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { floristSaveProductAction } from "@/app/florist/actions";
import { ProductForm } from "@/components/admin/product-form";
import { getDb, schema } from "@/db";
import { requireFlorist } from "@/lib/auth";

export const metadata = { title: "Mahsulot" };

export default async function FloristProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saqlandi?: string }> }) {
  const me = await requireFlorist();
  const [{ id }, { saqlandi }] = await Promise.all([params, searchParams]);
  const db = await getDb();
  const categories = await db.select().from(schema.categories).where(eq(schema.categories.isActive, true)).orderBy(asc(schema.categories.kind), asc(schema.categories.sortOrder));
  const back = (
    <Link href="/florist/mahsulotlar" className="text-sm text-muted hover:text-wine">
      ← Mahsulotlar
    </Link>
  );

  if (id === "yangi") {
    return (
      <div className="max-w-4xl">
        {back}
        <h1 className="mt-2 mb-6 text-4xl">Yangi mahsulot</h1>
        <ProductForm product={null} variants={[]} categoryIds={[]} categories={categories} saveAction={floristSaveProductAction} floristMode />
      </div>
    );
  }

  const pid = Number(id);
  if (!Number.isInteger(pid)) notFound();
  // Only this florist's own product; anything else is "not found".
  const [product] = await db.select().from(schema.products).where(and(eq(schema.products.id, pid), eq(schema.products.floristId, me.floristId)));
  if (!product) notFound();
  const [variants, pcs] = await Promise.all([
    db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, pid)).orderBy(asc(schema.productVariants.sortOrder)),
    db.select().from(schema.productCategories).where(eq(schema.productCategories.productId, pid)),
  ]);

  return (
    <div className="max-w-4xl">
      {back}
      <h1 className="mt-2 mb-6 text-4xl">{product.name}</h1>
      {saqlandi ? (
        <p role="status" className="mb-4 rounded-xl border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Mahsulot saqlandi.
        </p>
      ) : null}
      <ProductForm
        product={product}
        variants={variants}
        categoryIds={pcs.map((c) => c.categoryId)}
        categories={categories}
        saveAction={floristSaveProductAction}
        floristMode
      />
    </div>
  );
}
