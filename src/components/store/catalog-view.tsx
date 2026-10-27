import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { FilterIcon } from "@/components/ui/icons";
import { Breadcrumbs, EmptyState } from "@/components/ui/primitives";
import { fmt, localePath, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getCategories, listProducts, SORTS, type Category, type CatalogQuery } from "@/lib/catalog";
import { formatUZS } from "@/lib/format";
import { AutoSubmit } from "./auto-submit";

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string) => {
  const n = Number(v.replace(/\D/g, ""));
  return v.trim() && Number.isFinite(n) && n >= 0 ? n : undefined;
};

export function parseCatalogParams(sp: SearchParams) {
  const sort = one(sp.saralash);
  return {
    q: one(sp.q).trim().slice(0, 80),
    flower: one(sp.gul),
    occasion: one(sp.munosabat),
    type: one(sp.turi),
    minPrice: num(one(sp.narx_min)),
    maxPrice: num(one(sp.narx_max)),
    inStock: one(sp.mavjud) === "1",
    sort: ((SORTS as readonly string[]).includes(sort) ? sort : "popular") as NonNullable<CatalogQuery["sort"]>,
    page: Math.max(1, Math.floor(Number(one(sp.sahifa)) || 1)),
  };
}

/** basePath is the locale-free path ("/katalog" or "/katalog/<slug>"). */
export async function CatalogView({
  base,
  searchParams,
  basePath,
  locale,
}: {
  base: Category | null;
  searchParams: SearchParams;
  basePath: string;
  locale: Locale;
}) {
  const dict = getDict(locale);
  const t = dict.catalog;
  const lp = (p: string) => localePath(locale, p);
  const f = parseCatalogParams(searchParams);
  const cats = [base?.slug, f.flower, f.occasion, f.type].filter((x): x is string => !!x);
  const [result, flowers, occasions, types] = await Promise.all([
    listProducts({
      q: f.q || undefined,
      categories: [...new Set(cats)],
      minPrice: f.minPrice,
      maxPrice: f.maxPrice,
      inStock: f.inStock,
      sort: f.sort,
      page: f.page,
      perPage: 12,
      includeAddons: base?.slug === "sovgalar" || f.type === "sovgalar",
      locale,
    }),
    getCategories("flower", locale),
    getCategories("occasion", locale),
    getCategories("bouquet_type", locale),
  ]);

  const action = lp(basePath);
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (one(v) && k !== "sahifa") params.set(k, one(v));
  const withQuery = (q: URLSearchParams) => {
    const s = q.toString();
    return s ? `${action}?${s}` : action;
  };
  const pageHref = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("sahifa", String(p));
    return withQuery(q);
  };
  const without = (key: string) => {
    const q = new URLSearchParams(params);
    q.delete(key);
    return withQuery(q);
  };

  const name = (list: Category[], slug: string) => list.find((c) => c.slug === slug)?.name ?? slug;
  const active: { key: string; label: string }[] = [];
  if (f.q) active.push({ key: "q", label: `“${f.q}”` });
  if (f.flower) active.push({ key: "gul", label: name(flowers, f.flower) });
  if (f.occasion) active.push({ key: "munosabat", label: name(occasions, f.occasion) });
  if (f.type) active.push({ key: "turi", label: name(types, f.type) });
  if (f.minPrice != null) active.push({ key: "narx_min", label: fmt(t.fromChip, { amount: formatUZS(f.minPrice, locale) }) });
  if (f.maxPrice != null) active.push({ key: "narx_max", label: fmt(t.toChip, { amount: formatUZS(f.maxPrice, locale) }) });
  if (f.inStock) active.push({ key: "mavjud", label: t.inStockChip });

  const title = f.q && !base ? fmt(t.searchTitle, { q: f.q }) : (base?.name ?? t.allTitle);

  const select = (label: string, nameAttr: string, value: string, list: Category[], hide?: boolean) =>
    hide ? null : (
      <div>
        <label htmlFor={`f-${nameAttr}`} className="label">
          {label}
        </label>
        <select id={`f-${nameAttr}`} name={nameAttr} defaultValue={value} className="field py-2.5">
          <option value="">{t.all}</option>
          {list.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    );

  return (
    <div className="container-page pt-8">
      <Breadcrumbs
        label={dict.common.breadcrumbs}
        items={[
          { href: lp("/"), label: dict.common.home },
          ...(base ? [{ href: lp("/katalog"), label: dict.common.catalog }, { label: base.name }] : [{ label: dict.common.catalog }]),
        ]}
      />
      <header className="mb-8 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {base?.description ? <p className="mt-3 text-muted">{base.description}</p> : null}
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <aside aria-label={t.filters} className="mb-6 lg:mb-0">
          <details className="group card lg:sticky lg:top-36 lg:block" open>
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold lg:hidden">
              <span className="inline-flex items-center gap-2">
                <FilterIcon size={18} /> {t.filters}
                {active.length ? ` (${active.length})` : ""}
              </span>
              <span className="text-sm text-muted group-open:hidden">{t.open}</span>
              <span className="hidden text-sm text-muted group-open:inline">{t.close}</span>
            </summary>
            <form action={action} method="get" className="space-y-4 border-t border-line px-5 py-5 lg:border-0">
              <AutoSubmit collapseOnMobile={active.length === 0} />
              <div>
                <label htmlFor="f-q" className="label">
                  {t.search}
                </label>
                <input id="f-q" name="q" defaultValue={f.q} placeholder={t.searchPlaceholder} className="field py-2.5" maxLength={80} />
              </div>
              {select(t.flower, "gul", f.flower, flowers, base?.kind === "flower")}
              {select(t.occasion, "munosabat", f.occasion, occasions, base?.kind === "occasion")}
              {select(t.type, "turi", f.type, types, base?.kind === "bouquet_type")}
              <fieldset>
                <legend className="label">{t.price}</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input name="narx_min" inputMode="numeric" defaultValue={f.minPrice ?? ""} placeholder={t.priceMin} aria-label={t.priceMinAria} className="field py-2.5" />
                  <input name="narx_max" inputMode="numeric" defaultValue={f.maxPrice ?? ""} placeholder={t.priceMax} aria-label={t.priceMaxAria} className="field py-2.5" />
                </div>
              </fieldset>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="mavjud" value="1" defaultChecked={f.inStock} className="h-4 w-4 accent-forest" />
                {t.inStock}
              </label>
              <div>
                <label htmlFor="f-sort" className="label">
                  {t.sort}
                </label>
                <select id="f-sort" name="saralash" defaultValue={f.sort} className="field py-2.5">
                  {SORTS.map((s) => (
                    <option key={s} value={s}>
                      {t.sorts[s]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary btn-sm flex-1">
                  {t.apply}
                </button>
                {active.length ? (
                  <Link href={action} className="btn-secondary btn-sm">
                    {t.reset}
                  </Link>
                ) : null}
              </div>
            </form>
          </details>
        </aside>

        <section aria-label={t.products} aria-live="polite">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-muted">{fmt(t.count, { n: result.total })}</p>
            {active.map((a) => (
              <Link key={a.key} href={without(a.key)} className="chip gap-1.5 py-1 text-xs" aria-label={fmt(t.removeFilter, { label: a.label })}>
                {a.label} <span aria-hidden="true">×</span>
              </Link>
            ))}
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              title={t.emptyTitle}
              text={t.emptyText}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={action} className="btn-secondary">
                    {t.resetFilters}
                  </Link>
                  <Link href={lp("/maxsus-guldasta")} className="btn-primary">
                    {t.customBouquet}
                  </Link>
                </div>
              }
            />
          ) : (
            <ProductGrid items={result.items} priorityCount={4} locale={locale} />
          )}

          {result.pages > 1 ? (
            <nav aria-label={t.pages} className="mt-12 flex flex-wrap items-center justify-center gap-2">
              {f.page > 1 ? (
                <Link href={pageHref(f.page - 1)} className="chip" rel="prev">
                  {t.prev}
                </Link>
              ) : null}
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref(p)} aria-current={p === f.page ? "page" : undefined} className={`chip min-w-10 justify-center ${p === f.page ? "chip-active" : ""}`}>
                  {p}
                </Link>
              ))}
              {f.page < result.pages ? (
                <Link href={pageHref(f.page + 1)} className="chip" rel="next">
                  {t.next}
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
