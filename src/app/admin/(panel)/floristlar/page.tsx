import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { FLORIST_STATUS_LABEL, FLORIST_STATUS_STYLE, floristStatusCounts, listFloristsForAdmin } from "@/lib/florist-admin";
import type { FloristStatus } from "@/lib/florists";

export const metadata = { title: "Do‘konlar" };

const TABS: (FloristStatus | "")[] = ["", "pending", "approved", "suspended", "rejected"];

/** All shops on the marketplace; new applications first in the "Ko‘rib chiqilmoqda" tab. */
export default async function FloristsAdminPage({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const status = sp.holat && sp.holat in FLORIST_STATUS_LABEL ? (sp.holat as FloristStatus) : undefined;
  const [rows, counts] = await Promise.all([listFloristsForAdmin(status), floristStatusCounts()]);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <h1 className="mb-2 text-4xl">Do‘konlar</h1>
      <p className="mb-6 max-w-3xl text-sm text-muted">
        Floristlar /florist/royxatdan-otish sahifasida ariza qoldiradi. Tasdiqlanmaguncha do‘kon va uning mahsulotlari saytda ko‘rinmaydi.
      </p>
      <nav aria-label="Holat bo‘yicha" className="mb-5 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link key={t || "all"} href={t ? `/admin/floristlar?holat=${t}` : "/admin/floristlar"} className={`chip ${(status ?? "") === t ? "chip-active" : ""}`} aria-current={(status ?? "") === t ? "page" : undefined}>
            {t ? FLORIST_STATUS_LABEL[t] : "Barchasi"} ({t ? counts[t] : total})
          </Link>
        ))}
      </nav>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-line bg-ivory text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">Do‘kon</th>
              <th className="px-4 py-3 font-medium">Holat</th>
              <th className="px-4 py-3 font-medium">Shahar</th>
              <th className="px-4 py-3 text-right font-medium">Mahsulot</th>
              <th className="px-4 py-3 text-right font-medium">Buyurtma</th>
              <th className="px-4 py-3 text-right font-medium">Komissiya</th>
              <th className="px-4 py-3 font-medium">Ariza sanasi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted">
                  Bu holatda do‘kon yo‘q
                </td>
              </tr>
            ) : (
              rows.map((f) => (
                <tr key={f.id} className="hover:bg-ivory">
                  <td className="px-4 py-3">
                    <Link href={`/admin/floristlar/${f.id}`} className="font-semibold text-wine hover:underline">
                      {f.name}
                    </Link>
                    {f.isPlatform ? <span className="ml-1.5 text-[10px] text-muted">Gulzor do‘koni</span> : null}
                    <br />
                    <span className="text-xs text-muted">/dokon/{f.slug}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${FLORIST_STATUS_STYLE[f.status]}`}>{FLORIST_STATUS_LABEL[f.status]}</span>
                  </td>
                  <td className="px-4 py-3">{f.city ?? "—"}</td>
                  <td className="px-4 py-3 text-right">{f.products}</td>
                  <td className="px-4 py-3 text-right">{f.orders}</td>
                  <td className="px-4 py-3 text-right">{(f.commissionRate / 100).toLocaleString("uz-UZ")}%</td>
                  <td className="px-4 py-3 text-muted">{formatDateTime(f.createdAt)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
