import { panelT } from "@/i18n/panel/server";
import Link from "next/link";
import { requireFlorist } from "@/lib/auth";
import { floristOrders } from "@/lib/florist-panel";
import { formatDateTime } from "@/lib/format";
import { ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, type Order } from "@/lib/orders";

export async function generateMetadata() {
  return { title: (await panelT())("Buyurtmalar") };
}

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
  const tt = await panelT();
  const me = await requireFlorist();
  const { holat } = await searchParams;
  const status = holat && holat in ORDER_STATUS_LABEL ? (holat as Order["status"]) : undefined;
  const orders = await floristOrders(me.floristId, { status });

  return (
    <div>
      <h1 className="mb-6 text-4xl">{tt("Buyurtmalar")}</h1>
      <nav aria-label={tt("Holat bo‘yicha")} className="mb-6 flex flex-wrap gap-2">
        <Link href="/florist/buyurtmalar" className={`chip ${!status ? "chip-active" : ""}`}>
          {tt("Hammasi")}
        </Link>
        {(Object.keys(ORDER_STATUS_LABEL) as Order["status"][]).map((s) => (
          <Link key={s} href={`/florist/buyurtmalar?holat=${s}`} className={`chip ${status === s ? "chip-active" : ""}`}>
            {tt(ORDER_STATUS_LABEL[s])}
          </Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="card p-8 text-center text-muted">{tt("Hozircha buyurtma yo‘q.")}</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-line bg-ivory text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">{tt("Raqam")}</th>
                <th className="px-4 py-3 font-medium">{tt("Yaratildi")}</th>
                <th className="px-4 py-3 font-medium">{tt("Yetkazish")}</th>
                <th className="px-4 py-3 font-medium">{tt("Holat")}</th>
                <th className="px-4 py-3 font-medium">{tt("To‘lov")}</th>
                <th className="px-4 py-3 text-right font-medium">{tt("Jami")}</th>
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
                    {tt.date(o.deliveryDate, false)}
                    <br />
                    <span className="text-xs text-muted">
                      {o.slotLabel} · {o.fulfillment === "pickup" ? tt("Olib ketish") : o.zoneName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STATUS_STYLE[o.status]}`}>{tt(ORDER_STATUS_LABEL[o.status])}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {tt(PAYMENT_METHOD_LABEL[o.paymentMethod])}
                    <br />
                    <span className={o.paymentStatus === "paid" ? "text-success" : "text-muted"}>{tt(PAYMENT_STATUS_LABEL[o.paymentStatus])}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{tt.uzs(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
