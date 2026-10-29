/**
 * Integration test: server-side order creation, stock reservation and the Payme / Click
 * callback protocols (simulated requests — this does NOT prove connectivity with the real providers).
 *
 * Runs on a throwaway embedded PGlite database by default. Set TEST_DATABASE_URL to run the same
 * tests against a real PostgreSQL server (production driver). ⚠️ That database is WIPED first.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { after, before, test } from "node:test";

const realPg = process.env.TEST_DATABASE_URL;
const dir = realPg ? null : fs.mkdtempSync(path.join(os.tmpdir(), "gulzor-test-"));
process.env.DATABASE_URL = realPg ?? `pglite:${dir}`;
process.env.PAYME_MERCHANT_ID = "test-merchant";
process.env.PAYME_KEY = "test-payme-key";
process.env.CLICK_SERVICE_ID = "111";
process.env.CLICK_MERCHANT_ID = "222";
process.env.CLICK_SECRET_KEY = "click-secret";
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TELEGRAM_CHAT_ID;
delete process.env.SMTP_HOST;
delete process.env.ORDER_EMAIL_TO;

const { closeDb, getDb, schema } = await import("@/db");
const { eq } = await import("drizzle-orm");
const { migrate } = realPg ? await import("drizzle-orm/postgres-js/migrator") : await import("drizzle-orm/pglite/migrator");
const { sql } = await import("drizzle-orm");
const { changeOrderStatus, createOrder, notifyNewOrder } = await import("@/lib/orders");
const { rateLimit } = await import("@/lib/rate-limit");
const { deleteCustomerAccount } = await import("@/lib/auth");
const { notifyOrderEmail } = await import("@/lib/email");
const { paymeRpc } = await import("@/lib/payments/payme");
const { clickRequest } = await import("@/lib/payments/click");
const { saveSetting, DEFAULT_CHECKOUT } = await import("@/lib/settings");
const { addDaysISO, tashkentNow } = await import("@/lib/time");

let productId = 0;
let zoneId = 0;
let slotId = 0;
const tomorrow = addDaysISO(tashkentNow().date, 1);

before(async () => {
  const db = await getDb();
  if (realPg) {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`);
  }
  await migrate(db as never, { migrationsFolder: path.resolve("drizzle") });
  const [r] = await db.insert(schema.deliveryRegions).values({ slug: "t", name: "Toshkent" }).returning();
  const [z] = await db.insert(schema.deliveryZones).values({ regionId: r.id, name: "Markaz", fee: 30_000, freeFrom: 700_000, minOrder: 100_000 }).returning();
  const [s] = await db.insert(schema.timeSlots).values({ label: "12–15", startTime: "12:00", endTime: "15:00" }).returning();
  const [p] = await db
    .insert(schema.products)
    .values({ slug: "test-roses", name: "Test atirgullar", price: 200_000, status: "active", stockQuantity: 3 })
    .returning();
  await saveSetting("checkout", { ...DEFAULT_CHECKOUT, paymeEnabled: true, clickEnabled: true });
  productId = p.id;
  zoneId = z.id;
  slotId = s.id;
});

after(async () => {
  await closeDb();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});

function checkout(overrides: Record<string, unknown> = {}) {
  return {
    lines: [{ productId, quantity: 1, addons: [] }],
    fulfillment: "delivery",
    customerName: "Test",
    customerPhone: "+998901234567",
    recipientIsCustomer: true,
    zoneId,
    address: "Amir Temur 15",
    date: tomorrow,
    slotId,
    paymentMethod: "cash",
    ...overrides,
  };
}

test("server recalculates totals and ignores client prices", async () => {
  const res = await createOrder(checkout({ lines: [{ productId, quantity: 2, addons: [], unitPrice: 1 }] }), null);
  assert.ok(res.ok, JSON.stringify(res));
  const db = await getDb();
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, res.number));
  assert.equal(o.subtotal, 400_000);
  assert.equal(o.deliveryFee, 30_000);
  assert.equal(o.total, 430_000);
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  assert.equal(p.stockQuantity, 1); // 3 − 2 reserved
});

test("orders exceeding stock, below minimum or with past dates are rejected", async () => {
  const tooMany = await createOrder(checkout({ lines: [{ productId, quantity: 2, addons: [] }] }), null);
  assert.equal(tooMany.ok, false);
  const past = await createOrder(checkout({ date: "2020-01-01" }), null);
  assert.equal(past.ok, false);
  const badPhone = await createOrder(checkout({ customerPhone: "123" }), null);
  assert.ok(!badPhone.ok && badPhone.fieldErrors?.customerPhone);
  const noZone = await createOrder(checkout({ zoneId: 99999 }), null);
  assert.equal(noZone.ok, false);
});

async function onlineOrder(method: "payme" | "click") {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: 10 }).where(eq(schema.products.id, productId));
  const res = await createOrder(checkout({ paymentMethod: method }), null);
  assert.ok(res.ok, JSON.stringify(res));
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, res.number));
  assert.equal(o.paymentStatus, "pending");
  return o;
}

const auth = "Basic " + Buffer.from("Paycom:test-payme-key").toString("base64");
const rpc = (method: string, params: object, a = auth) => paymeRpc(a, JSON.stringify({ id: 1, method, params }));

test("Payme: auth, amount check, create → perform → idempotent perform", async () => {
  const o = await onlineOrder("payme");
  const account = { order_id: o.number };
  const amount = o.total * 100;

  assert.equal((await rpc("CheckPerformTransaction", { amount, account }, "Basic d3Jvbmc=")).error?.code, -32504);
  assert.equal((await rpc("CheckPerformTransaction", { amount: amount - 100, account })).error?.code, -31001);
  assert.equal((await rpc("CheckPerformTransaction", { amount, account: { order_id: "NOPE" } })).error?.code, -31050);
  assert.deepEqual((await rpc("CheckPerformTransaction", { amount, account })).result, { allow: true });

  const created = await rpc("CreateTransaction", { id: "payme-tx-1", time: Date.now(), amount, account });
  assert.equal((created.result as { state: number }).state, 1);
  // A second transaction for the same order is refused while the first is pending.
  assert.equal((await rpc("CreateTransaction", { id: "payme-tx-2", time: Date.now(), amount, account })).error?.code, -31052);

  const db = await getDb();
  let [after1] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  assert.equal(after1.paymentStatus, "pending"); // not paid until PerformTransaction

  const performed = await rpc("PerformTransaction", { id: "payme-tx-1" });
  assert.equal((performed.result as { state: number }).state, 2);
  const again = await rpc("PerformTransaction", { id: "payme-tx-1" });
  assert.equal((again.result as { perform_time: number }).perform_time, (performed.result as { perform_time: number }).perform_time);
  [after1] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  assert.equal(after1.paymentStatus, "paid");

  const check = await rpc("CheckTransaction", { id: "payme-tx-1" });
  assert.equal((check.result as { state: number }).state, 2);
  assert.equal((await rpc("CheckTransaction", { id: "missing" })).error?.code, -31003);

  const cancel = await rpc("CancelTransaction", { id: "payme-tx-1", reason: 5 });
  assert.equal((cancel.result as { state: number }).state, -2);
  [after1] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  assert.equal(after1.paymentStatus, "refunded");

  const statement = await rpc("GetStatement", { from: Date.now() - 60_000, to: Date.now() + 60_000 });
  assert.equal((statement.result as { transactions: unknown[] }).transactions.length, 1);
  assert.equal((await rpc("Nope", {})).error?.code, -32601);
});

const md5 = (s: string) => createHash("md5").update(s).digest("hex");
function clickForm(o: { number: string; total: number }, action: 0 | 1, extra: Record<string, string> = {}) {
  const f: Record<string, string> = {
    click_trans_id: "777",
    service_id: "111",
    click_paydoc_id: "1",
    merchant_trans_id: o.number,
    amount: `${o.total}.00`,
    action: String(action),
    error: "0",
    error_note: "Success",
    sign_time: "2026-10-26 12:00:00",
    ...extra,
  };
  f.sign_string = md5(f.click_trans_id + f.service_id + "click-secret" + f.merchant_trans_id + (action === 1 ? f.merchant_prepare_id : "") + f.amount + f.action + f.sign_time);
  return new URLSearchParams(f);
}

test("Click: signature, amount, prepare → complete → already paid", async () => {
  const o = await onlineOrder("click");
  const bad = clickForm(o, 0);
  bad.set("sign_string", "0".repeat(32));
  assert.equal((await clickRequest(bad, 0)).error, -1);
  assert.equal((await clickRequest(clickForm({ ...o, total: o.total + 1 }, 0), 0)).error, -2);

  const prep = await clickRequest(clickForm(o, 0), 0);
  assert.equal(prep.error, 0);
  const prepareId = String(prep.merchant_prepare_id);

  const db = await getDb();
  let [row] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  assert.equal(row.paymentStatus, "pending");

  const done = await clickRequest(clickForm(o, 1, { merchant_prepare_id: prepareId }), 1);
  assert.equal(done.error, 0);
  [row] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  assert.equal(row.paymentStatus, "paid");
  assert.equal((await clickRequest(clickForm(o, 1, { merchant_prepare_id: prepareId }), 1)).error, -4);
});

test("Telegram notification outcome is logged truthfully when not configured", async () => {
  const o = await onlineOrder("payme");
  await notifyNewOrder(o.id);
  const db = await getDb();
  const rows = await db.select().from(schema.notifications).where(eq(schema.notifications.orderId, o.id));
  // Both channels log their own outcome; nothing is reported as sent.
  assert.deepEqual(rows.map((r) => `${r.channel}:${r.status}`).sort(), ["email:skipped", "telegram:skipped"]);
});

test("slot capacity is enforced at order time", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: 50 }).where(eq(schema.products.id, productId));
  const [small] = await db.insert(schema.timeSlots).values({ label: "18–21", startTime: "18:00", endTime: "21:00", capacity: 1 }).returning();
  const first = await createOrder(checkout({ slotId: small.id }), null);
  assert.ok(first.ok, JSON.stringify(first));
  const second = await createOrder(checkout({ slotId: small.id }), null);
  assert.equal(second.ok, false);
  // Simultaneous attempts on a fresh slot: exactly one wins.
  const [race] = await db.insert(schema.timeSlots).values({ label: "09–12", startTime: "09:00", endTime: "12:00", capacity: 1 }).returning();
  const results = await Promise.all([1, 2, 3].map(() => createOrder(checkout({ slotId: race.id }), null)));
  assert.equal(results.filter((r) => r.ok).length, 1);
});

test("cancelling returns stock, coupon use and sales count", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: 10, salesCount: 0 }).where(eq(schema.products.id, productId));
  await db.insert(schema.coupons).values({ code: "TEST5", type: "percent", value: 5, usageLimit: 1 });
  const res = await createOrder(checkout({ couponCode: "test5", lines: [{ productId, quantity: 2, addons: [] }] }), null);
  assert.ok(res.ok, JSON.stringify(res));
  let [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  let [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, "TEST5"));
  assert.equal(p.stockQuantity, 8);
  assert.equal(p.salesCount, 2);
  assert.equal(c.usedCount, 1);

  assert.equal(await changeOrderStatus(res.orderId, "delivered", "test"), false); // not allowed from "new"
  assert.equal(await changeOrderStatus(res.orderId, "cancelled", "test", "Mijoz so‘rovi"), true);
  [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  [c] = await db.select().from(schema.coupons).where(eq(schema.coupons.code, "TEST5"));
  assert.equal(p.stockQuantity, 10);
  assert.equal(p.salesCount, 0);
  assert.equal(c.usedCount, 0);
  assert.equal(await changeOrderStatus(res.orderId, "confirmed", "test"), false); // cancelled is final
});

test("rate limiter is atomic under concurrency", async () => {
  const results = await Promise.all(Array.from({ length: 20 }, () => rateLimit("test:burst", 5, 60)));
  assert.equal(results.filter(Boolean).length, 5);
});

test("account deletion removes the account, addresses, favorites and sessions but keeps unlinked orders", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: null }).where(eq(schema.products.id, productId));
  const [c] = await db.insert(schema.customers).values({ name: "O‘chiriladigan", phone: "+998907770011", passwordHash: "x" }).returning();
  const [other] = await db.insert(schema.customers).values({ name: "Boshqa", phone: "+998907770022", passwordHash: "x" }).returning();
  await db.insert(schema.customerAddresses).values({ customerId: c.id, recipientName: "A", recipientPhone: "+998907770011", address: "Chilonzor 1" });
  await db.insert(schema.favorites).values({ customerId: c.id, productId });
  const future = new Date(Date.now() + 3600_000);
  await db.insert(schema.sessions).values([
    { id: "del-s1", userType: "customer", userId: c.id, expiresAt: future },
    { id: "del-s2", userType: "customer", userId: c.id, expiresAt: future },
    { id: "keep-s", userType: "customer", userId: other.id, expiresAt: future },
  ]);
  const res = await createOrder(checkout({ customerPhone: "+998907770011" }), c.id);
  assert.ok(res.ok, JSON.stringify(res));

  await deleteCustomerAccount(c.id);

  assert.equal((await db.select().from(schema.customers).where(eq(schema.customers.id, c.id))).length, 0);
  assert.equal((await db.select().from(schema.customerAddresses).where(eq(schema.customerAddresses.customerId, c.id))).length, 0);
  assert.equal((await db.select().from(schema.favorites).where(eq(schema.favorites.customerId, c.id))).length, 0);
  const sessions = await db.select({ id: schema.sessions.id }).from(schema.sessions);
  assert.deepEqual(sessions.map((s) => s.id).filter((id) => id.endsWith("-s1") || id.endsWith("-s2") || id === "keep-s"), ["keep-s"]);
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.number, res.number));
  assert.equal(o.customerId, null); // order kept for the shop, no longer linked to the account
  assert.equal(o.customerPhone, "+998907770011");
});

/** Minimal SMTP server: accepts one message and hands back the raw DATA. */
function fakeSmtp(): Promise<{ port: number; received: Promise<string>; close: () => void }> {
  const CRLF = "\r\n";
  return new Promise((resolve) => {
    let deliver: (s: string) => void;
    const received = new Promise<string>((r) => (deliver = r));
    const server = net.createServer((sock) => {
      let inData = false;
      let buf = "";
      sock.write("220 test ESMTP" + CRLF);
      sock.on("data", (chunk) => {
        buf += chunk.toString("utf8");
        for (;;) {
          const end = inData ? CRLF + "." + CRLF : CRLF;
          const i = buf.indexOf(end);
          if (i < 0) break;
          const part = buf.slice(0, i);
          buf = buf.slice(i + end.length);
          if (inData) {
            inData = false;
            deliver(part);
            sock.write("250 queued" + CRLF);
            continue;
          }
          const cmd = part.slice(0, 4).toUpperCase();
          if (cmd === "EHLO" || cmd === "HELO") sock.write("250-test" + CRLF + "250 OK" + CRLF);
          else if (cmd === "DATA") {
            inData = true;
            sock.write("354 go" + CRLF);
          } else if (cmd === "QUIT") sock.end("221 bye" + CRLF);
          else sock.write("250 OK" + CRLF);
        }
      });
    });
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as net.AddressInfo).port, received, close: () => server.close() }));
  });
}

