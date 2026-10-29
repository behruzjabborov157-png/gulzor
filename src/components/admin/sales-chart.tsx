import { formatDateISO, formatUZS } from "@/lib/format";

/**
 * Daily revenue — single series, so no legend (the heading names it).
 * Thin bars with 2px gaps and rounded data-ends, recessive grid, a hover tooltip
 * per bar (bigger hit area than the mark) and a table view for screen readers.
 */
export function SalesChart({ series }: { series: { date: string; revenue: number; orders: number }[] }) {
  const max = Math.max(...series.map((s) => s.revenue), 0);
  const niceMax = max === 0 ? 100_000 : niceCeil(max);
  const ticks = [0, niceMax / 2, niceMax];
  const W = 100 / series.length;

  return (
    <figure>
      <div className="relative h-56 pl-14">
        {/* grid + y axis */}
        {ticks.map((t) => (
          <div key={t} className="absolute right-0 left-14 border-t border-line" style={{ bottom: `${(t / niceMax) * 100}%` }}>
            <span className="absolute -top-2 -left-14 w-12 text-right text-[10px] text-muted">{shortUZS(t)}</span>
          </div>
        ))}
        <div className="relative flex h-full items-end" role="img" aria-label="Kunlik tushum ustunli diagrammasi">
          {series.map((s) => {
            const h = niceMax ? (s.revenue / niceMax) * 100 : 0;
            return (
              <div key={s.date} className="group relative flex h-full items-end justify-center" style={{ width: `${W}%` }}>
                <div
                  className="w-[calc(100%-2px)] max-w-6 rounded-t-[4px] bg-wine transition-opacity group-hover:opacity-80"
                  style={{ height: s.revenue > 0 ? `max(${h}%, 2px)` : 0 }}
                />
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 rounded-lg bg-charcoal px-2.5 py-1.5 text-[11px] whitespace-nowrap text-ivory shadow group-hover:block">
                  <p className="font-semibold">{formatDateISO(s.date, false)}</p>
                  <p>{formatUZS(s.revenue)}</p>
                  <p className="text-ivory/70">{s.orders} ta buyurtma</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-14 text-[10px] text-muted">
        <span>{formatDateISO(series[0].date, false)}</span>
        <span>{formatDateISO(series[series.length - 1].date, false)}</span>
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-muted">Jadval ko‘rinishi</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-muted">
              <th className="py-1 font-medium">Sana</th>
              <th className="py-1 font-medium">Buyurtmalar</th>
              <th className="py-1 text-right font-medium">Tushum</th>
            </tr>
          </thead>
          <tbody>
            {series.map((s) => (
              <tr key={s.date} className="border-t border-line">
                <td className="py-1">{formatDateISO(s.date, false)}</td>
                <td className="py-1">{s.orders}</td>
                <td className="py-1 text-right">{formatUZS(s.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function niceCeil(v: number) {
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function shortUZS(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toLocaleString("en", { maximumFractionDigits: 1 })} mln`;
  if (v >= 1_000) return `${Math.round(v / 1_000)} ming`;
  return String(v);
}
