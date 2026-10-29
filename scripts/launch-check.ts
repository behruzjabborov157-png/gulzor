/**
 * Pre-launch readiness check. Prints every item as OK / WARN / FAIL and exits with code 1 if anything FAILs.
 *
 *   npm run launch:check                  # read-only checks
 *   npm run launch:check -- --send-test   # also sends a real Telegram test message
 *
 * Run it on the server with the production .env.local (and, for the embedded DB, with the app stopped).
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "./env";
loadEnv();
import { and, eq, sql } from "drizzle-orm";
import { closeDb, databaseKind, getDb, schema } from "@/db";
import { clickCredentials, paymeCredentials } from "@/lib/payments/config";
import { getSettings, telegramLink } from "@/lib/settings";
import { uploadRoot } from "@/lib/storage";
import { emailConfigured, sendOwnerEmail } from "@/lib/email";
import { sendTelegram, telegramConfigured } from "@/lib/telegram";

type Level = "OK" | "WARN" | "FAIL" | "INFO";
const results: { level: Level; text: string }[] = [];
const report = (level: Level, text: string) => results.push({ level, text });
/** db.execute returns an array on postgres-js and { rows } on PGlite. */
const rowsOf = <T>(r: unknown): T[] => (Array.isArray(r) ? r : ((r as { rows?: T[] }).rows ?? [])) as T[];

