import { expect, test } from "@playwright/test";

test("English pages: language, navigation, translated catalog and hreflang", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "All flowers" }).first()).toBeVisible();
  await expect(page.locator('link[rel="alternate"][hreflang="en"]').first()).toHaveAttribute("href", /\/en$/);

  await page.goto("/en/katalog");
  await expect(page.getByRole("heading", { level: 1, name: "All flowers and bouquets" })).toBeVisible();
  await expect(page.getByText("Red rose bouquet").first()).toBeVisible();
  await expect(page.getByText(/\d\s+UZS/).first()).toBeVisible();

  // Internal links stay in English.
  await page.getByText("Red rose bouquet").first().click();
  await expect(page).toHaveURL(/\/en\/gul\//);
  await expect(page.getByRole("heading", { level: 1, name: "Red rose bouquet" })).toBeVisible();
});

test("language menu keeps the page and offers all three languages", async ({ page }) => {
  await page.goto("/katalog?q=atirgul");
  await page.getByRole("button", { name: /— Til: / }).click();
  await expect(page.getByRole("link", { name: "Русский" })).toBeVisible();
  await page.getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/katalog\?q=atirgul$/);
  await page.getByRole("button", { name: /— Language: / }).click();
  await page.getByRole("link", { name: "O‘zbekcha" }).click();
  await expect(page).toHaveURL(/\/katalog\?q=atirgul$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
});

test("search finds a product by its English name, and legal pages are in English", async ({ page }) => {
  await page.goto("/en/katalog?q=tulips");
  await expect(page.getByText(/tulips/i).first()).toBeVisible();
  await page.goto("/en/oferta");
  await expect(page.getByRole("heading", { level: 1, name: "Terms of sale" })).toBeVisible();
  await page.goto("/en/maxfiylik");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
});
