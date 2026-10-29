/**
 * Integration test: server-side order creation, stock reservation and the Payme / Click
 * callback protocols (simulated requests — this does NOT prove connectivity with the real providers).
 *
 * Runs on a throwaway embedded PGlite database by default. Set TEST_DATABASE_URL to run the same
 * tests against a real PostgreSQL server (production driver). ⚠️ That database is WIPED first.
 */
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
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
process.env.TELEGRAM_SHOP_BOT_TOKEN = "777:integration-test-shop-bot";

const { closeDb, getDb, schema } = await import("@/db");
const { eq } = await import("drizzle-orm");
const { migrate } = realPg ? await import("drizzle-orm/postgres-js/migrator") : await import("drizzle-orm/pglite/migrator");
const { sql } = await import("drizzle-orm");
const { changeOrderStatus, createOrder, notifyNewOrder } = await import("@/lib/orders");
const { rateLimit } = await import("@/lib/rate-limit");
const { deleteCustomerAccount } = await import("@/lib/auth");
const { notifyOrderEmail } = await import("@/lib/email");
const { handleUpdate } = await import("@/lib/bot/handler");
const { setBotTransport } = await import("@/lib/bot/api");
const { platformFloristId, commissionFor } = await import("@/lib/florists");
const { paymeRpc } = await import("@/lib/payments/payme");
const { clickRequest } = await import("@/lib/payments/click");
const { saveSetting, DEFAULT_CHECKOUT } = await import("@/lib/settings");
const { addDaysISO, tashkentNow } = await import("@/lib/time");

let productId = 0;
let floristId = 0;
let regionId = 0;
let zoneId = 0;
let slotId = 0;
const tomorrow = addDaysISO(tashkentNow().date, 1);

