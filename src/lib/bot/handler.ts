import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { fmt, localePath, pick, pickAt, type Locale } from "@/i18n/config";
import { getDict } from "@/i18n/dict";
import { getCategories, getProductsByIds, listProducts, stockState, toPricing } from "@/lib/catalog";
import { isOrderable } from "@/lib/catalog-shared";
import { floristApproved } from "@/lib/florists";
import { dateWindow, getDeliveryConfig } from "@/lib/delivery";
import { formatDateISO, formatPhone, formatUZS, normalizePhone } from "@/lib/format";
import { createOrder } from "@/lib/orders";
import { availablePaymentMethods } from "@/lib/payments/config";
import { linkFloristChat } from "@/lib/florist-notify";
import { onlineProvider } from "@/lib/payments/providers";
import { MAX_LINE_QUANTITY, priceLine, type PricingProduct } from "@/lib/pricing";
import { quoteCart } from "@/lib/quote";
import { getSettings, siteUrl, telegramLink } from "@/lib/settings";
import { addDaysISO } from "@/lib/time";
import { api, send, sendPhoto, type InlineButton, type Keyboard } from "./api";
import { BOT_TEXTS, type BotTexts } from "./texts";

/*
 * Telegram ordering bot (Evos/Bellissimo style): everything with buttons inside the chat.
 * Prices, stock, delivery zones, time slots and payment methods come from the same database and the
 * same server functions as the website (priceLine, quoteCart, createOrder), so an admin change shows
 * up in the bot immediately. Conversation state lives in tg_sessions, never in memory.
 */

type TgUser = { id: number; first_name: string; last_name?: string; username?: string; language_code?: string };
type Chat = { id: number; type: string };
type Message = {
  message_id: number;
  chat: Chat;
  from?: TgUser;
  text?: string;
  contact?: { phone_number: string; user_id?: number };
  location?: { latitude: number; longitude: number };
  photo?: unknown[];
};
type Callback = { id: string; from: TgUser; data?: string; message?: Message };
export type Update = { update_id?: number; message?: Message; callback_query?: Callback };

type Line = { productId: number; variantId: number | null; stems: number | null; color: string | null; quantity: number; addons?: { productId: number; quantity: number }[] };
type Draft = {
  config?: Line;
  sid?: string;
  name?: string;
  phone?: string;
  self?: boolean;
  rName?: string;
  rPhone?: string;
  fulfillment?: "delivery" | "pickup";
  zoneId?: number;
  /** District from `locations`, for delivery regions that are served district by district. */
  districtId?: number;
  address?: string;
  lat?: number;
  lon?: number;
  extra?: string;
  date?: string;
  slotId?: number;
  card?: string;
  payment?: "cash" | "payme" | "click";
};
type Step = "idle" | "phone" | "rname" | "rphone" | "address" | "extra" | "card" | "search" | "pphone";
type Session = {
  chatId: string;
  locale: Locale | null;
  step: Step;
  cart: Line[];
  draft: Draft;
  favorites: number[];
  profile: { phone?: string };
  /** The cart as loaded, to know whether this update changed it. */
  cartBefore: string;
};

/** Work to run after the webhook has answered (owner notification). */
export type AfterTask = { notifyOrderId: string };

/** Catalogue sections offered in the bot, in this order (same as the website's main navigation). */
export const BOT_CATEGORY_SLUGS = ["guldastalar", "atirgullar", "lolalar", "qutidagi-gullar", "savatdagi-gullar", "xona-osimliklari", "sovgalar"];
const PAGE_SIZE = 8;

/* ------------------------------------------------------------------ */
/* Session                                                             */
/* ------------------------------------------------------------------ */

async function loadSession(chatId: string): Promise<Session> {
  const db = await getDb();
  const [row] = await db.select().from(schema.tgSessions).where(eq(schema.tgSessions.chatId, chatId));
  if (!row) return { chatId, locale: null, step: "idle", cart: [], draft: {}, favorites: [], profile: {}, cartBefore: "[]" };
  return {
    chatId,
    locale: row.locale ?? null,
    step: (row.step as Step) ?? "idle",
    cart: row.cart ?? [],
    draft: (row.draft as Draft) ?? {},
    favorites: row.favorites ?? [],
    profile: row.profile ?? {},
    cartBefore: JSON.stringify(row.cart ?? []),
  };
}

async function saveSession(s: Session) {
  const db = await getDb();
  const values = {
    chatId: s.chatId,
    locale: s.locale,
    step: s.step,
    cart: s.cart,
    draft: s.draft as Record<string, unknown>,
    favorites: s.favorites,
    profile: s.profile,
    updatedAt: new Date(),
    // The Mini App syncs the cart by this time, so it only moves when the cart itself changed.
    ...(JSON.stringify(s.cart) !== s.cartBefore ? { cartUpdatedAt: new Date() } : {}),
  };
  await db.insert(schema.tgSessions).values(values).onConflictDoUpdate({ target: schema.tgSessions.chatId, set: values });
}

/* ------------------------------------------------------------------ */
/* Keyboards                                                           */
/* ------------------------------------------------------------------ */

const rows = <T,>(items: T[], perRow: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += perRow) out.push(items.slice(i, i + perRow));
  return out;
};

function mainMenu(t: BotTexts): Keyboard {
  const m = t.menu;
  return {
    keyboard: [
      [{ text: m.catalog }, { text: m.search }],
      [{ text: m.cart }, { text: m.orders }],
      [{ text: m.delivery }, { text: m.favorites }],
      [{ text: m.profile }, { text: m.help }],
    ],
    resize_keyboard: true,
    is_persistent: true,
  };
}

/** "Back" (when there is somewhere to go back to) and "Main menu" under inline screens. */
function navRow(t: BotTexts, back?: InlineButton): InlineButton[] {
  return [...(back ? [back] : []), { text: t.home, callback_data: "H" }];
}

const languageKeyboard: Keyboard = {
  inline_keyboard: [[{ text: "🇺🇿 O‘zbekcha", callback_data: "L:uz" }, { text: "🇷🇺 Русский", callback_data: "L:ru" }, { text: "🇬🇧 English", callback_data: "L:en" }]],
};

/** Buttons of the menu used before the 8-button one, still on some customers' keyboards until their next reply. */
const LEGACY_MENU: Record<string, keyof BotTexts["menu"] | "language"> = {
  "🌸 Katalog": "catalog",
  "🌸 Каталог": "catalog",
  "🌸 Catalog": "catalog",
  "🛒 Savat": "cart",
  "📞 Aloqa": "help",
  "📞 Контакты": "help",
  "📞 Contact": "help",
  "🌐 Til": "language",
  "🌐 Язык": "language",
  "🌐 Language": "language",
};

