import Link from "next/link";
import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { panelT } from "@/i18n/panel/server";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { PROVIDERS } from "@/lib/payments/providers";
import { TX_STATES, txStatus, type TxStatus } from "@/lib/payments/transactions";

export async function generateMetadata() {
  return { title: (await panelT())("To‘lovlar") };
}

const PAGE = 50;
const STATUS: Record<TxStatus, string> = { pending: "Jarayonda", paid: "To‘langan", cancelled: "Bekor qilingan", refunded: "Pul qaytarildi" };
const STYLE: Record<TxStatus, string> = {
  pending: "bg-petal text-charcoal",
  paid: "bg-sage-light text-wine",
  cancelled: "bg-charcoal/10 text-muted",
  refunded: "bg-danger/10 text-danger",
};

export default async function PaymentsAdmin({ searchParams }: { searchParams: Promise<{ q?: string; provayder?: string; holat?: string; sahifa?: string }> }) {
  const tt = await panelT();
  await requireAdmin();
  const sp = await searchParams;
  const db = await getDb();
  const P = schema.payments;
  const O = schema.orders;
  const page = Math.max(1, Number(sp.sahifa) || 1);
  const q = (sp.q ?? "").trim().slice(0, 60);
  const provider = sp.provayder === "payme" || sp.provayder === "click" ? sp.provayder : null;
  const status = sp.holat && sp.holat in STATUS ? (sp.holat as TxStatus) : null;
  const byStatus = status
    ? or(...(provider ? [provider] : ["payme", "click"]).map((p) => and(eq(P.provider, p as "payme"), inArray(P.state, TX_STATES[p][status].length ? TX_STATES[p][status] : [999]))))
    : undefined;
  const where = and(provider ? eq(P.provider, provider) : undefined, byStatus, q ? or(ilike(O.number, `%${q}%`), ilike(P.providerTransactionId, `%${q}%`)) : undefined);

  const [rows, [{ n }], totals] = await Promise.all([
    db
      .select({ p: P, number: O.number, orderId: O.id, paymentStatus: O.paymentStatus })
      .from(P)
      .innerJoin(O, eq(O.id, P.orderId))
      .where(where)
      .orderBy(desc(P.createTime))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db.select({ n: sql<number>`count(*)::int` }).from(P).innerJoin(O, eq(O.id, P.orderId)).where(where),
    db
      .select({ provider: P.provider, state: P.state, n: sql<number>`count(*)::int`, sum: sql<number>`coalesce(sum(${P.amount}), 0)::bigint` })
      .from(P)
      .groupBy(P.provider, P.state),
  ]);
  const paid = totals.filter((t) => txStatus(t.provider, t.state) === "paid");
  const paidSum = paid.reduce((s, t) => s + Number(t.sum), 0);
  const [{ n: refundsDue }] = await db.select({ n: sql<number>`count(*)::int` }).from(O).where(eq(O.paymentStatus, "refund_requested"));
  const href = (p: Record<string, string | number | null>) => {
    const s = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, provayder: provider, holat: status, ...p })) if (v != null && v !== "") s.set(k, String(v));
    return `/admin/tolovlar${s.size ? `?${s}` : ""}`;
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-4xl">{tt("To‘lovlar")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {tt("Payme va Click tranzaksiyalari. Bu yozuvlarni faqat provayder serveri o‘zgartiradi, shuning uchun ularni qo‘lda tahrirlab bo‘lmaydi.")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="text-xs text-muted">{tt("Tasdiqlangan onlayn to‘lovlar")}</p>
          <p className="text-2xl font-semibold">{tt.uzs(paidSum)}</p>
        </div>
        {Object.values(PROVIDERS).map((v) => (
          <div key={v.id} className="card p-4">
            <p className="text-xs text-muted">{v.label}</p>
            <p className="font-semibold">{v.configured() ? (v.testMode() ? tt("Test rejimi") : tt("Ishchi rejim")) : tt("Sozlanmagan")}</p>
          </div>
        ))}
      </div>

      {refundsDue ? (
        <p role="status" className="rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
          {tt("{n} ta bekor qilingan buyurtma bo‘yicha pul qaytarilishi kerak.", { n: refundsDue })}{" "}
          <Link href="/admin/buyurtmalar?tolov=refund_requested" className="underline">
            {tt("Buyurtmalarni ko‘rish")}
          </Link>
        </p>
      ) : null}

      <form className="flex flex-wrap items-end gap-3" action="/admin/tolovlar">
        <input name="q" defaultValue={q} placeholder={tt("Buyurtma yoki tranzaksiya raqami")} aria-label={tt("Qidirish")} className="field max-w-xs py-2" />
        <select name="provayder" defaultValue={provider ?? ""} aria-label={tt("Provayder")} className="field w-auto py-2">
          <option value="">{tt("Barcha provayderlar")}</option>
          <option value="payme">Payme</option>
          <option value="click">Click</option>
        </select>
        <select name="holat" defaultValue={status ?? ""} aria-label={tt("Holat")} className="field w-auto py-2">
          <option value="">{tt("Barcha holatlar")}</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>
              {tt(v)}
            </option>
          ))}
        </select>
        <button className="btn-secondary btn-sm">{tt("Filtrlash")}</button>
      </form>

      <section className="card overflow-x-auto" aria-label={tt("To‘lovlar")}>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted">{tt("Tranzaksiyalar yo‘q.")}</p>
        ) : (
          <table className="w-full min-w-[800px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">{tt("Buyurtma")}</th>
                <th className="px-4 py-3">{tt("Provayder")}</th>
                <th className="px-4 py-3">{tt("Tranzaksiya")}</th>
                <th className="px-4 py-3 text-right">{tt("Summa")}</th>
                <th className="px-4 py-3">{tt("Holat")}</th>
                <th className="px-4 py-3">{tt("Yaratildi")}</th>
                <th className="px-4 py-3">{tt("To‘langan vaqti")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, number, orderId }) => {
                const st = txStatus(p.provider, p.state);
                return (
                  <tr key={p.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/admin/buyurtmalar/${orderId}`} className="text-wine underline">
                        {number}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{PROVIDERS[p.provider].label}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.providerTransactionId}</td>
                    <td className="px-4 py-3 text-right">{tt.uzs(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${STYLE[st]}`}>{tt(STATUS[st])}</span>
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDateTime(p.createTime)}</td>
                    <td className="px-4 py-3 text-xs">{p.performTime ? formatDateTime(p.performTime) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {n > PAGE ? (
        <nav aria-label={tt("Sahifalar")} className="flex gap-3 text-sm">
          {page > 1 ? (
            <Link href={href({ sahifa: page - 1 })} className="text-wine underline">
              {tt("← Oldingi")}
            </Link>
          ) : null}
          <span className="text-muted">
            {page} / {Math.ceil(n / PAGE)}
          </span>
          {page * PAGE < n ? (
            <Link href={href({ sahifa: page + 1 })} className="text-wine underline">
              {tt("Keyingi →")}
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
