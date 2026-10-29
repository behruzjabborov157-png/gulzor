import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const categoryKind = pgEnum("category_kind", ["flower", "bouquet_type", "occasion", "collection"]);
export const productStatus = pgEnum("product_status", ["active", "draft", "archived"]);
export const pricingMode = pgEnum("pricing_mode", ["fixed", "variants", "per_stem"]);
export const availability = pgEnum("availability", ["in_stock", "made_to_order", "out_of_stock"]);
export const orderStatus = pgEnum("order_status", [
  "new",
  "confirmed",
  "preparing",
  "ready",
  "dispatched",
  "delivered",
  "cancelled",
  "rejected",
]);
export const paymentMethod = pgEnum("payment_method", ["cash", "payme", "click"]);
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "failed", "cancelled", "refunded"]);
export const fulfillment = pgEnum("fulfillment", ["delivery", "pickup"]);
export const couponType = pgEnum("coupon_type", ["percent", "fixed"]);

/* ------------------------------------------------------------------ */
/* Marketplace: florists (sellers)                                     */
/* ------------------------------------------------------------------ */

/**
 * A florist shop selling on Gulzor. Only "approved" florists' products are visible and orderable.
 * The florist delivers its own orders (its own delivery zones) and is paid by the customer directly;
 * Gulzor records a commission on every order (rate copied onto the order when it is placed).
 */
export const florists = pgTable(
  "florists",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameRu: text("name_ru"),
    description: text("description").notNull().default(""),
    descriptionRu: text("description_ru"),
    status: text("status").$type<"pending" | "approved" | "suspended" | "rejected">().notNull().default("pending"),
    /** Why the florist was rejected or suspended (shown to the florist). */
    statusReason: text("status_reason"),
    /** The platform's own shop (holds the original catalogue). */
    isPlatform: boolean("is_platform").notNull().default(false),
    phone: text("phone").notNull().default(""),
    telegramUsername: text("telegram_username").notNull().default(""),
    address: text("address").notNull().default(""),
    addressRu: text("address_ru"),
    /** City (a delivery region) the shop works in. */
    regionId: integer("region_id").references(() => deliveryRegions.id, { onDelete: "set null" }),
    /** Verification data submitted by the florist. */
    legalName: text("legal_name").notNull().default(""),
    taxId: text("tax_id").notNull().default(""),
    /** Commission in basis points (1000 = 10%). */
    commissionRate: integer("commission_rate").notNull().default(1000),
    logoUrl: text("logo_url"),
    /** Private chat with the shop bot where the florist gets new orders (linked by the florist from its panel). */
    telegramChatId: text("telegram_chat_id"),
    /** One-time code in the t.me/<bot>?start=fl_<code> link that connects the chat above. */
    telegramLinkToken: text("telegram_link_token"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("florists_slug_idx").on(t.slug), index("florists_status_idx").on(t.status)],
);

/* ------------------------------------------------------------------ */
/* Catalog                                                             */
/* ------------------------------------------------------------------ */

export type ProductImage = {
  url: string;
  alt: string;
  credit?: string;
  license?: string;
  sourceUrl?: string;
};

