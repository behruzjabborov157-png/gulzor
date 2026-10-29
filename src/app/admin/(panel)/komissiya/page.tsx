import Link from "next/link";
import { issueStatementsAction, setStatementPaidAction } from "@/app/admin/actions";
import { AdminForm } from "@/components/admin/admin-form";
import { requireOwner } from "@/lib/auth";
import { addMonths, currentPeriod, listStatements, unbilledByFlorist } from "@/lib/commission";
import { formatDateTime, formatUZS } from "@/lib/format";

export const metadata = { title: "Komissiya" };

const FILTERS = [
  { key: "", label: "Barchasi" },
  { key: "unpaid", label: "To‘lanmagan" },
  { key: "paid", label: "To‘langan" },
] as const;

/** Monthly commission statements for marketplace shops: issue, then record the shop's payment. */
export default async function CommissionPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  await requireOwner();
  const sp = await searchParams;
  const status = sp.holat === "paid" || sp.holat === "unpaid" ? sp.holat : undefined;
  const [unbilled, rows, allUnpaid] = await Promise.all([unbilledByFlorist(), listStatements({ status }), listStatements({ status: "unpaid" })]);
  const owed = allUnpaid.reduce((s, r) => s + r.s.commissionTotal, 0);
  const last = addMonths(currentPeriod(), -1);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(last, -i));

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="mb-2 text-4xl">Komissiya</h1>
        <p className="max-w-3xl text-sm text-muted">
          Mijozlar do‘konlarga to‘g‘ridan-to‘g‘ri to‘laydi. Har oy tugagach, har bir do‘konga yetkazilgan buyurtmalari bo‘yicha komissiya hisobi
          chiqariladi; do‘kon to‘lagach, shu yerda «To‘landi» deb belgilaysiz. Kechikib yetkazilgan buyurtma keyingi hisobga tushadi.
        </p>
      </div>

      <section className="card p-6" aria-labelledby="issue-h">
        <h2 id="issue-h" className="mb-1 text-2xl">
          Oylik hisob chiqarish
        </h2>
        <p className="mb-4 text-sm text-muted">Tanlangan oy oxirigacha yetkazilgan va hali hisobga kirmagan buyurtmalar olinadi. Do‘konlarga xabar yuboriladi.</p>
        <AdminForm action={issueStatementsAction} submitLabel="Hisob chiqarish">
          <label htmlFor="period" className="label">
            Oy
          </label>
          <select id="period" name="period" defaultValue={last} className="field max-w-[12rem] py-2">
            {months.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </AdminForm>
      </section>

      <section className="card overflow-x-auto" aria-labelledby="unbilled-h">
        <h2 id="unbilled-h" className="px-6 pt-6 text-2xl">
          Hali hisobga kirmagan
        </h2>
        <table className="mt-3 w-full min-w-[560px] text-left text-sm">
          <thead className="border-y border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-6 py-3 font-medium">Do‘kon</th>
              <th className="px-4 py-3 text-right font-medium">Yetkazilgan buyurtma</th>
              <th className="px-4 py-3 text-right font-medium">Mahsulotlar summasi</th>
              <th className="px-6 py-3 text-right font-medium">Komissiya</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {unbilled.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-muted">
                  Hisobga kirmagan buyurtma yo‘q
                </td>
              </tr>
            ) : (
              unbilled.map((u) => (
                <tr key={u.floristId}>
                  <td className="px-6 py-3">
                    <Link href={`/admin/floristlar/${u.floristId}`} className="text-wine hover:underline">
                      {u.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">{u.orders}</td>
                  <td className="px-4 py-3 text-right">{formatUZS(u.goods)}</td>
                  <td className="px-6 py-3 text-right font-semibold">{formatUZS(u.commission)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section aria-labelledby="statements-h">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 id="statements-h" className="text-2xl">
            Hisoblar
          </h2>
          <p className="text-sm">
            To‘lanmagan jami: <b>{formatUZS(owed)}</b>
          </p>
        </div>
        <nav aria-label="Holat bo‘yicha" className="mb-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link key={f.key || "all"} href={f.key ? `/admin/komissiya?holat=${f.key}` : "/admin/komissiya"} className={`chip ${(status ?? "") === f.key ? "chip-active" : ""}`}>
              {f.label}
            </Link>
          ))}
        </nav>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-line bg-ivory text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Oy</th>
                <th className="px-4 py-3 font-medium">Do‘kon</th>
                <th className="px-4 py-3 text-right font-medium">Buyurtma</th>
                <th className="px-4 py-3 text-right font-medium">Mahsulotlar</th>
                <th className="px-4 py-3 text-right font-medium">Komissiya</th>
                <th className="px-4 py-3 font-medium">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted">
                    Hali hisob chiqarilmagan
                  </td>
                </tr>
              ) : (
                rows.map(({ s, florist }) => (
                  <tr key={s.id} className="align-top">
                    <td className="px-4 py-3 font-semibold">{s.period}</td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/floristlar/${s.floristId}`} className="text-wine hover:underline">
                        {florist}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right">{s.orderCount}</td>
                    <td className="px-4 py-3 text-right">{formatUZS(s.goodsTotal)}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatUZS(s.commissionTotal)}</td>
                    <td className="px-4 py-3">
                      {s.status === "paid" ? (
                        <div>
                          <span className="badge bg-sage-light text-wine">To‘langan</span>
                          <p className="mt-1 text-xs text-muted">
                            {s.paidAt ? formatDateTime(s.paidAt) : ""}
                            {s.paidNote ? ` · ${s.paidNote}` : ""}
                          </p>
                          <AdminForm action={setStatementPaidAction.bind(null, s.id, false)} submitLabel="Bekor qilish">
                            {null}
                          </AdminForm>
                        </div>
                      ) : (
                        <AdminForm action={setStatementPaidAction.bind(null, s.id, true)} submitLabel="To‘landi">
                          <label htmlFor={`note-${s.id}`} className="sr-only">
                            Izoh
                          </label>
                          <input id={`note-${s.id}`} name="note" placeholder="Izoh (masalan, to‘lov raqami)" maxLength={300} className="field max-w-xs py-1.5 text-sm" />
                        </AdminForm>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
