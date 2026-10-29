import path from "node:path";
import { expect, test } from "@playwright/test";

/** Florist onboarding and panel: application, pending state, own zones and products, no access to admin. */

const PHOTO = path.resolve("public/images/demo/tulips-mix.webp");
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
test.describe.configure({ mode: "serial" });

// Shared by the serial tests below: the shop created in the application test.
const run = Date.now().toString(36);
const shopName = `E2E gullari ${run}`;
const floristEmail = `florist-${run}@example.uz`;
const floristPassword = "florist-parol-12345";

test("florist panel is closed to visitors", async ({ page }) => {
  await page.goto("/florist");
  await expect(page).toHaveURL(/\/admin\/kirish$/);
  const res = await page.request.get("/florist/royxatdan-otish");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("a shop applies, prepares zones and products while pending, and stays invisible until approved", async ({ page }) => {
  // Application with validation errors first.
  await page.goto("/florist/royxatdan-otish");
  await page.getByLabel("Do‘kon nomi *").fill(shopName);
  await page.getByLabel("STIR (INN) *").fill("123");
  await page.getByRole("button", { name: "Ariza yuborish" }).click();
  await expect(page.getByText("STIR 9 ta raqamdan iborat")).toBeVisible();
  await expect(page.getByText("Shartlarga rozilik kerak")).toBeVisible();

  await page.getByLabel("Do‘kon manzili *").fill("Chilonzor 9-kvartal, 12-uy");
  await page.getByLabel("Yuridik nom *").fill("YaTT Test Floristov");
  await page.getByLabel("STIR (INN) *").fill("123456789");
  await page.getByLabel("Ismingiz *").fill("Test Florist");
  await page.getByLabel("Telefon *").fill("90 765 43 21");
  await page.getByLabel("Email (kirish uchun) *").fill(floristEmail);
  await page.getByLabel("Parol *").fill(floristPassword);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Ariza yuborish" }).click();

  // Signed in to the florist panel, pending.
  await expect(page).toHaveURL(/\/florist\?yangi=1$/);
  await expect(page.getByRole("heading", { name: "Salom, Test!" })).toBeVisible();
  await expect(page.getByText("Arizangiz Gulzor tomonidan ko‘rib chiqilmoqda")).toBeVisible();

  // A florist account cannot open the admin area.
  await page.goto("/admin/buyurtmalar");
  await expect(page).toHaveURL(/\/florist$/);

  // Own delivery zone.
  await page.goto("/florist/hududlar");
  const newZone = page.getByRole("region", { name: "Yangi hudud" });
  await newZone.getByLabel("Hudud nomi *").fill("Chilonzor");
  await newZone.getByLabel("Yetkazish narxi, so‘m *").fill("25000");
  await newZone.getByRole("button", { name: "Qo‘shish" }).click();
  await expect(newZone.getByText("Saqlandi")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "Chilonzor" })).toBeVisible();

  // Own product with a photo; curation flags are not offered.
  await page.goto("/florist/mahsulotlar/yangi");
  await expect(page.getByText("Namuna (demo) mahsulot")).toHaveCount(0);
  await page.getByLabel("Nomi (o‘zbekcha) *").fill(`E2E lolalar ${run}`);
  await page.getByLabel("Narx, so‘m *").fill("175000");
  await page.getByLabel("Holat").selectOption("active");
  await page.getByLabel("Yangi rasmlar qo‘shish").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("Mahsulot saqlandi.")).toBeVisible();
  await page.goto("/florist/mahsulotlar");
  await expect(page.getByRole("link", { name: `E2E lolalar ${run}` })).toBeVisible();

  // Dashboard checklist reflects the progress.
  await page.goto("/florist");
  await expect(page.getByText("Yetkazib berish hududlari va narxlarini kiriting")).toHaveClass(/line-through/);

  // Still pending: nothing of this shop is on the storefront.
  await page.goto("/dokonlar");
  await expect(page.getByText(shopName)).toHaveCount(0);
  expect((await page.request.get(`/gul/e2e-lolalar-${run}`)).status()).toBe(404); // active, but its shop is not approved yet

  // Sign out.
  await page.goto("/florist");
  await page.getByRole("button", { name: "Chiqish" }).click();
  await expect(page).toHaveURL(/\/admin\/kirish$/);
});

