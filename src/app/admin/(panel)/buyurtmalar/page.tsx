import { panelT } from "@/i18n/panel/server";
import Link from "next/link";
import { and, desc, eq, gte, ilike, lt, or, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatPhone, normalizePhone } from "@/lib/format";
import { floristOptions } from "@/lib/florist-admin";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type Order } from "@/lib/orders";

export async function generateMetadata() {
  return { title: (await panelT())("Buyurtmalar") };
}

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

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; holat?: string; tolov?: string; sana?: string; yaratilgan?: string; dokon?: string; sahifa?: string }> }) {
  const tt = await panelT();
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
  if (sp.tolov && sp.tolov in PAYMENT_STATUS_LABEL) where.push(eq(schema.orders.paymentStatus, sp.tolov as Order["paymentStatus"]));
  if (sp.sana && /^\d{4}-\d{2}-\d{2}$/.test(sp.sana)) where.push(eq(schema.orders.deliveryDate, sp.sana));
  const shopId = Number(sp.dokon) || 0;
  if (shopId > 0) where.push(eq(schema.orders.floristId, shopId));
  // Order (creation) date as a Tashkent calendar day.
  if (sp.yaratilgan && /^\d{4}-\d{2}-\d{2}$/.test(sp.yaratilgan)) {
    const from = new Date(`${sp.yaratilgan}T00:00:00+05:00`);
    where.push(gte(schema.orders.createdAt, from), lt(schema.orders.createdAt, new Date(from.getTime() + 86_400_000)));
  }

  const db = await getDb();
  const cond = where.length ? and(...where) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.orders).where(cond);
  const [list, shops] = await Promise.all([
    db
      .select({ o: schema.orders, shop: schema.florists.name })
      .from(schema.orders)
      .leftJoin(schema.florists, eq(schema.florists.id, schema.orders.floristId))
      .where(cond)
      .orderBy(desc(schema.orders.createdAt))
      .limit(perPage)
      .offset((page - 1) * perPage),
    floristOptions(),
  ]);
  const rows = list.map((r) => ({ ...r.o, shop: r.shop }));
  const pages = Math.max(1, Math.ceil(count / perPage));
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (sp.holat) u.set("holat", sp.holat);
    if (sp.tolov) u.set("tolov", sp.tolov);
    if (sp.sana) u.set("sana", sp.sana);
    if (sp.yaratilgan) u.set("yaratilgan", sp.yaratilgan);
    if (shopId > 0) u.set("dokon", String(shopId));
    if (p > 1) u.set("sahifa", String(p));
    return `/admin/buyurtmalar?${u}`;
  };

  return (
    <div>
      <h1 className="mb-6 text-4xl">{tt("Buyurtmalar")}</h1>
      <form className="card mb-6 grid items-end gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_170px_150px_150px_auto]" role="search">
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="q">{tt("Qidiruv")}</label>
          <input id="q" name="q" defaultValue={q} placeholder={tt("Buyurtma raqami, telefon yoki ism")} className="field py-2.5" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="holat">{tt("Holat")}</label>
          <select id="holat" name="holat" defaultValue={sp.holat ?? ""} className="field py-2.5">
            <option value="">{tt("Barcha holatlar")}</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{tt(v)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="tolov">{tt("To‘lov")}</label>
          <select id="tolov" name="tolov" defaultValue={sp.tolov ?? ""} className="field py-2.5">
            <option value="">{tt("Barcha to‘lov holatlari")}</option>
            {Object.entries(PAYMENT_STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>{tt(v)}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="dokon">{tt("Do‘kon")}</label>
          <select id="dokon" name="dokon" defaultValue={shopId > 0 ? String(shopId) : ""} className="field py-2.5">
            <option value="">{tt("Barcha do‘konlar")}</option>
            {shops.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="yaratilgan">{tt("Buyurtma sanasi")}</label>
          <input id="yaratilgan" name="yaratilgan" type="date" defaultValue={sp.yaratilgan ?? ""} className="field py-2.5" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted" htmlFor="sana">{tt("Yetkazish sanasi")}</label>
          <input id="sana" name="sana" type="date" defaultValue={sp.sana ?? ""} className="field py-2.5" />
        </div>
        <button className="btn-primary btn-sm h-[46px]">{tt("Qidirish")}</button>
      </form>

      <p className="mb-3 text-sm text-muted">{tt("{count} ta buyurtma", { count: count })}</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">{tt("Raqam")}</th>
              <th className="px-4 py-3 font-medium">{tt("Yaratildi")}</th>
              <th className="px-4 py-3 font-medium">{tt("Do‘kon")}</th>
              <th className="px-4 py-3 font-medium">{tt("Mijoz")}</th>
              <th className="px-4 py-3 font-medium">{tt("Yetkazish")}</th>
              <th className="px-4 py-3 font-medium">{tt("Holat")}</th>
              <th className="px-4 py-3 font-medium">{tt("To‘lov")}</th>
              <th className="px-4 py-3 text-right font-medium">{tt("Jami")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-10 text-center text-muted">{tt("Buyurtmalar topilmadi")}</td></tr>
            ) : (
              rows.map((o) => (
                <tr key={o.id} className="hover:bg-ivory">
                  <td className="px-4 py-3">
                    <Link href={`/admin/buyurtmalar/${o.id}`} className="font-semibold text-wine hover:underline">{o.number}</Link>
                    {o.containsDemo ? <span className="ml-1.5 text-[10px] text-muted">{tt("demo")}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">{o.shop ?? "—"}</td>
                  <td className="px-4 py-3">{o.customerName}<br /><span className="text-xs text-muted">{formatPhone(o.customerPhone)}</span></td>
                  <td className="px-4 py-3">{tt.date(o.deliveryDate, false)}<br /><span className="text-xs text-muted">{o.slotLabel} · {o.fulfillment === "pickup" ? tt("olib ketish") : o.zoneName}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_STYLE[o.status]}`}>{tt(ORDER_STATUS_LABEL[o.status])}</span></td>
                  <td className="px-4 py-3 text-xs">{tt(PAYMENT_METHOD_LABEL[o.paymentMethod])}<br /><span className={o.paymentStatus === "paid" ? "text-success" : "text-muted"}>{tt(PAYMENT_STATUS_LABEL[o.paymentStatus])}</span></td>
                  <td className="px-4 py-3 text-right font-semibold">{tt.uzs(o.total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 ? (
        <nav className="mt-4 flex gap-2" aria-label={tt("Sahifalar")}>
          {page > 1 ? <Link href={qs(page - 1)} className="chip">{tt("← Oldingi")}</Link> : null}
          <span className="chip chip-active">{page} / {pages}</span>
          {page < pages ? <Link href={qs(page + 1)} className="chip">{tt("Keyingi →")}</Link> : null}
        </nav>
      ) : null}
    </div>
  );
}
