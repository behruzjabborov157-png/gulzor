import Link from "next/link";
import { LANGUAGE_NAME_UZ } from "@/i18n/config";
import { panelT } from "@/i18n/panel/server";
import { requireAdmin } from "@/lib/auth";
import { listCustomers, phoneParam } from "@/lib/customers-admin";
import { formatDateTime, formatPhone } from "@/lib/format";

export async function generateMetadata() {
  return { title: (await panelT())("Mijozlar") };
}

const PER_PAGE = 30;

export default async function CustomersAdmin({ searchParams }: { searchParams: Promise<{ q?: string; sahifa?: string }> }) {
  const tt = await panelT();
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 60);
  const page = Math.max(1, Number(sp.sahifa) || 1);
  const { rows, total, accountsTotal } = await listCustomers({ q, page, perPage: PER_PAGE });
  const href = (p: number) => `/admin/mijozlar?${new URLSearchParams({ ...(q ? { q } : {}), ...(p > 1 ? { sahifa: String(p) } : {}) })}`;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-4xl">{tt("Mijozlar")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {tt("Buyurtma bergan har bir mijoz (sayt, Mini App yoki bot), telefon raqami bo‘yicha. Saytda hisob ochganlar: {n}.", { n: accountsTotal })}
        </p>
      </div>

      <form className="flex flex-wrap gap-2" action="/admin/mijozlar" role="search">
        <input name="q" defaultValue={q} placeholder={tt("Ism yoki telefon")} aria-label={tt("Qidiruv")} className="field max-w-sm py-2" />
        <button className="btn-secondary btn-sm">{tt("Qidirish")}</button>
      </form>

      <section className="card overflow-x-auto" aria-label={tt("Mijozlar")}>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted">{tt("Mijozlar topilmadi.")}</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">{tt("Mijoz")}</th>
                <th className="px-4 py-3">{tt("Telefon")}</th>
                <th className="px-4 py-3 text-right">{tt("Buyurtmalar")}</th>
                <th className="px-4 py-3 text-right">{tt("Xaridlar summasi")}</th>
                <th className="px-4 py-3">{tt("Oxirgi buyurtma")}</th>
                <th className="px-4 py-3">{tt("Belgilar")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.phone} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/mijozlar/${phoneParam(c.phone)}`} className="text-wine underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatPhone(c.phone)}</td>
                  <td className="px-4 py-3 text-right">{c.orders}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">{tt.uzs(c.spent)}</td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(c.lastOrder)}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="flex flex-wrap gap-1">
                      {c.hasAccount ? <span className="badge bg-sage-light text-wine">{tt("Hisob bor")}</span> : null}
                      {c.telegram ? <span className="badge bg-petal text-charcoal">Telegram</span> : null}
                      {c.locale !== "uz" ? <span className="badge bg-cream text-muted">{tt(LANGUAGE_NAME_UZ[c.locale] ?? c.locale)}</span> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {total > PER_PAGE ? (
        <nav aria-label={tt("Sahifalar")} className="flex gap-3 text-sm">
          {page > 1 ? (
            <Link href={href(page - 1)} className="text-wine underline">
              {tt("← Oldingi")}
            </Link>
          ) : null}
          <span className="text-muted">
            {page} / {Math.ceil(total / PER_PAGE)}
          </span>
          {page * PER_PAGE < total ? (
            <Link href={href(page + 1)} className="text-wine underline">
              {tt("Keyingi →")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
