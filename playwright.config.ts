import { defineConfig, devices } from "@playwright/test";

const port = 4173;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    locale: "en-GB",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  expect: {
    // Visual regression (E12): small rendering differences are fine.
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    // Safari engine: in CI, or locally with E2E_WEBKIT=1 once installed.
    ...(process.env.CI || process.env.E2E_WEBKIT
      ? [{ name: "webkit", use: { ...devices["Desktop Safari"] } }]
      : []),
  ],
  webServer: {
    command: process.env.E2E_SKIP_BUILD
      ? "node e2e/serve.mjs"
      : "npm run build && node e2e/serve.mjs",
    port,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
