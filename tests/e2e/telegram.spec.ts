import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

/**
 * Telegram Mini App journey. A real Telegram client cannot be automated, so telegram-web-app.js
 * is replaced by a stub that exposes the same WebApp API. initData is signed with E2E_TG_BOT_TOKEN
 * (start the server with the same TELEGRAM_SHOP_BOT_TOKEN to also check the server-side link).
 */
const TOKEN = process.env.E2E_TG_BOT_TOKEN ?? "";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

const user = { id: 7000001, first_name: "Telegram", last_name: "Mijoz", username: "gulzor_e2e", language_code: "uz" };

function initData() {
  const fields: Record<string, string> = { auth_date: String(Math.floor(Date.now() / 1000)), query_id: "AAE2E", user: JSON.stringify(user) };
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(TOKEN || "unsigned").digest();
  return new URLSearchParams({ ...fields, hash: createHmac("sha256", secret).update(dcs).digest("hex") }).toString();
}

const stub = (data: string, u: typeof user) => `
(function () {
  try { sessionStorage.setItem("__telegram__initParams", JSON.stringify({ tgWebAppData: ${JSON.stringify(data)} })); } catch (e) {}
  var back = false;
  window.__tg = { ready: false, expanded: false, back: function () { return back; } };
  window.Telegram = { WebApp: {
    initData: ${JSON.stringify(data)},
    initDataUnsafe: { user: ${JSON.stringify(u)} },
    isVersionAtLeast: function () { return true; },
    ready: function () { window.__tg.ready = true; },
    expand: function () { window.__tg.expanded = true; },
    setHeaderColor: function () {}, setBackgroundColor: function () {}, disableVerticalSwipes: function () {},
    requestContact: function (cb) { setTimeout(function () { cb(true, { status: "sent", responseUnsafe: { contact: { user_id: ${u.id}, phone_number: "998901112244" } } }); }, 50); },
    BackButton: { show: function () { back = true; }, hide: function () { back = false; }, onClick: function () {}, offClick: function () {} }
  } };
})();`;

test("inside Telegram: app is initialised, name and phone come from Telegram, the order reaches admin with the Telegram account", async ({ page }) => {
  const data = initData();
  await page.route("https://telegram.org/js/telegram-web-app.js*", (route) =>
    route.fulfill({ contentType: "application/javascript", body: stub(data, user) }),
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("about:blank"); // a fresh load, as when Telegram opens the app (not a same-page hash change)
  // Telegram opens the Mini App with the signed data in the URL hash.
  await page.goto(`/#tgWebAppData=${encodeURIComponent(data)}&tgWebAppVersion=8.0&tgWebAppPlatform=android`);
  await expect(page.locator("html")).toHaveAttribute("data-telegram", "");
  expect(await page.evaluate(() => (window as unknown as { __tg: { ready: boolean; expanded: boolean } }).__tg)).toMatchObject({ ready: true, expanded: true });

  // Inner pages show Telegram's own Back button.
  await page.goto("/katalog");
  // After a full page load the provider re-loads the (stubbed) script asynchronously — poll until it is there.
  await expect.poll(() => page.evaluate(() => (window as unknown as { __tg?: { back: () => boolean } }).__tg?.back() ?? false)).toBe(true);
  await page.getByRole("button", { name: /— savatga qo‘shish$/ }).first().click();
  await page.getByRole("dialog", { name: "Savatga qo‘shildi" }).getByRole("link", { name: "Savatga o‘tish" }).click();
  await page.getByLabel("Yetkazib berish hududi").selectOption({ index: 1 });
  await page.getByRole("link", { name: "Rasmiylashtirish" }).click();
  await expect(page.getByRole("heading", { name: "Buyurtmani rasmiylashtirish" })).toBeVisible();

  // Name prefilled from Telegram; phone shared with one tap.
  await expect(page.getByLabel("Ismingiz *")).toHaveValue("Telegram Mijoz");
  await page.getByRole("button", { name: "Telegram raqamimni ulashish" }).click();
  await expect(page.getByLabel("Telefon raqamingiz *")).toHaveValue("+998 90 111 22 44");

  await page.getByLabel("Gullarni o‘zim qabul qilaman").check();
  await page.getByLabel("Ko‘cha, uy *").fill("Test buyurtma — Telegram Mini App");
  await page.getByRole("button", { name: "Ertaga" }).click();
  await page.locator("label").filter({ hasText: "12:00 – 15:00" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await page.getByRole("button", { name: /Buyurtmani tasdiqlash/ }).click();
  await expect(page.getByRole("heading", { name: "Buyurtmangiz qabul qilindi!" })).toBeVisible();
  const number = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);

  test.skip(!TOKEN || !ADMIN_EMAIL || !ADMIN_PASSWORD, "server-side Telegram link needs E2E_TG_BOT_TOKEN and admin credentials");
  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Parol").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("heading", { name: /Salom/ })).toBeVisible();
  await page.goto(`/admin/buyurtmalar?q=${number}`);
  await page.getByRole("link", { name: number }).click();
  await expect(page.getByRole("link", { name: "Telegram: @gulzor_e2e" })).toBeVisible();
  await expect(page.getByText("+998 90 111 22 44").first()).toBeVisible();
});

test("outside Telegram the Telegram script is never loaded", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (r) => r.url().includes("telegram.org") && requested.push(r.url()));
  await page.goto("/buyurtma");
  await expect(page.locator("html")).not.toHaveAttribute("data-telegram", "");
  await expect(page.getByRole("button", { name: "Telegram raqamimni ulashish" })).toHaveCount(0);
  expect(requested).toEqual([]);
});

test("shop bot webhook rejects calls without Telegram's secret header", async ({ request }) => {
  const res = await request.post("/api/telegram/webhook", { data: { message: { chat: { id: 1, type: "private" }, text: "/start" } } });
  expect(res.status()).toBe(403);
  const wrong = await request.post("/api/telegram/webhook", {
    headers: { "x-telegram-bot-api-secret-token": "wrong-secret-value-123" },
    data: {},
  });
  expect(wrong.status()).toBe(403);
});
