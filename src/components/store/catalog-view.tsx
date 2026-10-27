import Link from "next/link";
import { ProductGrid } from "@/components/store/product-card";
import { FilterIcon } from "@/components/ui/icons";
import { Breadcrumbs, EmptyState } from "@/components/ui/primitives";
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
    sort: (SORTS.some((s) => s.value === sort) ? sort : "popular") as NonNullable<CatalogQuery["sort"]>,
    page: Math.max(1, Math.floor(Number(one(sp.sahifa)) || 1)),
  };
}

export async function CatalogView({ base, searchParams, basePath }: { base: Category | null; searchParams: SearchParams; basePath: string }) {
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
    }),
    getCategories("flower"),
    getCategories("occasion"),
    getCategories("bouquet_type"),
  ]);

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(searchParams)) if (one(v) && k !== "sahifa") params.set(k, one(v));
  const pageHref = (p: number) => {
    const q = new URLSearchParams(params);
    if (p > 1) q.set("sahifa", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const without = (key: string) => {
    const q = new URLSearchParams(params);
    q.delete(key);
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const name = (list: Category[], slug: string) => list.find((c) => c.slug === slug)?.name ?? slug;
  const active: { key: string; label: string }[] = [];
  if (f.q) active.push({ key: "q", label: `“${f.q}”` });
  if (f.flower) active.push({ key: "gul", label: name(flowers, f.flower) });
  if (f.occasion) active.push({ key: "munosabat", label: name(occasions, f.occasion) });
  if (f.type) active.push({ key: "turi", label: name(types, f.type) });
  if (f.minPrice != null) active.push({ key: "narx_min", label: `${formatUZS(f.minPrice)}dan` });
  if (f.maxPrice != null) active.push({ key: "narx_max", label: `${formatUZS(f.maxPrice)}gacha` });
  if (f.inStock) active.push({ key: "mavjud", label: "Faqat mavjudlari" });

  const title = f.q && !base ? `“${f.q}” bo‘yicha qidiruv` : (base?.name ?? "Barcha gullar va guldastalar");

  const select = (label: string, nameAttr: string, value: string, list: Category[], hide?: boolean) =>
    hide ? null : (
      <div>
        <label htmlFor={`f-${nameAttr}`} className="label">{label}</label>
        <select id={`f-${nameAttr}`} name={nameAttr} defaultValue={value} className="field py-2.5">
          <option value="">Barchasi</option>
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
      <Breadcrumbs items={[{ href: "/", label: "Bosh sahifa" }, ...(base ? [{ href: "/katalog", label: "Katalog" }, { label: base.name }] : [{ label: "Katalog" }])]} />
      <header className="mb-8 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl">{title}</h1>
        {base?.description ? <p className="mt-3 text-muted">{base.description}</p> : null}
      </header>

      <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-10">
        <aside aria-label="Filtrlar" className="mb-6 lg:mb-0">
          <details className="group card lg:sticky lg:top-36 lg:block" open>
            <summary className="flex cursor-pointer items-center justify-between px-5 py-4 font-semibold lg:hidden">
              <span className="inline-flex items-center gap-2">
                <FilterIcon size={18} /> Filtrlar{active.length ? ` (${active.length})` : ""}
              </span>
              <span className="text-sm text-muted group-open:hidden">Ochish</span>
              <span className="hidden text-sm text-muted group-open:inline">Yopish</span>
            </summary>
            <form action={basePath} method="get" className="space-y-4 border-t border-line px-5 py-5 lg:border-0">
              <AutoSubmit collapseOnMobile={active.length === 0} />
              <div>
                <label htmlFor="f-q" className="label">Qidiruv</label>
                <input id="f-q" name="q" defaultValue={f.q} placeholder="Nomi yoki gul turi" className="field py-2.5" maxLength={80} />
              </div>
              {select("Gul turi", "gul", f.flower, flowers, base?.kind === "flower")}
              {select("Munosabat", "munosabat", f.occasion, occasions, base?.kind === "occasion")}
              {select("Guldasta turi", "turi", f.type, types, base?.kind === "bouquet_type")}
              <fieldset>
                <legend className="label">Narx (so‘m)</legend>
                <div className="grid grid-cols-2 gap-2">
                  <input name="narx_min" inputMode="numeric" defaultValue={f.minPrice ?? ""} placeholder="dan" aria-label="Minimal narx" className="field py-2.5" />
                  <input name="narx_max" inputMode="numeric" defaultValue={f.maxPrice ?? ""} placeholder="gacha" aria-label="Maksimal narx" className="field py-2.5" />
                </div>
              </fieldset>
              <label className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name="mavjud" value="1" defaultChecked={f.inStock} className="h-4 w-4 accent-forest" />
                Faqat hozir mavjudlari
              </label>
              <div>
                <label htmlFor="f-sort" className="label">Saralash</label>
                <select id="f-sort" name="saralash" defaultValue={f.sort} className="field py-2.5">
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" className="btn-primary btn-sm flex-1">Qo‘llash</button>
                {active.length ? (
                  <Link href={basePath} className="btn-secondary btn-sm">Tozalash</Link>
                ) : null}
              </div>
            </form>
          </details>
        </aside>

        <section aria-label="Mahsulotlar" aria-live="polite">
          <div className="mb-5 flex flex-wrap items-center gap-2">
            <p className="mr-2 text-sm text-muted">{result.total} ta mahsulot</p>
            {active.map((a) => (
              <Link key={a.key} href={without(a.key)} className="chip gap-1.5 py-1 text-xs" aria-label={`Filtrni olib tashlash: ${a.label}`}>
                {a.label} <span aria-hidden="true">×</span>
              </Link>
            ))}
          </div>

          {result.items.length === 0 ? (
            <EmptyState
              title="Hech narsa topilmadi"
              text="Filtrlarni o‘zgartirib ko‘ring yoki maxsus guldasta buyurtma qiling — floristimiz siz uchun yig‘ib beradi."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href={basePath} className="btn-secondary">Filtrlarni tozalash</Link>
                  <Link href="/maxsus-guldasta" className="btn-primary">Maxsus guldasta</Link>
                </div>
              }
            />
          ) : (
            <ProductGrid items={result.items} priorityCount={4} />
          )}

          {result.pages > 1 ? (
            <nav aria-label="Sahifalar" className="mt-12 flex flex-wrap items-center justify-center gap-2">
              {f.page > 1 ? <Link href={pageHref(f.page - 1)} className="chip" rel="prev">← Oldingi</Link> : null}
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={pageHref(p)} aria-current={p === f.page ? "page" : undefined} className={`chip min-w-10 justify-center ${p === f.page ? "chip-active" : ""}`}>
                  {p}
                </Link>
              ))}
              {f.page < result.pages ? <Link href={pageHref(f.page + 1)} className="chip" rel="next">Keyingi →</Link> : null}
            </nav>
          ) : null}
        </section>
      </div>
    </div>
  );
}
