import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a running dev or production server:
 *   E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 * They create real orders in the configured database — use a development database.
 * Start that server with the Telegram and e-mail settings blanked, or every test order is announced to the real
 * owner chat (a made-up bot username is enough for the florist "connect Telegram" link):
 *   TELEGRAM_BOT_TOKEN= TELEGRAM_CHAT_ID= TELEGRAM_SHOP_BOT_TOKEN= TELEGRAM_SHOP_BOT_USERNAME=gulzor_e2e_bot SMTP_HOST= npx next start -p 3100
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile/ },
  ],
});
