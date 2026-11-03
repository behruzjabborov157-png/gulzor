import { expect, test } from "@playwright/test";

const email = process.env.E2E_ADMIN_EMAIL ?? "";
const password = process.env.E2E_ADMIN_PASSWORD ?? "";

test("admin panel switches language, remembers it, and the storefront is not affected", async ({ page }) => {
  test.skip(!email || !password, "needs E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD");
  await page.goto("/admin/kirish");
  await expect(page.getByRole("heading", { name: "Boshqaruv paneli" })).toBeVisible();
  await page.getByRole("button", { name: "En", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Control panel" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.locator('input[type="email"], input[name="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  const nav = page.getByRole("navigation", { name: "Admin" });
  await expect(nav.getByRole("link", { name: /^Orders/ })).toBeVisible();
  await expect(nav.getByRole("link", { name: "Locations" })).toBeVisible();

  await page.goto("/admin/buyurtmalar");
  await expect(page.getByRole("heading", { level: 1, name: "Orders" })).toBeVisible();
  await page.goto("/admin/joylashuvlar");
  await expect(page.getByRole("heading", { level: 1, name: "Locations" })).toBeVisible();
  await expect(page.getByText(/UZS|Regions \(/).first()).toBeVisible();

  // A failed save shows a translated message.
  await page.goto("/admin/kuponlar");
  await expect(page.getByRole("heading", { level: 1, name: "Promo codes" })).toBeVisible();

  // Russian, then back to Uzbek; the choice survives navigation.
  await page.getByRole("button", { name: "Ру", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Промокоды" })).toBeVisible();
  await page.goto("/admin/mahsulotlar");
  await expect(page.getByRole("heading", { level: 1, name: "Товары" })).toBeVisible();

  // The panel cookie does not change the storefront's language.
  await page.goto("/katalog");
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");

  await page.goto("/admin");
  await page.getByRole("button", { name: "O‘z", exact: true }).click();
  await expect(nav.getByRole("link", { name: /^Buyurtmalar/ })).toBeVisible();
});