before(async () => {
  const db = await getDb();
  if (realPg) {
    await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;`);
  }
  await migrate(db as never, { migrationsFolder: path.resolve("drizzle") });
  floristId = await platformFloristId(); // created by the marketplace migration
  const [r] = await db.insert(schema.deliveryRegions).values({ slug: "t", name: "Toshkent" }).returning();
  regionId = r.id;
  const [z] = await db.insert(schema.deliveryZones).values({ floristId, regionId: r.id, name: "Markaz", fee: 30_000, freeFrom: 700_000, minOrder: 100_000 }).returning();
  const [s] = await db.insert(schema.timeSlots).values({ label: "12–15", startTime: "12:00", endTime: "15:00" }).returning();
  const [p] = await db
    .insert(schema.products)
    .values({ floristId, slug: "test-roses", name: "Test atirgullar", price: 200_000, status: "active", stockQuantity: 3 })
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

test("Mini App orders are linked to the verified Telegram user; forged initData is ignored", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: null }).where(eq(schema.products.id, productId));
  const sign = (fields: Record<string, string>, token: string) => {
    const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
    const secret = createHmac("sha256", "WebAppData").update(token).digest();
    return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs).digest("hex") }).toString();
  };
  const fields = { auth_date: String(Math.floor(Date.now() / 1000)), user: JSON.stringify({ id: 5550001, first_name: "Aziza", username: "aziza_uz" }) };

  const real = await createOrder(checkout({ telegramInitData: sign(fields, process.env.TELEGRAM_SHOP_BOT_TOKEN!) }), null);
  assert.ok(real.ok, JSON.stringify(real));
  const [a] = await db.select().from(schema.orders).where(eq(schema.orders.number, real.number));
  assert.equal(a.telegramUserId, "5550001");
  assert.equal(a.telegramUsername, "aziza_uz");

  const forged = await createOrder(checkout({ telegramInitData: sign(fields, "666:someone-elses-bot") }), null);
  assert.ok(forged.ok); // the order itself is still accepted…
  const [b] = await db.select().from(schema.orders).where(eq(schema.orders.number, forged.number));
  assert.equal(b.telegramUserId, null); // …but not linked to any Telegram account
});

test("ordering bot: full chat from /start to a saved order, with prices and slots from the database", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: null, price: 200_000 }).where(eq(schema.products.id, productId));
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  setBotTransport(async (method, body) => {
    calls.push({ method, body });
    return { ok: true, result: { message_id: 99, photo: [{ file_id: "f1" }] } };
  });
  const chat = { id: 900001, type: "private" };
  const from = { id: 900001, first_name: "Bot", last_name: "Mijoz", username: "bot_mijoz", language_code: "uz" };
  let n = 0;
  const say = (m: Record<string, unknown>) => handleUpdate({ message: { message_id: ++n, chat, from, ...m } });
  const tap = (data: string) => handleUpdate({ callback_query: { id: `cb${++n}`, from, data, message: { message_id: n, chat } } });
  const lastText = () => {
    const c = [...calls].reverse().find((x) => x.method === "sendMessage" || x.method === "editMessageText");
    return String(c?.body.text ?? "");
  };
  const buttons = () =>
    calls.flatMap((c) => ((c.body.reply_markup as { inline_keyboard?: { callback_data?: string }[][] })?.inline_keyboard ?? []).flat().map((b) => b.callback_data));

  try {
    await say({ text: "/start" });
    assert.match(lastText(), /Tilni tanlang/);
    await tap("L:uz");
    assert.match(lastText(), /xush kelibsiz/);

    await tap(`P:${productId}`);
    const card = calls.find((c) => c.method === "sendPhoto" || (c.method === "sendMessage" && String(c.body.text ?? c.body.caption).includes("Test atirgullar")));
    assert.ok(card, "product card sent");
    await tap(`Q:${productId}:+`); // quantity 2
    await tap(`A:${productId}`);
    assert.match(lastText(), /Savatga qo‘shildi/);

    await tap("O");
    assert.match(lastText(), /Telefon raqamingizni yuboring/);
    await say({ contact: { phone_number: "998901234567", user_id: from.id } });
    await tap("RS:1"); // I receive the flowers myself; pickup is off, so the zone question follows
    assert.ok(buttons().includes(`Z:${zoneId}`), "zone buttons come from the database");
    await tap(`Z:${zoneId}`);
    await say({ location: { latitude: 41.311, longitude: 69.279 } });
    await say({ text: "kv. 12, 3-qavat" });
    await tap(`D:${tomorrow}`);
    assert.ok(buttons().includes(`T:${slotId}`), "only real time slots are offered");
    await tap(`T:${slotId}`);
    await say({ text: "Tabriklayman!" });
    assert.ok(buttons().includes("Y:cash"));
    await tap("Y:cash");
    assert.match(lastText(), /Jami: 430\s000/); // 2 × 200 000 + 30 000 delivery, computed by the server
    const task = await tap("OK");
    assert.ok(task?.notifyOrderId, "owner notification is scheduled");
    assert.match(lastText(), /Buyurtmangiz qabul qilindi!\nRaqam: GZ-/);

    const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, task!.notifyOrderId));
    assert.equal(o.telegramUserId, "900001");
    assert.equal(o.telegramUsername, "bot_mijoz");
    assert.equal(o.customerName, "Bot Mijoz");
    assert.equal(o.customerPhone, "+998901234567");
    assert.equal(o.latitude, 41.311);
    assert.equal(o.landmark, "kv. 12, 3-qavat");
    assert.equal(o.cardMessage, "Tabriklayman!");
    assert.equal(o.total, 430_000);
    assert.equal(o.slotId, slotId);

    // A second tap on the old "Confirm" button cannot create another order.
    const again = await tap("OK");
    assert.equal(again, null);
    const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(schema.orders).where(eq(schema.orders.telegramUserId, "900001"));
    assert.equal(count, 1);
  } finally {
    setBotTransport(null);
  }
});

test("marketplace: one florist per order, only approved florists, florist's own zones, commission and per-florist slot capacity", async () => {
  const db = await getDb();
  await db.update(schema.products).set({ stockQuantity: null }).where(eq(schema.products.id, productId));
  // A second florist with its own product and its own delivery zone.
  const [f2] = await db.insert(schema.florists).values({ slug: "lola-gullari", name: "Lola gullari", status: "approved", commissionRate: 1200 }).returning();
  const [p2] = await db.insert(schema.products).values({ floristId: f2.id, slug: "f2-tulips", name: "Lolalar", price: 150_000, status: "active" }).returning();
  const [z2] = await db.insert(schema.deliveryZones).values({ floristId: f2.id, regionId, name: "Chilonzor", fee: 25_000 }).returning();
  const line = (id: number) => ({ productId: id, quantity: 1, addons: [] });

  // Mixing two florists in one order is refused.
  const mixed = await createOrder(checkout({ lines: [line(productId), line(p2.id)] }), null);
  assert.equal(mixed.ok, false);
  assert.match(JSON.stringify(mixed), /bitta do‘kondan/);

  // Florist 2's product cannot be delivered with florist 1's zone.
  const wrongZone = await createOrder(checkout({ lines: [line(p2.id)], zoneId }), null);
  assert.equal(wrongZone.ok, false);
  assert.match(JSON.stringify(wrongZone), /yetkazib bermaydi/);

  // With its own zone it works; the order belongs to florist 2 and carries its 12% commission on the goods.
  const ok = await createOrder(checkout({ lines: [line(p2.id)], zoneId: z2.id }), null);
  assert.ok(ok.ok, JSON.stringify(ok));
  const [o] = await db.select().from(schema.orders).where(eq(schema.orders.id, ok.orderId));
  assert.equal(o.floristId, f2.id);
  assert.equal(o.commissionRate, 1200);
  assert.equal(o.commissionAmount, commissionFor(1200, 150_000));
  assert.equal(o.commissionAmount, 18_000);
  assert.equal(o.deliveryFee, 25_000);

  // Slot capacity is per florist: florist 2 filling the window does not block another florist.
  const [f3] = await db.insert(schema.florists).values({ slug: "atirgul-uyi", name: "Atirgul uyi", status: "approved" }).returning();
  const [p3] = await db.insert(schema.products).values({ floristId: f3.id, slug: "f3-roses", name: "Atirgul", price: 120_000, status: "active" }).returning();
  const [z3] = await db.insert(schema.deliveryZones).values({ floristId: f3.id, regionId, name: "Yunusobod", fee: 20_000 }).returning();
  await db.update(schema.timeSlots).set({ capacity: 1 }).where(eq(schema.timeSlots.id, slotId));
  try {
    const f2Again = await createOrder(checkout({ lines: [line(p2.id)], zoneId: z2.id }), null);
    assert.equal(f2Again.ok, false); // florist 2's single place in this window is taken
    const f3Order = await createOrder(checkout({ lines: [line(p3.id)], zoneId: z3.id }), null);
    assert.ok(f3Order.ok, JSON.stringify(f3Order)); // florist 3 still has its own place
  } finally {
    await db.update(schema.timeSlots).set({ capacity: null }).where(eq(schema.timeSlots.id, slotId));
  }

  // A suspended florist's products disappear from sale immediately.
  await db.update(schema.florists).set({ status: "suspended" }).where(eq(schema.florists.id, f2.id));
  const suspended = await createOrder(checkout({ lines: [line(p2.id)], zoneId: z2.id }), null);
  assert.equal(suspended.ok, false);
  assert.match(JSON.stringify(suspended), /sotuvda emas/);
});


test("marketplace storefront: shop and city filters, hidden unapproved shops, shop zones, bot refuses to mix shops", async () => {
  const db = await getDb();
  const { listProducts } = await import("@/lib/catalog");
  const { getDeliveryConfig } = await import("@/lib/delivery");
  const { getFloristBySlug, listApprovedFlorists } = await import("@/lib/florists");
  const [shopA] = await db.insert(schema.florists).values({ slug: "shop-a", name: "Shop A", status: "approved" }).returning();
  const [shopB] = await db.insert(schema.florists).values({ slug: "shop-b", name: "Shop B", status: "pending" }).returning();
  const [cityB] = await db.insert(schema.deliveryRegions).values({ slug: "samarqand", name: "Samarqand" }).returning();
  const [pa] = await db.insert(schema.products).values({ floristId: shopA.id, slug: "a-rose", name: "A rose", price: 90_000, status: "active" }).returning();
  await db.insert(schema.products).values({ floristId: shopB.id, slug: "b-rose", name: "B rose", price: 90_000, status: "active" });
  await db.insert(schema.deliveryZones).values({ floristId: shopA.id, regionId: cityB.id, name: "Markaz", fee: 15_000 });

  // Pending shops are invisible everywhere.
  assert.equal(await getFloristBySlug("shop-b", "uz"), null);
  assert.ok(!(await listApprovedFlorists("uz")).some((f) => f.slug === "shop-b"));
  const all = await listProducts({ perPage: 48 });
  assert.ok(all.items.some((p) => p.slug === "a-rose"));
  assert.ok(!all.items.some((p) => p.slug === "b-rose"));
  // Cards carry their shop.
  assert.equal(all.items.find((p) => p.slug === "a-rose")?.florist?.slug, "shop-a");

  // Shop filter and city filter (a city = shops that deliver there).
  const onlyA = await listProducts({ floristId: shopA.id, perPage: 48 });
  assert.deepEqual(onlyA.items.map((p) => p.slug), ["a-rose"]);
  const inCityB = await listProducts({ regionId: cityB.id, perPage: 48 });
  assert.deepEqual(inCityB.items.map((p) => p.slug), ["a-rose"]);

  // Zones per shop.
  const zonesA = (await getDeliveryConfig("uz", shopA.id)).regions.flatMap((r) => r.zones);
  assert.ok(zonesA.length > 0 && zonesA.every((z) => z.floristId === shopA.id));

  // Bot: a product from another shop is not mixed into the cart; "replace" swaps the cart.
  const calls: { method: string; body: Record<string, unknown> }[] = [];
  setBotTransport(async (method, body) => {
    calls.push({ method, body });
    return { ok: true, result: { message_id: 1 } };
  });
  const chat = { id: 900002, type: "private" };
  const from = { id: 900002, first_name: "Aralash" };
  const tap = (data: string) => handleUpdate({ callback_query: { id: "c", from, data, message: { message_id: 1, chat } } });
  try {
    await handleUpdate({ message: { message_id: 1, chat, from, text: "/start" } });
    await tap("L:uz");
    await tap(`P:${productId}`);
    await tap(`A:${productId}`); // platform shop
    await tap(`P:${pa.id}`);
    await tap(`A:${pa.id}`); // shop A → conflict
    const lastText = String([...calls].reverse().find((c) => c.method === "sendMessage")?.body.text ?? "");
    assert.match(lastText, /bitta do‘kondan/);
    const [sess1] = await db.select().from(schema.tgSessions).where(eq(schema.tgSessions.chatId, "900002"));
    assert.deepEqual(sess1.cart.map((l) => l.productId), [productId]);
    await tap(`AR:${pa.id}`);
    const [sess2] = await db.select().from(schema.tgSessions).where(eq(schema.tgSessions.chatId, "900002"));
    assert.deepEqual(sess2.cart.map((l) => l.productId), [pa.id]);
  } finally {
    setBotTransport(null);
  }
});

test("florist panel: registration, and a florist can only touch its own products, orders and zones", async () => {
  const db = await getDb();
  const fp = await import("@/lib/florist-panel");
  const { saveProductForm, canEditProduct } = await import("@/lib/product-save");
  const application = {
    shopName: "Bahor gullari",
    contactName: "Dilnoza",
    email: "Bahor@Example.uz",
    password: "juda-uzun-parol-123",
    phone: "90 555 11 22",
    telegramUsername: "@bahor_gullari",
    regionId,
    address: "Chilonzor 9-kvartal, 12",
    legalName: "YaTT Dilnoza Karimova",
    taxId: "123456789",
    description: "",
    acceptTerms: true,
  };

  // Validation and registration.
  const bad = await fp.registerFlorist({ ...application, taxId: "12345", acceptTerms: false });
  assert.equal(bad.ok, false);
  assert.ok(!bad.ok && bad.errors.taxId && bad.errors.acceptTerms);
  const reg = await fp.registerFlorist(application);
  assert.ok(reg.ok, JSON.stringify(reg));
  const [shop] = await db.select().from(schema.florists).where(eq(schema.florists.id, reg.floristId));
  assert.equal(shop.status, "pending"); // needs Gulzor's approval before anything is sold
  assert.equal(shop.slug, "bahor-gullari");
  const [user] = await db.select().from(schema.adminUsers).where(eq(schema.adminUsers.id, reg.userId));
  assert.equal(user.role, "florist");
  assert.equal(user.floristId, reg.floristId);
  assert.equal(user.email, "bahor@example.uz");
  const again = await fp.registerFlorist(application);
  assert.ok(!again.ok && again.errors.email, "the same email cannot register twice");

  const mine = { kind: "florist" as const, floristId: reg.floristId };
  // Products: create own (curation flags ignored), never edit someone else's.
  const form = new FormData();
  for (const [k, v] of Object.entries({ name: "Bahor guldastasi", price: "180000", pricingMode: "fixed", status: "active", isDemo: "on", isPremium: "on", isNew: "on", deliveryEligible: "on" })) form.set(k, v);
  const created = await saveProductForm(mine, null, form);
  assert.ok(created.state.ok && created.id, JSON.stringify(created.state));
  const [own] = await db.select().from(schema.products).where(eq(schema.products.id, created.id!));
  assert.equal(own.floristId, reg.floristId);
  assert.equal(own.isDemo, false);
  assert.equal(own.isPremium, false);
  assert.equal(own.isNew, true);
  assert.equal(await canEditProduct(mine, productId), false);
  const hijack = await saveProductForm(mine, productId, form);
  assert.equal(hijack.state.ok, false);
  const [untouched] = await db.select().from(schema.products).where(eq(schema.products.id, productId));
  assert.notEqual(untouched.name, "Bahor guldastasi");

  // Zones: own ones only.
  const zoneInput = { regionId, name: "Chilonzor", nameRu: null, description: "", fee: 20_000, freeFrom: null, minOrder: null, sameDayEnabled: true, sameDayCutoff: "17:00", minLeadMinutes: 120, isActive: true };
  assert.deepEqual(await fp.saveFloristZone(reg.floristId, null, zoneInput), { ok: true });
  const stolenZone = await fp.saveFloristZone(reg.floristId, zoneId, { ...zoneInput, fee: 1 });
  assert.equal(stolenZone.ok, false);
  const [platformZone] = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.id, zoneId));
  assert.equal(platformZone.fee, 30_000);

  // Orders: another shop's order is invisible; own orders follow the florist rules.
  await db.update(schema.products).set({ stockQuantity: null }).where(eq(schema.products.id, productId));
  const platformOrder = await createOrder(checkout(), null);
  assert.ok(platformOrder.ok);
  assert.equal(await fp.floristOrder(reg.floristId, platformOrder.orderId), null);
  assert.equal((await fp.floristChangeStatus(reg.floristId, "d@x.uz", platformOrder.orderId, "confirmed")).ok, false);

  await db.update(schema.florists).set({ status: "approved" }).where(eq(schema.florists.id, reg.floristId));
  const [myZone] = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.floristId, reg.floristId));
  const myOrder = await createOrder(checkout({ lines: [{ productId: created.id!, quantity: 1, addons: [] }], zoneId: myZone.id }), null);
  assert.ok(myOrder.ok, JSON.stringify(myOrder));
  assert.ok((await fp.floristOrders(reg.floristId)).some((o) => o.id === myOrder.orderId));
  assert.ok(!(await fp.floristOrders(reg.floristId)).some((o) => o.id === platformOrder.orderId));
  assert.equal((await fp.floristChangeStatus(reg.floristId, "d@x.uz", myOrder.orderId, "rejected", "")).ok, false); // a reason is required
  assert.equal((await fp.floristChangeStatus(reg.floristId, "d@x.uz", myOrder.orderId, "cancelled", "xohlamadim")).ok, false); // cancelling is Gulzor's call
  assert.equal((await fp.floristMarkCashPaid(reg.floristId, "d@x.uz", myOrder.orderId)).ok, false); // not prepared yet
  for (const to of ["confirmed", "preparing", "ready", "dispatched", "delivered"] as const) {
    assert.deepEqual(await fp.floristChangeStatus(reg.floristId, "d@x.uz", myOrder.orderId, to), { ok: true }, to);
  }
  assert.deepEqual(await fp.floristMarkCashPaid(reg.floristId, "d@x.uz", myOrder.orderId), { ok: true });
  const [paid] = await db.select().from(schema.orders).where(eq(schema.orders.id, myOrder.orderId));
  assert.equal(paid.paymentStatus, "paid");

  // The report counts the delivered order with its commission (default 10% on goods).
  const report = await fp.floristSalesReport(reg.floristId);
  assert.equal(report.length, 1);
  assert.equal(Number(report[0].orders), 1);
  assert.equal(Number(report[0].goods), 180_000);
  assert.equal(Number(report[0].commission), 18_000);
});

test("admin moderation: approve/suspend/reject rules, commission for new orders only, audit log", async () => {
  const db = await getDb();
  const fp = await import("@/lib/florist-panel");
  const fa = await import("@/lib/florist-admin");
  const { saveProductForm } = await import("@/lib/product-save");
  const owner = { id: null, email: "owner@gulzor.uz" };
  const reg = await fp.registerFlorist({
    shopName: "Lola bog‘i",
    contactName: "Aziza",
    email: "lola@example.uz",
    password: "juda-uzun-parol-456",
    phone: "90 555 33 44",
    telegramUsername: "",
    regionId,
    address: "Yunusobod 4",
    legalName: "YaTT Aziza",
    taxId: "987654321",
    description: "",
    acceptTerms: true,
  });
  assert.ok(reg.ok);
  const id = reg.floristId;
  const zoneInput = { regionId, name: "Yunusobod", nameRu: null, description: "", fee: 15_000, freeFrom: null, minOrder: null, sameDayEnabled: true, sameDayCutoff: "17:00", minLeadMinutes: 120, isActive: true };
  assert.deepEqual(await fp.saveFloristZone(id, null, zoneInput), { ok: true });
  const form = new FormData();
  for (const [k, v] of Object.entries({ name: "Lola guldastasi", price: "200000", pricingMode: "fixed", status: "active", deliveryEligible: "on" })) form.set(k, v);
  const product = await saveProductForm({ kind: "florist", floristId: id }, null, form);
  assert.ok(product.state.ok && product.id);
  const [zone] = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.floristId, id));
  const order = () => createOrder(checkout({ lines: [{ productId: product.id!, quantity: 1, addons: [] }], zoneId: zone.id }), null);

  // Pending: not orderable; suspending a pending shop is not a valid step; rejecting needs a reason.
  assert.equal((await order()).ok, false);
  assert.equal((await fa.setFloristStatus(owner, id, "suspended", "sabab")).ok, false);
  assert.equal((await fa.setFloristStatus(owner, id, "rejected", "")).ok, false);
  const platform = await platformFloristId();
  assert.equal((await fa.setFloristStatus(owner, platform, "suspended", "sinov")).ok, false, "the platform shop cannot be moderated");

  // Approve → orderable with the default 10%.
  assert.deepEqual(await fa.setFloristStatus(owner, id, "approved"), { ok: true });
  const [approved] = await db.select().from(schema.florists).where(eq(schema.florists.id, id));
  assert.ok(approved.approvedAt);
  assert.equal(approved.statusReason, null);
  const first = await order();
  assert.ok(first.ok, JSON.stringify(first));

  // Commission: validated, and only new orders get the new rate.
  assert.equal((await fa.setFloristCommission(owner, id, "abc")).ok, false);
  assert.equal((await fa.setFloristCommission(owner, id, "60")).ok, false);
  assert.deepEqual(await fa.setFloristCommission(owner, id, "12,5"), { ok: true });
  const second = await order();
  assert.ok(second.ok);
  const [o1] = await db.select().from(schema.orders).where(eq(schema.orders.id, first.orderId));
  const [o2] = await db.select().from(schema.orders).where(eq(schema.orders.id, second.orderId));
  assert.equal(o1.commissionRate, 1000);
  assert.equal(o1.commissionAmount, 20_000);
  assert.equal(o2.commissionRate, 1250);
  assert.equal(o2.commissionAmount, 25_000);

  // Suspend (with a reason) → hidden again; the reason is stored for the florist; reinstating clears it.
  assert.deepEqual(await fa.setFloristStatus(owner, id, "suspended", "Shikoyatlar tekshirilmoqda"), { ok: true });
  const [suspended] = await db.select().from(schema.florists).where(eq(schema.florists.id, id));
  assert.equal(suspended.statusReason, "Shikoyatlar tekshirilmoqda");
  assert.equal((await order()).ok, false);
  assert.equal((await fa.setFloristStatus(owner, id, "suspended", "yana")).ok, false, "already suspended");
  assert.deepEqual(await fa.setFloristStatus(owner, id, "approved"), { ok: true });
  assert.equal((await db.select().from(schema.florists).where(eq(schema.florists.id, id)))[0].statusReason, null);

  // Everything above is in the audit log, newest first, with readable descriptions.
  const log = await fa.auditEntries({ entity: "florist", entityId: String(id) });
  assert.deepEqual(
    log.map((e) => e.action),
    ["florist.approved", "florist.suspended", "florist.commission", "florist.approved"],
  );
  assert.equal(fa.describeAudit(log[2]), "Komissiya: 10% → 12,5%");
  assert.ok(log.every((e) => e.actorEmail === "owner@gulzor.uz"));

  const detail = await fa.floristAdminDetail(id);
  assert.equal(detail?.stats.orders.all, 2);
  assert.equal(detail?.stats.products.active, 1);
  assert.equal(detail?.users[0].email, "lola@example.uz");
  const counts = await fa.floristStatusCounts();
  assert.ok(counts.approved >= 2);
});

test("marketplace money flow: shops take cash only, no Gulzor promo codes, service fee or pickup; florists get Telegram notifications; monthly statements", async () => {
  const db = await getDb();
  const fp = await import("@/lib/florist-panel");
  const fa = await import("@/lib/florist-admin");
  const fnotify = await import("@/lib/florist-notify");
  const cm = await import("@/lib/commission");
  const { quoteCart } = await import("@/lib/quote");
  const { saveProductForm } = await import("@/lib/product-save");
  const owner = { id: null, email: "owner@gulzor.uz" };

  const reg = await fp.registerFlorist({
    shopName: "Nargiz gullari",
    contactName: "Nargiza",
    email: "nargiz@example.uz",
    password: "juda-uzun-parol-789",
    phone: "90 555 66 77",
    telegramUsername: "",
    regionId,
    address: "Mirobod 3",
    legalName: "YaTT Nargiza",
    taxId: "111222333",
    description: "",
    acceptTerms: true,
  });
  assert.ok(reg.ok);
  const id = reg.floristId;
  await fp.saveFloristZone(id, null, { regionId, name: "Mirobod", nameRu: null, description: "", fee: 20_000, freeFrom: null, minOrder: null, sameDayEnabled: true, sameDayCutoff: "17:00", minLeadMinutes: 120, isActive: true });
  const form = new FormData();
  for (const [k, v] of Object.entries({ name: "Nargiz guldastasi", price: "300000", pricingMode: "fixed", status: "active", deliveryEligible: "on", pickupEligible: "on" })) form.set(k, v);
  const product = await saveProductForm({ kind: "florist", floristId: id }, null, form);
  assert.ok(product.state.ok && product.id);
  assert.deepEqual(await fa.setFloristStatus(owner, id, "approved"), { ok: true });
  const [zone] = await db.select().from(schema.deliveryZones).where(eq(schema.deliveryZones.floristId, id));
  const lines = [{ productId: product.id!, quantity: 1, addons: [] }];
  await db.insert(schema.coupons).values({ code: "GULZOR10", type: "percent", value: 10 });
  await saveSetting("checkout", { ...DEFAULT_CHECKOUT, paymeEnabled: true, clickEnabled: true, pickupEnabled: true, serviceFee: 5_000 });

  try {
    // Gulzor's coupon, service fee and pickup do not apply to a marketplace shop; the platform shop keeps them.
    const q = await quoteCart({ lines, couponCode: "GULZOR10", fulfillment: "delivery", zoneId: zone.id, date: tomorrow, slotId }, { forCheckout: false });
    assert.equal(q.florist?.isPlatform, false);
    assert.equal(q.discount, 0);
    assert.equal(q.coupon?.applied, false);
    assert.equal(q.serviceFee, 0);
    assert.equal(q.total, 300_000 + 20_000);
    const platformQ = await quoteCart(
      { lines: [{ productId, quantity: 1, addons: [] }], couponCode: "GULZOR10", fulfillment: "delivery", zoneId, date: tomorrow, slotId },
      { forCheckout: false },
    );
    assert.equal(platformQ.coupon?.applied, true);
    assert.equal(platformQ.serviceFee, 5_000);
    const pickup = await quoteCart({ lines, fulfillment: "pickup", date: tomorrow, slotId }, { forCheckout: false });
    assert.ok(pickup.errors.some((e) => e.includes("olib ketish faqat Gulzor")));
    const coupon = await createOrder(checkout({ lines, zoneId: zone.id, couponCode: "GULZOR10" }), null);
    assert.equal(coupon.ok, false);

    // Online payment would land in Gulzor's merchant account, so it is refused for a marketplace shop.
    for (const m of ["payme", "click"]) {
      const res = await createOrder(checkout({ lines, zoneId: zone.id, paymentMethod: m }), null);
      assert.ok(!res.ok && res.fieldErrors?.paymentMethod, m);
    }

    // The florist links Telegram through the shop bot: one-time deep link, then new orders arrive in that chat.
    const calls: { method: string; body: Record<string, unknown> }[] = [];
    setBotTransport(async (method, body) => {
      calls.push({ method, body });
      return method === "getMe" ? { ok: true, result: { username: "gulzor_test_bot" } } : { ok: true, result: { message_id: 1 } };
    });
    const link = await fnotify.floristTelegramLink(id);
    assert.match(link ?? "", /^https:\/\/t\.me\/gulzor_test_bot\?start=fl_[\w-]+$/);
    const code = link!.split("start=")[1];
    const chat = { id: 700700, type: "private" };
    const from = { id: 700700, first_name: "Nargiza" };
    await handleUpdate({ message: { message_id: 1, chat, from, text: "/start fl_wrong-code-123" } });
    assert.match(String(calls.at(-1)?.body.text), /Havola eskirgan/);
    await handleUpdate({ message: { message_id: 2, chat, from, text: `/start ${code}` } });
    assert.match(String(calls.at(-1)?.body.text), /«Nargiz gullari» do‘koni ulandi/);
    const [linked] = await db.select().from(schema.florists).where(eq(schema.florists.id, id));
    assert.equal(linked.telegramChatId, "700700");
    assert.equal(linked.telegramLinkToken, null, "the code is single-use");

    const order = await createOrder(checkout({ lines, zoneId: zone.id }), null);
    assert.ok(order.ok, JSON.stringify(order));
    await notifyNewOrder(order.orderId);
    const toFlorist = calls.find((c) => c.method === "sendMessage" && c.body.chat_id === "700700" && String(c.body.text).includes(order.number));
    assert.ok(toFlorist, "the florist got the order in Telegram");
    assert.match(String(toFlorist!.body.text), /florist\/buyurtmalar\//);
    assert.doesNotMatch(String(toFlorist!.body.text), /admin\/buyurtmalar/);
    const logs = await db.select().from(schema.notifications).where(eq(schema.notifications.orderId, order.orderId));
    const byChannel = Object.fromEntries(logs.map((l) => [l.channel, l.status]));
    assert.equal(byChannel.florist_telegram, "sent");
    assert.equal(byChannel.florist_email, "skipped"); // no SMTP in tests, logged truthfully
    assert.equal(byChannel.telegram, "skipped"); // owner bot not configured here

    // A platform order does not go to any florist chat.
    const before = calls.length;
    const platformOrder = await createOrder(checkout(), null);
    assert.ok(platformOrder.ok);
    await notifyNewOrder(platformOrder.orderId);
    assert.ok(!calls.slice(before).some((c) => c.body.chat_id === "700700"));

    // Statements: deliver two orders, one of them late (next month), then bill the month.
    const second = await createOrder(checkout({ lines, zoneId: zone.id }), null);
    assert.ok(second.ok);
    for (const oid of [order.orderId, second.orderId]) {
      for (const to of ["confirmed", "preparing", "ready", "dispatched", "delivered"] as const) assert.ok(await changeOrderStatus(oid, to, "t"));
    }
    const period = tomorrow.slice(0, 7);
    const nextMonth = cm.addMonths(period, 1);
    await db.update(schema.orders).set({ deliveryDate: `${nextMonth}-02` }).where(eq(schema.orders.id, second.orderId));

    assert.equal((await cm.issueStatements(owner, cm.currentPeriod())).ok, false, "the running month cannot be billed");
    const afterMonth = new Date(`${cm.addMonths(period, 2)}-10T00:00:00Z`);
    const issued = await cm.issueStatements(owner, period, afterMonth);
    assert.ok(issued.ok);
    const mine = issued.issued.filter((s) => s.floristId === id);
    assert.equal(mine.length, 1);
    assert.equal(mine[0].orderCount, 1);
    assert.equal(mine[0].commissionTotal, 30_000); // 10% of 300 000
    assert.ok(!issued.issued.some((s) => s.floristId === floristId), "Gulzor's own shop is never billed");
    const again = await cm.issueStatements(owner, period, afterMonth);
    assert.ok(again.ok && again.issued.length === 0, "issuing twice bills nothing twice");
    assert.equal((await cm.unbilledByFlorist(id))[0].orders, 1, "the late order waits for the next statement");
    const next = await cm.issueStatements(owner, nextMonth, afterMonth);
    assert.ok(next.ok && next.issued.some((s) => s.floristId === id && s.orderCount === 1));
    assert.equal((await cm.unbilledByFlorist(id)).length, 0);

    const billed = await cm.statementOrders(mine[0].id, id);
    assert.deepEqual(billed.map((o) => o.number), [order.number]);
    assert.equal((await cm.statementOrders(mine[0].id, floristId)).length, 0, "another shop cannot read it");
    assert.deepEqual(await cm.setStatementPaid(owner, mine[0].id, true, "Click 123"), { ok: true });
    const [paid] = await cm.listStatements({ floristId: id, status: "paid" });
    assert.equal(paid.s.paidNote, "Click 123");
    const log = await fa.auditEntries({ entity: "florist", entityId: String(id) });
    assert.ok(log.some((e) => e.action === "commission.paid"));
    assert.ok(log.some((e) => e.action === "commission.issued"));
  } finally {
    setBotTransport(null);
    await saveSetting("checkout", { ...DEFAULT_CHECKOUT, paymeEnabled: true, clickEnabled: true });
  }
});
