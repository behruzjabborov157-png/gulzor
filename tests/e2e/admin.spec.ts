import path from "node:path";
import { expect, test } from "@playwright/test";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const PHOTO = path.resolve("public/images/demo/eustoma-white.webp");

test("SEO and security endpoints", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /admin");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/gul/qizil-atirgullar-guldastasi");
  const home = await request.get("/");
  expect(home.headers()["x-content-type-options"]).toBe("nosniff");
  expect(await home.text()).toContain("<title>Gulzor — Toshkentda gul yetkazib berish");
  // Demo products must not publish structured product data.
  expect(await (await request.get("/gul/qizil-atirgullar-guldastasi")).text()).not.toContain("application/ld+json");
  // Payment callbacks reject unauthenticated calls.
  const payme = await request.post("/api/payments/payme", { data: { id: 1, method: "CheckPerformTransaction", params: {} } });
  expect((await payme.json()).error.code).toBe(-32504);
  const click = await request.post("/api/payments/click/prepare", { form: { action: "0" } });
  expect((await click.json()).error).toBeLessThan(0);
  // Health endpoint for uptime monitoring.
  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect((await health.json()).db).toBe("ok");
  // Admin-only routes.
  expect((await request.get("/admin/import/eksport")).status()).toBe(404);
  expect((await request.get("/media/requests/x.webp")).status()).toBe(404);
});

test("custom bouquet request with inspiration photo", async ({ page }) => {
  await page.goto("/maxsus-guldasta");
  await page.getByRole("button", { name: "So‘rov yuborish" }).click();
  await expect(page.getByText("Ismingizni kiriting")).toBeVisible();
  await page.getByLabel("Ismingiz *").fill("Test So‘rov");
  await page.getByLabel("Telefon *").fill("+998 90 000 00 01");
  await page.getByLabel("Qanday guldasta xohlaysiz? *").fill("Oq va pushti eustomalardan kichik guldasta, test so‘rovi.");
  await page.getByLabel("Namunaviy rasm (ixtiyoriy)").setInputFiles(PHOTO);
  await page.getByRole("button", { name: "So‘rov yuborish" }).click();
  await expect(page.getByText("So‘rovingiz qabul qilindi")).toBeVisible();
});

test("admin pages render and product form saves with image upload", async ({ page }) => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "admin credentials missing");
  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Parol").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("heading", { name: /Salom/ })).toBeVisible();

  for (const [url, heading] of [
    ["/admin?davr=7", /Salom/],
    ["/admin/buyurtmalar", "Buyurtmalar"],
    ["/admin/mahsulotlar", "Mahsulotlar"],
    ["/admin/kategoriyalar", "Kategoriyalar"],
    ["/admin/yetkazib-berish", "Yetkazib berish"],
    ["/admin/kuponlar", "Promokodlar"],
    ["/admin/sorovlar", "Maxsus guldasta so‘rovlari"],
    ["/admin/import", "Import / eksport"],
    ["/admin/sozlamalar", "Sozlamalar"],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }

  // The private inspiration image is visible to the admin.
  await page.goto("/admin/sorovlar");
  const img = page.getByAltText("Mijoz yuborgan namunaviy rasm").first();
  await expect(img).toBeVisible();
  expect(await img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

  // Create a draft product with an uploaded photo.
  await page.goto("/admin/mahsulotlar/yangi");
  const runId = Date.now().toString(36);
  await page.getByLabel("Nomi (o‘zbekcha) *").fill(`E2E test guldasta ${runId}`);
  await page.getByLabel("Narx, so‘m *").fill("123000");
  await page.getByLabel("Yangi rasmlar qo‘shish").setInputFiles(PHOTO);
  await page.locator("label").filter({ hasText: /^Eustoma$/ }).click();
  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("Mahsulot yaratildi.")).toBeVisible();
  const uploaded = page.locator('img[src*="media%2Fproducts"], img[src*="/media/products/"]').first();
  await expect(uploaded).toBeVisible();

  // Edit: switch to size variants and save.
  await page.getByText("O‘lchamlar (Kichik/O‘rtacha/Katta)").click();
  const prices = page.getByLabel("Narx", { exact: true });
  await prices.nth(0).fill("150000");
  await prices.nth(1).fill("250000");
  await prices.nth(2).fill("400000");
  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("Saqlandi").first()).toBeVisible();

  // Archive it again so it never appears in the shop.
  await page.getByLabel("Holat").selectOption("archived");
  await page.getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByText("Saqlandi").first()).toBeVisible();

  // CSV export downloads.
  const csv = await page.request.get("/admin/import/eksport");
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain(`e2e-test-guldasta-${runId}`);
});

test("unknown product shows the 404 page; phone fields format as you type", async ({ page }) => {
  const res = await page.goto("/gul/bunday-mahsulot-yoq");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Sahifa topilmadi" })).toBeVisible();

  await page.goto("/kuzatish");
  await page.getByLabel("Telefon raqami").pressSequentially("901234567");
  await expect(page.getByLabel("Telefon raqami")).toHaveValue("+998 90 123 45 67");
});

test("pages are served with a nonce-based Content-Security-Policy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  const res = await page.goto("/gul/qizil-atirgullar-guldastasi");
  const csp = res?.headers()["content-security-policy"] ?? "";
  expect(csp).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  // Interactive parts still work under the policy.
  await page.getByText("Kichik", { exact: true }).click();
  await page.getByRole("button", { name: "Savatga qo‘shish" }).click();
  await expect(page.getByText("Savatga qo‘shildi")).toBeVisible();
  expect(violations).toEqual([]);
});
