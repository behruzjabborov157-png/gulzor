import { panelT } from "@/i18n/panel/server";
import { asc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveCategoryAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { requireAdmin } from "@/lib/auth";

export async function generateMetadata() {
  return { title: (await panelT())("Kategoriyalar") };
}

const KINDS = [
  ["flower", "Gul turi"],
  ["bouquet_type", "Guldasta turi"],
  ["occasion", "Munosabat"],
  ["collection", "Kolleksiya"],
] as const;

async function Fields({ c }: { c?: typeof schema.categories.$inferSelect }) {
  const tt = await panelT();
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <F label={tt("Nomi *")} name="name" defaultValue={c?.name} required />
      <F label={tt("Slug")} name="slug" defaultValue={c?.slug} placeholder={tt("avtomatik")} />
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">{tt("Turi")}</label>
        <select name="kind" defaultValue={c?.kind ?? "flower"} className="field px-3 py-2" aria-label={tt("Turi")}>
          {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      <F label={tt("Tartib")} name="sortOrder" defaultValue={c?.sortOrder ?? 0} inputMode="numeric" />
      <div className="sm:col-span-2"><F label={tt("Tavsif")} name="description" defaultValue={c?.description} /></div>
      <F label={tt("Rasm URL (/images/... yoki /media/...)")} name="imageUrl" defaultValue={c?.imageUrl} />
      <div className="flex items-end pb-2"><C label={tt("Faol")} name="isActive" defaultChecked={c?.isActive ?? true} /></div>
      <F label={tt("SEO sarlavha")} name="seoTitle" defaultValue={c?.seoTitle} />
      <div className="sm:col-span-3"><F label={tt("SEO tavsif")} name="seoDescription" defaultValue={c?.seoDescription} /></div>
      <F label={tt("Nomi (rus.)")} name="nameRu" defaultValue={c?.nameRu} lang="ru" />
      <div className="sm:col-span-3"><F label={tt("Tavsif (rus.)")} name="descriptionRu" defaultValue={c?.descriptionRu} lang="ru" /></div>
      <F label={tt("SEO sarlavha (rus.)")} name="seoTitleRu" defaultValue={c?.seoTitleRu} lang="ru" />
      <div className="sm:col-span-3"><F label={tt("SEO tavsif (rus.)")} name="seoDescriptionRu" defaultValue={c?.seoDescriptionRu} lang="ru" /></div>
      <F label={tt("Nomi (ingl.)")} name="nameEn" defaultValue={c?.nameEn} lang="en" />
      <div className="sm:col-span-3"><F label={tt("Tavsif (ingl.)")} name="descriptionEn" defaultValue={c?.descriptionEn} lang="en" /></div>
      <F label={tt("SEO sarlavha (ingl.)")} name="seoTitleEn" defaultValue={c?.seoTitleEn} lang="en" />
      <div className="sm:col-span-3"><F label={tt("SEO tavsif (ingl.)")} name="seoDescriptionEn" defaultValue={c?.seoDescriptionEn} lang="en" /></div>
    </div>
  );
}

export default async function CategoriesAdmin() {
  const tt = await panelT();
  await requireAdmin();
  const db = await getDb();
  const rows = await db
    .select({ c: schema.categories, n: sql<number>`(SELECT count(*)::int FROM ${schema.productCategories} WHERE ${schema.productCategories.categoryId} = ${schema.categories.id})` })
    .from(schema.categories)
    .orderBy(asc(schema.categories.kind), asc(schema.categories.sortOrder));

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-4xl">{tt("Kategoriyalar")}</h1>
      <section className="card p-5">
        <h2 className="mb-3 text-2xl">{tt("Yangi kategoriya")}</h2>
        <AdminForm action={saveCategoryAction.bind(null, null)} submitLabel={tt("Qo‘shish")} resetOnSuccess>
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
                  <span><strong>{c.name}</strong> <span className="text-muted">{tt("{n} mahsulot · /{slug}{p}", { slug: c.slug, n: n, p: c.isActive ? "" : tt(" · o‘chirilgan") })}</span></span>
                  <span className="text-xs text-wine">{tt("Tahrirlash")}</span>
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