/** Menu button texts in every language, so a button pressed just before switching language still works. */
function menuAction(text: string): keyof BotTexts["menu"] | "language" | null {
  for (const t of Object.values(BOT_TEXTS)) {
    for (const [k, v] of Object.entries(t.menu)) if (v === text) return k as keyof BotTexts["menu"];
  }
  return LEGACY_MENU[text] ?? null;
}
const isCancelText = (text: string) => Object.values(BOT_TEXTS).some((t) => t.cancel === text);

function https() {
  return siteUrl().startsWith("https://");
}
/** Link to a site page: opens inside Telegram (Mini App) on an https site, otherwise as a normal link. */
function siteButton(text: string, path: string): InlineButton | null {
  const url = siteUrl() + path;
  if (!https()) return null; // Telegram rejects http://localhost buttons
  return { text, web_app: { url } };
}

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

async function loadProduct(productId: number, locale: Locale) {
  const db = await getDb();
  const [prod] = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.id, productId), eq(schema.products.status, "active"), floristApproved(schema.products.floristId)));
  if (!prod) return null;
  const variants = await db
    .select()
    .from(schema.productVariants)
    .where(eq(schema.productVariants.productId, prod.id))
    .orderBy(asc(schema.productVariants.sortOrder), asc(schema.productVariants.price));
  return {
    prod,
    pricing: toPricing(prod, variants, locale),
    orderable: isOrderable(stockState(prod, variants)),
    name: pick(locale, prod.name, prod.nameRu, prod.nameEn),
    short: pick(locale, prod.shortDescription, prod.shortDescriptionRu, prod.shortDescriptionEn),
    colors: prod.colorOptions.map((value, i) => ({ value, label: pickAt(locale, i, prod.colorOptions, prod.colorOptionsRu, prod.colorOptionsEn) })),
    image: prod.images[0]?.url ?? null,
    florist: await shopOf(prod.floristId, locale),
  };
}
type LoadedProduct = NonNullable<Awaited<ReturnType<typeof loadProduct>>>;

async function shopOf(floristId: number, locale: Locale) {
  const db = await getDb();
  const [f] = await db.select().from(schema.florists).where(eq(schema.florists.id, floristId));
  return f ? { id: f.id, name: pick(locale, f.name, f.nameRu, f.nameEn), isPlatform: f.isPlatform } : null;
}

/** The shop the bot cart belongs to (one shop per order). */
async function cartShop(s: Session) {
  if (!s.cart.length) return null;
  const db = await getDb();
  const [p] = await db.select({ floristId: schema.products.floristId }).from(schema.products).where(eq(schema.products.id, s.cart[0].productId));
  return p ? shopOf(p.floristId, s.locale!) : null;
}

function defaultStems(p: PricingProduct) {
  if (p.pricingMode !== "per_stem") return null;
  const step = Math.max(1, p.stemStep);
  let n = p.minStems ?? 1;
  while (n < 11 && n + step <= (p.maxStems ?? 101)) n += step;
  return n;
}

function defaultConfig(lp: LoadedProduct): Line {
  return {
    productId: lp.prod.id,
    variantId: lp.pricing.pricingMode === "variants" ? (lp.pricing.variants.find((v) => v.isActive)?.id ?? null) : null,
    stems: defaultStems(lp.pricing),
    color: lp.colors[0]?.value ?? null,
    quantity: 1,
  };
}

function linePrice(lp: LoadedProduct, c: Line) {
  const r = priceLine(lp.pricing, { variantId: c.variantId, stems: c.stems, quantity: c.quantity, addons: [] }, []);
  return r.ok ? r.lineTotal : null;
}

function productCard(lp: LoadedProduct, c: Line, locale: Locale, favorite = false): { caption: string; keyboard: Keyboard } {
  const t = BOT_TEXTS[locale];
  const uzs = (n: number) => formatUZS(n, locale);
  const p = lp.pricing;
  const total = linePrice(lp, c);
  const caption = [
    `🌸 ${lp.name}`,
    lp.short || null,
    lp.florist ? fmt(t.shop, { name: lp.florist.name }) : null,
    total != null ? `\n💰 ${uzs(total)}` : null,
    p.pricingMode === "per_stem"
      ? `${fmt(t.stems, { n: c.stems ?? 0 })} ${fmt(t.stemsHint, { min: p.minStems ?? 1, max: p.maxStems ?? 101, odd: p.stemStep === 2 && (p.minStems ?? 1) % 2 === 1 ? t.odd : "" })}`
      : null,
    lp.prod.isDemo ? `\n${t.demo}` : null,
    lp.orderable ? null : `\n${t.unavailable}`,
  ]
    .filter((x) => x !== null)
    .join("\n")
    .slice(0, 1000);

  const id = lp.prod.id;
  const kb: InlineButton[][] = [];
  if (lp.orderable) {
    if (p.pricingMode === "variants") {
      kb.push(
        ...rows(
          p.variants
            .filter((v) => v.isActive)
            .map((v) => ({ text: `${v.id === c.variantId ? "✓ " : ""}${v.name} · ${uzs(v.price)}`, callback_data: `V:${id}:${v.id}` })),
          1,
        ),
      );
    }
    if (p.pricingMode === "per_stem") {
      kb.push([
        { text: "➖", callback_data: `S:${id}:-` },
        { text: fmt(t.stems, { n: c.stems ?? 0 }), callback_data: "N" },
        { text: "➕", callback_data: `S:${id}:+` },
      ]);
    }
    if (lp.colors.length) {
      kb.push(...rows(lp.colors.map((col, i) => ({ text: `${col.value === c.color ? "✓ " : ""}${col.label}`, callback_data: `K:${id}:${i}` })), 3));
    }
    kb.push([
      { text: "➖", callback_data: `Q:${id}:-` },
      { text: fmt(t.quantity, { n: c.quantity }), callback_data: "N" },
      { text: "➕", callback_data: `Q:${id}:+` },
    ]);
    if (total != null) kb.push([{ text: fmt(t.addToCart, { price: uzs(total) }), callback_data: `A:${id}` }]);
  }
  kb.push([{ text: favorite ? t.favRemove : t.favAdd, callback_data: `FV:${lp.prod.id}` }]);
  kb.push(navRow(t, { text: t.backToCategories, callback_data: "M" }));
  return { caption, keyboard: { inline_keyboard: kb } };
}

/* ------------------------------------------------------------------ */
/* Screens                                                             */
/* ------------------------------------------------------------------ */

