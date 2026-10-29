import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { api } from "@/lib/bot/api";
import { htmlEmail, orderEmail, sendEmail } from "@/lib/email";
import { formatUZS } from "@/lib/format";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import { siteUrl } from "@/lib/settings";
import { orderMessage, type SendResult } from "@/lib/telegram";
import { shopBotToken } from "@/lib/telegram-miniapp";

/*
 * Messages to marketplace florists: new orders, changes Gulzor made to their orders, moderation decisions
 * and commission statements. Two channels, each optional:
 *  - Telegram: the shop bot writes to the chat the florist linked from its panel (t.me/<bot>?start=fl_<code>);
 *  - e-mail: to the florist's panel login(s), when SMTP is configured.
 * Nothing here throws. Order-related outcomes are logged in `notifications` (channels florist_telegram /
 * florist_email) exactly as they happened — "skipped" when a channel is not set up.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const LINK_PREFIX = "fl_";

let botUsername: string | null = null;

/** The shop bot's @username (asked from Telegram once). Null when the bot is not configured or unreachable. */
export async function shopBotUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_SHOP_BOT_USERNAME) return process.env.TELEGRAM_SHOP_BOT_USERNAME.replace(/^@/, "");
  if (!shopBotToken()) return null;
  if (botUsername) return botUsername;
  const r = await api("getMe", {});
  const u = (r.result as { username?: string } | undefined)?.username;
  if (r.ok && u) botUsername = u;
  return botUsername;
}

/** Deep link that connects the florist's Telegram chat. Creates the one-time code on first use. */
export async function floristTelegramLink(floristId: number): Promise<string | null> {
  const username = await shopBotUsername();
  if (!username) return null;
  const db = await getDb();
  const [f] = await db.select({ token: schema.florists.telegramLinkToken }).from(schema.florists).where(eq(schema.florists.id, floristId));
  if (!f) return null;
  let token = f.token;
  if (!token) {
    token = randomBytes(12).toString("base64url");
    await db.update(schema.florists).set({ telegramLinkToken: token }).where(eq(schema.florists.id, floristId));
  }
  return `https://t.me/${username}?start=${LINK_PREFIX}${token}`;
}

/** Called by the bot on "/start fl_<code>": binds that private chat to the shop. Returns the shop name, or null. */
export async function linkFloristChat(startPayload: string, chatId: string): Promise<string | null> {
  if (!startPayload.startsWith(LINK_PREFIX)) return null;
  const token = startPayload.slice(LINK_PREFIX.length);
  if (!/^[\w-]{10,40}$/.test(token)) return null;
  const db = await getDb();
  // The code is single-use: it is cleared when the chat is linked.
  const [f] = await db
    .update(schema.florists)
    .set({ telegramChatId: chatId, telegramLinkToken: null, updatedAt: new Date() })
    .where(eq(schema.florists.telegramLinkToken, token))
    .returning({ name: schema.florists.name });
  return f?.name ?? null;
}

export async function unlinkFloristChat(floristId: number) {
  const db = await getDb();
  await db.update(schema.florists).set({ telegramChatId: null, telegramLinkToken: null }).where(eq(schema.florists.id, floristId));
}

type Channels = { telegram: SendResult; email: SendResult };

/** Sends one message to a florist on both channels and reports each outcome. */
async function deliver(floristId: number, telegramHtml: string, email: { subject: string; html: string; text: string }): Promise<Channels> {
  const db = await getDb();
  const [f] = await db.select({ chatId: schema.florists.telegramChatId }).from(schema.florists).where(eq(schema.florists.id, floristId));
  const users = await db
    .select({ email: schema.adminUsers.email })
    .from(schema.adminUsers)
    .where(and(eq(schema.adminUsers.floristId, floristId), eq(schema.adminUsers.isActive, true)));

  let telegram: SendResult;
  if (!shopBotToken()) telegram = { status: "skipped", detail: "TELEGRAM_SHOP_BOT_TOKEN sozlanmagan" };
  else if (!f?.chatId) telegram = { status: "skipped", detail: "Florist Telegram’ni ulamagan" };
  else {
    const r = await api("sendMessage", { chat_id: f.chatId, text: telegramHtml, parse_mode: "HTML", link_preview_options: { is_disabled: true } });
    telegram = r.ok ? { status: "sent", detail: "Yuborildi" } : { status: "failed", detail: `Telegram xatosi: ${r.description ?? "noma’lum"}` };
  }

  let mail: SendResult;
  if (!users.length) mail = { status: "skipped", detail: "Floristning faol hisobi yo‘q" };
  else {
    const results = await Promise.all(users.map((u) => sendEmail(u.email, email.subject, email.html, email.text)));
    mail = results.find((r) => r.status === "sent") ?? results[0];
  }
  return { telegram, email: mail };
}

