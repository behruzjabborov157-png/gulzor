import Link from "next/link";
import { and, asc, eq, isNull, ne, or, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";
import { panelT } from "@/i18n/panel/server";
import { requireOwner } from "@/lib/auth";

export async function generateMetadata() {
  return { title: (await panelT())("Tarjimalar") };
}

/** "Empty" for an optional translation column. */
const missing = (c: PgColumn) => or(isNull(c), eq(c, ""))!;

type Kind = "products" | "categories" | "florists" | "zones";
const KINDS: { key: Kind; label: string }[] = [
  { key: "products", label: "Mahsulotlar" },
  { key: "categories", label: "Kategoriyalar" },
  { key: "florists", label: "Do‘konlar" },
  { key: "zones", label: "Yetkazish hududlari" },
];

/** What the site shows in Russian and English comes from these fields; empty ones fall back to Uzbek. */
async function coverage(kind: Kind) {
  const db = await getDb();
  const T = {
    products: { t: schema.products, ru: schema.products.nameRu, en: schema.products.nameEn, live: ne(schema.products.status, "archived") },
    categories: { t: schema.categories, ru: schema.categories.nameRu, en: schema.categories.nameEn, live: eq(schema.categories.isActive, true) },
    florists: { t: schema.florists, ru: schema.florists.nameRu, en: schema.florists.nameEn, live: eq(schema.florists.status, "approved") },
    zones: { t: schema.deliveryZones, ru: schema.deliveryZones.nameRu, en: schema.deliveryZones.nameEn, live: eq(schema.deliveryZones.isActive, true) },
  }[kind];
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      noRu: sql<number>`count(*) FILTER (WHERE ${missing(T.ru)})::int`,
      noEn: sql<number>`count(*) FILTER (WHERE ${missing(T.en)})::int`,
    })
    .from(T.t)
    .where(T.live as SQL);
  return row;
}

async function gaps(kind: Kind) {
  const db = await getDb();
  const pick = <C extends { id: PgColumn; name: PgColumn; nameRu: PgColumn; nameEn: PgColumn }>(c: C) => ({ id: c.id, name: c.name, ru: c.nameRu, en: c.nameEn });
  const where = (c: { nameRu: PgColumn; nameEn: PgColumn }, live: SQL) => and(live, or(missing(c.nameRu), missing(c.nameEn)));
  if (kind === "products") {
    const P = schema.products;
    return (await db.select(pick(P)).from(P).where(where(P, ne(P.status, "archived"))).orderBy(asc(P.name)).limit(100)).map((r) => ({ ...r, href: `/admin/mahsulotlar/${r.id}` }));
  }
  if (kind === "categories") {
    const C = schema.categories;
    return (await db.select(pick(C)).from(C).where(where(C, eq(C.isActive, true))).orderBy(asc(C.name)).limit(100)).map((r) => ({ ...r, href: "/admin/kategoriyalar" }));
  }
  if (kind === "florists") {
    const F = schema.florists;
    return (await db.select(pick(F)).from(F).where(where(F, eq(F.status, "approved"))).orderBy(asc(F.name)).limit(100)).map((r) => ({ ...r, href: `/admin/floristlar/${r.id}` }));
  }
  const Z = schema.deliveryZones;
  return (await db.select(pick(Z)).from(Z).where(where(Z, eq(Z.isActive, true))).orderBy(asc(Z.name)).limit(100)).map((r) => ({ ...r, href: "/admin/yetkazib-berish" }));
}

export default async function TranslationsAdmin({ searchParams }: { searchParams: Promise<{ tur?: string }> }) {
  const tt = await panelT();
  await requireOwner();
  const sp = await searchParams;
  const kind = (KINDS.find((k) => k.key === sp.tur)?.key ?? "products") as Kind;
  const [stats, list] = await Promise.all([Promise.all(KINDS.map(async (k) => ({ ...k, ...(await coverage(k.key)) }))), gaps(kind)]);
  const pct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 100);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl">{tt("Tarjimalar")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {tt("Mahsulot, kategoriya, do‘kon va hudud nomlarining ruscha va inglizcha tarjimalari. Tarjima bo‘sh bo‘lsa, saytda o‘zbekcha matn chiqadi. Sayt va panel interfeysi matnlari koddagi lug‘atlarda, ular to‘liqligini avtomatik test tekshiradi.")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.key} href={`/admin/tarjimalar?tur=${s.key}`} aria-current={s.key === kind ? "page" : undefined} className={`card p-4 hover:border-wine ${s.key === kind ? "border-wine" : ""}`}>
            <p className="text-xs text-muted">{tt(s.label)}</p>
            <p className="mt-1 text-sm">
              {tt("Ruscha: {p}%", { p: pct(s.total - s.noRu, s.total) })} · {tt("Inglizcha: {p}%", { p: pct(s.total - s.noEn, s.total) })}
            </p>
            <p className="text-xs text-muted">{tt("jami: {n}", { n: s.total })}</p>
          </Link>
        ))}
      </div>

      <section className="card overflow-x-auto" aria-label={tt("Tarjimasi to‘liq emas")}>
        <h2 className="px-5 pt-5 text-2xl">{tt("Tarjimasi to‘liq emas")}</h2>
        {list.length === 0 ? (
          <p className="p-5 text-sm text-muted">{tt("Hammasi tarjima qilingan.")}</p>
        ) : (
          <table className="mt-3 w-full min-w-[600px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-5 py-3">{tt("Nomi (o‘zbekcha)")}</th>
                <th className="px-5 py-3">{tt("Ruscha")}</th>
                <th className="px-5 py-3">{tt("Inglizcha")}</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id as number} className="border-b border-line last:border-0">
                  <td className="px-5 py-3">{r.name as string}</td>
                  <td className="px-5 py-3">{(r.ru as string | null) || <span className="text-danger">{tt("yo‘q")}</span>}</td>
                  <td className="px-5 py-3">{(r.en as string | null) || <span className="text-danger">{tt("yo‘q")}</span>}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={r.href} className="text-wine underline">
                      {tt("Tahrirlash")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