/** Replaces the message the button belongs to (text messages), or sends a new one (e.g. under a photo). */
async function show(chatId: string, text: string, keyboard: Keyboard, edit?: Message) {
  if (edit && !edit.photo) {
    const r = await api("editMessageText", { chat_id: chatId, message_id: edit.message_id, text, reply_markup: keyboard });
    if (r.ok || /not modified/i.test(r.description ?? "")) return;
  }
  await send(chatId, text, keyboard);
}

async function showCategories(s: Session, t: BotTexts, edit?: Message) {
  const all = await getCategories(undefined, s.locale!);
  const cats = BOT_CATEGORY_SLUGS.map((slug) => all.find((c) => c.slug === slug)).filter((c) => c != null);
  const kb: InlineButton[][] = rows(cats.map((c) => ({ text: c.name, callback_data: `C:${c.id}:1` })), 2);
  kb.push(navRow(t));
  await show(s.chatId, t.categories, { inline_keyboard: kb }, edit);
}

async function showCategory(s: Session, t: BotTexts, categoryId: number, page: number, edit?: Message) {
  const locale = s.locale!;
  const cat = (await getCategories(undefined, locale)).find((c) => c.id === categoryId);
  if (!cat) return showCategories(s, t, edit);
  const res = await listProducts({ categories: [cat.slug], perPage: PAGE_SIZE, page, sort: "popular", locale, includeAddons: cat.slug === "sovgalar" });
  if (!res.items.length) return show(s.chatId, t.noProducts, { inline_keyboard: [navRow(t, { text: t.backToCategories, callback_data: "M" })] }, edit);
  const uzs = (n: number) => formatUZS(n, locale);
  const kb: InlineButton[][] = res.items.map((p) => [
    { text: `${p.name} · ${p.hasOptions ? fmt(t.from, { price: uzs(p.price) }) : uzs(p.price)}`, callback_data: `P:${p.id}` },
  ]);
  const nav: InlineButton[] = [];
  if (res.page > 1) nav.push({ text: t.prev, callback_data: `C:${cat.id}:${res.page - 1}` });
  if (res.page < res.pages) nav.push({ text: t.next, callback_data: `C:${cat.id}:${res.page + 1}` });
  if (nav.length) kb.push(nav);
  kb.push(navRow(t, { text: t.backToCategories, callback_data: "M" }));
  await show(s.chatId, fmt(t.products, { name: cat.name, page: res.page, pages: res.pages }), { inline_keyboard: kb }, edit);
}

async function showCart(s: Session, t: BotTexts, edit?: Message) {
  const locale = s.locale!;
  if (!s.cart.length) return show(s.chatId, t.cartEmpty, { inline_keyboard: [[{ text: t.menu.catalog, callback_data: "M" }], navRow(t)] }, edit);
  const q = await quoteCart({ lines: s.cart.map((l) => ({ ...l, addons: l.addons ?? [] })) }, { locale });
  const uzs = (n: number) => formatUZS(n, locale);
  const lines = q.lines.map((l, i) => {
    const opts = [l.variantName, l.stems ? fmt(getDict(locale).common.pieces, { n: l.stems }) : null, l.colorLabel].filter(Boolean).join(", ");
    return `${i + 1}. ${l.name}${opts ? ` (${opts})` : ""} × ${l.quantity} — ${uzs(l.lineTotal)}${l.error ? `\n   ⚠️ ${l.error}` : ""}`;
  });
  const text = [t.cartTitle, "", ...lines, "", fmt(t.subtotal, { amount: uzs(q.subtotal) })].join("\n");
  const kb: InlineButton[][] = rows(
    s.cart.map((_, i) => ({ text: fmt(t.remove, { n: i + 1 }), callback_data: `R:${i}` })),
    5,
  );
  kb.push([{ text: t.clear, callback_data: "X" }], [{ text: t.checkout, callback_data: "O" }], navRow(t));
  await show(s.chatId, text, { inline_keyboard: kb }, edit);
}

async function showOrders(s: Session, t: BotTexts, userId: number) {
  const locale = s.locale!;
  const db = await getDb();
  const orders = await db
    .select()
    .from(schema.orders)
    .where(eq(schema.orders.telegramUserId, String(userId)))
    .orderBy(desc(schema.orders.createdAt))
    .limit(5);
  if (!orders.length) return send(s.chatId, t.noOrders, mainMenu(t));
  const statuses = getDict(locale).order.statuses;
  const text = [
    t.ordersTitle,
    "",
    ...orders.map((o) =>
      fmt(t.orderLine, {
        number: o.number,
        date: formatDateISO(o.deliveryDate, false, locale),
        status: statuses[o.status],
        total: formatUZS(o.total, locale),
      }),
    ),
  ].join("\n\n");
  const buttons = orders
    .map((o) => siteButton(`📄 ${o.number}`, localePath(locale, `/buyurtma/${o.number}?t=${o.accessToken}`)))
    .filter((b): b is InlineButton => b != null)
    .map((b) => [b]);
  await send(s.chatId, text, buttons.length ? { inline_keyboard: buttons } : mainMenu(t));
}

async function showContact(s: Session, t: BotTexts) {
  const locale = s.locale!;
  const { store } = await getSettings();
  const address = pick(locale, store.address, store.addressRu, store.addressEn);
  const hours = pick(locale, store.workingHours, store.workingHoursRu, store.workingHoursEn);
  const lines = [
    store.phone ? fmt(t.contactPhone, { phone: formatPhone(store.phone) }) : null,
    telegramLink(store.telegramUsername) ? fmt(t.contactTelegram, { username: store.telegramUsername.replace(/^@/, "") }) : null,
    address ? fmt(t.contactAddress, { address }) : null,
    hours ? fmt(t.contactHours, { hours }) : null,
  ].filter(Boolean);
  const site = siteButton(t.site, localePath(locale, "/"));
  const tg = telegramLink(store.telegramUsername);
  const kb: InlineButton[][] = [
    ...(tg ? [[{ text: t.helpWrite, url: tg }]] : []),
    ...(site ? [[site]] : []),
    navRow(t),
  ];
  await send(s.chatId, [t.helpTitle, "", t.helpText, "", t.contactTitle, ...(lines.length ? lines : [t.contactSoon])].join("\n"), { inline_keyboard: kb });
}

