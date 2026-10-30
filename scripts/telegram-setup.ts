/**
 * Configures the shop bot for the Telegram Mini App. Run on the server after the site is live on HTTPS:
 *   npm run telegram:setup
 * Needs TELEGRAM_SHOP_BOT_TOKEN (or TELEGRAM_BOT_TOKEN), TELEGRAM_WEBHOOK_SECRET and an https NEXT_PUBLIC_SITE_URL.
 * Safe to run again (every call overwrites the previous setting).
 * Hosts without a shell (Render): set TELEGRAM_AUTO_SETUP=1 instead — the server does this at start.
 */
import { loadEnv } from "./env";
loadEnv();
import { shopBotApi, shopBotToken, webhookSecret } from "@/lib/telegram-miniapp";
import { configureShopBot, isSecret } from "@/lib/telegram-setup";

function fail(msg: string): never {
  console.error(`✖ ${msg}`);
  process.exit(1);
}

async function main() {
  if (!shopBotToken()) fail("TELEGRAM_SHOP_BOT_TOKEN (yoki TELEGRAM_BOT_TOKEN) .env.local da yo‘q");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  if (!site.startsWith("https://")) fail(`NEXT_PUBLIC_SITE_URL https:// bilan boshlanishi kerak (hozir: "${site}"). Telegram Mini App faqat HTTPS saytda ishlaydi.`);
  const secret = webhookSecret();
  if (!isSecret(secret)) {
    fail("TELEGRAM_WEBHOOK_SECRET kamida 16 belgili (harf, raqam, _ yoki -) bo‘lishi kerak. Yaratish: node -e \"console.log(require('crypto').randomBytes(24).toString('hex'))\"");
  }

  const me = await shopBotApi("getMe", {});
  if (!me.ok) fail(`Token ishlamayapti: ${me.description}`);
  const bot = me.result as { username: string };
  console.log(`Bot: @${bot.username}\nSayt: ${site}\n`);

  const ok = await configureShopBot({
    site,
    secret,
    dropPending: true,
    log: (good, label, detail) => console.log(`${good ? "✔" : "✖"} ${label}${good ? "" : ` — ${detail}`}`),
  });
  if (!ok) process.exitCode = 1;
  const info = await shopBotApi("getWebhookInfo", {});
  const w = info.result as { url?: string; last_error_message?: string } | undefined;
  console.log(`\nWebhook: ${w?.url ?? "-"}${w?.last_error_message ? ` (oxirgi xato: ${w.last_error_message})` : ""}`);
  console.log(`\nTayyor. Telegram'da https://t.me/${bot.username} ni oching → /start → «Do‘kon».`);
}

main().catch((e) => fail((e as Error).message));