async function main() {
  /* ---- Environment ---- */
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (!site) report("FAIL", "NEXT_PUBLIC_SITE_URL is not set");
  else if (!site.startsWith("https://")) report("WARN", `NEXT_PUBLIC_SITE_URL is not HTTPS (${site}) — payments, HSTS and SEO need https://`);
  else if (/localhost|127\.0\.0\.1/.test(site)) report("FAIL", `NEXT_PUBLIC_SITE_URL points to localhost (${site})`);
  else report("OK", `Site URL: ${site}`);

  if (databaseKind() === "pglite") report("WARN", "Embedded PGlite database in use — use a real PostgreSQL server (DATABASE_URL=postgres://…) in production");
  else report("OK", "PostgreSQL server configured");

  /* ---- Database ---- */
  let db;
  try {
    db = await getDb();
    await db.execute(sql`SELECT 1`);
    report("OK", "Database reachable");
  } catch (e) {
    report("FAIL", `Cannot connect to the database: ${(e as Error).message}`);
    return;
  }

  if (databaseKind() === "postgres") {
    const rows = rowsOf<{ server_encoding: string }>(await db.execute(sql`SHOW server_encoding`));
    const enc = rows[0]?.server_encoding;
    report(enc === "UTF8" ? "OK" : "FAIL", `Database encoding: ${enc}${enc === "UTF8" ? "" : " (must be UTF8)"}`);
  }

  const journal = JSON.parse(fs.readFileSync(path.resolve("drizzle/meta/_journal.json"), "utf8")) as { entries: unknown[] };
  try {
    const applied = rowsOf<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`));
    const n = Number(applied[0]?.n ?? 0);
    report(n >= journal.entries.length ? "OK" : "FAIL", `Migrations applied: ${n}/${journal.entries.length}${n < journal.entries.length ? " — run npm run db:migrate" : ""}`);
  } catch {
    report("FAIL", "Migrations table not found — run npm run db:migrate");
    return;
  }

  /* ---- Admin ---- */
  const owners = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.adminUsers)
    .where(and(eq(schema.adminUsers.role, "owner"), eq(schema.adminUsers.isActive, true)));
  const qa = await db.select({ email: schema.adminUsers.email }).from(schema.adminUsers).where(sql`${schema.adminUsers.email} LIKE '%.local'`);
  report(owners[0].n > 0 ? "OK" : "FAIL", `Active owner accounts: ${owners[0].n}${owners[0].n ? "" : " — npm run admin:create -- --role owner …"}`);
  if (qa.length) report("WARN", `Test admin accounts still exist: ${qa.map((x) => x.email).join(", ")}`);

  /* ---- Catalog ---- */
  const [{ active, demo }] = await db
    .select({
      active: sql<number>`count(*) FILTER (WHERE ${schema.products.status} = 'active' AND NOT ${schema.products.isAddon})::int`,
      demo: sql<number>`count(*) FILTER (WHERE ${schema.products.status} = 'active' AND ${schema.products.isDemo})::int`,
    })
    .from(schema.products);
  report(active > 0 ? "OK" : "FAIL", `Active products (excluding gift add-ons): ${active}`);
  if (demo > 0) report("WARN", `${demo} DEMO products (incl. add-ons) are still active — replace or archive them (admin → Mahsulotlar → “Namunalarni arxivlash”)`);
  else report("OK", "No demo products are active");

  /* ---- Settings ---- */
  const { store, checkout } = await getSettings();
  if (!store.phone && !telegramLink(store.telegramUsername)) report("FAIL", "No shop phone or Telegram username — customers have no way to contact you (admin → Sozlamalar)");
  else report("OK", `Contact: ${[store.phone, store.telegramUsername && "@" + store.telegramUsername].filter(Boolean).join(", ")}`);
  if (!store.legalName) report("WARN", "Legal name is empty (shown in the public offer and footer)");
  if (checkout.demoMode) report("WARN", "Demo-mode banner is ON (admin → Sozlamalar)");
  if (checkout.pickupEnabled && !checkout.pickupAddress) report("FAIL", "Pickup is enabled but the pickup address is empty");

  const [demoCoupon] = await db.select().from(schema.coupons).where(and(eq(schema.coupons.code, "DEMO10"), eq(schema.coupons.isActive, true)));
  if (demoCoupon) report("WARN", "Demo coupon DEMO10 is still active (admin → Promokodlar)");

  /* ---- Delivery ---- */
  const [{ zones }] = await db
    .select({ zones: sql<number>`count(*)::int` })
    .from(schema.deliveryZones)
    .innerJoin(schema.deliveryRegions, eq(schema.deliveryRegions.id, schema.deliveryZones.regionId))
    .where(and(eq(schema.deliveryZones.isActive, true), eq(schema.deliveryRegions.isActive, true)));
  const [{ slots }] = await db.select({ slots: sql<number>`count(*)::int` }).from(schema.timeSlots).where(eq(schema.timeSlots.isActive, true));
  report(zones > 0 || checkout.pickupEnabled ? "OK" : "FAIL", `Active delivery zones: ${zones}${checkout.pickupEnabled ? " (+ pickup)" : ""}`);
  report(slots > 0 ? "OK" : "FAIL", `Active time slots: ${slots}`);
  report("INFO", "Check that delivery zones and fees are your REAL ones (the seeded Tashkent zones are examples)");

  /* ---- Payments ---- */
  const methods = [checkout.cashEnabled, checkout.paymeEnabled && !!paymeCredentials(), checkout.clickEnabled && !!clickCredentials()].filter(Boolean).length;
  report(methods > 0 ? "OK" : "FAIL", `Payment methods available to customers: ${methods}`);
  if (checkout.paymeEnabled && !paymeCredentials()) report("FAIL", "Payme is enabled in settings but PAYME_MERCHANT_ID / PAYME_KEY are missing");
  if (checkout.clickEnabled && !clickCredentials()) report("FAIL", "Click is enabled in settings but CLICK_* credentials are missing");
  if (paymeCredentials() && (process.env.PAYME_CHECKOUT_URL ?? "").includes("test.paycom.uz")) report("WARN", "PAYME_CHECKOUT_URL points to the Payme sandbox");

  /* ---- Telegram ---- */
  if (!telegramConfigured()) report("WARN", "Telegram notifications not configured (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)");
  else if (process.argv.includes("--send-test")) {
    const r = await sendTelegram(`✅ ${store.name}: launch check — Telegram notifications work.`);
    report(r.status === "sent" ? "OK" : "FAIL", `Telegram test message: ${r.detail}`);
  } else report("OK", "Telegram configured (add --send-test to send a real test message)");

  /* ---- E-mail (optional second channel) ---- */
  if (!emailConfigured()) report("OK", "E-mail notifications not configured (optional: SMTP_HOST, ORDER_EMAIL_TO)");
  else if (process.argv.includes("--send-test")) {
    const r = await sendOwnerEmail(`${store.name}: launch check`, "<p>E-mail notifications work.</p>", "E-mail notifications work.");
    report(r.status === "sent" ? "OK" : "FAIL", `Test e-mail: ${r.detail}`);
  } else report("OK", "E-mail configured (add --send-test to send a real test e-mail)");
  if (!telegramConfigured() && !emailConfigured()) report("WARN", "No order notification channel configured — new orders are only visible in the admin panel");

  /* ---- Marketplace ---- */
  const [platform] = await db.select().from(schema.florists).where(eq(schema.florists.isPlatform, true));
  report(platform?.status === "approved" ? "OK" : "FAIL", platform ? `Platform shop “${platform.name}”: ${platform.status}` : "Platform shop missing — run npm run db:migrate");
  const shops = await db
    .select({
      id: schema.florists.id,
      name: schema.florists.name,
      status: schema.florists.status,
      chat: schema.florists.telegramChatId,
      zones: sql<number>`(SELECT count(*)::int FROM ${schema.deliveryZones} z WHERE z.florist_id = ${schema.florists.id} AND z.is_active)`,
    })
    .from(schema.florists)
    .where(eq(schema.florists.isPlatform, false));
  const approved = shops.filter((s) => s.status === "approved");
  report("INFO", `Marketplace shops: ${approved.length} approved, ${shops.filter((s) => s.status === "pending").length} waiting for review`);
  const noZones = approved.filter((s) => s.zones === 0);
  if (noZones.length) report("WARN", `Approved shops without an active delivery zone (customers cannot order): ${noZones.map((s) => s.name).join(", ")}`);
  const shopBot = !!(process.env.TELEGRAM_SHOP_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);
  if (!shopBot) report("WARN", "Shop bot not configured (TELEGRAM_SHOP_BOT_TOKEN) — florists cannot receive orders in Telegram");
  else if ((process.env.TELEGRAM_WEBHOOK_SECRET ?? "").length < 16) report("FAIL", "TELEGRAM_WEBHOOK_SECRET must be at least 16 characters");
  else report("OK", "Shop bot configured (after deploy: npm run telegram:setup)");
  const deaf = approved.filter((s) => !s.chat);
  if (deaf.length && !process.env.SMTP_HOST) report("WARN", `Shops with no notification channel (no Telegram linked, no SMTP): ${deaf.map((s) => s.name).join(", ")}`);
  else if (deaf.length) report("INFO", `Shops that have not linked Telegram (they get e-mail only): ${deaf.map((s) => s.name).join(", ")}`);

  const [{ stale }] = await db
    .select({ stale: sql<number>`count(*)::int` })
    .from(schema.disputes)
    .where(and(eq(schema.disputes.status, "open"), sql`${schema.disputes.createdAt} < now() - interval '3 days'`));
  if (stale) report("WARN", `${stale} customer complaint(s) open for more than 3 days (admin → Murojaatlar)`);
  const [{ overdue }] = await db
    .select({ overdue: sql<number>`count(*)::int` })
    .from(schema.commissionStatements)
    .where(and(eq(schema.commissionStatements.status, "unpaid"), sql`${schema.commissionStatements.createdAt} < now() - interval '30 days'`));
  if (overdue) report("INFO", `${overdue} commission statement(s) unpaid for more than 30 days (admin → Komissiya)`);

  /* ---- Dependencies with known advisories ---- */
  try {
    const v = (JSON.parse(fs.readFileSync(path.resolve("node_modules/nodemailer/package.json"), "utf8")) as { version: string }).version;
    const [maj, min, pat] = v.split(".").map(Number);
    const fixed = maj > 10 || (maj === 10 && (min > 1 || (min === 1 && pat >= 4)));
    report(fixed ? "OK" : "WARN", `nodemailer ${v}${fixed ? "" : " — upgrade to ≥ 10.1.4 (address-parser advisories; recipients are already restricted to plain addresses)"}`);
  } catch {
    report("INFO", "nodemailer not installed");
  }

  /* ---- Storage ---- */
  for (const folder of ["products", "orders", "requests"]) {
    try {
      const dir = path.join(uploadRoot(), folder);
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.write-test-${process.pid}`);
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe);
      report("OK", `Upload folder writable: ${dir}`);
    } catch (e) {
      report("FAIL", `Upload folder not writable (${path.join(uploadRoot(), folder)}): ${(e as Error).message}`);
    }
  }

  report("INFO", "Personal data of Uzbek citizens must be stored on servers in Uzbekistan — confirm your hosting");
  report("INFO", "Back up PostgreSQL and the upload folder daily (see deploy/backup.sh)");
}

main()
  .catch((e) => report("FAIL", `Unexpected error: ${(e as Error).message}`))
  .finally(async () => {
    await closeDb().catch(() => {});
    const icon: Record<Level, string> = { OK: "✔", WARN: "!", FAIL: "✖", INFO: "i" };
    console.log("\nGulzor — launch check\n");
    for (const r of results) console.log(`  ${icon[r.level]} ${r.level.padEnd(4)}  ${r.text}`);
    const fails = results.filter((r) => r.level === "FAIL").length;
    const warns = results.filter((r) => r.level === "WARN").length;
    console.log(`\n${fails} failed, ${warns} warnings.${fails ? " Not ready to launch." : warns ? " Review the warnings before launch." : " Ready."}\n`);
    process.exit(fails ? 1 : 0);
  });