test("the owner approves the shop and sets its commission; the shop goes live and the log records it", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "admin credentials missing");
  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Parol").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("heading", { name: /Salom/ })).toBeVisible();
  await expect(page.getByText(/ta yangi do‘kon arizasi/)).toBeVisible();

  await page.goto("/admin/floristlar?holat=pending");
  await page.getByRole("link", { name: shopName }).click();
  await expect(page.getByRole("heading", { name: shopName })).toBeVisible();
  await expect(page.getByText("123456789")).toBeVisible(); // STIR to verify
  await expect(page.getByText("Do‘kon arizasi yuborildi")).toBeVisible(); // audit entry from the application

  await page.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(page.locator(".badge", { hasText: "Tasdiqlangan" })).toBeVisible();
  await expect(page.getByRole("button", { name: "To‘xtatish" })).toBeVisible();

  const commission = page.getByRole("region", { name: "Komissiya" });
  await commission.getByLabel("Komissiya, %").fill("12");
  await commission.getByRole("button", { name: "Saqlash" }).click();
  await expect(commission.getByText(/Saqlandi/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Komissiya: 10% → 12%")).toBeVisible();
  await expect(page.getByText("Do‘kon tasdiqlandi", { exact: false })).toBeVisible();

  await page.goto("/admin/jurnal?tur=florist");
  await expect(page.getByRole("link", { name: "Komissiya: 10% → 12%" }).first()).toBeVisible();

  // Live on the storefront now, with its active product.
  await page.goto("/dokonlar");
  await expect(page.getByText(shopName)).toBeVisible();
  await page.getByText(shopName).click();
  await expect(page.getByText("Sotuvchi: YaTT Test Floristov")).toBeVisible(); // seller identity; the tax id stays private
  await expect(page.getByText("123456789")).toHaveCount(0);
  expect((await page.request.get(`/gul/e2e-lolalar-${run}`)).status()).toBe(200);
});

test("after approval the florist sees no pending banner and the new commission", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "admin credentials missing");
  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(floristEmail);
  await page.getByLabel("Parol").fill(floristPassword);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page).toHaveURL(/\/florist$/);
  await expect(page.getByText("Arizangiz Gulzor tomonidan ko‘rib chiqilmoqda")).toHaveCount(0);
  await page.goto("/florist/profil");
  await expect(page.getByText("Komissiya: 12%")).toBeVisible();

  // Order notifications: a one-time Telegram deep link to the shop bot (the E2E server sets TELEGRAM_SHOP_BOT_USERNAME).
  const notify = page.getByRole("region", { name: "Bildirishnomalar" });
  await expect(notify.getByRole("link", { name: "Telegram’ni ulash" })).toHaveAttribute("href", /^https:\/\/t\.me\/\w+\?start=fl_[\w-]+$/);

  // Report: commission statements section (none issued yet for a new shop).
  await page.goto("/florist/hisobot");
  await expect(page.getByRole("heading", { name: "Komissiya hisoblari" })).toBeVisible();
  await expect(page.getByText("Hali hisob chiqarilmagan.")).toBeVisible();
});

test("the owner issues monthly commission statements", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "admin credentials missing");
  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Parol").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("heading", { name: /Salom/ })).toBeVisible();
  await page.goto("/admin/komissiya");
  await expect(page.getByRole("heading", { name: "Komissiya", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Hisob chiqarish" }).click();
  await expect(page.getByText(/ta do‘konga hisob chiqarildi|Hisoblanadigan yangi buyurtma yo‘q/)).toBeVisible();
});
