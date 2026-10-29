import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatUZS } from "@/lib/format";
import { shopMetrics } from "@/lib/trust";

export const metadata = { title: "Tahlil" };

const PERIODS = [7, 30, 90];

const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : "—");

function minutes(m: number | null) {
  if (m == null) return "—";
  if (m < 60) return `${m} daq`;
  return `${Math.floor(m / 60)} soat ${m % 60} daq`;
}

/** Per-shop operating numbers: volume, how fast shops confirm, how often they refuse, complaints and ratings. */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ davr?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.davr)) ? Number(sp.davr) : 30;
  const rows = await shopMetrics(days);
  const total = rows.reduce(
    (s, r) => ({ orders: s.orders + r.orders, delivered: s.delivered + r.delivered, refused: s.refused + r.rejected + r.cancelled, goods: s.goods + r.goods, commission: s.commission + r.commission, disputes: s.disputes + r.disputes }),
    { orders: 0, delivered: 0, refused: 0, goods: 0, commission: 0, disputes: 0 },
  );
  const cards = [
    { label: "Buyurtmalar", value: String(total.orders) },
    { label: "Yetkazilgan", value: `${total.delivered} (${pct(total.delivered, total.orders)})` },
    { label: "Rad / bekor", value: `${total.refused} (${pct(total.refused, total.orders)})` },
    { label: "Yetkazilgan mahsulotlar summasi", value: formatUZS(total.goods) },
    { label: "Komissiya", value: formatUZS(total.commission) },
    { label: "Murojaatlar", value: String(total.disputes) },
  ];

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="mb-2 text-4xl">Tahlil</h1>
          <p className="max-w-3xl text-sm text-muted">
            Oxirgi {days} kunda berilgan buyurtmalar bo‘yicha. «Qabul qilish vaqti» — buyurtmadan do‘kon qabul qilguncha o‘tgan vaqtning medianasi.
            Reyting — e’lon qilingan barcha sharhlar bo‘yicha.
          </p>
        </div>
        <nav aria-label="Davr" className="flex gap-2">
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin/tahlil?davr=${p}`} className={`chip ${p === days ? "chip-active" : ""}`}>
              {p} kun
            </Link>
          ))}
        </nav>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <dt className="text-sm text-muted">{c.label}</dt>
            <dd className="mt-1 font-display text-3xl text-plum">{c.value}</dd>
          </div>
        ))}
      </dl>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="border-b border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Do‘kon</th>
              <th className="px-4 py-3 text-right font-medium">Buyurtma</th>
              <th className="px-4 py-3 text-right font-medium">Yetkazilgan</th>
              <th className="px-4 py-3 text-right font-medium">Rad etilgan</th>
              <th className="px-4 py-3 text-right font-medium">Bekor</th>
              <th className="px-4 py-3 text-right font-medium">Qabul qilish vaqti</th>
              <th className="px-4 py-3 text-right font-medium">Murojaat</th>
              <th className="px-4 py-3 text-right font-medium">Reyting</th>
              <th className="px-4 py-3 text-right font-medium">Summa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.floristId}>
                <td className="px-4 py-3">
                  <Link href={`/admin/floristlar/${r.floristId}`} className="text-wine hover:underline">
                    {r.name}
                  </Link>
                  {r.isPlatform ? <span className="ml-1.5 text-[10px] text-muted">Gulzor</span> : null}
                </td>
                <td className="px-4 py-3 text-right">{r.orders}</td>
                <td className="px-4 py-3 text-right">{r.delivered}</td>
                <td className={`px-4 py-3 text-right ${r.orders && r.rejected / r.orders > 0.2 ? "font-semibold text-danger" : ""}`}>
                  {r.rejected} <span className="text-muted">({pct(r.rejected, r.orders)})</span>
                </td>
                <td className="px-4 py-3 text-right">{r.cancelled}</td>
                <td className="px-4 py-3 text-right">{minutes(r.medianConfirmMinutes)}</td>
                <td className={`px-4 py-3 text-right ${r.disputes ? "font-semibold text-danger" : ""}`}>{r.disputes}</td>
                <td className="px-4 py-3 text-right">{r.rating != null ? `${r.rating.toLocaleString("uz-UZ")} ★ (${r.reviews})` : "—"}</td>
                <td className="px-4 py-3 text-right">{formatUZS(r.goods)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
