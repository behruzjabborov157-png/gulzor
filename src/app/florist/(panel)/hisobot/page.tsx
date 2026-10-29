import { requireFlorist } from "@/lib/auth";
import { floristSalesReport } from "@/lib/florist-panel";
import { formatUZS } from "@/lib/format";

export const metadata = { title: "Savdo va komissiya" };

export default async function FloristReportPage() {
  const me = await requireFlorist();
  const rows = await floristSalesReport(me.floristId);
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
      <p className="text-xs text-muted">Komissiya to‘lovlari tarixi keyingi bosqichda qo‘shiladi.</p>
    </div>
  );
}
