import Link from "next/link";
import { and, asc, eq, ilike, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { saveLocationAction } from "@/app/admin/actions";
import { AdminForm, C, F } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";
import { getLocation, locationPath, type Location } from "@/lib/locations";
import { locationSearchKey } from "@/lib/translit";

export const metadata = { title: "Joylashuvlar" };

const LEVEL: Record<Location["level"], string> = { region: "Viloyat", district: "Tuman / shahar", settlement: "Aholi punkti", mahalla: "Mahalla" };
const CHILD: Record<Location["level"], Location["level"][]> = { region: ["district"], district: ["settlement", "mahalla"], settlement: ["mahalla"], mahalla: [] };
const PAGE = 100;

function Fields({ l }: { l?: Location }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <F label="Nomi (o‘zbekcha, lotin) *" name="name" defaultValue={l?.name} required />
      <F label="Nomi (kirill)" name="nameCyrl" defaultValue={l?.nameCyrl} lang="uz-Cyrl" />
      <F label="Nomi (rus.)" name="nameRu" defaultValue={l?.nameRu} lang="ru" />
      <F label="Nomi (ingl.)" name="nameEn" defaultValue={l?.nameEn} lang="en" />
      <F label="Kenglik (latitude)" name="latitude" defaultValue={l?.latitude} inputMode="decimal" placeholder="41.3111" />
      <F label="Uzunlik (longitude)" name="longitude" defaultValue={l?.longitude} inputMode="decimal" placeholder="69.2797" />
      <F label="Tartib" name="sortOrder" defaultValue={l?.sortOrder ?? 0} inputMode="numeric" />
      <div className="flex items-end pb-2">
        <C label="Faol (mijozlarga ko‘rinadi)" name="isActive" defaultChecked={l?.isActive ?? true} />
      </div>
    </div>
  );
}

export default async function LocationsAdmin({ searchParams }: { searchParams: Promise<{ id?: string; q?: string; sahifa?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const db = await getDb();
  const id = Number(sp.id) || null;
  const current = id ? await getLocation(id) : null;
  const path = current ? await locationPath(current.id) : [];
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number(sp.sahifa) || 1);
  const key = q ? `%${locationSearchKey(q)}%` : null;

  const where = and(current ? eq(schema.locations.parentId, current.id) : key ? undefined : isNull(schema.locations.parentId), key ? ilike(schema.locations.searchText, key) : undefined);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({ l: schema.locations, children: sql<number>`(select count(*)::int from locations c where c.parent_id = ${schema.locations.id})` })
      .from(schema.locations)
      .where(where)
      .orderBy(asc(schema.locations.sortOrder), asc(schema.locations.name))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.locations).where(where),
  ]);
  const href = (p: Record<string, string | number | null>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries(p)) if (v != null && v !== "") s.set(k, String(v));
    const qs = s.toString();
    return `/admin/joylashuvlar${qs ? `?${qs}` : ""}`;
  };
  const childLevels = current ? CHILD[current.level] : (["region"] as Location["level"][]);

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-4xl">Joylashuvlar</h1>
        <p className="mt-2 text-sm text-muted">
          Viloyat → tuman / shahar → aholi punkti → mahalla. Viloyatlar, tumanlar va mahallalar SOATO ma’lumotlaridan olingan (
          <a href="https://github.com/pdlpad/SOATO" className="underline" target="_blank" rel="noopener noreferrer">
            pdlpad/SOATO
          </a>
          , CC BY 4.0). Lotincha nomlar kirilldan avtomatik o‘girilgan — xato bo‘lsa, shu yerda tuzating. Joylar o‘chirilmaydi: keraksizini “Faol”dan
          chiqaring.
        </p>
      </div>

      <form className="flex gap-2" action="/admin/joylashuvlar">
        {current ? <input type="hidden" name="id" value={current.id} /> : null}
        <input name="q" defaultValue={q} placeholder={current ? `${current.name} ichidan qidirish` : "Butun ro‘yxatdan qidirish (lotin yoki kirill)"} className="field py-2" aria-label="Qidirish" />
        <button className="btn-secondary btn-sm">Qidirish</button>
      </form>

      <nav aria-label="Yo‘l" className="flex flex-wrap items-center gap-1 text-sm">
        <Link href={href({})} className="text-wine underline">
          O‘zbekiston
        </Link>
        {path.map((p) => (
          <span key={p.id}>
            {" › "}
            {p.id === current?.id ? <strong>{p.name}</strong> : <Link href={href({ id: p.id })} className="text-wine underline">{p.name}</Link>}
          </span>
        ))}
      </nav>

      {current ? (
        <section className="card p-5">
          <h2 className="mb-3 text-2xl">
            {current.name} <span className="font-sans text-sm text-muted">· {LEVEL[current.level]}{current.code && !current.code.startsWith("m:") ? ` · SOATO ${current.code}` : ""}</span>
          </h2>
          <AdminForm action={saveLocationAction.bind(null, current.id, null)}>
            <Fields l={current} />
          </AdminForm>
        </section>
      ) : null}

      <section className="card p-5">
        <h2 className="mb-3 text-xl">
          {q ? `Qidiruv natijalari (${n})` : current ? `Ichidagi joylar (${n})` : `Viloyatlar (${n})`}
        </h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">Hech narsa topilmadi.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {rows.map(({ l, children }) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link href={href({ id: l.id })} className={`underline-offset-2 hover:underline ${l.isActive ? "" : "text-muted line-through"}`}>
                  {l.name}
                  {l.nameCyrl && l.nameCyrl !== l.name ? <span className="text-muted"> · {l.nameCyrl}</span> : null}
                </Link>
                <span className="text-xs text-muted">
                  {LEVEL[l.level]}
                  {children ? ` · ${children} ta ichida` : ""}
                  {l.isActive ? "" : " · o‘chirilgan"}
                </span>
              </li>
            ))}
          </ul>
        )}
        {n > PAGE ? (
          <div className="mt-4 flex gap-3 text-sm">
            {page > 1 ? <Link href={href({ id: current?.id ?? null, q, sahifa: page - 1 })} className="text-wine underline">← Oldingi</Link> : null}
            <span className="text-muted">{page} / {Math.ceil(n / PAGE)}</span>
            {page * PAGE < n ? <Link href={href({ id: current?.id ?? null, q, sahifa: page + 1 })} className="text-wine underline">Keyingi →</Link> : null}
          </div>
        ) : null}
      </section>

      {childLevels.length && !q ? (
        <section className="card border-dashed p-5">
          <h2 className="mb-3 text-xl">+ {current ? `${current.name} ichiga joy qo‘shish` : "Viloyat qo‘shish"}</h2>
          <AdminForm action={saveLocationAction.bind(null, null, current?.id ?? null)} submitLabel="Qo‘shish" resetOnSuccess>
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-muted">
                Turi
                <select name="level" defaultValue={childLevels[0]} className="field mt-1 px-3 py-2 sm:w-64">
                  {childLevels.map((lv) => (
                    <option key={lv} value={lv}>
                      {LEVEL[lv]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Fields />
          </AdminForm>
        </section>
      ) : null}
    </div>
  );
}
