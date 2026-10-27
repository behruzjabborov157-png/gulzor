import { expect, test } from "@playwright/test";

const PAGES = ["/", "/katalog", "/katalog/atirgullar", "/gul/qizil-atirgullar-guldastasi", "/savat", "/buyurtma", "/yetkazib-berish", "/maxsus-guldasta", "/kuzatish", "/hisob"];

test("no horizontal overflow on phone-width pages", async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("mobile menu opens, closes with Escape and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Menyuni ochish" }).click();
  const dialog = page.getByRole("dialog", { name: "Menyu" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.getByRole("button", { name: "Menyuni ochish" }).click();
  await dialog.getByRole("link", { name: "Qutidagi gullar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Qutidagi gullar");
});

test("filters are collapsed on mobile and expand on tap", async ({ page }) => {
  await page.goto("/katalog");
  const summary = page.getByText("Filtrlar", { exact: false }).first();
  await expect(page.getByLabel("Gul turi")).toBeHidden();
  await summary.click();
  await expect(page.getByLabel("Gul turi")).toBeVisible();
});