test("e-mail notification is really delivered over SMTP, and an SMTP failure is logged without losing the order", async () => {
  const o = await onlineOrder("payme");
  const db = await getDb();
  const items = await db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, o.id));
  const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  const smtp = await fakeSmtp();
  Object.assign(process.env, { SMTP_HOST: "127.0.0.1", SMTP_PORT: String(smtp.port), SMTP_FROM: "shop@example.com", ORDER_EMAIL_TO: "owner@example.com" });
  try {
    const ok = await notifyOrderEmail({ ...order, items });
    assert.equal(ok.status, "sent", ok.detail);
    const raw = await smtp.received;
    assert.match(raw, new RegExp(order.number));
    assert.match(raw, /owner@example.com/);

    smtp.close();
    process.env.SMTP_PORT = "1"; // nothing listens there
    const failed = await notifyOrderEmail({ ...order, items });
    assert.equal(failed.status, "failed");
  } finally {
    smtp.close();
    delete process.env.SMTP_HOST;
    delete process.env.ORDER_EMAIL_TO;
  }
  const log = await db.select().from(schema.notifications).where(eq(schema.notifications.orderId, o.id));
  assert.deepEqual(log.filter((r) => r.channel === "email").map((r) => r.status).sort(), ["failed", "sent"]);
  const [still] = await db.select().from(schema.orders).where(eq(schema.orders.id, o.id));
  assert.equal(still.number, order.number); // the order is untouched by notification problems
});

test("repeated submits with the same submission id create exactly one order", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: 5 }).where(eq(schema.products.id, productId));
  const submissionId = "7d4f2a10-1b2c-4d5e-8f90-123456789abc";
  const results = await Promise.all([1, 2, 3].map(() => createOrder(checkout({ submissionId }), null)));
  const again = await createOrder(checkout({ submissionId }), null);
  const numbers = new Set([...results, again].map((r) => (r.ok ? r.number : JSON.stringify(r))));
  assert.equal(numbers.size, 1, [...numbers].join(" | "));
  assert.ok(again.ok && again.duplicate);
  const rows = await db.select().from(schema.orders).where(eq(schema.orders.idempotencyKey, submissionId));
  assert.equal(rows.length, 1);
  const [p] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  assert.equal(p.stockQuantity, 4); // stock reserved once
});