async function log(orderId: string, c: Channels) {
  const db = await getDb();
  await db.insert(schema.notifications).values([
    { orderId, channel: "florist_telegram", status: c.telegram.status, detail: c.telegram.detail },
    { orderId, channel: "florist_email", status: c.email.status, detail: c.email.detail },
  ]);
}

async function marketplaceOrder(orderId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ o: schema.orders, f: schema.florists })
    .from(schema.orders)
    .innerJoin(schema.florists, eq(schema.florists.id, schema.orders.floristId))
    .where(eq(schema.orders.id, orderId));
  // Gulzor's own shop is run from the admin panel; the owner already gets those orders.
  if (!row || row.f.isPlatform) return null;
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  return { order: { ...row.o, items }, florist: row.f };
}

/** New order for a marketplace shop: full details (the florist prepares and delivers it) and a panel link. */
export async function notifyFloristNewOrder(orderId: string) {
  try {
    const m = await marketplaceOrder(orderId);
    if (!m) return;
    const link = `${siteUrl()}/florist/buyurtmalar/${orderId}`;
    const heading = "🌸 Yangi buyurtma";
    const tg = orderMessage(m.order, heading, { link: `Qabul qilish yoki rad etish: ${link}` });
    await log(orderId, await deliver(m.florist.id, tg, orderEmail(m.order, "Yangi buyurtma", { link })));
  } catch (e) {
    console.error("Florist notification failed", e);
  }
}

/** Gulzor changed one of the florist's orders (status or delivery details). */
export async function notifyFloristOrderChange(orderId: string, what: "status" | "details") {
  try {
    const m = await marketplaceOrder(orderId);
    if (!m) return;
    const o = m.order;
    const link = `${siteUrl()}/florist/buyurtmalar/${orderId}`;
    const line =
      what === "status"
        ? `Gulzor buyurtma holatini o‘zgartirdi: <b>${ORDER_STATUS_LABEL[o.status]}</b>${o.cancelReason ? `\nSabab: ${esc(o.cancelReason)}` : ""}`
        : "Gulzor buyurtmaning yetkazish ma’lumotlarini o‘zgartirdi. Yangilangan manzil va vaqtni tekshiring.";
    const body = `<b>Buyurtma ${o.number}</b>\n${line}\n\n${link}`;
    const subject = what === "status" ? `Buyurtma ${o.number}: ${ORDER_STATUS_LABEL[o.status]}` : `Buyurtma ${o.number} o‘zgardi`;
    await log(orderId, await deliver(m.florist.id, body, { subject, ...htmlEmail(body) }));
  } catch (e) {
    console.error("Florist notification failed", e);
  }
}

/** Moderation decision or a new commission statement; not tied to an order, so only console-logged on failure. */
export async function notifyFloristAccount(floristId: number, subject: string, body: string): Promise<Channels | null> {
  try {
    const html = `<b>${esc(subject)}</b>\n${body}\n\n${siteUrl()}/florist`;
    return await deliver(floristId, html, { subject: `Gulzor: ${subject}`, ...htmlEmail(html) });
  } catch (e) {
    console.error("Florist notification failed", e);
    return null;
  }
}

export function statusDecisionMessage(to: "approved" | "suspended" | "rejected", reason: string | null) {
  const why = reason ? `\nSabab: ${esc(reason)}` : "";
  if (to === "approved") return { subject: "Do‘koningiz tasdiqlandi", body: "Do‘koningiz va faol mahsulotlaringiz endi saytda ko‘rinadi. Buyurtmalarni panelda qabul qiling." };
  if (to === "suspended") return { subject: "Do‘koningiz vaqtincha to‘xtatildi", body: `Mahsulotlaringiz saytda ko‘rinmaydi. Ochiq buyurtmalarni yakunlashingiz mumkin.${why}` };
  return { subject: "Arizangiz rad etildi", body: `Do‘koningiz saytda ko‘rinmaydi.${why}` };
}

export function statementMessage(period: string, orderCount: number, commission: number) {
  return {
    subject: `${period} uchun komissiya hisobi`,
    body: `${period}: ${orderCount} ta yetkazilgan buyurtma, Gulzor komissiyasi <b>${formatUZS(commission)}</b>.\nTafsilotlar panelning «Hisobot» bo‘limida.`,
  };
}
