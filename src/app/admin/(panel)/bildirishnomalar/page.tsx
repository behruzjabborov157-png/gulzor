import Link from "next/link";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { panelT } from "@/i18n/panel/server";
import { requireOwner } from "@/lib/auth";
import { emailConfigured } from "@/lib/email";
import { formatDateTime } from "@/lib/format";
import { telegramConfigured } from "@/lib/telegram";
import { shopBotApi } from "@/lib/telegram-miniapp";

export async function generateMetadata() {
  return { title: (await panelT())("Bildirishnomalar") };
}

const CHANNEL: Record<string, string> = {
  telegram: "Egasiga (Telegram)",
  email: "Egasiga (email)",
  "telegram-customer": "Mijozga (Telegram)",
  "telegram-florist": "Do‘konga (Telegram)",
};
const STATUS: Record<string, string> = { sent: "Yuborildi", failed: "Xato", skipped: "O‘tkazib yuborildi" };
const STYLE: Record<string, string> = { sent: "bg-sage-light text-wine", failed: "bg-danger/10 text-danger", skipped: "bg-cream text-muted" };

/** Server time, read once per request. */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

type WebhookInfo = { url?: string; pending_update_count?: number; last_error_date?: number; last_error_message?: string };

export default async function NotificationsAdmin({ searchParams }: { searchParams: Promise<{ holat?: string }> }) {
  const tt = await panelT();
  await requireOwner();
  const sp = await searchParams;
  const status = sp.holat && sp.holat in STATUS ? sp.holat : null;
  const db = await getDb();
  const N = schema.notifications;
  const weekAgo = daysAgo(7);
  const [rows, week, hook] = await Promise.all([
    db
      .select({ n: N, number: schema.orders.number })
      .from(N)
      .leftJoin(schema.orders, eq(schema.orders.id, N.orderId))
      .where(status ? eq(N.status, status as "sent") : undefined)
      .orderBy(desc(N.createdAt))
      .limit(100),
    db
      .select({ channel: N.channel, status: N.status, n: sql<number>`count(*)::int` })
      .from(N)
      .where(and(gte(N.createdAt, weekAgo)))
      .groupBy(N.channel, N.status),
    shopBotApi("getWebhookInfo", {}),
  ]);
  const info = (hook.ok ? hook.result : null) as WebhookInfo | null;
  const failedWeek = week.filter((w) => w.status === "failed").reduce((s, w) => s + w.n, 0);

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-4xl">{tt("Bildirishnomalar")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">
          {tt("Buyurtmalar haqidagi har bir xabar natijasi bilan yoziladi: yuborildi, xato yoki sozlanmagani uchun o‘tkazib yuborildi. Xato bo‘lgan xabarni buyurtma sahifasidan qayta yuborish mumkin.")}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4 text-sm">
          <p className="text-xs text-muted">{tt("Egasiga xabarlar")}</p>
          <p className="font-semibold">
            Telegram: {telegramConfigured() ? tt("Sozlangan") : tt("Sozlanmagan")} · Email: {emailConfigured() ? tt("Sozlangan") : tt("Sozlanmagan")}
          </p>
          <Link href="/admin/sozlamalar" className="text-xs text-wine underline">
            {tt("Sozlamalar va test xabar")}
          </Link>
        </div>
        <div className="card p-4 text-sm">
          <p className="text-xs text-muted">{tt("Do‘kon boti (mijozlar va floristlar)")}</p>
          {info ? (
            <>
              <p className="font-semibold">{info.url ? tt("Webhook ulangan") : tt("Webhook o‘rnatilmagan")}</p>
              <p className="text-xs text-muted">{tt("Kutilayotgan xabarlar: {n}", { n: info.pending_update_count ?? 0 })}</p>
              {info.last_error_message ? (
                <p className="text-xs text-danger">
                  {tt("Oxirgi xato: {text}", { text: info.last_error_message })}
                  {info.last_error_date ? ` (${formatDateTime(new Date(info.last_error_date * 1000))})` : ""}
                </p>
              ) : null}
            </>
          ) : (
            <p className="font-semibold">{tt("Bot sozlanmagan yoki javob bermadi")}</p>
          )}
        </div>
        <div className="card p-4 text-sm">
          <p className="text-xs text-muted">{tt("Oxirgi 7 kun")}</p>
          <p className="font-semibold">{tt("Xatolar: {n}", { n: failedWeek })}</p>
          <ul className="mt-1 text-xs text-muted">
            {week.map((w) => (
              <li key={`${w.channel}-${w.status}`}>
                {tt(CHANNEL[w.channel] ?? w.channel)} · {tt(STATUS[w.status])}: {w.n}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm" aria-label={tt("Holat bo‘yicha")}>
        {[["", tt("Barchasi")], ...Object.entries(STATUS).map(([k, v]) => [k, tt(v)])].map(([k, label]) => (
          <Link key={k} href={k ? `/admin/bildirishnomalar?holat=${k}` : "/admin/bildirishnomalar"} className={`chip ${(status ?? "") === k ? "chip-active" : ""}`}>
            {label}
          </Link>
        ))}
      </nav>

      <section className="card overflow-x-auto" aria-label={tt("Bildirishnomalar")}>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted">{tt("Hali yozuv yo‘q.")}</p>
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b border-line text-left text-xs text-muted">
              <tr>
                <th className="px-4 py-3">{tt("Vaqt")}</th>
                <th className="px-4 py-3">{tt("Buyurtma")}</th>
                <th className="px-4 py-3">{tt("Kimga")}</th>
                <th className="px-4 py-3">{tt("Holat")}</th>
                <th className="px-4 py-3">{tt("Izoh")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ n, number }) => (
                <tr key={n.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(n.createdAt)}</td>
                  <td className="px-4 py-3">
                    {n.orderId && number ? (
                      <Link href={`/admin/buyurtmalar/${n.orderId}`} className="text-wine underline">
                        {number}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{tt(CHANNEL[n.channel] ?? n.channel)}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${STYLE[n.status]}`}>{tt(STATUS[n.status])}</span>
                  </td>
                  <td className="max-w-md px-4 py-3 text-xs break-words text-muted">{n.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
