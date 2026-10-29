import { requireFlorist } from "@/lib/auth";
import { listStatements, statementOrders, unbilledByFlorist } from "@/lib/commission";
import { floristSalesReport } from "@/lib/florist-panel";
import { formatDateISO, formatDateTime, formatUZS } from "@/lib/format";

export const metadata = { title: "Savdo va komissiya" };

export default async function FloristReportPage() {
  const me = await requireFlorist();
  const [rows, statements, [unbilled]] = await Promise.all([
    floristSalesReport(me.floristId),
    listStatements({ floristId: me.floristId }),
    unbilledByFlorist(me.floristId),
  ]);
  const details = await Promise.all(statements.map(({ s }) => statementOrders(s.id, me.floristId)));
  const total = rows.reduce((s, r) => ({ goods: s.goods + Number(r.goods), commission: s.commission + Number(r.commission) }), { goods: 0, commission: 0 });
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-4xl">Savdo va komissiya</h1>
      <p className="text-sm text-muted">
        Faqat yetkazilgan buyurtmalar hisoblanadi. Mijoz to‘lovni sizga qiladi; Gulzor komissiyasi mahsulotlar summasidan (chegirmadan keyin, yetkazish
        narxisiz) olinadi va oyma-oy hisob-kitob qilinadi.
      </p>
      {rows.length === 0 ? (
        <p className="card p-8 text-center text-muted">Hali yetkazilgan buyurtma yo‘q.</p>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead className="border-b border-line bg-ivory text-xs text-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Oy</th>
                <th className="px-4 py-3 text-right font-medium">Buyurtmalar</th>
                <th className="px-4 py-3 text-right font-medium">Mahsulotlar summasi</th>
                <th className="px-4 py-3 text-right font-medium">Komissiya</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => (
                <tr key={r.month}>
                  <td className="px-4 py-3">{r.month}</td>
                  <td className="px-4 py-3 text-right">{r.orders}</td>
                  <td className="px-4 py-3 text-right">{formatUZS(Number(r.goods))}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatUZS(Number(r.commission))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-line font-semibold">
              <tr>
                <td className="px-4 py-3" colSpan={2}>
                  Jami
                </td>
                <td className="px-4 py-3 text-right">{formatUZS(total.goods)}</td>
                <td className="px-4 py-3 text-right">{formatUZS(total.commission)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <section aria-labelledby="statements-h" className="space-y-3">
        <h2 id="statements-h" className="text-3xl">
          Komissiya hisoblari
        </h2>
        <p className="text-sm text-muted">
          Har oy tugagach Gulzor hisob chiqaradi va sizga xabar beradi. To‘lov qilganingizdan keyin Gulzor uni «To‘langan» deb belgilaydi.
          {unbilled ? ` Hali hisobga kirmagan: ${unbilled.orders} ta buyurtma, ${formatUZS(unbilled.commission)} komissiya.` : ""}
        </p>
        {statements.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">Hali hisob chiqarilmagan.</p>
        ) : (
          <ul className="space-y-3">
            {statements.map(({ s }, i) => (
              <li key={s.id} className="card p-5 text-sm">
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-display text-xl text-plum">{s.period}</span>
                    <span>{s.orderCount} ta buyurtma</span>
                    <span className="font-semibold">{formatUZS(s.commissionTotal)}</span>
                    {s.status === "paid" ? (
                      <span className="badge bg-sage-light text-wine">To‘langan{s.paidAt ? ` · ${formatDateTime(s.paidAt)}` : ""}</span>
                    ) : (
                      <span className="badge bg-petal text-charcoal">To‘lanmagan</span>
                    )}
                  </summary>
                  <table className="mt-3 w-full text-left">
                    <thead className="text-xs text-muted">
                      <tr>
                        <th className="py-1 font-medium">Buyurtma</th>
                        <th className="py-1 font-medium">Yetkazish sanasi</th>
                        <th className="py-1 text-right font-medium">Mahsulotlar</th>
                        <th className="py-1 text-right font-medium">Komissiya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {details[i].map((o) => (
                        <tr key={o.id}>
                          <td className="py-1">{o.number}</td>
                          <td className="py-1">{formatDateISO(o.deliveryDate, false)}</td>
                          <td className="py-1 text-right">{formatUZS(Number(o.goods))}</td>
                          <td className="py-1 text-right">
                            {formatUZS(o.commissionAmount)} <span className="text-muted">({(o.commissionRate / 100).toLocaleString("uz-UZ")}%)</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
