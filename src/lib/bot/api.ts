import fs from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { getDb, schema } from "@/db";
import { readMedia } from "@/lib/storage";
import { shopBotApi, shopBotToken } from "@/lib/telegram-miniapp";

export type ApiResult = { ok: boolean; description?: string; result?: unknown };
/** Sends one Bot API call. Replaceable in tests so no request reaches Telegram. */
export type Transport = (method: string, body: Record<string, unknown>, file?: { field: string; name: string; data: Buffer }) => Promise<ApiResult>;

async function realTransport(method: string, body: Record<string, unknown>, file?: { field: string; name: string; data: Buffer }): Promise<ApiResult> {
  if (!file) return shopBotApi(method, body);
  const token = shopBotToken();
  if (!token) return { ok: false, description: "Telegram bot sozlanmagan" };
  const form = new FormData();
  for (const [k, v] of Object.entries(body)) form.append(k, typeof v === "string" ? v : JSON.stringify(v));
  form.append(file.field, new Blob([new Uint8Array(file.data)], { type: "image/jpeg" }), file.name);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", body: form, signal: AbortSignal.timeout(20_000) });
    return (await res.json()) as ApiResult;
  } catch (e) {
    return { ok: false, description: (e as Error).message };
  }
}

let transport: Transport = realTransport;
export function setBotTransport(t: Transport | null) {
  transport = t ?? realTransport;
}

export function api(method: string, body: Record<string, unknown>) {
  return transport(method, body);
}

export type InlineButton = { text: string; callback_data?: string; url?: string; web_app?: { url: string } };
export type Keyboard = { inline_keyboard: InlineButton[][] } | { keyboard: unknown[][]; resize_keyboard: boolean; is_persistent?: boolean; one_time_keyboard?: boolean } | { remove_keyboard: true };

export function send(chatId: string | number, text: string, reply_markup?: Keyboard) {
  return api("sendMessage", { chat_id: chatId, text, ...(reply_markup ? { reply_markup } : {}), link_preview_options: { is_disabled: true } });
}

/** Bytes behind a site image URL: /images/... from public/, /media/... from the upload storage (disk or database). */
async function imageBytes(url: string): Promise<Buffer | null> {
  if (url.startsWith("/images/") && !url.includes("..")) {
    return fs.readFile(path.join(/*turbopackIgnore: true*/ process.cwd(), "public", url)).catch(() => null);
  }
  if (url.startsWith("/media/")) return readMedia(url.slice("/media/".length).split("/"));
  return null;
}

/**
 * Sends a product photo with caption and buttons. Each image is converted to JPEG and uploaded once;
 * Telegram's file_id is cached in tg_media and reused. Falls back to a text message without a photo.
 */
export async function sendPhoto(chatId: string | number, imageUrl: string | null, caption: string, reply_markup: Keyboard) {
  const db = await getDb();
  if (imageUrl) {
    const [cached] = await db.select().from(schema.tgMedia).where(eq(schema.tgMedia.url, imageUrl));
    if (cached) {
      const r = await transport("sendPhoto", { chat_id: chatId, photo: cached.fileId, caption, reply_markup });
      if (r.ok) return r;
    }
    const source = await imageBytes(imageUrl);
    if (source) {
      const data = await sharp(source).rotate().resize(1280, 1280, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
      const r = await transport("sendPhoto", { chat_id: chatId, caption, reply_markup }, { field: "photo", name: "photo.jpg", data });
      const photos = (r.result as { photo?: { file_id: string }[] } | undefined)?.photo;
      if (r.ok && photos?.length) {
        await db
          .insert(schema.tgMedia)
          .values({ url: imageUrl, fileId: photos[photos.length - 1].file_id })
          .onConflictDoUpdate({ target: schema.tgMedia.url, set: { fileId: photos[photos.length - 1].file_id } });
        return r;
      }
    }
  }
  return send(chatId, caption, reply_markup);
}
