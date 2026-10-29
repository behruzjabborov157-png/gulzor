import { getDb, schema } from "@/db";
import { formatDateISO, formatPhone, formatUZS } from "@/lib/format";
import { siteUrl } from "@/lib/settings";

export function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID);
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export type SendResult = { status: "sent" | "failed" | "skipped"; detail: string };

/** Sends a message to the owner chat. Never throws; reports what really happened. */
export async function sendTelegram(html: string): Promise<SendResult> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { status: "skipped", detail: "TELEGRAM_BOT_TOKEN yoki TELEGRAM_CHAT_ID sozlanmagan" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true }),
      signal: AbortSignal.timeout(8000),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string };
    if (res.ok && body.ok) return { status: "sent", detail: "Yuborildi" };
    return { status: "failed", detail: `Telegram API: ${res.status} ${body.description ?? ""}`.trim() };
  } catch (e) {
    return { status: "failed", detail: `Tarmoq xatosi: ${(e as Error).message}` };
  }
}

const PAYMENT_LABEL: Record<string, string> = { cash: "Naqd (qabul qilganda)", payme: "Payme", click: "Click" };
const PAYMENT_STATUS: Record<string, string> = {
  pending: "Kutilmoqda",
  paid: "To‘langan",
  failed: "Xato",
  cancelled: "Bekor qilingan",
  refunded: "Qaytarilgan",
};

export type OrderForMessage = typeof schema.orders.$inferSelect & { items: (typeof schema.orderItems.$inferSelect)[] };

export function orderMessage(o: OrderForMessage, heading = "🌸 Yangi buyurtma"): string {
  const items = o.items
    .map((i) => {
      const opts = [i.variantName, i.stems ? `${i.stems} dona` : null, i.color].filter(Boolean).join(", ");
      const addons = i.addons.map((a) => `   + ${esc(a.name)} × ${a.quantity}`).join("\n");
      return `• ${esc(i.productName)}${opts ? ` (${esc(opts)})` : ""} × ${i.quantity} — ${formatUZS(i.lineTotal)}${addons ? "\n" + addons : ""}`;
    })
    .join("\n");
  const where =
    o.fulfillment === "pickup"
      ? "Do‘kondan olib ketish"
      : [o.regionName, o.zoneName, o.district, o.neighborhood, o.address, o.apartment && `kv. ${o.apartment}`, o.landmark && `mo‘ljal: ${o.landmark}`]
          .filter(Boolean)
          .map((x) => esc(String(x)))
          .join(", ");
  return [
    `<b>${heading}: ${o.number}</b>${o.containsDemo ? " ⚠️ DEMO mahsulot bor" : ""}`,
    "",
    `<b>Mijoz:</b> ${esc(o.customerName)}, ${formatPhone(o.customerPhone)}`,
    o.locale === "ru" ? "<b>Mijoz tili:</b> rus tili" : null,
    `<b>Qabul qiluvchi:</b> ${esc(o.recipientName)}, ${formatPhone(o.recipientPhone)}${o.anonymous ? " (anonim)" : ""}`,
    `<b>${o.fulfillment === "pickup" ? "Olib ketish" : "Manzil"}:</b> ${where}`,
    `<b>Sana va vaqt:</b> ${formatDateISO(o.deliveryDate)}, ${esc(o.slotLabel)}`,
    "",
    items,
    "",
    o.cardMessage ? `<b>Otkritka:</b> ${esc(o.cardMessage)}` : null,
    o.courierNote ? `<b>Kuryer uchun:</b> ${esc(o.courierNote)}` : null,
    `<b>To‘lov:</b> ${PAYMENT_LABEL[o.paymentMethod]} — ${PAYMENT_STATUS[o.paymentStatus]}`,
    o.discount ? `<b>Chegirma:</b> −${formatUZS(o.discount)}${o.couponCode ? ` (${esc(o.couponCode)})` : ""}` : null,
    `<b>Yetkazish:</b> ${formatUZS(o.deliveryFee)}`,
    o.serviceFee ? `<b>Xizmat haqi:</b> ${formatUZS(o.serviceFee)}` : null,
    `<b>JAMI: ${formatUZS(o.total)}</b>`,
    "",
    `${siteUrl()}/admin/buyurtmalar/${o.id}`,
  ]
    .filter((x) => x !== null)
    .join("\n");
}

/** Sends and logs the result against the order. */
export async function notifyOrder(o: OrderForMessage, heading?: string): Promise<SendResult> {
  const result = await sendTelegram(orderMessage(o, heading));
  const db = await getDb();
  await db.insert(schema.notifications).values({ orderId: o.id, channel: "telegram", status: result.status, detail: result.detail });
  return result;
}
