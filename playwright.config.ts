import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests run against a running dev or production server:
 *   E2E_BASE_URL=http://localhost:3000 E2E_ADMIN_EMAIL=... E2E_ADMIN_PASSWORD=... npm run test:e2e
 * They create real orders in the configured database — use a development database.
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
