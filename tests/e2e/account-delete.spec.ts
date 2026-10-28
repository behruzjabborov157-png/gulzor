import { expect, test } from "@playwright/test";

/** Self-service account deletion (required by Google Play for apps with accounts). */

test("public deletion page explains the steps to signed-out visitors", async ({ page }) => {
  await page.goto("/hisobni-ochirish");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hisobni o‘chirish");
  await expect(page.getByRole("heading", { name: "Qanday o‘chiriladi" })).toBeVisible();
  await page.getByRole("link", { name: "Hisobga kirish" }).click();
  await expect(page).toHaveURL(/\/hisob\?next=%2Fhisobni-ochirish$/);

  await page.goto("/ru/hisobni-ochirish");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Удаление аккаунта");
});

test("customer deletes their account; the password is checked and the account is gone", async ({ page }) => {
  const phone = `93${String(Date.now()).slice(-7)}`;
  const password = "parol-12345";
  await page.goto("/hisob?next=%2Fhisobni-ochirish");
  await page.getByRole("tab", { name: "Ro‘yxatdan o‘tish" }).click();
  await page.locator("#r-name").fill("O‘chirish Testi");
  await page.locator("#r-phone").fill(phone);
  await page.locator("#r-pass").fill(password);
  await page.getByRole("button", { name: "Hisob yaratish" }).click();
  await expect(page).toHaveURL(/\/hisobni-ochirish$/);
  await expect(page.getByText(/Hisob: O‘chirish Testi/)).toBeVisible();

  // Wrong password → refused, account still there.
  await page.getByLabel("Joriy parol").fill("noto-g-ri-parol");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Hisobni butunlay o‘chirish" }).click();
  await expect(page.getByText("Parol noto‘g‘ri")).toBeVisible();

  await page.getByLabel("Joriy parol").fill(password);
  await page.getByRole("button", { name: "Hisobni butunlay o‘chirish" }).click();
  await expect(page.getByRole("heading", { name: "Hisobingiz o‘chirildi" })).toBeVisible();

  // Signed out, and the same credentials no longer work.
  await page.goto("/hisob");
  await page.locator("#l-phone").fill(phone);
  await page.locator("#l-pass").fill(password);
  await page.getByRole("button", { name: "Kirish", exact: true }).click();
  await expect(page.getByText("Telefon raqami yoki parol noto‘g‘ri")).toBeVisible();
});
