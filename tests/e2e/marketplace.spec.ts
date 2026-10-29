import { expect, test } from "@playwright/test";

/** Marketplace storefront: shop pages, shop on products, shop filter, one shop per cart. */

test("shops list and shop page show the verified shop, its delivery zones and products", async ({ page }) => {
  await page.goto("/dokonlar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Do‘konlar");
  const card = page.getByRole("link", { name: /Gulzor/ }).filter({ hasText: "Tekshirilgan do‘kon" });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page).toHaveURL(/\/dokon\/gulzor$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gulzor");
  await expect(page.getByRole("heading", { name: "Yetkazib berish hududlari" })).toBeVisible();
  expect(await page.locator("article").count()).toBeGreaterThan(3);

  await page.goto("/ru/dokonlar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Магазины");
  expect((await page.request.get("/dokon/mavjud-emas")).status()).toBe(404);
});

test("product page names the shop; catalog can be filtered by shop", async ({ page }) => {
  await page.goto("/gul/qizil-atirgullar-guldastasi");
  await expect(page.getByText("Do‘kon:")).toBeVisible();
  await expect(page.locator("main").getByRole("link", { name: "Gulzor", exact: true }).first()).toHaveAttribute("href", "/dokon/gulzor");

  await page.goto("/katalog?dokon=gulzor");
  await expect(page.getByText("Do‘kon: Gulzor")).toBeVisible(); // active filter chip
  expect(await page.locator("article").count()).toBeGreaterThan(0);
  await page.goto("/katalog?dokon=mavjud-emas");
  await expect(page.locator("article")).toHaveCount(0); // unknown shop shows nothing, not everything
});

test("adding another shop's product asks before replacing the cart", async ({ page }) => {
  await page.goto("/");
  // A cart that already holds another shop's bouquet.
  await page.evaluate(() =>
    localStorage.setItem(
      "gulzor.cart.v1",
      JSON.stringify([
        { key: "x", productId: 999999, slug: "boshqa", name: "Boshqa guldasta", image: null, variantId: null, variantName: null, stems: null, color: null, addons: [], quantity: 1, unitPrice: 100000, floristId: 999999, floristName: "Boshqa do‘kon" },
      ]),
    ),
  );
  await page.goto("/katalog");
  await page.getByRole("button", { name: /— savatga qo‘shish$/ }).first().click();
  const dialog = page.getByRole("dialog", { name: "Boshqa do‘kon mahsuloti" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/«Boshqa do‘kon» do‘konining/)).toBeVisible();

  // "Keep" leaves the cart untouched.
  await dialog.getByRole("button", { name: "Savatni saqlash" }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("gulzor.cart.v1") ?? "[]").length)).toBe(1);

  // "Replace" empties it and adds the new bouquet.
  await page.getByRole("button", { name: /— savatga qo‘shish$/ }).first().click();
  await page.getByRole("dialog", { name: "Boshqa do‘kon mahsuloti" }).getByRole("button", { name: "Savatni tozalab, shuni qo‘shish" }).click();
  await expect(page.getByRole("dialog", { name: "Savatga qo‘shildi" })).toBeVisible();
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("gulzor.cart.v1") ?? "[]") as { floristId: number; floristName: string }[]);
  expect(cart).toHaveLength(1);
  expect(cart[0].floristName).toBe("Gulzor");

  // The cart page names the shop the order goes to.
  await page.goto("/savat");
  await expect(page.locator("main").getByRole("link", { name: "Gulzor", exact: true })).toBeVisible();
});
