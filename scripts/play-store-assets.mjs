// Google Play listing graphics, rendered from the live site so fonts and colours match.
//   node scripts/play-store-assets.mjs https://gulzor.uz
// Writes docs/play-store/feature-graphic-{uz,ru}.png (1024×500) and
// docs/play-store/screenshots/{uz,ru}/NN-*.png (1080×1920 phone screenshots).
// Retake the screenshots once real products are in and the demo banner is off.
import fs from "node:fs";
import { chromium } from "@playwright/test";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const out = "docs/play-store";

const TEXT = {
  uz: { tagline: "Guldastalar va gullarni onlayn buyurtma qiling", note: "Kerakli sana va vaqtga yetkazib berish" },
  ru: { tagline: "Букеты и цветы — заказ онлайн", note: "Доставка на удобные дату и время" },
};

const PAGES = [
  ["01-bosh-sahifa", "/"],
  ["02-katalog", "/katalog"],
  ["03-guldasta", "/gul/atirgullar-donalab"],
  ["04-savat", "/savat"],
  ["05-yetkazib-berish", "/yetkazib-berish"],
];

const prefix = (locale, path) => (locale === "ru" ? `/ru${path === "/" ? "" : path}` : path);

async function featureGraphic(browser, locale) {
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
  await page.goto(`${base}${prefix(locale, "/")}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000); // let React finish hydrating before drawing on top
  // Reuse the page's own fonts (next/font); the banner is a full-screen overlay on top of the page.
  await page.evaluate(({ t }) => {
    const banner = document.createElement("div");
    document.body.append(banner);
    banner.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;background:#2b0f1f;display:flex;align-items:center;gap:56px;padding:0 72px;overflow:hidden">
        <img src="/icons/maskable-512.png" alt="" style="width:260px;height:260px;border-radius:56px;flex:none">
        <div style="color:#fbf6ef">
          <div style="font-family:var(--font-cormorant),serif;font-size:112px;line-height:1;font-weight:500">Gulzor<span style="color:#eaa7b4">.</span></div>
          <div style="font-family:var(--font-manrope),sans-serif;font-size:34px;font-weight:600;margin-top:20px;max-width:560px;line-height:1.25">${t.tagline}</div>
          <div style="font-family:var(--font-manrope),sans-serif;font-size:24px;margin-top:14px;color:rgba(251,248,243,.75)">${t.note}</div>
        </div>
        <div style="position:absolute;right:-120px;bottom:-140px;width:420px;height:420px;border-radius:50%;background:rgba(243,220,213,.08)"></div>
      </div>`;
  }, { t: TEXT[locale] });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/feature-graphic-${locale}.png` });
  await page.close();
}

async function screenshots(browser, locale) {
  const dir = `${out}/screenshots/${locale}`;
  fs.mkdirSync(dir, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: locale === "ru" ? "ru-RU" : "uz-UZ",
  });
  const page = await context.newPage();
  for (const [name, path] of PAGES) {
    if (name === "04-savat") {
      // Put one bouquet in the cart first so the cart screenshot is not empty.
      await page.goto(`${base}${prefix(locale, "/gul/atirgullar-donalab")}`);
      await page.getByRole("button", { name: locale === "ru" ? "В корзину" : "Savatga qo‘shish" }).click();
      await page.waitForTimeout(800);
    }
    await page.goto(`${base}${prefix(locale, path)}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500); // entrance animations
    await page.screenshot({ path: `${dir}/${name}.png` });
    console.log("wrote", `${dir}/${name}.png`);
  }
  await context.close();
}

const browser = await chromium.launch();
fs.mkdirSync(out, { recursive: true });
for (const locale of ["uz", "ru"]) {
  await featureGraphic(browser, locale);
  console.log("wrote", `${out}/feature-graphic-${locale}.png`);
  await screenshots(browser, locale);
}
await browser.close();
