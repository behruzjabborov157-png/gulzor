import { timingSafeEqual } from "node:crypto";
import { localePath, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { siteUrl } from "@/lib/settings";
import { shopBotApi, shopButton } from "@/lib/telegram-miniapp";

export const dynamic = "force-dynamic";

type Update = {
  message?: { chat: { id: number; type: string }; text?: string; from?: { language_code?: string } };
};

function secretOk(given: string | null) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Shop bot webhook (registered by `npm run telegram:setup`). Telegram proves the request is
 * genuine with the secret token header. Answers /start with a welcome and the shop button;
 * Russian-speaking users also get a Russian menu button that opens /ru.
 */
export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-telegram-bot-api-secret-token"))) return new Response("Forbidden", { status: 403 });
  const update = (await request.json().catch(() => ({}))) as Update;
  const msg = update.message;
  if (msg?.chat.type === "private" && msg.text?.startsWith("/start")) {
    const locale: Locale = msg.from?.language_code?.startsWith("ru") ? "ru" : "uz";
    const t = getDict(locale).layout.tgBot;
    const url = siteUrl() + localePath(locale, "/");
    await shopBotApi("sendMessage", { chat_id: msg.chat.id, text: `${t.welcome}\n\n${t.text}`, reply_markup: shopButton(t.open, url) });
    if (locale === "ru") {
      await shopBotApi("setChatMenuButton", { chat_id: msg.chat.id, menu_button: { type: "web_app", text: t.menu, web_app: { url } } });
    }
  }
  // Always 200 so Telegram does not keep re-sending the update.
  return Response.json({ ok: true });
}
