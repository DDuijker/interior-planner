import { expect, test, type Page } from "@playwright/test";

/** The main flows end to end (E12): 3D, style, export. */

async function openEditor(page: Page) {
  await page.goto("/editor/");
  await expect(page.locator(".plan-svg[data-ready]")).toBeVisible();
}

test("loads the 3D view, or explains when WebGL is missing", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "3D" }).click();
  const canvas = page.locator(".three-wrap canvas");
  const fallback = page.getByText(/WebGL/);
  await expect(canvas.or(fallback).first()).toBeVisible({ timeout: 20_000 });
  if (await canvas.isVisible()) {
    await page.getByRole("button", { name: "Top" }).click();
    await expect(canvas).toBeVisible();
  }
});

test("applies a style preset", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("tab", { name: "Style" }).click();
  const preset = page.locator(".preset-card").first();
  await preset.click();
  await expect(preset).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/applied/i).first()).toBeVisible();
});

test("exports the project file and plan-code", async ({ page }) => {
  await openEditor(page);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download project file" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/\.maison\.json$/);
  await page.getByRole("tab", { name: "Plan-code" }).click();
  await expect(page.locator("textarea").first()).toHaveValue(/"rooms"/);
});