async function showSearch(s: Session, t: BotTexts, q: string) {
  const locale = s.locale!;
  const res = await listProducts({ q, perPage: PAGE_SIZE, sort: "popular", locale, includeAddons: true });
  const again = { text: t.searchAgain, callback_data: "SR" };
  if (!res.items.length) return send(s.chatId, fmt(t.searchEmpty, { q }), { inline_keyboard: [navRow(t, again)] });
  const uzs = (n: number) => formatUZS(n, locale);
  const kb: InlineButton[][] = res.items.map((p) => [{ text: `${p.name} · ${p.hasOptions ? fmt(t.from, { price: uzs(p.price) }) : uzs(p.price)}`, callback_data: `P:${p.id}` }]);
  kb.push(navRow(t, again));
  await send(s.chatId, fmt(t.searchResults, { q }), { inline_keyboard: kb });
}

async function showFavorites(s: Session, t: BotTexts, edit?: Message) {
  const locale = s.locale!;
  const cards = s.favorites.length ? await getProductsByIds(s.favorites, locale) : [];
  if (!cards.length) return show(s.chatId, t.favoritesEmpty, { inline_keyboard: [[{ text: t.menu.catalog, callback_data: "M" }], navRow(t)] }, edit);
  const uzs = (n: number) => formatUZS(n, locale);
  const kb: InlineButton[][] = cards.slice(0, 20).map((p) => [{ text: `${p.name} · ${p.hasOptions ? fmt(t.from, { price: uzs(p.price) }) : uzs(p.price)}`, callback_data: `P:${p.id}` }]);
  kb.push(navRow(t));
  await show(s.chatId, t.favoritesTitle, { inline_keyboard: kb }, edit);
}

async function showDelivery(s: Session, t: BotTexts) {
  const locale = s.locale!;
  const [{ regions, slots }, { checkout }] = await Promise.all([getDeliveryConfig(locale), getSettings()]);
  const uzs = (n: number) => formatUZS(n, locale);
  const areas = regions.flatMap((r) =>
    r.zones.map((z) => fmt(t.deliveryLine, { area: `${r.name} — ${z.name}`, fee: uzs(z.fee) }) + (z.freeFrom ? fmt(t.deliveryFree, { amount: uzs(z.freeFrom) }) : "")),
  );
  const methods = availablePaymentMethods(checkout, locale).map((m) => m.label);
  const text = [
    t.deliveryTitle,
    "",
    ...(areas.length ? areas : [t.deliveryNone]),
    "",
    slots.length ? fmt(t.deliverySlots, { slots: slots.map((x) => x.label).join(", ") }) : null,
    methods.length ? fmt(t.deliveryPayments, { methods: methods.join(", ") }) : null,
  ]
    .filter((x) => x != null)
    .join("\n");
  const more = siteButton(t.deliveryMore, localePath(locale, "/yetkazib-berish"));
  await send(s.chatId, text, { inline_keyboard: [...(more ? [[more]] : []), navRow(t)] });
}

async function showProfile(s: Session, t: BotTexts, from: TgUser) {
  const db = await getDb();
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.orders).where(eq(schema.orders.telegramUserId, String(from.id)));
  const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
  const text = [
    t.profileTitle,
    "",
    fmt(t.profileName, { name }),
    s.profile.phone ? fmt(t.profilePhone, { phone: formatPhone(s.profile.phone) }) : t.profileNoPhone,
    fmt(t.profileLanguage, { language: t.languageName }),
    fmt(t.profileOrders, { n }),
  ].join("\n");
  await send(s.chatId, text, {
    inline_keyboard: [[{ text: t.changePhone, callback_data: "PH" }], [{ text: t.changeLanguage, callback_data: "LANG" }], [{ text: t.menu.favorites, callback_data: "FAVS" }], navRow(t)],
  });
}

/* ------------------------------------------------------------------ */
/* Checkout                                                            */
/* ------------------------------------------------------------------ */

const cancelKeyboard = (t: BotTexts, extra?: { text: string; request_contact?: boolean; request_location?: boolean }): Keyboard => ({
  keyboard: [...(extra ? [[extra]] : []), [{ text: t.cancel }]],
  resize_keyboard: true,
  one_time_keyboard: false,
});

async function startCheckout(s: Session, t: BotTexts, from: TgUser) {
  if (!s.cart.length) return send(s.chatId, t.cartEmpty, mainMenu(t));
  const q = await quoteCart({ lines: s.cart.map((l) => ({ ...l, addons: l.addons ?? [] })) }, { locale: s.locale! });
  if (q.lines.some((l) => l.error)) return showCart(s, t);
  s.draft = { sid: randomUUID(), name: [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 80) || "Telegram" };
  // A phone given before is reused (it can be changed in "Profile").
  if (s.profile.phone) {
    s.draft.phone = s.profile.phone;
    await send(s.chatId, fmt(t.phoneOk, { phone: formatPhone(s.profile.phone) }), mainMenu(t));
    return askRecipient(s, t);
  }
  s.step = "phone";
  await send(s.chatId, t.askPhone, cancelKeyboard(t, { text: t.sharePhone, request_contact: true }));
}

async function askRecipient(s: Session, t: BotTexts) {
  s.step = "idle";
  await send(s.chatId, t.askRecipient, {
    inline_keyboard: [[{ text: t.recipientSelf, callback_data: "RS:1" }, { text: t.recipientOther, callback_data: "RS:0" }]],
  });
}

async function askFulfillment(s: Session, t: BotTexts) {
  const { checkout } = await getSettings();
  // Marketplace shops deliver themselves; pickup is only at Gulzor's own shop.
  if (!checkout.pickupEnabled || (await cartShop(s))?.isPlatform === false) {
    s.draft.fulfillment = "delivery";
    return askZone(s, t);
  }
  await send(s.chatId, t.askFulfillment, { inline_keyboard: [[{ text: t.delivery, callback_data: "F:d" }], [{ text: t.pickup, callback_data: "F:p" }]] });
}

/** Delivery regions of the cart's shop (each shop delivers itself). */
async function shopRegions(s: Session) {
  const shop = await cartShop(s);
  return (await getDeliveryConfig(s.locale!, shop?.id)).regions;
}

const DISTRICTS_PER_PAGE = 16;

/**
 * Where to deliver. Regions linked to the places list are asked district by district (region → district → zone);
 * the others list their zones directly, as before.
 */
