import { expect, test } from "@playwright/test";

/** Installable web app: manifest, icons, service worker, offline page, install button. */

test("manifest, icons and app metadata are served", async ({ page, request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const manifest = await res.json();
  expect(manifest).toMatchObject({ short_name: "Gulzor", start_url: "/", display: "standalone", scope: "/" });
  expect(manifest.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
  for (const icon of manifest.icons) {
    const r = await request.get(icon.src);
    expect(r.status(), icon.src).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }
  for (const path of ["/sw.js", "/offline.html", "/icons/apple-touch-icon.png"]) {
    expect((await request.get(path)).status(), path).toBe(200);
  }
  // Not configured in tests → 404; once configured it must be valid JSON.
  const links = await request.get("/.well-known/assetlinks.json");
  if (links.status() === 200) expect(Array.isArray(await links.json())).toBe(true);
  else expect(links.status()).toBe(404);

  for (const url of ["/", "/ru"]) {
    await page.goto(url);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute("href", "/manifest.webmanifest");
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute("href", /apple-touch-icon\.png/);
  }
});

test("offline: a page load without network shows the offline page, then works again online", async ({ page, context }) => {
  await page.goto("/");
  // Wait until the service worker controls the page.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) => navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true }));
    }
  });

  await context.setOffline(true);
  await page.goto("/katalog");
  await expect(page.getByRole("heading", { name: "Internet aloqasi yo‘q" })).toBeVisible();
  await expect(page.getByText("Нет подключения к интернету")).toBeVisible();

  await context.setOffline(false);
  await page.getByRole("link", { name: /Qayta urinish/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Barcha gullar va guldastalar");
});

test("iPhone visitors get Add-to-Home-Screen instructions", async ({ browser }) => {
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await page.goto("/ru");
  const button = page.getByRole("button", { name: "Установить приложение" });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText(/«Поделиться»/)).toBeVisible();
  await context.close();
});
