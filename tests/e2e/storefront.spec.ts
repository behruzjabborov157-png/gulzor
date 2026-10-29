import { expect, test } from "@playwright/test";

/** Gulzor 2.0 storefront: quick add + cart drawer, scroll reveals, reduced motion. */

test("quick add from a product card opens the cart drawer; Esc closes it and the bag count updates", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/katalog");
  const quickAdd = page.getByRole("button", { name: /— savatga qo‘shish$/ }).first();
  const label = (await quickAdd.getAttribute("aria-label")) ?? "";
  const name = label.replace(/ — savatga qo‘shish$/, "");
  await quickAdd.click();

  const drawer = page.getByRole("dialog", { name: "Savatga qo‘shildi" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByText(name, { exact: true })).toBeVisible();
  await expect(drawer.getByText("Savatda: 1 ta mahsulot")).toBeVisible();
  await expect(page.getByRole("link", { name: /Savat, 1 ta mahsulot/ })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();

  // "Go to cart" from the drawer lands on the cart with the item.
  await quickAdd.click();
  await expect(drawer.getByText("Savatda: 2 ta mahsulot")).toBeVisible();
  await drawer.getByRole("link", { name: "Savatga o‘tish" }).click();
  await expect(page).toHaveURL(/\/savat$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Savat");
  await expect(page.getByText(name).first()).toBeVisible();
});

test("sections reveal on scroll, and stay visible with reduced motion", async ({ browser }) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    const context = await browser.newContext({ reducedMotion });
    const page = await context.newPage();
    await page.goto("/");
    const faq = page.getByRole("heading", { name: "Ko‘p beriladigan savollar" });
    await faq.scrollIntoViewIfNeeded();
    await expect(faq).toBeVisible();
    await expect.poll(() => faq.evaluate((el) => Number(getComputedStyle(el.closest("[data-reveal]") ?? el).opacity))).toBe(1);
    await context.close();
  }
});

test("homepage images all load (no broken images)", async ({ page }) => {
  await page.goto("/");
  // Bring lazy images into view.
  for (let y = 0; y < 20000; y += 700) {
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    await page.waitForTimeout(40);
  }
  await page.waitForLoadState("networkidle");
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src),
  );
  expect(broken).toEqual([]);
});