async function askZone(s: Session, t: BotTexts, edit?: Message): Promise<unknown> {
  const locale = s.locale!;
  const regions = await shopRegions(s);
  if (!regions.length) return send(s.chatId, t.noZones, mainMenu(t));
  const byDistrict = regions.filter((r) => r.districts.length);
  if (regions.length === 1 && byDistrict.length === 1) return askDistrict(s, t, regions[0].id, 1, edit);
  const kb = regions.flatMap((r) =>
    r.districts.length
      ? [[{ text: `📍 ${r.name}`, callback_data: `RG:${r.id}:1` }]]
      : r.zones.map((z) => [{ text: fmt(t.zoneFee, { zone: `${r.name} — ${z.name}`, fee: formatUZS(z.fee, locale) }), callback_data: `Z:${z.id}` }]),
  );
  await show(s.chatId, byDistrict.length ? t.askRegion : t.askZone, { inline_keyboard: kb }, edit);
}

async function askDistrict(s: Session, t: BotTexts, regionId: number, page: number, edit?: Message): Promise<unknown> {
  const regions = await shopRegions(s);
  const region = regions.find((r) => r.id === regionId);
  if (!region?.districts.length) return askZone(s, t, edit);
  const pages = Math.ceil(region.districts.length / DISTRICTS_PER_PAGE);
  const p = Math.min(Math.max(1, page), pages);
  const slice = region.districts.slice((p - 1) * DISTRICTS_PER_PAGE, p * DISTRICTS_PER_PAGE);
  const kb = rows(slice.map((d) => ({ text: d.name, callback_data: `DS:${region.id}:${d.id}` })), 2);
  const nav = [];
  if (p > 1) nav.push({ text: t.prev, callback_data: `RG:${region.id}:${p - 1}` });
  if (p < pages) nav.push({ text: t.next, callback_data: `RG:${region.id}:${p + 1}` });
  if (nav.length) kb.push(nav);
  if (regions.length > 1) kb.push([{ text: t.backToRegions, callback_data: "RG:0:1" }]);
  await show(s.chatId, fmt(t.askDistrict, { region: region.name, page: p, pages }), { inline_keyboard: kb }, edit);
}

async function pickDistrict(s: Session, t: BotTexts, regionId: number, districtId: number, edit?: Message) {
  const locale = s.locale!;
  const region = (await shopRegions(s)).find((r) => r.id === regionId);
  const district = region?.districts.find((d) => d.id === districtId);
  if (!region || !district) return askZone(s, t, edit);
  s.draft.districtId = district.id;
  const zones = region.zones.filter((z) => district.zoneIds.includes(z.id));
  if (zones.length === 1) return chooseZone(s, t, zones[0].id, district.id);
  await show(
    s.chatId,
    fmt(t.askDistrictZone, { district: district.name }),
    { inline_keyboard: zones.map((z) => [{ text: fmt(t.zoneFee, { zone: z.name, fee: formatUZS(z.fee, locale) }), callback_data: `Z:${z.id}:${district.id}` }]) },
    edit,
  );
}

async function chooseZone(s: Session, t: BotTexts, zoneId: number, districtId: number | undefined) {
  s.draft.zoneId = zoneId;
  s.draft.districtId = districtId;
  s.step = "address";
  await send(s.chatId, t.askAddress, cancelKeyboard(t, { text: t.shareLocation, request_location: true }));
}

async function askDate(s: Session, t: BotTexts, edit?: Message) {
  const locale = s.locale!;
  const { checkout } = await getSettings();
  const win = dateWindow(checkout.maxDaysAhead);
  const days: string[] = [];
  for (let d = win.min; d <= win.max && days.length < 8; d = addDaysISO(d, 1)) days.push(d);
  const label = (d: string, i: number) => (i === 0 ? t.today : i === 1 ? t.tomorrow : formatDateISO(d, true, locale));
  await show(s.chatId, t.askDate, { inline_keyboard: rows(days.map((d, i) => ({ text: label(d, i), callback_data: `D:${d}` })), 2) }, edit);
}

function quoteInput(s: Session) {
  const d = s.draft;
  return {
    lines: s.cart.map((l) => ({ ...l, addons: l.addons ?? [] })),
    fulfillment: d.fulfillment,
    zoneId: d.fulfillment === "delivery" ? (d.zoneId ?? null) : null,
    districtId: d.fulfillment === "delivery" ? (d.districtId ?? null) : null,
    date: d.date ?? null,
    slotId: d.slotId ?? null,
  };
}

async function askSlot(s: Session, t: BotTexts, edit?: Message) {
  const locale = s.locale!;
  const q = await quoteCart(quoteInput(s), { forCheckout: true, locale });
  const free = q.slots.filter((x) => x.available);
  const dateLabel = formatDateISO(s.draft.date!, true, locale);
  if (!free.length) {
    await show(s.chatId, t.noSlots, { inline_keyboard: [[{ text: t.otherDay, callback_data: "DD" }]] }, edit);
    return;
  }
  const kb = rows(free.map((x) => ({ text: x.label, callback_data: `T:${x.id}` })), 2);
  kb.push([{ text: t.otherDay, callback_data: "DD" }]);
  await show(s.chatId, fmt(t.askSlot, { date: dateLabel }), { inline_keyboard: kb }, edit);
}

async function askPayment(s: Session, t: BotTexts) {
  const { checkout } = await getSettings();
  const shop = await cartShop(s);
  const methods = availablePaymentMethods(checkout, s.locale!, { platformShop: shop?.isPlatform ?? true });
  await send(s.chatId, t.askPayment, { inline_keyboard: methods.map((m) => [{ text: m.label, callback_data: `Y:${m.id}` }]) });
}

function orderPayload(s: Session) {
  const d = s.draft;
  return {
    submissionId: d.sid,
    lines: s.cart.map((l) => ({ ...l, addons: l.addons ?? [] })),
    couponCode: null,
    fulfillment: d.fulfillment ?? "delivery",
    customerName: d.name ?? "",
    customerPhone: d.phone ?? "",
    recipientIsCustomer: d.self !== false,
    recipientName: d.self === false ? (d.rName ?? "") : "",
    recipientPhone: d.self === false ? (d.rPhone ?? "") : "",
    anonymous: false,
    zoneId: d.fulfillment === "delivery" ? (d.zoneId ?? null) : null,
    districtId: d.fulfillment === "delivery" ? (d.districtId ?? null) : null,
    district: "",
    neighborhood: "",
    address: d.fulfillment === "delivery" ? (d.address ?? "") : "",
    apartment: "",
    landmark: d.extra ?? "",
    date: d.date ?? "",
    slotId: d.slotId ?? 0,
    courierNote: "",
    cardMessage: d.card ?? "",
    paymentMethod: d.payment ?? "cash",
    saveAddress: false,
  };
}

