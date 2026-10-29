import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fmt, isLocale, localePath } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { formatUZS } from "@/lib/format";
import { siteUrl } from "@/lib/settings";
import { shopBotApi } from "@/lib/telegram-miniapp";

/**
 * Messages from the shop bot to a customer who ordered in the Telegram Mini App: "order received"
 * and every status change, in the language they ordered in. Customers who ordered on the website
 * have no Telegram id and get nothing. Never throws; the outcome is logged on the order.
 */
export async function notifyCustomerTelegram(orderId: string, kind: "received" | "status") {
  try {
    const db = await getDb();
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, orderId));
    if (!o?.telegramUserId) return;
    const locale = isLocale(o.locale) ? o.locale : "uz";
    const t = getDict(locale).order;
    const base = siteUrl();
    const url = base + localePath(locale, `/buyurtma/${o.number}?t=${o.accessToken}`);
    const text =
      kind === "received"
        ? fmt(t.tg.received, { number: o.number, total: formatUZS(o.total, locale) })
        : [fmt(t.tg.status, { number: o.number, status: t.statuses[o.status] }), o.cancelReason ? fmt(t.tg.reason, { reason: o.cancelReason }) : null]
            .filter(Boolean)
            .join("\n");
    // Telegram only accepts HTTPS Mini App links; on a local http:// site the link goes in the text instead.
    const https = base.startsWith("https://");
    const res = await shopBotApi("sendMessage", {
      chat_id: o.telegramUserId,
      text: https ? text : `${text}\n${url}`,
      ...(https ? { reply_markup: { inline_keyboard: [[{ text: t.tg.open, web_app: { url } }]] } } : {}),
    });
    await db.insert(schema.notifications).values({
      orderId: o.id,
      channel: "telegram-customer",
      status: res.ok ? "sent" : "failed",
      detail: res.ok ? `Mijozga: ${kind === "received" ? "qabul qilindi" : t.statuses[o.status]}` : `Telegram API: ${res.description ?? ""}`,
    });
  } catch (e) {
    console.error("Customer Telegram notification failed", e);
  }
}
