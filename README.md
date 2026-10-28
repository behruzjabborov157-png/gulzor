# Gulzor — online flower shop for Uzbekistan

A full e-commerce platform (storefront, cart, checkout, delivery rules, orders, admin
dashboard, Telegram notifications, Payme/Click payment endpoints) in Uzbek (Latin) with a full Russian version under `/ru`, prices in UZS.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 ·
PostgreSQL via Drizzle ORM (embedded PGlite for local development, any PostgreSQL in production) · Zod · sharp.

> **Status: demo catalog.** All 46 seeded products are flagged *demo*. Their prices are illustrative,
> anchored to public Tashkent listings (see `docs/market-research.md`). They are **not** live market prices.
> Photos are freely licensed Wikimedia Commons images credited at `/rasm-mualliflari`, not photos of real stock.
> Replace both before launch.

---

## 1. Quick start (local)

Requirements: Node.js ≥ 20.9 (tested on 24), npm. TypeScript is pinned to 6.x because typescript-eslint does not support TypeScript 7 yet.

```bash
npm install
cp .env.example .env.local        # defaults work for local development
npm run setup                     # creates the database (./storage/pgdata) and loads demo data
npm run admin:create -- --email you@example.com --name "Ism Familiya" --role owner
npm run dev                       # http://localhost:3000  ·  admin: /admin
```

`admin:create` asks for a password (min. 12 characters) or reads `ADMIN_PASSWORD` from the environment.
Running it again for an existing email resets the password and signs out that admin's sessions.

> ⚠️ **Embedded database lock:** PGlite is single-process. **Stop `npm run dev`/`npm start` before running
> `db:migrate`, `db:seed`, `admin:create` or `db:check`** against the local database. (A real PostgreSQL server has no such restriction.)

Useful scripts:

| Script | Purpose |
|---|---|
| `npm run db:generate` | Generate a new SQL migration after editing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations (`drizzle/`) |
| `npm run db:seed` | Load demo data if the catalog is empty. `-- --no-demo` = clean production start (categories, time slots, settings; delivery zones created switched off; no demo products/coupon). `-- --reset` wipes catalog/delivery data (keeps orders) |
| `npm run db:check` | Print row counts |
| `npm run launch:check` | Pre-launch readiness report (env, DB encoding, migrations, owner account, demo leftovers, contacts, delivery, payments, Telegram, upload folder). Exit code 1 if anything blocks launch. `-- --send-test` also sends a real Telegram message |
| `npm test` | Unit + integration tests (pricing, slots, CSV, order creation, Payme/Click protocol) on a throwaway database |
| `npm run test:e2e` | Playwright end-to-end tests against a running server (see §8) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint (`eslint-config-next` core-web-vitals + TypeScript rules) |

---

## 2. Project layout

```
src/
  app/[lang]/(store)/ storefront pages (URLs: /katalog, /gul/[slug], /savat, /buyurtma, /kuzatish, /hisob …;
                      Russian under /ru/…)
  i18n/               locale config, server/client helpers, dictionaries (ns/*.ts: uz + ru)
  proxy.ts            locale routing + CSP/HSTS
  app/admin/          admin: (auth)/kirish = login, (panel)/… = protected dashboard
  app/api/payments/   Payme Merchant API + Click SHOP API callbacks
  app/media/          serves uploaded images (customer uploads are admin-only)
  app/actions.ts      storefront Server Actions (quote, checkout, auth, requests…)
  app/admin/actions.ts admin Server Actions (each one re-checks authorization)
  db/schema.ts        database schema (single source of truth) → drizzle/*.sql migrations
  lib/                pricing, quote (authoritative server pricing), orders, delivery, auth,
                      telegram, payments/, storage, analytics, csv
  components/         store/ admin/ ui/
scripts/              migrate, seed (+ seed-data.ts), create-admin, check-db
tests/                unit/integration tests and Playwright e2e tests
docs/                 market research, owner guide (Uzbek), product import template
```

### Languages (Uzbek + Russian)
- Uzbek is the default and has clean URLs (`/katalog`); Russian lives under `/ru/katalog`. `src/proxy.ts`
  rewrites Uzbek paths to `/uz/…` internally and 308-redirects a typed `/uz/…` back to the clean URL.
  Every page has `hreflang` alternates and both languages are in the sitemap.
- UI text lives in `src/i18n/ns/*.ts` (one file per area, `uz` and `ru` objects; TypeScript makes sure
  every Uzbek key has a Russian one). Server code: `await getT()`; client components: `useT()`.
- Catalog content (products, categories, variants, delivery zones, shop address/hours) has optional
  `*_ru` fields, edited in the admin forms ("Rus tilidagi versiya") and via CSV (`name_ru` …). An empty
  Russian field falls back to the Uzbek text, so nothing is ever blank.