async function showSummary(s: Session, t: BotTexts) {
  const locale = s.locale!;
  const d = s.draft;
  const q = await quoteCart(quoteInput(s), { forCheckout: true, locale });
  if (q.errors.length) {
    await send(s.chatId, [t.orderFailed, ...q.errors.map((e) => `• ${e}`), "", t.restart].join("\n"), mainMenu(t));
    return;
  }
  const uzs = (n: number) => formatUZS(n, locale);
  const { checkout } = await getSettings();
  const slot = q.slots.find((x) => x.id === d.slotId);
  const method = availablePaymentMethods(checkout, locale, { platformShop: q.florist?.isPlatform ?? true }).find((m) => m.id === d.payment);
  const items = q.lines.map((l) => {
    const opts = [l.variantName, l.stems ? fmt(getDict(locale).common.pieces, { n: l.stems }) : null, l.colorLabel].filter(Boolean).join(", ");
    return `• ${l.name}${opts ? ` (${opts})` : ""} × ${l.quantity} — ${uzs(l.lineTotal)}`;
  });
  const text = [
    t.summary,
    "",
    ...items,
    "",
    fmt(t.subtotal, { amount: uzs(q.subtotal) }),
    q.discount ? fmt(t.sumDiscount, { amount: uzs(q.discount) }) : null,
    d.fulfillment === "delivery" ? fmt(t.sumDelivery, { amount: uzs(q.deliveryFee) }) : null,
    q.serviceFee ? fmt(t.sumService, { label: q.serviceFeeLabel, amount: uzs(q.serviceFee) }) : null,
    fmt(t.sumTotal, { amount: uzs(q.total) }),
    "",
    fmt(t.sumRecipient, { name: d.self === false ? d.rName! : d.name!, phone: formatPhone(d.self === false ? d.rPhone! : d.phone!) }),
    d.fulfillment === "pickup"
      ? fmt(t.sumPickup, { address: pick(locale, checkout.pickupAddress, checkout.pickupAddressRu, checkout.pickupAddressEn) })
      : fmt(t.sumAddress, { address: [q.zone?.regionName, q.district?.name ?? q.zone?.name, d.address, d.extra].filter(Boolean).join(", ") }),
    fmt(t.sumWhen, { date: formatDateISO(d.date!, true, locale), slot: slot?.label ?? "" }),
    d.card ? fmt(t.sumCard, { text: d.card }) : null,
    fmt(t.sumPayment, { method: method?.label ?? d.payment ?? "" }),
  ]
    .filter((x) => x !== null)
    .join("\n");
  await send(s.chatId, text, { inline_keyboard: [[{ text: t.confirm, callback_data: "OK" }], [{ text: t.cancel, callback_data: "NO" }]] });
}

async function placeOrder(s: Session, t: BotTexts, from: TgUser): Promise<AfterTask | null> {
  const locale = s.locale!;
  const d = s.draft;
  const res = await createOrder(orderPayload(s), null, locale, {
    telegram: { id: from.id, username: from.username },
    location: d.lat != null && d.lon != null ? { latitude: d.lat, longitude: d.lon } : undefined,
  });
  if (!res.ok) {
    const errors = [...new Set([...res.errors, ...Object.values(res.fieldErrors ?? {})])];
    await send(s.chatId, [t.orderFailed, ...errors.map((e) => `• ${e}`)].join("\n"), mainMenu(t));
    if (res.fieldErrors?.slotId) await askDate(s, t);
    else await send(s.chatId, t.restart, mainMenu(t));
    return null;
  }
  s.cart = [];
  s.draft = {};
  s.step = "idle";
  const path = localePath(locale, `/buyurtma/${res.number}?t=${res.accessToken}`);
  const buttons: InlineButton[][] = [];
  if (res.paymentMethod !== "cash") {
    const db = await getDb();
    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, res.orderId));
    const back = siteUrl() + path;
    const payUrl = onlineProvider(res.paymentMethod)?.checkoutUrl(o, back);
    if (payUrl) buttons.push([{ text: t.payNow, url: payUrl }]);
  }
  const open = siteButton(t.openOrder, path);
  if (open) buttons.push([open]);
  await send(s.chatId, fmt(t.orderPlaced, { number: res.number }), buttons.length ? { inline_keyboard: buttons } : mainMenu(t));
  if (buttons.length) await send(s.chatId, t.menuHint, mainMenu(t));
  return res.duplicate ? null : { notifyOrderId: res.orderId };
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */

