/**
 * Configures the shop bot for the Telegram Mini App. Run on the server after the site is live on HTTPS:
 *   npm run telegram:setup
 * Needs TELEGRAM_SHOP_BOT_TOKEN (or TELEGRAM_BOT_TOKEN), TELEGRAM_WEBHOOK_SECRET and an https NEXT_PUBLIC_SITE_URL.
 * Safe to run again (every call overwrites the previous setting).
 */
import { loadEnv } from "./env";
loadEnv();
import { getDict } from "@/i18n/dict";
import { shopBotApi, shopBotToken } from "@/lib/telegram-miniapp";

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function call(label: string, method: string, body: Record<string, unknown>) {
  const r = await shopBotApi(method, body);
  console.log(`${r.ok ? "✔" : "✖"} ${label}${r.ok ? "" : ` — ${r.description}`}`);
  if (!r.ok) process.exitCode = 1;
  return r;
}

async function main() {
  if (!shopBotToken()) fail("TELEGRAM_SHOP_BOT_TOKEN (yoki TELEGRAM_BOT_TOKEN) .env.local da yo‘q");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!site.startsWith("https://")) fail(`NEXT_PUBLIC_SITE_URL https:// bilan boshlanishi kerak (hozir: "${site}"). Telegram Mini App faqat HTTPS saytda ishlaydi.`);
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? "";
  if (!/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    fail("TELEGRAM_WEBHOOK_SECRET kamida 16 belgili (harf, raqam, _ yoki -) bo‘lishi kerak. Yaratish: node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\"");
  }

  const me = await shopBotApi("getMe", {});
  if (!me.ok) fail(`Token ishlamayapti: ${me.description}`);
  const bot = me.result as { username: string };
  console.log(`Bot: @${bot.username}\nSayt: ${site}\n`);

  const uz = getDict("uz").layout.tgBot;
  const ru = getDict("ru").layout.tgBot;

  await call("Menyu tugmasi «Do‘kon»", "setChatMenuButton", { menu_button: { type: "web_app", text: uz.menu, web_app: { url: `${site}/` } } });
  await call("Buyruqlar (o‘zbekcha)", "setMyCommands", { commands: [{ command: "start", description: uz.open.replace(/^🌸\s*/, "") }] });
  await call("Buyruqlar (ruscha)", "setMyCommands", { commands: [{ command: "start", description: ru.open.replace(/^🌸\s*/, "") }], language_code: "ru" });
  await call("Qisqa tavsif (o‘zbekcha)", "setMyShortDescription", { short_description: "Gulzor — guldastalar va gullarni onlayn buyurtma qilish" });
  await call("Qisqa tavsif (ruscha)", "setMyShortDescription", { short_description: "Gulzor — заказ букетов и цветов онлайн", language_code: "ru" });
  await call("Tavsif (o‘zbekcha)", "setMyDescription", { description: `${uz.welcome}\n${uz.text}` });
  await call("Tavsif (ruscha)", "setMyDescription", { description: `${ru.welcome}\n${ru.text}`, language_code: "ru" });
  await call("Webhook", "setWebhook", {
    url: `${site}/api/telegram/webhook`,
    secret_token: secret,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: true,
  });
  const info = await shopBotApi("getWebhookInfo", {});
  const w = info.result as { url?: string; last_error_message?: string } | undefined;
  console.log(`\nWebhook: ${w?.url ?? "-"}${w?.last_error_message ? ` (oxirgi xato: ${w.last_error_message})` : ""}`);
  console.log(`\nTayyor. Telegram'da https://t.me/${bot.username} ni oching → /start → «Do‘kon».`);
}

main().catch((e) => fail((e as Error).message));
