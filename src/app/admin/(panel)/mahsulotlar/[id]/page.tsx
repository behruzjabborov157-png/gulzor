import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ProductForm } from "@/components/admin/product-form";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Mahsulot" };

export default async function ProductEditPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saqlandi?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { saqlandi } = await searchParams;
  const db = await getDb();
  const categories = await db.select().from(schema.categories).orderBy(asc(schema.categories.kind), asc(schema.categories.sortOrder));

  if (id === "yangi") {
    return (
      <div className="max-w-4xl">
        <Link href="/admin/mahsulotlar" className="text-sm text-muted hover:text-forest">← Mahsulotlar</Link>
        <h1 className="mt-2 mb-6 text-4xl">Yangi mahsulot</h1>
        <ProductForm product={null} variants={[]} categoryIds={[]} categories={categories} />
      </div>
    );
  }

  const pid = Number(id);
  if (!Number.isInteger(pid)) notFound();
  const [product] = await db.select().from(schema.products).where(eq(schema.products.id, pid));
  if (!product) notFound();
  const variants = await db.select().from(schema.productVariants).where(eq(schema.productVariants.productId, pid)).orderBy(asc(schema.productVariants.sortOrder));
  const pcs = await db.select().from(schema.productCategories).where(eq(schema.productCategories.productId, pid));

  return (
    <div className="max-w-4xl">
      <Link href="/admin/mahsulotlar" className="text-sm text-muted hover:text-forest">← Mahsulotlar</Link>
      <div className="mt-2 mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-4xl">{product.name}</h1>
        {product.status === "active" ? <Link href={`/gul/${product.slug}`} target="_blank" className="text-sm text-forest underline">Saytda ko‘rish ↗</Link> : null}
      </div>
      {saqlandi ? <p className="mb-4 rounded-xl bg-success/5 px-4 py-3 text-sm text-success" role="status">Mahsulot yaratildi.</p> : null}
      <ProductForm product={product} variants={variants} categoryIds={pcs.map((x) => x.categoryId)} categories={categories} />
    </div>
  );
}
