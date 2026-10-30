import { createHash } from "node:crypto";
import { getDict } from "@/i18n/dict";
import { siteUrl } from "@/lib/settings";
import { shopBotApi, shopBotToken, webhookSecret } from "@/lib/telegram-miniapp";

/*
 * Shop bot configuration: menu button, commands, descriptions and the webhook.
 * Used by `npm run telegram:setup` and, with TELEGRAM_AUTO_SETUP=1, at server start (src/instrumentation.ts)
 * for hosts without a shell such as Render.
 */

export type SetupLog = (ok: boolean, label: string, detail?: string) => void;

const isSecret = (s: string) => /^[A-Za-z0-9_-]{16,256}$/.test(s);

/**
 * Webhook URL with a short fingerprint of the secret: when the secret changes the URL changes too, so a restart
 * can tell whether the registered webhook is still valid without Telegram revealing the secret. The route ignores it.
 */
export function webhookUrl(site: string, secret: string) {
  const v = createHash("sha256").update(secret).digest("hex").slice(0, 10);
  return `${site.replace(/\/$/, "")}/api/telegram/webhook?v=${v}`;
}

/** Full setup. dropPending clears messages Telegram queued while no webhook was reachable. */
export async function configureShopBot(opts: { site: string; secret: string; dropPending: boolean; log: SetupLog }) {
  const { site, secret, log } = opts;
  const call = async (label: string, method: string, body: Record<string, unknown>) => {
    const r = await shopBotApi(method, body);
    log(r.ok, label, r.ok ? undefined : r.description);
    return r.ok;
  };
  const uz = getDict("uz").layout.tgBot;
  const ru = getDict("ru").layout.tgBot;
  let ok = true;
  ok = (await call("Menyu tugmasi «Do‘kon»", "setChatMenuButton", { menu_button: { type: "web_app", text: uz.menu, web_app: { url: `${site}/` } } })) && ok;
  ok = (await call("Buyruqlar (o‘zbekcha)", "setMyCommands", { commands: [{ command: "start", description: uz.open.replace(/^🌸\s*/, "") }] })) && ok;
  ok = (await call("Buyruqlar (ruscha)", "setMyCommands", { commands: [{ command: "start", description: ru.open.replace(/^🌸\s*/, "") }], language_code: "ru" })) && ok;
  ok = (await call("Qisqa tavsif (o‘zbekcha)", "setMyShortDescription", { short_description: "Gulzor — guldastalar va gullarni onlayn buyurtma qilish" })) && ok;
  ok = (await call("Qisqa tavsif (ruscha)", "setMyShortDescription", { short_description: "Gulzor — заказ букетов и цветов онлайн", language_code: "ru" })) && ok;
  ok = (await call("Tavsif (o‘zbekcha)", "setMyDescription", { description: `${uz.welcome}\n${uz.text}` })) && ok;
  ok = (await call("Tavsif (ruscha)", "setMyDescription", { description: `${ru.welcome}\n${ru.text}`, language_code: "ru" })) && ok;
  ok =
    (await call("Webhook", "setWebhook", {
      url: webhookUrl(site, secret),
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
      drop_pending_updates: opts.dropPending,
    })) && ok;
  return ok;
}

/**
 * Server start (TELEGRAM_AUTO_SETUP=1): registers the webhook only if it is missing or points elsewhere.
 * It never drops pending updates — on a sleeping free instance the message that woke the server is one of them.
 */
export async function ensureShopBotWebhook(): Promise<void> {
  const site = siteUrl();
  const secret = webhookSecret();
  if (!shopBotToken()) return console.warn("[telegram] TELEGRAM_SHOP_BOT_TOKEN / TELEGRAM_BOT_TOKEN yo‘q — bot o‘chiq");
  if (!site.startsWith("https://")) return console.warn("[telegram] sayt manzili https:// emas — webhook o‘rnatilmadi");
  if (!isSecret(secret)) return console.warn("[telegram] TELEGRAM_WEBHOOK_SECRET faqat harf, raqam, _ va - dan, 16–256 belgi bo‘lishi kerak — webhook o‘rnatilmadi");
  const info = await shopBotApi("getWebhookInfo", {});
  const current = (info.result as { url?: string } | undefined)?.url;
  if (info.ok && current === webhookUrl(site, secret)) return console.log("[telegram] webhook allaqachon to‘g‘ri");
  const ok = await configureShopBot({
    site,
    secret,
    dropPending: false,
    log: (good, label, detail) => (good ? console.log(`[telegram] ✔ ${label}`) : console.error(`[telegram] ✖ ${label}: ${detail}`)),
  });
  console.log(ok ? "[telegram] bot sozlandi" : "[telegram] bot sozlashda xatolar bor (yuqoriga qarang)");
}

export { isSecret };
