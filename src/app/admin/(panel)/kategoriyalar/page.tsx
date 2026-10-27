import { asc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveCategoryAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { requireAdmin } from "@/lib/auth";

export const metadata = { title: "Kategoriyalar" };

const KINDS = [
  ["flower", "Gul turi"],
  ["bouquet_type", "Guldasta turi"],
  ["occasion", "Munosabat"],
  ["collection", "Kolleksiya"],
] as const;

function Fields({ c }: { c?: typeof schema.categories.$inferSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <F label="Nomi *" name="name" defaultValue={c?.name} required />
      <F label="Slug" name="slug" defaultValue={c?.slug} placeholder="avtomatik" />
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">Turi</label>
        <select name="kind" defaultValue={c?.kind ?? "flower"} className="field px-3 py-2" aria-label="Turi">
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <F label="Tartib" name="sortOrder" defaultValue={c?.sortOrder ?? 0} inputMode="numeric" />
      <div className="sm:col-span-2"><F label="Tavsif" name="description" defaultValue={c?.description} /></div>
      <F label="Rasm URL (/images/... yoki /media/...)" name="imageUrl" defaultValue={c?.imageUrl} />
      <div className="flex items-end pb-2"><C label="Faol" name="isActive" defaultChecked={c?.isActive ?? true} /></div>
      <F label="SEO sarlavha" name="seoTitle" defaultValue={c?.seoTitle} />
      <div className="sm:col-span-3"><F label="SEO tavsif" name="seoDescription" defaultValue={c?.seoDescription} /></div>
      <F label="Nomi (rus.)" name="nameRu" defaultValue={c?.nameRu} lang="ru" />
      <div className="sm:col-span-3"><F label="Tavsif (rus.)" name="descriptionRu" defaultValue={c?.descriptionRu} lang="ru" /></div>
      <F label="SEO sarlavha (rus.)" name="seoTitleRu" defaultValue={c?.seoTitleRu} lang="ru" />
      <div className="sm:col-span-3"><F label="SEO tavsif (rus.)" name="seoDescriptionRu" defaultValue={c?.seoDescriptionRu} lang="ru" /></div>
    </div>
  );
}

export default async function CategoriesAdmin() {
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ c: schema.categories, n: sql<number>`(SELECT count(*)::int FROM ${schema.productCategories} WHERE ${schema.productCategories.categoryId} = ${schema.categories.id})` })
    .from(schema.categories)
    .orderBy(asc(schema.categories.kind), asc(schema.categories.sortOrder));

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-4xl">Kategoriyalar</h1>
      <section className="card p-5">
        <h2 className="mb-3 text-2xl">Yangi kategoriya</h2>
        <AdminForm action={saveCategoryAction.bind(null, null)} submitLabel="Qo‘shish" resetOnSuccess>
          <Fields />
        </AdminForm>
      </section>
      {KINDS.map(([kind, label]) => (
        <section key={kind}>
          <h2 className="mb-2 text-2xl">{label}</h2>
          <div className="space-y-2">
            {rows.filter((r) => r.c.kind === kind).map(({ c, n }) => (
              <details key={c.id} className="card">
                <summary className="flex cursor-pointer items-center justify-between px-5 py-3 text-sm">
                  <span><strong>{c.name}</strong> <span className="text-muted">/{c.slug} · {n} mahsulot{c.isActive ? "" : " · o‘chirilgan"}</span></span>
                  <span className="text-xs text-forest">Tahrirlash</span>
                </summary>
                <div className="border-t border-line p-5">
                  <AdminForm action={saveCategoryAction.bind(null, c.id)}>
                    <Fields c={c} />
                  </AdminForm>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
