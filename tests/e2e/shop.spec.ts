import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Full customer journey + admin verification.
 * Requires a seeded database (npm run setup) and an admin user (E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD).
 */

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

async function clearStorage(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
}

const digits = (s: string) => Number(s.replace(/\D/g, ""));

/** The catalog's "N ta mahsulot" line once rendered — not the hidden cart drawer's "Savatda: N ta mahsulot". */
async function resultCount(p: Page) {
  const el = p.locator("main").getByText(/^\d+ ta mahsulot$/).first();
  await el.waitFor();
  return el.textContent();
}

test.describe.configure({ mode: "serial" });

let page: Page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
});
test.afterAll(async () => {
  await page.close();
});

let orderNumber = "";
let orderUrl = "";

test("homepage renders hero, sections and working navigation", async () => {
  await clearStorage(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Gullar so‘zdan ko‘ra ko‘proq aytadi.");
  await expect(page.getByText(/Biz uni siz tanlagan kun va vaqtga yetkazamiz/).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Gullarni tanlash" })).toBeVisible();
  await expect(page.getByText("Eng ko‘p buyurtma qilinganlar").first()).toBeVisible();
  await expect(page.getByText("Qayerga yetkazamiz?")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ko‘p beriladigan savollar" })).toBeVisible();
  // FAQ answers come from real settings: the payment answer lists only enabled methods.
  await page.getByText("Qanday to‘lash mumkin?").click();
  await expect(page.getByText(/Hozir mavjud usullar: .*Naqd/)).toBeVisible();

  // Every header category link resolves to a real page.
  const nav = page.getByRole("navigation", { name: "Kategoriyalar" });
  const hrefs = await nav.getByRole("link").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
  for (const href of hrefs) {
    const res = await page.request.get(href!);
    expect(res.status(), href!).toBe(200);
  }
  await nav.getByRole("link", { name: "Lolalar" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lolalar");
});

test("search and price filter narrow the catalog", async () => {
  await page.goto("/katalog?q=lola");
  const countText = await resultCount(page);
  const all = digits(countText!);
  expect(all).toBeGreaterThan(2);
  for (const name of await page.locator("article h3").allTextContents()) expect(name.toLowerCase()).toContain("lola");

  await page.getByLabel("Maksimal narx").fill("200000");
  await page.getByRole("button", { name: "Qo‘llash" }).click();
  await expect(page).toHaveURL(/narx_max=200000/);
  const filtered = digits((await resultCount(page))!);
  expect(filtered).toBeLessThan(all);
  expect(filtered).toBeGreaterThan(0);

  // Apostrophe-insensitive search ("o'zingiz" matches "o‘zingiz").
  await page.goto("/katalog?q=o'zingiz");
  expect(digits((await resultCount(page))!)).toBeGreaterThan(0);

  // Out-of-season peonies disappear with the availability filter.
  await page.goto("/katalog?gul=pionlar");
  await expect(page.locator("article")).toHaveCount(1);
  await page.goto("/katalog?gul=pionlar&mavjud=1");
  await expect(page.getByText("Hech narsa topilmadi")).toBeVisible();
});

test("unavailable product cannot be added and shows alternatives", async () => {
  await page.goto("/gul/gortenziya-monobuket");
  await expect(page.getByText("Hozircha mavjud emas").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Savatga qo‘shish", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "O‘xshash guldastalar" })).toBeVisible();
});

test("customize a bouquet: price updates with stems and add-ons, then add to cart", async () => {
  await clearStorage(page);
  await page.goto("/gul/atirgullar-donalab");
  const total = page.locator("p.font-display").filter({ hasText: "so‘m" }).first();
  await expect(total).toHaveText(/187\s000/); // default 11 stems × 17 000
  await page.getByRole("button", { name: "Ko‘paytirish" }).first().click(); // 13 stems
  await expect(total).toHaveText(/221\s000/);
  await page.getByText("Pushti", { exact: true }).click();
  await page.getByLabel("Otkritka").check();
  await expect(total).toHaveText(/236\s000/); // + 15 000 card
  await page.getByRole("button", { name: "Savatga qo‘shish", exact: true }).click();
  await expect(page.getByText("Savatga qo‘shildi")).toBeVisible();

  // A second, size-based bouquet.
  await page.goto("/gul/qizil-atirgullar-guldastasi");
  await page.getByText("Kichik", { exact: true }).click();
  await page.getByRole("button", { name: "Savatga qo‘shish", exact: true }).click();
  await expect(page.getByRole("link", { name: /Savat, 2 ta mahsulot/ })).toBeVisible();
});

test("cart: change quantity, coupon and delivery fee are recalculated by the server", async () => {
  await page.goto("/savat");
  await expect(page.getByText("Atirgullar — sonini o‘zingiz tanlang")).toBeVisible();
  const totalEl = page.locator("dd.font-display");
  await expect(totalEl).toHaveText(/465\s000/); // 236 000 + 229 000

  await page.getByRole("button", { name: /Qizil atirgullar guldastasi: ko‘paytirish/ }).click();
  await expect(totalEl).toHaveText(/694\s000/);

  await page.getByLabel("Yetkazib berish hududi").selectOption({ label: "Toshkent shahri, Markaziy tumanlar — 30 000 so‘m" });
  await expect(totalEl).toHaveText(/724\s000/);

  await page.getByLabel("Promokod").fill("demo10");
  await page.getByRole("button", { name: "Qo‘llash" }).click();
  await expect(page.getByText(/Chegirma: 69\s400/)).toBeVisible();
  // 694 000 − 69 400 = 624 600 (< 700 000 free threshold) + 30 000 delivery
  await expect(totalEl).toHaveText(/654\s600/);

  await page.getByRole("button", { name: /Qizil atirgullar guldastasi: kamaytirish/ }).click();
  await expect(totalEl).toHaveText(/448\s500/); // 465 000 − 46 500 + 30 000
});

test("checkout validates input, then creates the order", async () => {
  await page.goto("/buyurtma");
  await expect(page.getByRole("heading", { name: "Buyurtmani rasmiylashtirish" })).toBeVisible();

  await page.getByRole("button", { name: "Ertaga" }).click();
  await page.locator("label").filter({ hasText: "12:00 – 15:00" }).click();
  await page.getByRole("button", { name: "Davom etish" }).click();
  await page.getByRole("button", { name: /Buyurtmani tasdiqlash/ }).click();
  // Server-side validation: required fields are missing.
  await expect(page.getByText("Ismingizni kiriting")).toBeVisible();
  await expect(page.getByText("Telefon raqami noto‘g‘ri (+998 XX XXX XX XX)")).toBeVisible();

  await page.getByLabel("Ismingiz *").fill("Test Mijoz");
  await page.getByLabel("Telefon raqamingiz *").fill("90 123 45 67");
  await page.getByLabel("Qabul qiluvchi ismi *").fill("Malika");
  await page.getByLabel("Qabul qiluvchi telefoni *").fill("+998 (93) 765-43-21");
  await page.getByLabel("Tuman").fill("Mirobod");
  await page.getByLabel("Ko‘cha, uy *").fill("Amir Temur ko‘chasi, 15");
  await page.getByLabel("Mo‘ljal").fill("Test buyurtma — yetkazilmaydi");
  await page.getByLabel("Otkritka uchun matn").fill("Tug‘ilgan kuningiz muborak!");
  await page.locator("label").filter({ hasText: "12:00 – 15:00" }).click();

  await expect(page.locator("dd.font-display")).toHaveText(/448\s500/);
  await page.getByRole("button", { name: "Davom etish" }).click();
  await expect(page.getByText("Tekshiring:")).toBeVisible();
  await page.getByRole("button", { name: /Buyurtmani tasdiqlash/ }).click();

  await expect(page.getByRole("heading", { name: "Buyurtmangiz qabul qilindi!" })).toBeVisible();
  orderUrl = page.url();
  orderNumber = decodeURIComponent(new URL(orderUrl).pathname.split("/").pop()!);
  expect(orderNumber).toMatch(/^GZ-\d{6}-\d{4}$/);
  await expect(page.getByText("448 500 so‘m").last()).toBeVisible();
  await expect(page.getByRole("link", { name: /Savat, 0 ta mahsulot/ })).toBeVisible();

  // Without the secret token the order page is not accessible.
  const res = await page.request.get(`/buyurtma/${orderNumber}`);
  expect(res.status()).toBe(404);
});

test("order tracking lookup by number and phone", async () => {
  test.skip(!orderNumber, "order was not created");
  await page.goto("/kuzatish");
  await page.getByLabel("Buyurtma raqami").fill(orderNumber);
  await page.getByLabel("Telefon raqami").fill("+998 93 765 43 21"); // recipient phone must NOT work
  await page.getByRole("button", { name: "Holatni ko‘rish" }).click();
  await expect(page.getByText("Bunday buyurtma topilmadi")).toBeVisible();
  await page.getByLabel("Telefon raqami").fill("+998901234567");
  await page.getByRole("button", { name: "Holatni ko‘rish" }).click();
  await expect(page.getByText(`Buyurtma raqami: ${orderNumber}`).or(page.getByRole("heading", { name: `Buyurtma ${orderNumber}` }))).toBeVisible();
});

test("admin sees the order, confirms it and the customer timeline updates", async () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD || !orderNumber, "admin credentials or order missing");
  expect((await page.request.get("/admin")).url()).toContain("/admin/kirish");

  await page.goto("/admin/kirish");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Parol").fill("wrong-password");
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByText("Email yoki parol noto‘g‘ri")).toBeVisible();
  await page.getByLabel("Parol").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Kirish" }).click();
  await expect(page.getByRole("heading", { name: /Salom/ })).toBeVisible();

  await page.goto(`/admin/buyurtmalar?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  await expect(page.getByText("Amir Temur ko‘chasi, 15")).toBeVisible();
  await expect(page.getByText("Tug‘ilgan kuningiz muborak!")).toBeVisible();
  await expect(page.getByText(/O‘tkazib yuborildi|Yuborildi|Xato/).first()).toBeVisible(); // Telegram attempt is logged truthfully
  await page.getByRole("button", { name: "Tasdiqlash" }).click();
  await expect(page.getByRole("button", { name: "Tayyorlashni boshlash" })).toBeVisible();

  // Search by phone works too.
  await page.goto("/admin/buyurtmalar?q=901234567");
  await expect(page.getByRole("link", { name: orderNumber })).toBeVisible();

  await page.goto(orderUrl);
  await expect(page.getByRole("region", { name: "Holat" }).getByText("Holat: Tasdiqlandi").first()).toBeVisible();
});

test("admin price change is reflected on the storefront", async () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD, "admin credentials missing");
  // Still signed in from the previous test (shared page).
  await page.goto("/admin/mahsulotlar?q=Oq liliyalar");
  const price = page.getByLabel("Oq liliyalar narxi");
  await price.fill("365000");
  await page.getByRole("row", { name: /Oq liliyalar/ }).getByRole("button", { name: "Saqlash" }).click();
  await expect(price).toHaveValue("365000");
  await page.goto("/gul/oq-liliyalar");
  await expect(page.getByText("365 000 so‘m").first()).toBeVisible();
  // restore
  await page.goto("/admin/mahsulotlar?q=Oq liliyalar");
  await page.getByLabel("Oq liliyalar narxi").fill("359000");
  await page.getByRole("row", { name: /Oq liliyalar/ }).getByRole("button", { name: "Saqlash" }).click();
  await expect(page.getByLabel("Oq liliyalar narxi")).toHaveValue("359000");
});

test("trust: bouquet photo, complaint and decision, then a verified review that appears after moderation", async () => {
  test.skip(!ADMIN_EMAIL || !ADMIN_PASSWORD || !orderNumber, "admin credentials or order missing");
  // Still signed in as admin (shared page). The order was confirmed in the previous test.
  await page.goto(`/admin/buyurtmalar?q=${orderNumber}`);
  await page.getByRole("link", { name: orderNumber }).click();
  await page.waitForURL(/\/admin\/buyurtmalar\/[0-9a-f-]{36}$/);
  const adminOrderUrl = page.url();
  await page.getByLabel("Rasm (JPG, PNG, WEBP, 6 MB gacha)").setInputFiles(path.resolve("public/images/demo/tulips-mix.webp"));
  await page.getByRole("button", { name: "Rasmni yuklash" }).click();
  await expect(page.getByText("Rasm yuklandi")).toBeVisible();

  // The customer sees the photo and reports a problem.
  await page.goto(orderUrl);
  await expect(page.getByRole("heading", { name: "Tayyor guldastangiz" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Tayyor guldasta, 1-rasm" })).toBeVisible();
  await page.getByText("Buyurtmada muammo bormi?").click();
  await page.getByLabel("Sabab").selectOption("late");
  await page.getByLabel("Nima bo‘ldi?").fill("Kuryer belgilangan vaqtdan kechikdi (e2e sinov)");
  await page.getByRole("button", { name: "Murojaat yuborish" }).click();
  // The page refreshes: the form is replaced by the complaint with its status.
  const mine = page.getByRole("region", { name: "Murojaatlaringiz" });
  await expect(mine.getByText("Kuryer belgilangan vaqtdan kechikdi (e2e sinov)")).toBeVisible();
  await expect(mine.getByText(/Ko‘rib chiqilmoqda/)).toBeVisible();
  await expect(page.getByText("Buyurtmada muammo bormi?")).toHaveCount(0); // one open complaint at a time

  // Gulzor decides; the customer sees the decision.
  await page.goto("/admin/murojaatlar");
  const item = page.getByRole("listitem").filter({ hasText: orderNumber });
  await item.getByLabel("Qaror (mijozga ko‘rinadi) *").fill("Do‘kon ogohlantirildi (e2e)");
  await item.getByRole("button", { name: "Qarorni saqlash" }).click();
  await expect(item).toHaveCount(0); // moved from "Ochiq" to "Hal qilingan"
  await page.goto("/admin/murojaatlar?holat=resolved");
  await expect(page.getByRole("listitem").filter({ hasText: orderNumber }).getByText(/Qaror: Do‘kon ogohlantirildi/)).toBeVisible();
  await page.goto(orderUrl);
  await expect(page.getByText("Gulzor qarori: Do‘kon ogohlantirildi (e2e)")).toBeVisible();
  await expect(page.getByText(/Hal qilindi/)).toBeVisible();

  // No review form before delivery; deliver the order.
  await expect(page.getByRole("heading", { name: "Fikringizni qoldiring" })).toHaveCount(0);
  await page.goto(adminOrderUrl);
  for (const step of ["Tayyorlashni boshlash", "Tayyor", "Kuryerga berildi", "Yetkazildi / topshirildi"]) {
    await page.getByRole("button", { name: step, exact: true }).click();
    await expect(page.getByRole("button", { name: step, exact: true })).toHaveCount(0);
  }

  // Review: pending until the admin publishes it.
  await page.goto(orderUrl);
  await page.getByRole("radio", { name: "5 yulduz" }).check({ force: true });
  await page.getByLabel("Izoh (ixtiyoriy)").fill("Juda chiroyli guldasta (e2e sinov)");
  await page.getByRole("button", { name: "Sharh yuborish" }).click();
  await expect(page.getByText(/Sizning bahoyingiz: 5\/5 · Sharhingiz tekshirilmoqda\./)).toBeVisible();
  await page.goto("/dokon/gulzor");
  await expect(page.getByText("Juda chiroyli guldasta (e2e sinov)")).toHaveCount(0);

  await page.goto("/admin/sharhlar");
  const review = page.getByRole("listitem").filter({ hasText: "Juda chiroyli guldasta (e2e sinov)" });
  await review.getByRole("button", { name: "E’lon qilish" }).click();
  await expect(review).toHaveCount(0); // moved to "E’lon qilingan"
  await page.goto("/admin/sharhlar?holat=approved");
  await expect(page.getByText("Juda chiroyli guldasta (e2e sinov)")).toBeVisible();

  await page.goto("/dokon/gulzor");
  await expect(page.getByRole("heading", { name: "Mijozlar sharhlari" })).toBeVisible();
  await expect(page.getByText("Juda chiroyli guldasta (e2e sinov)")).toBeVisible();
  await expect(page.getByText(/Tasdiqlangan xarid/).first()).toBeVisible();

  await page.goto("/admin/tahlil");
  await expect(page.getByRole("heading", { name: "Tahlil" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gulzor" }).first()).toBeVisible();
});