- Search matches both languages (`products.search_text`, recomputed on every save/import).
- Orders keep the customer's language: the Russian buyer sees the confirmation, tracking timeline and
  validation errors in Russian, while the admin panel and Telegram always show Uzbek names plus
  "Mijoz tili: rus tili".
- The admin panel is Uzbek only. The Russian texts (UI, legal pages, seeded demo products) were
  written for this project and **should be proofread by a native speaker** before launch; the Russian
  offer/privacy texts need the same legal review as the Uzbek ones.

### Installable app (PWA) and Android app (TWA)
- `src/app/manifest.ts` (manifest), `public/icons/` (generated by `node scripts/generate-icons.mjs`),
  `public/sw.js` (service worker, registered in production only) and `public/offline.html`.
- The service worker never caches pages, admin, `/api` or `/media`: pages are network-first and fall back to
  the offline page; only hashed build files, icons and catalogue photos are cached. Bump `VERSION` in
  `sw.js` to drop old caches.
- Footer "Ilovani o‘rnatish" button: Chrome's install dialog, or Add-to-Home-Screen instructions on iPhone.
- Android app: built with Bubblewrap from the live manifest (checked against `@bubblewrap/core` 1.27).
  `/.well-known/assetlinks.json` is generated from `TWA_PACKAGE_NAME` + `TWA_SHA256_FINGERPRINTS`
  (404 until set). Step-by-step guide in Uzbek: `docs/ANDROID-ILOVA.md`.
- Google Play listing texts (uz/ru), Data safety answers and graphics: `docs/play-store/`
  (`node scripts/play-store-assets.mjs <site-url>` re-renders the banner and phone screenshots from the live site).
- Customers can delete their own account at `/hisobni-ochirish` (password + confirmation; addresses,
  favorites and sessions go with it, orders are kept but unlinked) — required by Google Play.

### How pricing stays honest
The browser never decides a price. Cart and checkout send only *what* was chosen (product, size,
stem count, colour, add-ons, quantity). `src/lib/quote.ts` loads current prices, stock, season,
coupons, delivery zone fee, minimum order, free-delivery threshold and available time slots from the
database on every change, and `createOrder` re-runs that quote inside the order flow, reserves stock and re-checks time-slot
capacity atomically in a transaction, and only then returns success. Cancelling or rejecting an order
returns the stock, the coupon use and the sales counter in one transaction. The confirmation page is rendered from the stored order.

---

## 3. Environment variables

See `.env.example`. Summary:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | yes (prod) | Public URL: canonical links, sitemap, payment return URLs, Telegram links |
| `DATABASE_URL` | prod | `postgres://…`. Empty or `pglite:./path` = embedded DB |
| `UPLOAD_DIR` | no | Upload folder (default `./storage/uploads`) — must be on persistent disk |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | optional | Owner order notifications |
| `PAYME_MERCHANT_ID`, `PAYME_KEY`, `PAYME_CHECKOUT_URL` | optional | Payme |
| `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID` | optional | Click |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | multi-instance only | Same value on every instance (Next.js requirement) |

Secrets are read only on the server; none are exposed to the browser (nothing secret uses the `NEXT_PUBLIC_` prefix).

---

## 4. Deployment

**Step-by-step launch guide (Uzbek): `docs/ISHGA-TUSHIRISH.md`; Android app: `docs/ANDROID-ILOVA.md`.** Ready-made files: `deploy/gulzor.service`
(systemd), `deploy/nginx.conf` (reverse proxy + TLS via certbot), `deploy/backup.sh` (daily `pg_dump` + uploads, 14-day rotation).
Uptime monitoring: `GET /api/health` returns 200 `{status:"ok"}` or 503 when the database is unreachable.

> The PostgreSQL database **must be UTF8** (`CREATE DATABASE gulzor ENCODING UTF8 … TEMPLATE template0`).
> `db:migrate` refuses other encodings — a Windows-default WIN1252 database cannot store Cyrillic or other non-Latin names.

The app needs **a Node.js server, PostgreSQL, and a persistent disk for uploads** (or swap
`src/lib/storage.ts` for S3/Supabase Storage — it is the only file that touches upload storage).

> **Data localisation:** Uzbekistan's personal-data law requires personal data of Uzbek citizens to be
> stored on servers physically located in Uzbekistan. Orders contain names, phones and addresses.
> Choose hosting accordingly (e.g. a local data-centre VPS + PostgreSQL) and confirm with a lawyer.

Typical VPS setup (Ubuntu, Node 22+, PostgreSQL 15+, nginx):

