import path from "node:path";
import { expect, test } from "@playwright/test";

/** Florist onboarding and panel: application, pending state, own zones and products, no access to admin. */

const PHOTO = path.resolve("public/images/demo/tulips-mix.webp");
test.describe.configure({ mode: "serial" });

test("florist panel is closed to visitors", async ({ page }) => {
  await page.goto("/florist");
  await expect(page).toHaveURL(/\/admin\/kirish$/);
  const res = await page.request.get("/florist/royxatdan-otish");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
});

test("a shop applies, prepares zones and products while pending, and stays invisible until approved", async ({ page }) => {
  const run = Date.now().toString(36);
  const shopName = `E2E gullari ${run}`;

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
  await page.getByLabel("Email (kirish uchun) *").fill(`florist-${run}@example.uz`);
  await page.getByLabel("Parol *").fill("florist-parol-12345");
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
