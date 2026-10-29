import Link from "next/link";
import { requireFlorist } from "@/lib/auth";
import { floristOrders } from "@/lib/florist-panel";
import { formatDateISO, formatDateTime, formatUZS } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type Order } from "@/lib/orders";

export const metadata = { title: "Buyurtmalar" };

const STATUS_STYLE: Record<Order["status"], string> = {
  new: "bg-fuchsia text-white",
  confirmed: "bg-sage-light text-wine",
  preparing: "bg-sage-light text-wine",
  ready: "bg-sage-light text-wine",
  dispatched: "bg-wine/15 text-wine",
  delivered: "bg-wine text-ivory",
  cancelled: "bg-charcoal/10 text-muted",
  rejected: "bg-charcoal/10 text-muted",
};

export default async function FloristOrdersPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  const me = await requireFlorist();
  const { holat } = await searchParams;
  const status = holat && holat in ORDER_STATUS_LABEL ? (holat as Order["status"]) : undefined;
  const orders = await floristOrders(me.floristId, { status });

  return (
    <div>
      <h1 className="mb-6 text-4xl">Buyurtmalar</h1>
      <nav aria-label="Holat bo‘yicha" className="mb-6 flex flex-wrap gap-2">
        <Link href="/florist/buyurtmalar" className={`chip ${!status ? "chip-active" : ""}`}>
          Hammasi
        </Link>
        {(Object.keys(ORDER_STATUS_LABEL) as Order["status"][]).map((s) => (
          <Link key={s} href={`/florist/buyurtmalar?holat=${s}`} className={`chip ${status === s ? "chip-active" : ""}`}>
            {ORDER_STATUS_LABEL[s]}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="card p-8 text-center text-muted">Hozircha buyurtma yo‘q.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-ivory text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Raqam</th>
                <th className="px-4 py-3 font-medium">Yaratildi</th>
                <th className="px-4 py-3 font-medium">Yetkazish</th>
                <th className="px-4 py-3 font-medium">Holat</th>
                <th className="px-4 py-3 font-medium">To‘lov</th>
                <th className="px-4 py-3 text-right font-medium">Jami</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.map((o) => (
                <tr key={o.id} className={o.status === "new" ? "bg-petal/20" : ""}>
                  <td className="px-4 py-3 font-semibold">
                    <Link href={`/florist/buyurtmalar/${o.id}`} className="text-wine hover:underline">
                      {o.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    {formatDateISO(o.deliveryDate, false)}
                    <br />
                    <span className="text-xs text-muted">
                      {o.slotLabel} · {o.fulfillment === "pickup" ? "Olib ketish" : o.zoneName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_STYLE[o.status]}`}>{ORDER_STATUS_LABEL[o.status]}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {PAYMENT_METHOD_LABEL[o.paymentMethod]}
                    <br />
                    <span className={o.paymentStatus === "paid" ? "text-success" : "text-muted"}>{PAYMENT_STATUS_LABEL[o.paymentStatus]}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatUZS(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