async function onMessage(m: Message): Promise<AfterTask | null> {
  if (m.chat.type !== "private" || !m.from) return null;
  const s = await loadSession(String(m.chat.id));
  const text = (m.text ?? "").trim();

  // A florist connecting order notifications from its panel (one-time code in the deep link).
  const floristCode = /^\/start\s+(fl_[\w-]+)$/.exec(text)?.[1];
  if (floristCode) {
    const shop = await linkFloristChat(floristCode, s.chatId);
    await send(
      s.chatId,
      shop
        ? `✅ «${shop}» do‘koni ulandi. Yangi buyurtmalar va Gulzor xabarlari shu chatga keladi.`
        : "Havola eskirgan yoki noto‘g‘ri. Florist panelidagi «Telegram’ni ulash» tugmasidan yangi havola oling.",
    );
    return null;
  }

  if (text.startsWith("/start") || text === "/lang" || menuAction(text) === "language" || !s.locale) {
    if (text.startsWith("/start") && s.locale) {
      await send(s.chatId, BOT_TEXTS[s.locale].welcome, mainMenu(BOT_TEXTS[s.locale]));
    } else {
      await send(s.chatId, BOT_TEXTS.uz.chooseLanguage, languageKeyboard);
    }
    s.step = "idle";
    await saveSession(s);
    return null;
  }

  const t = BOT_TEXTS[s.locale];
  const action = menuAction(text);
  if (action || isCancelText(text)) {
    if (s.step !== "idle" || isCancelText(text)) {
      s.step = "idle";
      s.draft = {};
      if (isCancelText(text)) await send(s.chatId, t.cancelled, mainMenu(t));
    }
    if (action === "catalog") await showCategories(s, t);
    else if (action === "search") {
      s.step = "search";
      await send(s.chatId, t.askSearch, { inline_keyboard: [navRow(t)] });
    } else if (action === "cart") await showCart(s, t);
    else if (action === "orders") await showOrders(s, t, m.from.id);
    else if (action === "delivery") await showDelivery(s, t);
    else if (action === "favorites") await showFavorites(s, t);
    else if (action === "profile") await showProfile(s, t, m.from);
    else if (action === "help") await showContact(s, t);
    await saveSession(s);
    return null;
  }

  switch (s.step) {
    case "phone": {
      const raw = m.contact?.phone_number ?? text;
      const phone = normalizePhone(raw.startsWith("+") || !m.contact ? raw : `+${raw}`);
      if (!phone) {
        await send(s.chatId, t.badPhone);
        break;
      }
      s.draft.phone = phone;
      s.profile.phone = phone;
      await send(s.chatId, fmt(t.phoneOk, { phone: formatPhone(phone) }), mainMenu(t));
      await askRecipient(s, t);
      break;
    }
    case "pphone": {
      const raw = m.contact?.phone_number ?? text;
      const phone = normalizePhone(raw.startsWith("+") || !m.contact ? raw : `+${raw}`);
      if (!phone) {
        await send(s.chatId, t.badPhone);
        break;
      }
      s.profile.phone = phone;
      s.step = "idle";
      await send(s.chatId, fmt(t.phoneSaved, { phone: formatPhone(phone) }), mainMenu(t));
      break;
    }
    case "search":
      if (text.length < 2) {
        await send(s.chatId, t.askSearch);
        break;
      }
      s.step = "idle";
      await showSearch(s, t, text.slice(0, 60));
      break;
    case "rname":
      if (text.length < 2) {
        await send(s.chatId, t.askRecipientName);
        break;
      }
      s.draft.rName = text.slice(0, 80);
      s.step = "rphone";
      await send(s.chatId, t.askRecipientPhone);
      break;
    case "rphone": {
      const phone = normalizePhone(text);
      if (!phone) {
        await send(s.chatId, t.badPhone);
        break;
      }
      s.draft.rPhone = phone;
      s.step = "idle";
      await askFulfillment(s, t);
      break;
    }
    case "address":
      if (m.location) {
        s.draft.lat = m.location.latitude;
        s.draft.lon = m.location.longitude;
        s.draft.address = t.locationAddress;
        s.step = "extra";
        await send(s.chatId, "✅", mainMenu(t));
        await send(s.chatId, t.askAddressExtra, { inline_keyboard: [[{ text: t.skip, callback_data: "SKX" }]] });
        break;
      }
      if (text.length < 5) {
        await send(s.chatId, t.badAddress);
        break;
      }
      s.draft.address = text.slice(0, 200);
      s.draft.lat = s.draft.lon = undefined;
      s.step = "idle";
      await send(s.chatId, "✅", mainMenu(t));
      await askDate(s, t);
      break;
    case "extra":
      s.draft.extra = text.slice(0, 160);
      s.step = "idle";
      await askDate(s, t);
      break;
    case "card":
      s.draft.card = text.slice(0, 300);
      s.step = "idle";
      await askPayment(s, t);
      break;
    default:
      await send(s.chatId, t.unknown, mainMenu(t));
  }
  await saveSession(s);
  return null;
}