export const categories = pgTable(
  "categories",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameRu: text("name_ru"),
    kind: categoryKind("kind").notNull(),
    description: text("description").notNull().default(""),
    descriptionRu: text("description_ru"),
    imageUrl: text("image_url"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    seoTitleRu: text("seo_title_ru"),
    seoDescriptionRu: text("seo_description_ru"),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: serial("id").primaryKey(),
    /** The florist that sells (and delivers) this product. */
    floristId: integer("florist_id")
      .notNull()
      .references(() => florists.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description").notNull().default(""),
    description: text("description").notNull().default(""),
    careInstructions: text("care_instructions").notNull().default(""),
    flowerVarieties: jsonb("flower_varieties").$type<string[]>().notNull().default([]),
    /* Russian content — optional; the storefront falls back to Uzbek when empty. */
    nameRu: text("name_ru"),
    shortDescriptionRu: text("short_description_ru"),
    descriptionRu: text("description_ru"),
    careInstructionsRu: text("care_instructions_ru"),
    sizeLabelRu: text("size_label_ru"),
    flowerVarietiesRu: jsonb("flower_varieties_ru").$type<string[]>().notNull().default([]),
    /** Russian labels for colorOptions, same order (the Uzbek value is what gets stored on orders). */
    colorOptionsRu: jsonb("color_options_ru").$type<string[]>().notNull().default([]),
    seoTitleRu: text("seo_title_ru"),
    seoDescriptionRu: text("seo_description_ru"),
    /** Lower-cased, apostrophe-free text in both languages, maintained by the app for search. */
    searchText: text("search_text").notNull().default(""),
    stemCount: integer("stem_count"),
    sizeLabel: text("size_label"),
    primaryCategoryId: integer("primary_category_id").references(() => categories.id, { onDelete: "set null" }),
    images: jsonb("images").$type<ProductImage[]>().notNull().default([]),
    pricingMode: pricingMode("pricing_mode").notNull().default("fixed"),
    /** Price in UZS (whole so'm) for fixed pricing. */
    price: integer("price").notNull().default(0),
    compareAtPrice: integer("compare_at_price"),
    /** per_stem pricing */
    stemPrice: integer("stem_price"),
    minStems: integer("min_stems"),
    maxStems: integer("max_stems"),
    stemStep: integer("stem_step").notNull().default(1),
    colorOptions: jsonb("color_options").$type<string[]>().notNull().default([]),
    status: productStatus("status").notNull().default("draft"),
    availability: availability("availability").notNull().default("in_stock"),
    /** null = stock is not tracked */
    stockQuantity: integer("stock_quantity"),
    /** Months (1-12) when the product can be sold. Empty = all year. */
    seasonalMonths: jsonb("seasonal_months").$type<number[]>().notNull().default([]),
    prepTimeMinutes: integer("prep_time_minutes").notNull().default(60),
    deliveryEligible: boolean("delivery_eligible").notNull().default(true),
    pickupEligible: boolean("pickup_eligible").notNull().default(true),
    /** Can be attached as an add-on to bouquets (cards, chocolates, toys, vases). */
    isAddon: boolean("is_addon").notNull().default(false),
    isDemo: boolean("is_demo").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),
    isNew: boolean("is_new").notNull().default(false),
    isPremium: boolean("is_premium").notNull().default(false),
    salesCount: integer("sales_count").notNull().default(0),
    priceUpdatedAt: timestamp("price_updated_at", { withTimezone: true }).notNull().defaultNow(),
    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_status_idx").on(t.status),
    index("products_florist_idx").on(t.floristId),
    index("products_price_idx").on(t.price),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categoryId: integer("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.productId, t.categoryId] }), index("pc_category_idx").on(t.categoryId)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    /** e.g. "Kichik", "O‘rtacha", "Katta" */
    name: text("name").notNull(),
    nameRu: text("name_ru"),
    stemCount: integer("stem_count"),
    price: integer("price").notNull(),
    compareAtPrice: integer("compare_at_price"),
    stockQuantity: integer("stock_quantity"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("variants_product_idx").on(t.productId)],
);

/* ------------------------------------------------------------------ */
/* Delivery                                                            */
/* ------------------------------------------------------------------ */

export const deliveryRegions = pgTable(
  "delivery_regions",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    nameRu: text("name_ru"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    note: text("note").notNull().default(""),
  },
  (t) => [uniqueIndex("regions_slug_idx").on(t.slug)],
);

export const deliveryZones = pgTable("delivery_zones", {
  id: serial("id").primaryKey(),
  /** Each florist delivers itself, so delivery areas and fees belong to a florist. */
  floristId: integer("florist_id")
    .notNull()
    .references(() => florists.id, { onDelete: "cascade" }),
  regionId: integer("region_id")
    .notNull()
    .references(() => deliveryRegions.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameRu: text("name_ru"),
  /** Districts / areas covered, shown to customers. */
  description: text("description").notNull().default(""),
  descriptionRu: text("description_ru"),
  fee: integer("fee").notNull().default(0),
  freeFrom: integer("free_from"),
  minOrder: integer("min_order"),
  sameDayEnabled: boolean("same_day_enabled").notNull().default(true),
  /** Latest local time (HH:MM, Asia/Tashkent) to accept same-day orders. */
  sameDayCutoff: text("same_day_cutoff").notNull().default("18:00"),
  /** Minimum minutes between order time and slot start. */
  minLeadMinutes: integer("min_lead_minutes").notNull().default(120),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  label: text("label").notNull(),
  startTime: text("start_time").notNull(), // HH:MM
  endTime: text("end_time").notNull(), // HH:MM
  /** Max orders per date for this slot. null = unlimited. */
  capacity: integer("capacity"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

/* ------------------------------------------------------------------ */
/* Settings & coupons                                                  */
/* ------------------------------------------------------------------ */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const coupons = pgTable(
  "coupons",
  {
    id: serial("id").primaryKey(),
    code: text("code").notNull(),
    type: couponType("type").notNull(),
    value: integer("value").notNull(),
    minSubtotal: integer("min_subtotal").notNull().default(0),
    maxDiscount: integer("max_discount"),
    usageLimit: integer("usage_limit"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coupons_code_idx").on(t.code)],
);

/* ------------------------------------------------------------------ */
/* Users & sessions                                                    */
/* ------------------------------------------------------------------ */

export const adminUsers = pgTable(
  "admin_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").$type<"owner" | "staff" | "florist">().notNull().default("staff"),
    /** Set for role "florist": the only shop this user may see and manage. */
    floristId: integer("florist_id").references(() => florists.id, { onDelete: "cascade" }),
    isActive: boolean("is_active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_email_idx").on(t.email)],
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phone: text("phone").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("customers_phone_idx").on(t.phone)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the raw token never touches the DB. */
    id: text("id").primaryKey(),
    userType: text("user_type").$type<"admin" | "customer">().notNull(),
    userId: uuid("user_id").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

export const customerAddresses = pgTable("customer_addresses", {
  id: serial("id").primaryKey(),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),
  label: text("label").notNull().default("Manzil"),
  recipientName: text("recipient_name").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  regionId: integer("region_id").references(() => deliveryRegions.id, { onDelete: "set null" }),
  zoneId: integer("zone_id").references(() => deliveryZones.id, { onDelete: "set null" }),
  district: text("district").notNull().default(""),
  neighborhood: text("neighborhood").notNull().default(""),
  address: text("address").notNull(),
  apartment: text("apartment").notNull().default(""),
  landmark: text("landmark").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const favorites = pgTable(
  "favorites",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.productId] })],
);

/* ------------------------------------------------------------------ */
/* Orders                                                              */
/* ------------------------------------------------------------------ */

export type OrderItemAddon = { productId: number; name: string; unitPrice: number; quantity: number };

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    number: text("number").notNull(),
    /** Random token that allows the customer to view their order without an account. */
    accessToken: text("access_token").notNull(),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "set null" }),
    /** One florist per order (the cart may only hold one florist's products). */
    floristId: integer("florist_id")
      .notNull()
      .references(() => florists.id, { onDelete: "restrict" }),
    /** Commission agreed when the order was placed: rate in basis points and amount in so'm (on goods after discount). */
    commissionRate: integer("commission_rate").notNull().default(0),
    commissionAmount: integer("commission_amount").notNull().default(0),
    /** Monthly commission statement this delivered order was billed on (null = not billed yet). */
    commissionStatementId: integer("commission_statement_id").references(() => commissionStatements.id, { onDelete: "set null" }),
    status: orderStatus("status").notNull().default("new"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
    fulfillment: fulfillment("fulfillment").notNull(),
    /** Language the customer ordered in (uz / ru). */
    locale: text("locale").notNull().default("uz"),
    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    recipientName: text("recipient_name").notNull(),
    recipientPhone: text("recipient_phone").notNull(),
    regionId: integer("region_id"),
    zoneId: integer("zone_id"),
    regionName: text("region_name"),
    zoneName: text("zone_name"),
    district: text("district").notNull().default(""),
    neighborhood: text("neighborhood").notNull().default(""),
    address: text("address").notNull().default(""),
    apartment: text("apartment").notNull().default(""),
    landmark: text("landmark").notNull().default(""),
    deliveryDate: date("delivery_date").notNull(),
    slotId: integer("slot_id"),
    slotLabel: text("slot_label").notNull(),
    courierNote: text("courier_note").notNull().default(""),
    cardMessage: text("card_message").notNull().default(""),
    anonymous: boolean("anonymous").notNull().default(false),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").notNull().default(0),
    deliveryFee: integer("delivery_fee").notNull().default(0),
    serviceFee: integer("service_fee").notNull().default(0),
    total: integer("total").notNull(),
    couponCode: text("coupon_code"),
    containsDemo: boolean("contains_demo").notNull().default(false),
    adminNote: text("admin_note").notNull().default(""),
    cancelReason: text("cancel_reason"),
    /** Random id generated by the checkout page; a repeated submit with the same id returns the same order. */
    idempotencyKey: text("idempotency_key"),
    /** Set only for orders placed in the Telegram Mini App, from signature-verified initData. */
    telegramUserId: text("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    /** Delivery point shared as a Telegram location (bot orders); shown to the courier as a map link. */
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    uniqueIndex("orders_idempotency_idx").on(t.idempotencyKey),
    index("orders_phone_idx").on(t.customerPhone),
    index("orders_created_idx").on(t.createdAt),
    index("orders_customer_idx").on(t.customerId),
    index("orders_florist_idx").on(t.floristId),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: integer("variant_id"),
    productName: text("product_name").notNull(),
    variantName: text("variant_name"),
    stems: integer("stems"),
    color: text("color"),
    imageUrl: text("image_url"),
    unitPrice: integer("unit_price").notNull(),
    quantity: integer("quantity").notNull(),
    addons: jsonb("addons").$type<OrderItemAddon[]>().notNull().default([]),
    lineTotal: integer("line_total").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").$type<"status" | "payment" | "note" | "notification" | "edit">().notNull(),
    toStatus: text("to_status"),
    message: text("message").notNull().default(""),
    /** Machine-readable event (e.g. "order_received", "payment_paid") so customer pages can show it in their language. */
    code: text("code"),
    params: jsonb("params").$type<Record<string, string | number>>(),
    actor: text("actor").notNull().default("system"),
    /** Whether this event is shown on the customer tracking page. */
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").$type<"payme" | "click">().notNull(),
    providerTransactionId: text("provider_transaction_id").notNull(),
    /** Amount in UZS (so'm). Payme sends tiyin; converted at the edge. */
    amount: integer("amount").notNull(),
    /** Payme: 1, 2, -1, -2. Click: 0 prepared, 1 completed, -1 cancelled. */
    state: integer("state").notNull(),
    reason: integer("reason"),
    providerCreateTime: text("provider_create_time"),
    createTime: timestamp("create_time", { withTimezone: true }).notNull().defaultNow(),
    performTime: timestamp("perform_time", { withTimezone: true }),
    cancelTime: timestamp("cancel_time", { withTimezone: true }),
    raw: jsonb("raw"),
  },
  (t) => [uniqueIndex("payments_provider_tx_idx").on(t.provider, t.providerTransactionId)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("telegram"),
  status: text("status").$type<"sent" | "failed" | "skipped">().notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

export const customRequests = pgTable("custom_requests", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  occasion: text("occasion").notNull().default(""),
  budget: integer("budget"),
  desiredDate: date("desired_date"),
  colors: text("colors").notNull().default(""),
  description: text("description").notNull(),
  imagePath: text("image_path"),
  status: text("status").$type<"new" | "contacted" | "closed">().notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const subscribers = pgTable(
  "subscribers",
  {
    id: serial("id").primaryKey(),
    phone: text("phone").notNull(),
    consentText: text("consent_text").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull().defaultNow(),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("subscribers_phone_idx").on(t.phone)],
);

/* ------------------------------------------------------------------ */
/* Relations                                                           */
/* ------------------------------------------------------------------ */

export const productsRelations = relations(products, ({ many, one }) => ({
  variants: many(productVariants),
  categories: many(productCategories),
  primaryCategory: one(categories, { fields: [products.primaryCategoryId], references: [categories.id] }),
}));
export const variantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));
export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, { fields: [productCategories.productId], references: [products.id] }),
  category: one(categories, { fields: [productCategories.categoryId], references: [categories.id] }),
}));
export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(productCategories),
}));
export const regionsRelations = relations(deliveryRegions, ({ many }) => ({
  zones: many(deliveryZones),
}));
export const zonesRelations = relations(deliveryZones, ({ one }) => ({
  region: one(deliveryRegions, { fields: [deliveryZones.regionId], references: [deliveryRegions.id] }),
}));
export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  events: many(orderEvents),
  payments: many(payments),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));
