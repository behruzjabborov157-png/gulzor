/**
 * Local development: runs the shop bot in long-polling mode, without a public HTTPS address.
 *   npm run dev            # the site, in one terminal
 *   npm run telegram:poll  # this relay, in another
 *
 * Every update fetched with getUpdates is passed to the site's own webhook (/api/telegram/webhook) with the
 * secret header, so the bot behaves exactly as in production. On the server use the webhook instead
 * (npm run telegram:setup) — Telegram allows only one of the two at a time.
 *
 * Needs TELEGRAM_SHOP_BOT_TOKEN (or TELEGRAM_BOT_TOKEN) in .env.local (TELEGRAM_WEBHOOK_SECRET is optional).
 * Options: --target=http://localhost:3000   --keep-pending (also answer messages sent while the bot was off)
 */
import { loadEnv } from "./env";
loadEnv();
import { shopBotToken, webhookSecret } from "@/lib/telegram-miniapp";

const token = shopBotToken();
const secret = webhookSecret();
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const target = (arg("target") ?? "http://localhost:3000").replace(/\/$/, "");
const keepPending = process.argv.includes("--keep-pending");

type Result = { ok: boolean; result?: unknown; description?: string; error_code?: number };

async function tg(method: string, body: Record<string, unknown> = {}, timeoutMs = 15_000): Promise<Result> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return (await res.json()) as Result;
}

const time = () => new Date().toLocaleTimeString("uz-UZ", { hour12: false });

async function main() {
  if (!token) throw new Error("TELEGRAM_SHOP_BOT_TOKEN (yoki TELEGRAM_BOT_TOKEN) .env.local da yo‘q");
  if (secret.length < 16) throw new Error("TELEGRAM_WEBHOOK_SECRET kamida 16 belgi bo‘lishi kerak");

  const me = await tg("getMe");
  if (!me.ok) throw new Error(`Token noto‘g‘ri: ${me.description}`);
  const bot = (me.result as { username: string }).username;

  // getUpdates does not work while a webhook is set. Never remove someone's live webhook silently.
  const info = await tg("getWebhookInfo");
  const hook = (info.result as { url?: string } | undefined)?.url;
  if (hook) throw new Error(`@${bot} da webhook o‘rnatilgan (${hook}). Polling uchun avval uni o‘chiring — bu ishlab turgan saytdagi botni to‘xtatadi.`);

  // Check that the site is up and accepts our secret before taking updates off Telegram's queue.
  const probe = await fetch(`${target}/api/telegram/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
    body: "{}",
  }).catch(() => null);
  if (!probe) throw new Error(`Sayt ishlamayapti: ${target} (avval npm run dev)`);
  if (probe.status === 403) throw new Error("Sayt webhook sirini qabul qilmadi — .env.local o‘zgargandan keyin saytni qayta ishga tushiring");

  let offset = 0;
  if (!keepPending) {
    // Skip messages sent while the bot was off (they would get late, confusing answers).
    const last = await tg("getUpdates", { offset: -1, timeout: 0 });
    const updates = (last.result as { update_id: number }[] | undefined) ?? [];
    if (updates.length) {
      offset = updates[updates.length - 1].update_id + 1;
      await tg("getUpdates", { offset, timeout: 0 });
      console.log(`${time()}  Eski xabarlar o‘tkazib yuborildi (--keep-pending bilan ularga ham javob beriladi)`);
    }
  }
  console.log(`${time()}  @${bot} polling rejimida ishlayapti → ${target}/api/telegram/webhook  (to‘xtatish: Ctrl+C)`);

  let failures = 0;
  for (;;) {
    let res: Result;
    try {
      res = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message", "callback_query"] }, 40_000);
    } catch (e) {
      failures++;
      console.error(`${time()}  Telegram bilan aloqa yo‘q: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** failures)));
      continue;
    }
    if (!res.ok) {
      // 409: a webhook was set or another poller started meanwhile.
      if (res.error_code === 409) throw new Error(`Telegram: ${res.description}`);
      failures++;
      console.error(`${time()}  Telegram xatosi: ${res.description}`);
      await new Promise((r) => setTimeout(r, Math.min(30_000, 1000 * 2 ** failures)));
      continue;
    }
    failures = 0;
    for (const u of (res.result as ({ update_id: number } & Record<string, unknown>)[]) ?? []) {
      offset = u.update_id + 1;
      const kind = u.message ? "xabar" : u.callback_query ? "tugma" : "boshqa";
      const r = await fetch(`${target}/api/telegram/webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": secret },
        body: JSON.stringify(u),
      }).catch((e: Error) => ({ status: `ulanmadi (${e.message})` }));
      console.log(`${time()}  #${u.update_id} ${kind} → sayt: ${r.status}`);
    }
  }
}

process.on("SIGINT", () => {
  console.log("\nPolling to‘xtatildi.");
  process.exit(0);
});

main().catch((e) => {
  console.error(`✖ ${(e as Error).message}`);
  process.exit(1);
});
