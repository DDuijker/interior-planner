import { expect, test } from "@playwright/test";

/**
 * Visual regression (E12). Screenshots live next to this file; after an
 * intended design change run `npm run e2e:update` and review the new images.
 * Chromium only: other engines render fonts slightly differently.
 */
test.skip(({ browserName, isMobile }) => browserName !== "chromium" || isMobile, "chromium only");

test("projects page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Maison" })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("projects.png", {
    fullPage: true,
    mask: [page.locator(".project-card time")],
  });
});

test("2D editor with the sample apartment", async ({ page }) => {
  await page.goto("/editor/");
  await expect(page.locator(".plan-svg[data-ready]")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("editor.png");
});

test("settings page", async ({ page }) => {
  await page.goto("/settings/");
  await page.evaluate(() => document.fonts.ready);
  await expect(page).toHaveScreenshot("settings.png", { fullPage: true });
});
