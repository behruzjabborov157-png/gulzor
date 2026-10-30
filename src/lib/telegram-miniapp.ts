import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Telegram Mini App ("Do‘kon" button in the shop bot).
 *
 * The shop bot is the one customers see. It can be a separate bot from the owner-notification
 * bot (TELEGRAM_BOT_TOKEN); if TELEGRAM_SHOP_BOT_TOKEN is empty the same bot is used for both.
 * Data from Telegram (initData, a shared contact) is trusted only after its HMAC signature is
 * checked with this bot's token — see https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function shopBotToken(): string | null {
  return process.env.TELEGRAM_SHOP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN || null;
}

/**
 * Secret Telegram sends with every webhook call. TELEGRAM_WEBHOOK_SECRET if set; otherwise derived from the bot
 * token (as secret as the token itself), so a host like Render needs no extra variable. Empty without a bot.
 */
export function webhookSecret(): string {
  const set = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
  if (set) return set;
  const token = shopBotToken();
  return token ? createHash("sha256").update(`gulzor-webhook:${token}`).digest("hex").slice(0, 48) : "";
}

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

/**
 * Verifies a Telegram-signed query string (Mini App initData or a requestContact response):
 * secret = HMAC_SHA256(key "WebAppData", bot token); hash = HMAC_SHA256(key secret, sorted "k=v" lines).
 * Returns the parsed fields, or null when the signature is wrong or the data is older than maxAgeSec.
 */
export function verifyTelegramData(raw: string, token: string, maxAgeSec = 24 * 3600, now = Date.now()): Record<string, string> | null {
  if (!raw || raw.length > 8192) return null;
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) return null;
  const fields: Record<string, string> = {};
  for (const [k, v] of params) if (k !== "hash") fields[k] = v;
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const expected = createHmac("sha256", secret).update(dataCheckString).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  const authDate = Number(fields.auth_date);
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSec || authDate - now / 1000 > 300) return null;
  return fields;
}

/** The Telegram user behind a Mini App session, or null if initData is missing, forged or stale. */
export function telegramUserFromInitData(raw: string | null | undefined): TelegramUser | null {
  const token = shopBotToken();
  if (!raw || !token) return null;
  const fields = verifyTelegramData(raw, token);
  if (!fields?.user) return null;
  try {
    const u = JSON.parse(fields.user) as TelegramUser;
    return Number.isSafeInteger(u.id) && u.id > 0 ? u : null;
  } catch {
    return null;
  }
}

/** Calls a Bot API method with the shop bot. Never throws. */
export async function shopBotApi(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; description?: string; result?: unknown }> {
  const token = shopBotToken();
  if (!token) return { ok: false, description: "Telegram bot sozlanmagan" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    });
    return (await res.json().catch(() => ({ ok: false, description: `HTTP ${res.status}` }))) as { ok: boolean; description?: string };
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

/** Inline keyboard with one button that opens the shop inside Telegram. */
export function shopButton(text: string, url: string) {
  return { inline_keyboard: [[{ text, web_app: { url } }]] };
}
