import Link from "next/link";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateISO, formatDateTime, formatPhone, formatUZS, normalizePhone } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type Order } from "@/lib/orders";

export const metadata = { title: "Buyurtmalar" };

const STATUS_STYLE: Record<Order["status"], string> = {
  new: "bg-petal text-charcoal",
  confirmed: "bg-sage-light text-wine",
  preparing: "bg-sage-light text-wine",
  ready: "bg-sage-light text-wine",
  dispatched: "bg-wine/15 text-wine",
  delivered: "bg-wine text-ivory",
  cancelled: "bg-charcoal/10 text-muted",
  rejected: "bg-charcoal/10 text-muted",
};

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; holat?: string; sana?: string; yaratilgan?: string; sahifa?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(1, Number(sp.sahifa) || 1);
  const perPage = 25;
  const where: SQL[] = [];
  if (q) {
    const phone = normalizePhone(q);
    const digits = q.replace(/\D/g, "");
    const conds: SQL[] = [ilike(schema.orders.number, `%${q}%`), ilike(schema.orders.customerName, `%${q}%`)];
    if (phone) conds.push(eq(schema.orders.customerPhone, phone), eq(schema.orders.recipientPhone, phone));
    else if (digits.length >= 4) conds.push(ilike(schema.orders.customerPhone, `%${digits}%`), ilike(schema.orders.recipientPhone, `%${digits}%`));
    where.push(or(...conds)!);
  }
  if (sp.holat && sp.holat in ORDER_STATUS_LABEL) where.push(eq(schema.orders.status, sp.holat as Order["status"]));
  if (sp.sana && /^\d{4}-\d{2}-\d{2}$/.test(sp.sana)) where.push(eq(schema.orders.deliveryDate, sp.sana));
  // Order (creation) date as a Tashkent calendar day.
  if (sp.yaratilgan && /^\d{4}-\d{2}-\d{2}$/.test(sp.yaratilgan)) {
    const from = new Date(`${sp.yaratilgan}T00:00:00+05:00`);
    where.push(gte(schema.orders.createdAt, from), lt(schema.orders.createdAt, new Date(from.getTime() + 86_400_000)));
  }

  const db = await getDb();
  const cond = where.length ? and(...where) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.orders).where(cond);
  const rows = await db
    .select()
    .from(schema.orders)
    .where(cond)
    .orderBy(desc(schema.orders.createdAt))
    .limit(perPage)
    .offset((page - 1) * perPage);
  const pages = Math.max(1, Math.ceil(count / perPage));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (sp.holat) u.set("holat", sp.holat);
    if (sp.sana) u.set("sana", sp.sana);
    if (sp.yaratilgan) u.set("yaratilgan", sp.yaratilgan);
    if (p > 1) u.set("sahifa", String(p));
    return `/admin/buyurtmalar?${u}`;
  };

  return (
    <div>
      <h1 className="mb-6 text-4xl">Buyurtmalar</h1>
      <form className="card mb-6 grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_190px_165px_165px_auto]" role="search">
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="q">Qidiruv</label>
          <input id="q" name="q" defaultValue={q} placeholder="Buyurtma raqami, telefon yoki ism" className="field py-2.5" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="holat">Holat</label>
          <select id="holat" name="holat" defaultValue={sp.holat ?? ""} className="field py-2.5">
            <option value="">Barcha holatlar</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="yaratilgan">Buyurtma sanasi</label>
          <input id="yaratilgan" name="yaratilgan" type="date" defaultValue={sp.yaratilgan ?? ""} className="field py-2.5" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="sana">Yetkazish sanasi</label>
          <input id="sana" name="sana" type="date" defaultValue={sp.sana ?? ""} className="field py-2.5" />
        </div>
        <button className="btn-primary btn-sm h-[46px]">Qidirish</button>
      </form>

      <p className="mb-3 text-sm text-muted">{count} ta buyurtma</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Raqam</th>
              <th className="px-4 py-3 font-medium">Yaratildi</th>
              <th className="px-4 py-3 font-medium">Mijoz</th>
              <th className="px-4 py-3 font-medium">Yetkazish</th>
              <th className="px-4 py-3 font-medium">Holat</th>
              <th className="px-4 py-3 font-medium">To‘lov</th>
              <th className="px-4 py-3 text-right font-medium">Jami</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Buyurtmalar topilmadi</td></tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id} className="hover:bg-ivory">
                  <td className="px-4 py-3">
                    <Link href={`/admin/buyurtmalar/${o.id}`} className="font-semibold text-wine hover:underline">{o.number}</Link>
                    {o.containsDemo ? <span className="ml-1.5 text-[10px] text-muted">demo</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">{o.customerName}<br /><span className="text-xs text-muted">{formatPhone(o.customerPhone)}</span></td>
                  <td className="px-4 py-3">{formatDateISO(o.deliveryDate, false)}<br /><span className="text-xs text-muted">{o.slotLabel} · {o.fulfillment === "pickup" ? "olib ketish" : o.zoneName}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_STYLE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span></td>
                  <td className="px-4 py-3 text-xs">{PAYMENT_METHOD_LABEL[o.paymentMethod]}<br /><span className={o.paymentStatus === "paid" ? "text-success" : "text-muted"}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{formatUZS(o.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex gap-2" aria-label="Sahifalar">
          {page > 1 ? <Link href={qs(page - 1)} className="chip">← Oldingi</Link> : null}
          <span className="chip chip-active">{page} / {pages}</span>
          {page < pages ? <Link href={qs(page + 1)} className="chip">Keyingi →</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