export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));
export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

/* ------------------------------------------------------------------ */
/* Telegram ordering bot                                               */
/* ------------------------------------------------------------------ */

/** Conversation state per private chat with the shop bot (language, cart, checkout step). */
export const tgSessions = pgTable("tg_sessions", {
  chatId: text("chat_id").primaryKey(),
  locale: text("locale").$type<"uz" | "ru">(),
  step: text("step").notNull().default("idle"),
  cart: jsonb("cart").$type<{ productId: number; variantId: number | null; stems: number | null; color: string | null; quantity: number }[]>().notNull().default([]),
  draft: jsonb("draft").$type<Record<string, unknown>>().notNull().default({}),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Telegram file_id of product photos already uploaded by the bot (so each photo is uploaded once). */
export const tgMedia = pgTable("tg_media", {
  url: text("url").primaryKey(),
  fileId: text("file_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Audit log                                                           */
/* ------------------------------------------------------------------ */

/** Photos of the prepared bouquet, taken by the florist before dispatch and shown to the customer. */
export const orderPhotos = pgTable(
  "order_photos",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    uploadedBy: text("uploaded_by").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("order_photos_order_idx").on(t.orderId)],
);

/**
 * Verified-purchase reviews: only the customer of a delivered order can write one (one per order).
 * Published after moderation; the shop may reply publicly.
 */
export const reviews = pgTable(
  "reviews",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    floristId: integer("florist_id")
      .notNull()
      .references(() => florists.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(),
    text: text("text").notNull().default(""),
    /** Shown publicly: first name only. */
    authorName: text("author_name").notNull(),
    locale: text("locale").notNull().default("uz"),
    status: text("status").$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
    floristReply: text("florist_reply"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    moderatedAt: timestamp("moderated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("reviews_order_idx").on(t.orderId), index("reviews_florist_status_idx").on(t.floristId, t.status)],
);

/** A customer's complaint about an order (late, quality, wrong item, …), resolved by Gulzor. */
export const disputes = pgTable(
  "disputes",
  {
    id: serial("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    floristId: integer("florist_id")
      .notNull()
      .references(() => florists.id, { onDelete: "cascade" }),
    reason: text("reason").$type<"late" | "quality" | "wrong_item" | "not_delivered" | "other">().notNull(),
    message: text("message").notNull(),
    status: text("status").$type<"open" | "resolved" | "rejected">().notNull().default("open"),
    /** The shop's explanation (seen by Gulzor). */
    floristNote: text("florist_note"),
    /** Gulzor's decision, shown to the customer. */
    resolution: text("resolution"),
    resolvedBy: text("resolved_by"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [index("disputes_order_idx").on(t.orderId), index("disputes_status_idx").on(t.status)],
);

/**
 * Monthly commission statement: what a florist owes Gulzor for delivered orders. Customers pay the florist directly,
 * so the florist settles this with Gulzor; the admin records the payment.
 */
export const commissionStatements = pgTable(
  "commission_statements",
  {
    id: serial("id").primaryKey(),
    floristId: integer("florist_id")
      .notNull()
      .references(() => florists.id, { onDelete: "restrict" }),
    /** Billing month, "YYYY-MM" (Tashkent time). */
    period: text("period").notNull(),
    orderCount: integer("order_count").notNull(),
    /** Goods after discount, so'm. */
    goodsTotal: integer("goods_total").notNull(),
    commissionTotal: integer("commission_total").notNull(),
    status: text("status").$type<"unpaid" | "paid">().notNull().default("unpaid"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidNote: text("paid_note").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("commission_statement_period_idx").on(t.floristId, t.period), index("commission_statement_status_idx").on(t.status)],
);

/** Important administrative actions (florist approval, commission changes, …). Append-only. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    actorId: uuid("actor_id"),
    actorEmail: text("actor_email").notNull().default(""),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id").notNull(),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_entity_idx").on(t.entity, t.entityId), index("audit_created_idx").on(t.createdAt)],
);
