import { expect, test, type Page } from "@playwright/test";

/** Russian storefront: routing, language switch, localized content, full order in Russian. */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

test.describe.configure({ mode: "serial" });

let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});
test.afterAll(async () => {
  await page.close();
});

let orderNumber = "";

test("routing: /ru is Russian, /uz redirects to clean Uzbek URLs, hreflang is set", async () => {
  const res = await page.request.get("/uz/katalog", { maxRedirects: 0 });
  expect(res.status()).toBe(308);
  expect(res.headers()["location"]).toMatch(/\/katalog$/);

  await page.goto("/ru");
  await expect(page.locator("html")).toHaveAttribute("lang", "ru");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Создавайте незабываемые моменты с цветами.");
  await expect(page.getByRole("navigation", { name: "Категории" }).getByRole("link", { name: "Розы" })).toHaveAttribute("href", "/ru/katalog/atirgullar");
  await expect(page.getByText(/от 85\s000\sсум/).first()).toBeVisible();

  await page.goto("/gul/qizil-atirgullar-guldastasi");
  await expect(page.locator("html")).toHaveAttribute("lang", "uz");
  await expect(page.locator('link[rel="alternate"][hreflang="ru"]')).toHaveAttribute("href", /\/ru\/gul\/qizil-atirgullar-guldastasi$/);
  const sitemap = await (await page.request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/ru/gul/qizil-atirgullar-guldastasi");
});

test("language switch keeps the page and query", async () => {
  await page.evaluate(() => localStorage.clear());
  await page.goto("/katalog/atirgullar?saralash=price_asc");
  await page.getByRole("link", { name: "Русская версия" }).click();
  await expect(page).toHaveURL(/\/ru\/katalog\/atirgullar\?saralash=price_asc$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Розы");
  await expect(page.locator("#f-sort")).toHaveValue("price_asc");
  await page.getByRole("link", { name: "O‘zbekcha versiya" }).click();
  await expect(page).toHaveURL(/\/katalog\/atirgullar\?saralash=price_asc$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Atirgullar");
});

test("search works with Russian words and Cyrillic", async () => {
  await page.goto("/ru/katalog?q=тюльпан");
  const names = await page.locator("article h3").allTextContents();
  expect(names.length).toBeGreaterThan(2);
  for (const n of names) expect(n.toLowerCase()).toContain("тюльпан");
  await page.goto("/ru/katalog?q=Тюльпаны");
  expect(await page.locator("article h3").count()).toBeGreaterThan(0);
});

test("product page and configurator in Russian", async () => {
  await page.goto("/ru/gul/atirgullar-donalab");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Розы — количество на ваш выбор");
  const total = page.locator("p.font-display").filter({ hasText: "сум" }).first();
  await expect(total).toHaveText(/187\s000\sсум/);
  await page.getByText("Розовый", { exact: true }).click();
  await page.getByLabel("Открытка").check();
  await expect(total).toHaveText(/202\s000\sсум/);
  await expect(page.getByText("только нечётное количество")).toBeVisible();
  await page.getByRole("button", { name: "В корзину" }).click();
  await expect(page.getByText("Добавлено в корзину")).toBeVisible();
});

test("cart and checkout in Russian, with Russian validation messages", async () => {
  await page.goto("/ru/savat");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Корзина");
  await expect(page.getByText("Розовый")).toBeVisible(); // colour label translated
  await expect(page.getByText("+ Открытка")).toBeVisible();
  await page.getByLabel("Зона доставки").selectOption({ index: 1 });
  await expect(page.locator("dd.font-display")).toHaveText(/232\s000\sсум/); // 202 000 + 30 000
  await page.getByRole("link", { name: "Оформить заказ" }).click();
  await expect(page).toHaveURL(/\/ru\/buyurtma$/);

  await page.getByRole("button", { name: "Завтра" }).click();
  await page.locator("label").filter({ hasText: "12:00 – 15:00" }).click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: /Подтвердить заказ/ }).click();
  await expect(page.getByText("Введите ваше имя")).toBeVisible();

  await page.getByLabel("Ваше имя *").fill("Тест Покупатель");
  await page.getByLabel("Ваш телефон *").fill("901112233");
  await page.getByLabel("Цветы получу я сам(а)").check();
  await page.getByLabel("Улица, дом *").fill("ул. Амира Темура, 15");
  await page.locator("label").filter({ hasText: "12:00 – 15:00" }).click();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await expect(page.getByText("Проверьте:")).toBeVisible();
  await page.getByRole("button", { name: /Подтвердить заказ/ }).click();

  await expect(page.getByRole("heading", { name: "Заказ принят!" })).toBeVisible();
  expect(page.url()).toContain("/ru/buyurtma/");
  orderNumber = decodeURIComponent(new URL(page.url()).pathname.split("/").pop()!);
  await expect(page.getByText("Статус: Новый")).toBeVisible();
  await expect(page.getByText("Заказ принят").last()).toBeVisible(); // timeline event in Russian
  await expect(page.getByText(/Розы — количество на ваш выбор × 1/)).toBeVisible(); // item name in Russian
});

test("admin sees the order in Uzbek with the customer's language", async () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD || !orderNumber, "admin credentials or order missing");
  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Parol").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("heading", { name: /Salom/ })).toBeVisible();
  await page.goto(`/admin/buyurtmalar?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByText("Mijoz tili: rus tili")).toBeVisible();
  await expect(page.getByText("Atirgullar — sonini o‘zingiz tanlang")).toBeVisible(); // stored in Uzbek
});
