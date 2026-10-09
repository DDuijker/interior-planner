import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const ROOM_PNG = path.join(__dirname, "fixtures", "room.png");

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function openPhotos(page: Page) {
  await page.goto("/editor/");
  await expect(page.locator(".plan-svg[data-ready]")).toBeVisible();
  await page.getByRole("tab", { name: "Photos" }).click();
}

test("adds a photo, gets a palette, links it and opens it from the plan", async ({ page }) => {
  const errors = trackErrors(page);
  await openPhotos(page);
  await page.getByRole("tab", { name: "Current interior" }).click();
  await page.getByLabel("Choose photos").setInputFiles(ROOM_PNG);
  await expect(page.getByText("1 photo(s) added")).toBeVisible();

  // Palette from the photo, computed locally.
  await expect(page.getByRole("button", { name: /^Use #/ }).first()).toBeVisible();
  await page
    .getByRole("button", { name: /^Use #/ })
    .first()
    .click();
  await expect(page.getByText(/copied and added/)).toBeVisible();

  // Pinterest link is stored, never fetched.
  await page
    .getByLabel("Source (e.g. Pinterest link)")
    .fill("nl.pinterest.com/pin/123/?utm_source=x");
  await page.getByLabel("Source (e.g. Pinterest link)").blur();
  await expect(page.getByRole("link", { name: "Open the pin" })).toHaveAttribute(
    "href",
    "https://nl.pinterest.com/pin/123/",
  );

  // Link to the living room, facing the north wall.
  await page.getByRole("combobox", { name: /^Room/ }).selectOption({ label: "Woonkamer" });
  await page.getByRole("combobox", { name: /^Looks towards/ }).selectOption("N");
  await page.getByRole("button", { name: "Show on plan" }).click();

  const marker = page.locator("[data-photo]");
  await expect(marker).toHaveCount(1);
  await marker.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("tab", { name: "Photos", selected: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("without a key the moodboard style offers the palette and settings", async ({ page }) => {
  await openPhotos(page);
  await page.getByLabel("Choose photos").setInputFiles(ROOM_PNG);
  await expect(page.getByText("1 photo(s) added")).toBeVisible();
  await page.getByRole("button", { name: "Style from moodboard (Claude)" }).click();
  await expect(page.getByRole("link", { name: "Enter key" })).toBeVisible();
});

test("never contacts Pinterest or anything but Anthropic", async ({ page }) => {
  const hosts = new Set<string>();
  page.on("request", (r) => {
    const url = new URL(r.url());
    if (url.protocol.startsWith("http")) hosts.add(url.hostname);
  });
  await openPhotos(page);
  await page.getByLabel("Choose photos").setInputFiles(ROOM_PNG);
  await expect(page.getByText("1 photo(s) added")).toBeVisible();
  const outside = [...hosts].filter((h) => h !== "localhost" && !h.endsWith("fonts.gstatic.com"));
  expect(outside, [...hosts].join(",")).toEqual([]);
});
