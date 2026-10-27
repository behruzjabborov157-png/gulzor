import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { SalesChart } from "@/components/admin/sales-chart";
import { Alert } from "@/components/ui/primitives";
import { dashboardStats } from "@/lib/analytics";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, formatUZS } from "@/lib/format";
import { clickCredentials, paymeCredentials } from "@/lib/payments/config";
import { getSettings } from "@/lib/settings";
import { telegramConfigured } from "@/lib/telegram";

export const metadata = { title: "Bosh sahifa" };

const PERIODS = [7, 30, 90];

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ davr?: string; xato?: string }> }) {
  const admin = await requireAdmin();
  const sp = await searchParams;
  const days = PERIODS.includes(Number(sp.davr)) ? Number(sp.davr) : 30;
  const db = await getDb();
  const [stats, { store, checkout }, [{ demoCount }], failed] = await Promise.all([
    dashboardStats(days),
    getSettings(),
    db
      .select({ demoCount: sql<number>`count(*)::int` })
      .from(schema.products)
      .where(and(eq(schema.products.isDemo, true), eq(schema.products.status, "active"))),
    db.select().from(schema.notifications).where(eq(schema.notifications.status, "failed")).orderBy(desc(schema.notifications.createdAt)).limit(3),
  ]);

  const setup = [
    { done: telegramConfigured(), label: "Telegram bildirishnomalari (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)", href: "/admin/sozlamalar" },
    { done: !!(store.phone || store.telegramUsername), label: "Mijozlar uchun aloqa: telefon yoki Telegram username", href: "/admin/sozlamalar" },
    { done: demoCount === 0, label: `Namuna mahsulotlarni haqiqiylari bilan almashtirish (${demoCount} ta faol namuna)`, href: "/admin/mahsulotlar?demo=1" },
    { done: !checkout.demoMode, label: "Demo rejim bannerini o‘chirish (haqiqiy narxlar kiritilgandan so‘ng)", href: "/admin/sozlamalar" },
    { done: !!(paymeCredentials() || clickCredentials()), label: "Onlayn to‘lov (ixtiyoriy): Payme/Click merchant ma’lumotlari", href: "/admin/sozlamalar" },
  ];

  const cards = [
    { label: "Tushum", value: formatUZS(stats.revenue), hint: "bekor qilinmagan buyurtmalar" },
    { label: "Buyurtmalar", value: String(stats.orders), hint: `${stats.awaiting} ta yangi, ko‘rib chiqilmagan` },
    { label: "O‘rtacha chek", value: formatUZS(stats.aov), hint: "tushum / buyurtmalar" },
    { label: "Bekor qilingan", value: String(stats.cancelled), hint: `${Math.round(stats.cancelRate * 100)}% barcha buyurtmalardan` },
    { label: "To‘langan", value: formatUZS(stats.paid), hint: "to‘lov holati “to‘langan”" },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">Salom, {admin.name}</h1>
          <p className="text-sm text-muted">Statistika: {stats.fromDate} — {stats.today} (Toshkent vaqti)</p>
        </div>
        <nav className="flex gap-1 rounded-full bg-white p-1 text-sm" aria-label="Davr">
          {PERIODS.map((p) => (
            <Link key={p} href={`/admin?davr=${p}`} aria-current={p === days ? "true" : undefined} className={`rounded-full px-3 py-1.5 ${p === days ? "bg-forest text-ivory" : "text-muted"}`}>
              {p} kun
            </Link>
          ))}
        </nav>
      </div>

      {sp.xato === "ruxsat" ? <Alert tone="error">Bu bo‘lim faqat do‘kon egasi uchun.</Alert> : null}

      {setup.some((s) => !s.done) ? (
        <section className="card p-6" aria-labelledby="setup-h">
          <h2 id="setup-h" className="mb-3 text-2xl">Ishga tushirishdan oldin</h2>
          <ul className="space-y-2 text-sm">
            {setup.map((s) => (
              <li key={s.label} className="flex items-start gap-2.5">
                <span aria-hidden="true" className={s.done ? "text-success" : "text-blush-deep"}>{s.done ? "✓" : "○"}</span>
                <span className="sr-only">{s.done ? "Bajarilgan:" : "Bajarilmagan:"}</span>
                {s.done ? <span className="text-muted line-through">{s.label}</span> : <Link href={s.href} className="hover:text-forest hover:underline">{s.label}</Link>}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {failed.length ? (
        <Alert tone="error">
          So‘nggi Telegram xatolari: {failed.map((f) => `${formatDateTime(f.createdAt)} — ${f.detail}`).join("; ")}
        </Alert>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Ko‘rsatkichlar">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-xs text-muted">{c.label}</p>
            <p className="mt-1 text-xl font-semibold text-charcoal sm:text-2xl">{c.value}</p>
            <p className="mt-1 text-[11px] text-muted">{c.hint}</p>
          </div>
        ))}
      </section>

      <section className="card p-6" aria-labelledby="sales-h">
        <h2 id="sales-h" className="mb-5 text-2xl">Kunlik tushum</h2>
        <SalesChart series={stats.series} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6" aria-labelledby="best-h">
          <h2 id="best-h" className="mb-4 text-2xl">Eng ko‘p sotilganlar</h2>
          {stats.bestsellers.length === 0 ? (
            <p className="text-sm text-muted">Bu davrda buyurtmalar yo‘q.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr><th className="pb-2 font-medium">Mahsulot</th><th className="pb-2 font-medium">Dona</th><th className="pb-2 text-right font-medium">Tushum</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {stats.bestsellers.map((b) => (
                  <tr key={`${b.productId}-${b.name}`}>
                    <td className="py-2">{b.productId ? <Link href={`/admin/mahsulotlar/${b.productId}`} className="hover:underline">{b.name}</Link> : b.name}</td>
                    <td className="py-2">{b.quantity}</td>
                    <td className="py-2 text-right">{formatUZS(b.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <section className="card p-6" aria-labelledby="stock-h">
          <h2 id="stock-h" className="mb-1 text-2xl">Ombor</h2>
          <p className="mb-4 text-sm text-muted">{stats.outOfStock} ta faol mahsulot tugagan. Quyida 5 donadan kam qolganlar:</p>
          {stats.lowStock.length === 0 ? (
            <p className="text-sm text-muted">Kam qolgan mahsulot yo‘q (ombor hisobi yuritilayotganlar orasida).</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {stats.lowStock.map((s) => (
                <li key={s.id} className="flex justify-between py-2">
                  <Link href={`/admin/mahsulotlar/${s.id}`} className="hover:underline">{s.name}</Link>
                  <span className={s.stock === 0 ? "font-semibold text-danger" : ""}>{s.stock} dona</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