async function onCallback(cb: Callback): Promise<AfterTask | null> {
  const msg = cb.message;
  const data = cb.data ?? "";
  if (!msg || msg.chat.type !== "private") {
    await api("answerCallbackQuery", { callback_query_id: cb.id });
    return null;
  }
  const s = await loadSession(String(msg.chat.id));
  let toast: string | undefined;
  let task: AfterTask | null = null;

  if (data.startsWith("L:")) {
    s.locale = data === "L:ru" ? "ru" : data === "L:en" ? "en" : "uz";
    const t = BOT_TEXTS[s.locale];
    await api("answerCallbackQuery", { callback_query_id: cb.id });
    await send(s.chatId, t.welcome, mainMenu(t));
    // The Mini App menu button follows the chosen language.
    if (https()) {
      await api("setChatMenuButton", {
        chat_id: s.chatId,
        menu_button: { type: "web_app", text: getDict(s.locale).layout.tgBot.menu, web_app: { url: siteUrl() + localePath(s.locale, "/") } },
      });
    }
    await saveSession(s);
    return null;
  }
  if (!s.locale) {
    await api("answerCallbackQuery", { callback_query_id: cb.id });
    await send(s.chatId, BOT_TEXTS.uz.chooseLanguage, languageKeyboard);
    return null;
  }
  const t = BOT_TEXTS[s.locale];
  const locale = s.locale;
  const [kind, a, b] = data.split(":");
  const num = (x: string | undefined) => (x && /^\d+$/.test(x) ? Number(x) : NaN);

  try {
    switch (kind) {
      case "N":
        break;
      case "H":
        s.step = "idle";
        await send(s.chatId, t.menuHint, mainMenu(t));
        break;
      case "SR":
        s.step = "search";
        await send(s.chatId, t.askSearch, { inline_keyboard: [navRow(t)] });
        break;
      case "FAVS":
        await showFavorites(s, t, msg);
        break;
      case "FV": {
        const id = num(a);
        const lp = await loadProduct(id, locale);
        if (!lp) {
          toast = t.stale;
          break;
        }
        const on = !s.favorites.includes(id);
        s.favorites = on ? [id, ...s.favorites].slice(0, 50) : s.favorites.filter((x) => x !== id);
        toast = on ? t.favAdded : t.favRemoved;
        const c = s.draft.config?.productId === id ? s.draft.config : defaultConfig(lp);
        await api("editMessageReplyMarkup", { chat_id: s.chatId, message_id: msg.message_id, reply_markup: productCard(lp, c, locale, on).keyboard });
        break;
      }
      case "LANG":
        await send(s.chatId, BOT_TEXTS[locale].chooseLanguage, languageKeyboard);
        break;
      case "PH":
        s.step = "pphone";
        await send(s.chatId, t.askPhone, cancelKeyboard(t, { text: t.sharePhone, request_contact: true }));
        break;
      case "M":
        await showCategories(s, t, msg);
        break;
      case "C":
        await showCategory(s, t, num(a), Math.max(1, num(b) || 1), msg);
        break;
      case "P": {
        const lp = await loadProduct(num(a), locale);
        if (!lp) {
          toast = t.stale;
          break;
        }
        s.draft.config = defaultConfig(lp);
        const card = productCard(lp, s.draft.config, locale, s.favorites.includes(lp.prod.id));
        await sendPhoto(s.chatId, lp.image, card.caption, card.keyboard);
        break;
      }
      case "V":
      case "S":
      case "K":
      case "Q":
      case "A": {
        const lp = await loadProduct(num(a), locale);
        if (!lp) {
          toast = t.stale;
          break;
        }
        const c = s.draft.config?.productId === lp.prod.id ? s.draft.config : defaultConfig(lp);
        const p = lp.pricing;
        if (kind === "V" && p.variants.some((v) => v.id === num(b) && v.isActive)) c.variantId = num(b);
        if (kind === "S" && p.pricingMode === "per_stem") {
          const step = Math.max(1, p.stemStep);
          const next = (c.stems ?? defaultStems(p) ?? 1) + (b === "+" ? step : -step);
          if (next >= (p.minStems ?? 1) && next <= (p.maxStems ?? 101)) c.stems = next;
        }
        if (kind === "K" && lp.colors[num(b)]) c.color = lp.colors[num(b)].value;
        if (kind === "Q") c.quantity = Math.max(1, Math.min(MAX_LINE_QUANTITY, c.quantity + (b === "+" ? 1 : -1)));
        s.draft.config = c;
        if (kind === "A") {
          if (!lp.orderable || linePrice(lp, c) == null) {
            toast = t.unavailable;
            break;
          }
          const current = await cartShop(s);
          if (current && lp.florist && current.id !== lp.florist.id) {
            await send(s.chatId, fmt(t.otherShop, { current: current.name }), {
              inline_keyboard: [[{ text: t.replaceCart, callback_data: `AR:${lp.prod.id}` }], [{ text: t.keepCart, callback_data: "N" }]],
            });
            break;
          }
          const same = s.cart.find(
            (l) => l.productId === c.productId && l.variantId === c.variantId && l.stems === c.stems && l.color === c.color,
          );
          if (same) same.quantity = Math.min(MAX_LINE_QUANTITY, same.quantity + c.quantity);
          else s.cart.push({ ...c });
          toast = t.added;
          await send(s.chatId, `${t.added}: ${lp.name}`, {
            inline_keyboard: [[{ text: t.menu.cart, callback_data: "CART" }, { text: t.checkout, callback_data: "O" }]],
          });
          break;
        }
        const card = productCard(lp, c, locale, s.favorites.includes(lp.prod.id));
        const r = msg.photo
          ? await api("editMessageCaption", { chat_id: s.chatId, message_id: msg.message_id, caption: card.caption, reply_markup: card.keyboard })
          : await api("editMessageText", { chat_id: s.chatId, message_id: msg.message_id, text: card.caption, reply_markup: card.keyboard });
        if (!r.ok && !/not modified/i.test(r.description ?? "")) await sendPhoto(s.chatId, lp.image, card.caption, card.keyboard);
        break;
      }
      case "AR": {
        // "Clear the cart and add this" after a shop conflict: the product's current configuration replaces the cart.
        const lp = await loadProduct(num(a), locale);
        const c = lp ? (s.draft.config?.productId === lp.prod.id ? s.draft.config : defaultConfig(lp)) : null;
        if (!lp || !c || !lp.orderable || linePrice(lp, c) == null) {
          toast = t.stale;
          break;
        }
        s.cart = [{ ...c }];
        toast = t.added;
        await send(s.chatId, `${t.added}: ${lp.name}`, {
          inline_keyboard: [[{ text: t.menu.cart, callback_data: "CART" }, { text: t.checkout, callback_data: "O" }]],
        });
        break;
      }
      case "CART":
        await showCart(s, t);
        break;
      case "R": {
        const i = num(a);
        if (s.cart[i]) s.cart.splice(i, 1);
        await showCart(s, t, msg);
        break;
      }
      case "X":
        s.cart = [];
        await show(s.chatId, t.cleared, { inline_keyboard: [[{ text: t.menu.catalog, callback_data: "M" }], navRow(t)] }, msg);
        break;
      case "O":
        await startCheckout(s, t, cb.from);
        break;
      case "RS":
        if (!s.draft.sid) {
          toast = t.stale;
          break;
        }
        if (a === "1") {
          s.draft.self = true;
          await askFulfillment(s, t);
        } else {
          s.draft.self = false;
          s.step = "rname";
          await send(s.chatId, t.askRecipientName);
        }
        break;
      case "F":
        if (!s.draft.sid) {
          toast = t.stale;
          break;
        }
        if (a === "p") {
          s.draft.fulfillment = "pickup";
          await askDate(s, t);
        } else {
          s.draft.fulfillment = "delivery";
          await askZone(s, t);
        }
        break;
      case "Z":
        if (!s.draft.sid) {
          toast = t.stale;
          break;
        }
        await chooseZone(s, t, num(a), b ? num(b) : undefined);
        break;
      case "RG":
        if (!s.draft.sid) {
          toast = t.stale;
          break;
        }
        if (num(a) === 0) await askZone(s, t, msg);
        else await askDistrict(s, t, num(a), num(b) || 1, msg);
        break;
      case "DS":
        if (!s.draft.sid) {
          toast = t.stale;
          break;
        }
        await pickDistrict(s, t, num(a), num(b), msg);
        break;
      case "SKX":
        if (s.step !== "extra") break;
        s.step = "idle";
        await askDate(s, t);
        break;
      case "DD":
        await askDate(s, t, msg);
        break;
      case "D":
        if (!s.draft.sid || !/^\d{4}-\d{2}-\d{2}$/.test(a ?? "")) {
          toast = t.stale;
          break;
        }
        s.draft.date = a;
        s.draft.slotId = undefined;
        await askSlot(s, t, msg);
        break;
      case "T":
        if (!s.draft.sid || !s.draft.date) {
          toast = t.stale;
          break;
        }
        s.draft.slotId = num(a);
        s.step = "card";
        await send(s.chatId, t.askCard, { inline_keyboard: [[{ text: t.skip, callback_data: "SKC" }]] });
        break;
      case "SKC":
        if (s.step !== "card") break;
        s.draft.card = "";
        s.step = "idle";
        await askPayment(s, t);
        break;
      case "Y":
        if (!s.draft.sid || !["cash", "payme", "click"].includes(a ?? "")) {
          toast = t.stale;
          break;
        }
        s.draft.payment = a as Draft["payment"];
        await showSummary(s, t);
        break;
      case "OK":
        if (!s.draft.sid || !s.draft.payment) {
          toast = t.stale;
          break;
        }
        task = await placeOrder(s, t, cb.from);
        break;
      case "NO":
        s.draft = {};
        s.step = "idle";
        await send(s.chatId, t.cancelled, mainMenu(t));
        break;
      default:
        toast = t.stale;
    }
  } finally {
    await api("answerCallbackQuery", { callback_query_id: cb.id, ...(toast ? { text: toast } : {}) });
  }
  await saveSession(s);
  return task;
}

/** Entry point for one webhook update. Never throws. */
export async function handleUpdate(update: Update): Promise<AfterTask | null> {
  try {
    if (update.callback_query) return await onCallback(update.callback_query);
    if (update.message) return await onMessage(update.message);
  } catch (e) {
    console.error("Telegram bot update failed", e);
  }
  return null;
}