```bash
git clone … gulzor && cd gulzor
npm ci
cp .env.example .env.local   # set NEXT_PUBLIC_SITE_URL=https://your-domain.uz, DATABASE_URL=postgres://…, UPLOAD_DIR=/var/lib/gulzor/uploads
npm run db:migrate
npm run db:seed -- --no-demo # clean start (or plain db:seed for demo data)
npm run admin:create -- --email owner@your-domain.uz --name "Owner" --role owner
npm run build
npm start -- -p 3000         # run under systemd or pm2; put nginx (TLS) in front
```

nginx must forward `X-Forwarded-For` (used for rate limiting) and allow request bodies of at least 8 MB
(`client_max_body_size 8m;`) for image uploads. Back up PostgreSQL and `UPLOAD_DIR` daily.

Upgrades: `git pull && npm ci && npm run db:migrate && npm run build` and restart.

---

## 5. Admin setup checklist (also shown on the admin home page)

1. **Sozlamalar** → shop phone and/or Telegram username (customers' contact link), address, working hours, legal name.
2. **Yetkazib berish** → enable only the areas you really serve; set fees, free-delivery threshold,
   minimum order, same-day cut-off, lead time, and time windows (optional capacity per window).
   The seeded Tashkent zones and fees are demo values. Samarkand is seeded *disabled* to show multi-region support.
3. **Mahsulotlar** → replace demo products: edit or archive them ("Namunalarni arxivlash"), upload your own
   photos, set real prices and stock. Every price change stamps "narx yangilangan" (price updated date), shown on the product page.
4. **Promokodlar** → delete or disable the seeded `DEMO10` code.
5. **Sozlamalar** → switch off the demo banner once real data is in.
6. Configure Telegram (§6) and, if wanted, payments (§7).

Roles: **owner** (everything) and **staff** (orders, products, categories, requests). Create staff with
`npm run admin:create -- --role staff …`. Admin login is rate-limited (5 attempts / 15 min per email,
20 per IP); sessions are httpOnly cookies, expire after 12 h, and are stored hashed.

### Product import template
`docs/product-import-template.csv` (also downloadable in **Import / eksport**). Products are matched
by `slug` (update) or created. Required: `slug,name,price`. Optional Russian columns: `name_ru`,
`short_description_ru`, `description_ru`, `care_instructions_ru` (left untouched on update when the column is absent). Use `|` to separate several
`categories` (category slugs) and `flower_varieties`. Import covers fixed-price products;
size-based and per-stem products are edited in the product form. **Eksport** downloads the whole
catalog in the same format, so the workflow is export → edit in Excel → import.

---

## 6. Telegram notifications

1. In Telegram, open **@BotFather** → `/newbot` → copy the token.
2. Send any message to the bot (or add the bot to the owner group and post there).
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` and copy `message.chat.id` (groups are negative numbers).
4. Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env.local` on the server and restart.
5. Admin → **Sozlamalar** → "Test xabar yuborish".

Every new order, paid online payment and custom-bouquet request is sent with order number, customer
contact, items and options, address, date/time slot, payment status and total. The real outcome
(`sent` / `failed` + Telegram error / `skipped` when not configured) is stored and shown on the order
page in admin, with a "Qayta yuborish" (resend) button. Order creation never depends on Telegram being up: notifications are sent after the response (`after()`),
so a slow Telegram API never delays checkout.

The *customer-facing* Telegram link comes from the shop's Telegram username in Settings.

---

## 7. Payment integration (Payme, Click)

Cash on delivery is enabled by default. Online methods appear at checkout **only** when the owner
switches them on in Settings **and** the server has credentials.

**Payme (Merchant API):**
- Merchant cabinet → endpoint URL: `https://<your-domain>/api/payments/payme`
- Account field: `order_id` (= Gulzor order number, e.g. `GZ-261026-1234`)
- Env: `PAYME_MERCHANT_ID`, `PAYME_KEY` (test key in sandbox, production key later),
  `PAYME_CHECKOUT_URL=https://test.paycom.uz` for sandbox, `https://checkout.paycom.uz` for production.
- Implemented: Basic-auth check, `CheckPerformTransaction`, `CreateTransaction` (one pending transaction per order),
  `PerformTransaction` (idempotent), `CancelTransaction` (before/after perform → `cancelled`/`refunded`),
  `CheckTransaction`, `GetStatement`, 12-hour timeout, amounts in tiyin.

**Click (SHOP API):**
- Prepare URL: `https://<your-domain>/api/payments/click/prepare`
- Complete URL: `https://<your-domain>/api/payments/click/complete`
- Env: `CLICK_SERVICE_ID`, `CLICK_MERCHANT_ID`, `CLICK_SECRET_KEY`, `CLICK_MERCHANT_USER_ID`.
- Implemented: MD5 `sign_string` verification, amount check, prepare/complete, duplicate and cancelled handling.

An order is marked **paid only by these server-to-server callbacks**. The browser "return" page just
re-reads the order from the database ("payment pending" until the provider confirms) and offers a
"continue payment" link. Admins can change payment status manually only for cash orders.

> **Not yet verified with the real providers.** The protocol logic is covered by simulated tests
> (`tests/orders-payments.test.ts`), but no real merchant credentials were available. Before enabling:
> obtain merchant accounts, run Payme's sandbox test suite and Click's test requests end-to-end, check the
> current provider documentation for changes, then switch the method on in Settings.

---

## 8. Testing

```bash
npm test                                       # 19 unit/integration tests, throwaway DB, no server needed
E2E_BASE_URL=http://localhost:3000 \
E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… \
npm run test:e2e                               # 28 Playwright tests (desktop + phone viewport)
```
First time: `npx playwright install chromium`. E2E tests **create real orders** in the database the
server uses (and one archived test product), so run them against a development database.

E2E coverage: homepage and every header link, search (including `o'`/`o‘` apostrophe variants),
price/availability filters, unavailable product with alternatives, bouquet customisation (stems, colour,
add-on) and live price, cart quantity changes, coupon, delivery fee, free-delivery threshold, server-side
checkout validation, order creation and number, secret-link access, order tracking (buyer phone only),
admin login (including a wrong password), order search by number and phone, status change visible to the
customer, inline price change visible on the storefront, PWA manifest/icons/offline page/iPhone install hint, self-service account deletion, product creation with photo upload and size
variants, CSV export, custom request with private photo, robots/sitemap/security headers, payment endpoint
auth, no horizontal scroll on 10 pages at phone width, mobile menu and filters. Russian: `/ru` routing,
`/uz` redirect, hreflang + sitemap, language switch keeping the query, Cyrillic search, Russian configurator
prices, cart and checkout with Russian validation messages, Russian confirmation page, admin view of a Russian order.

---

## 9. What works now vs. what needs external accounts

**Works now (tested):**
- Responsive storefront: home (all requested sections), catalog with working search, filters (flower,
  occasion, bouquet type, price, availability), sorting and pagination, category landing pages, product
  pages with gallery, sizes / stem count / colours / add-ons and live totals, related and recently viewed
  products, favourites (local, synced to the account when signed in), out-of-stock/out-of-season handling with alternatives.
- Cart with server re-quotes, coupons, delivery zone fee, service fee, free-delivery threshold and minimum order.
- Checkout with full validation, recipient ≠ buyer, anonymous gift, delivery or pickup, date and time-slot
  availability (same-day cut-off, preparation/lead time, slot capacity), card message, courier note, review step.
- Orders stored in PostgreSQL with atomic stock reservation, unique order number, confirmation page via
  secret link, tracking page with status timeline, guest checkout, optional customer accounts (order history,
  saved addresses, repeat order, self-service account deletion).
- Custom bouquet requests with a secure image upload (re-encoded, metadata stripped, visible to admins only).
- Newsletter sign-up with explicit consent text stored.
- Admin: analytics (revenue, orders, average order value, cancellations, paid total, daily sales chart, bestsellers,
  low stock), orders (search, status workflow with stock return on cancel/reject, delivery edits, internal notes,
  history, Telegram log/resend), products (full editor, image upload, quick inline price/stock/status), categories,
  delivery regions/zones/slots, coupons, requests/subscribers, settings, CSV import/export.
- Russian version of the whole storefront (`/ru`), with a language switch in the header.
- SEO: per-page titles and descriptions in Uzbek and Russian, canonical URLs + hreflang, sitemap, robots, Open Graph. Product JSON-LD is
  emitted **only for non-demo products**.
- Security: per-request nonce-based Content-Security-Policy (`src/proxy.ts`) and HSTS when served over HTTPS,
  server-side authorization on every admin action/page, bcrypt hashes, hashed session tokens,
  atomic DB-backed rate limits (login, checkout, tracking, forms), Next.js CSRF origin checks, input validation (Zod),
  path-traversal-safe media serving, CSV formula-injection guard, security headers.

**Requires your accounts / decisions:**
- Real products, prices, stock and photos (the catalog is demo data).
- Delivery areas and fees you actually serve (seeded zones are examples).
- Shop contact details (phone/Telegram username); until set, contact links are hidden rather than faked.
- Telegram bot token + chat id (notifications are logged as "skipped" until configured).
- Payme / Click merchant accounts and sandbox verification (online payment is off by default).
- Hosting with PostgreSQL and persistent storage in Uzbekistan; a domain + TLS.
- Legal review of the public offer (`/oferta`) and privacy policy (`/maxfiylik`) texts.
- Optional: SMS provider for phone verification/OTP (accounts currently use phone + password without SMS
  verification, so guest orders are deliberately **not** linked to accounts by phone number).

**Deliberately not included:** customer reviews (none exist yet; nothing is invented), "live market price"
feeds, fake discounts or scarcity, an Instagram feed (only a profile link when configured).
