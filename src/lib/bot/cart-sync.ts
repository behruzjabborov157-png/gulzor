import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { Locale } from "@/i18n/config";
import { cartLineSchema, quoteCart } from "@/lib/quote";

/*
 * One cart for a Telegram user in the ordering bot and in the Mini App (the website inside Telegram).
 * The bot keeps it in tg_sessions; the Mini App in the browser. Whichever side changed it last wins:
 * the Mini App sends the stamp of the last cart it saw, and an older stamp means the bot changed it since.
 */

export const syncLinesSchema = z.array(cartLineSchema).max(30);
export type SyncLine = z.infer<typeof cartLineSchema>;

const same = (a: SyncLine, b: SyncLine) =>
  a.productId === b.productId &&
  (a.variantId ?? null) === (b.variantId ?? null) &&
  (a.stems ?? null) === (b.stems ?? null) &&
  (a.color ?? null) === (b.color ?? null) &&
  JSON.stringify([...(a.addons ?? [])].sort((x, y) => x.productId - y.productId)) === JSON.stringify([...(b.addons ?? [])].sort((x, y) => x.productId - y.productId));

/** Union of two carts; a line in both keeps the larger quantity. */
export function mergeCarts(a: SyncLine[], b: SyncLine[]): SyncLine[] {
  const out = a.map((l) => ({ ...l }));
  for (const l of b) {
    const hit = out.find((x) => same(x, l));
    if (hit) hit.quantity = Math.max(hit.quantity, l.quantity);
    else out.push({ ...l });
  }
  return out.slice(0, 30);
}

/**
 * stamp = null: first sync in this browser, so both carts are merged.
 * stamp ≥ the bot cart's last change: the Mini App's cart is newer and replaces the bot's.
 * stamp < the bot cart's last change: the bot's cart is newer and is returned.
 */
export async function syncTelegramCart(userId: number, local: SyncLine[], stamp: number | null): Promise<{ lines: SyncLine[]; stamp: number }> {
  const db = await getDb();
  const chatId = String(userId); // a private chat's id is the user's id
  const [row] = await db.select().from(schema.tgSessions).where(eq(schema.tgSessions.chatId, chatId));
  const server: SyncLine[] = (row?.cart ?? []).map((l) => ({ ...l, addons: l.addons ?? [] }));
  const serverStamp = row?.cartUpdatedAt?.getTime() ?? 0;

  let lines: SyncLine[];
  if (stamp == null) lines = mergeCarts(server, local);
  else if (stamp >= serverStamp) lines = local;
  else return { lines: server, stamp: serverStamp };

  if (JSON.stringify(lines) === JSON.stringify(server) && row) return { lines, stamp: Math.max(serverStamp, stamp ?? 0) };
  const now = new Date();
  const cart = lines.map((l) => ({ productId: l.productId, variantId: l.variantId ?? null, stems: l.stems ?? null, color: l.color ?? null, quantity: l.quantity, addons: l.addons ?? [] }));
  await db
    .insert(schema.tgSessions)
    .values({ chatId, cart, cartUpdatedAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: schema.tgSessions.chatId, set: { cart, cartUpdatedAt: now, updatedAt: now } });
  return { lines, stamp: now.getTime() };
}

/** Lines with what the website's cart shows (names, photos, prices), in the visitor's language. */
export async function describeLines(lines: SyncLine[], locale: Locale) {
  if (!lines.length) return [];
  const q = await quoteCart({ lines }, { locale });
  return q.lines
    .filter((l) => !l.error)
    .map((l) => ({
      productId: l.productId,
      slug: l.slug ?? "",
      name: l.name,
      image: l.image,
      variantId: l.variantId,
      variantName: l.variantName,
      stems: l.stems,
      color: l.color,
      addons: l.addons.map((a) => ({ productId: a.productId, quantity: a.quantity, name: a.name, price: a.unitPrice })),
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      floristId: q.florist?.id ?? null,
      floristName: q.florist?.name ?? null,
    }));
}
