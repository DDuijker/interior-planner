import { expect, test, type Page } from "@playwright/test";

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

async function openEditor(page: Page, query = "") {
  await page.goto(`/editor/${query}`);
  await expect(page.locator(".plan-svg[data-ready]")).toBeVisible();
}

const transformOf = (page: Page, id: string) =>
  page.locator(`[data-item="${id}"]`).getAttribute("transform");

test("home links to the editor without console errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Maison" })).toBeVisible();
  await page.getByRole("link", { name: "Open sample floor plan" }).click();
  await expect(page.locator('[data-item="sofa"]')).toBeVisible();
  await expect(page.getByText("Living room").or(page.getByText("Woonkamer")).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("switches language to Dutch and remembers it", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Language").selectOption("nl");
  await expect(page.getByRole("link", { name: "Open voorbeeldplattegrond" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Open voorbeeldplattegrond" })).toBeVisible();
});

test.describe("desktop editing", () => {
  test.skip(({ isMobile }) => isMobile, "mouse and keyboard flows");

  test("select, drag as one step, undo and redo", async ({ page }) => {
    const errors = trackErrors(page);
    await openEditor(page);
    const chair = page.locator('[data-item="armchair"]');
    const before = await transformOf(page, "armchair");
    const box = (await chair.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++)
      await page.mouse.move(box.x + box.width / 2 + i * 6, box.y + box.height / 2);
    await page.mouse.up();
    await expect(page.getByText("1 selected")).toBeVisible();
    const after = await transformOf(page, "armchair");
    expect(after).not.toBe(before);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await transformOf(page, "armchair")).toBe(before);
    await page.keyboard.press("Control+Shift+Z");
    expect(await transformOf(page, "armchair")).toBe(after);
    expect(errors).toEqual([]);
  });

  test("nudges with the arrow keys", async ({ page }) => {
    await openEditor(page);
    await page
      .getByRole("button", { name: "Objects" })
      .or(page.getByText("Objects"))
      .first()
      .click();
    await page.getByRole("button", { name: "Bed 160x200" }).click();
    await page.locator("#plan").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(page.locator('[data-item="bed"]')).toHaveAttribute(
      "transform",
      /translate\(191 680\)/,
    );
  });

  test("marquee selects several items and Ctrl+D duplicates them", async ({ page }) => {
    await openEditor(page);
    const bed = (await page.locator('[data-item="nightstand-l"]').boundingBox())!;
    const other = (await page.locator('[data-item="nightstand-r"]').boundingBox())!;
    await page.mouse.move(bed.x - 5, bed.y - 5);
    await page.mouse.down();
    await page.mouse.move(other.x + other.width + 5, other.y + other.height + 5, { steps: 5 });
    await page.mouse.up();
    await expect(page.getByText(/^[3-9] selected$/)).toBeVisible();
    const count = await page.locator("[data-item]").count();
    await page.keyboard.press("Control+d");
    await expect(page.locator("[data-item]")).toHaveCount(count + 3);
  });

  test("context menu deletes an item", async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-item="armchair"]').click({ button: "right" });
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await menu.getByRole("menuitem", { name: "Delete" }).click();
    await expect(page.locator('[data-item="armchair"]')).toHaveCount(0);
    await page.keyboard.press("Control+z");
    await expect(page.locator('[data-item="armchair"]')).toHaveCount(1);
  });

  test("shows the shortcuts with ?", async ({ page }) => {
    await openEditor(page);
    await page.locator("#plan").focus();
    await page.keyboard.press("Shift+?");
    const dialog = page.getByRole("dialog", { name: "Keyboard shortcuts" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Ctrl+Shift+Z")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("hides a layer", async ({ page }) => {
    await openEditor(page);
    await page.getByText("Layers").click();
    await page.getByRole("button", { name: "Hide layer Decor" }).click();
    await expect(page.locator('[data-item="plant"]')).toHaveCount(0);
    await page.getByRole("button", { name: "Show layer Decor" }).click();
    await expect(page.locator('[data-item="plant"]')).toHaveCount(1);
  });

  test("measures a distance and follows the unit", async ({ page }) => {
    await openEditor(page);
    await page.getByRole("button", { name: "Measure" }).click();
    const plan = (await page.locator(".plan-svg").boundingBox())!;
    await page.mouse.click(plan.x + 200, plan.y + 300);
    await page.mouse.click(plan.x + 400, plan.y + 300);
    await expect(page.getByRole("status").filter({ hasText: "Distance:" })).toBeVisible();
    await page.getByLabel("Unit").selectOption("in");
    await expect(page.getByRole("status").filter({ hasText: /Distance: [\d.]+"/ })).toBeVisible();
  });

  test("zooms with the wheel around the pointer", async ({ page }) => {
    await openEditor(page);
    const svg = page.locator(".plan-svg");
    const before = Number(await svg.getAttribute("data-scale"));
    const box = (await svg.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -300);
    await expect
      .poll(async () => Number(await svg.getAttribute("data-scale")))
      .toBeGreaterThan(before);
  });

  test("renders 150 extra items", async ({ page }) => {
    await openEditor(page, "?stress=150");
    await expect(page.locator('[data-item^="stress-"]')).toHaveCount(150);
  });
});

test.describe("mobile", () => {
  test.skip(({ isMobile }) => !isMobile, "touch layout");

  test("has no horizontal scroll and a collapsible panel", async ({ page }) => {
    await openEditor(page);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const toggle = page.getByRole("button", { name: "Side panel" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(page.getByText("Nothing selected")).toBeVisible();
  });

  test("tap selects an item", async ({ page }) => {
    await openEditor(page);
    await page.locator('[data-item="bed"]').tap();
    await page.getByRole("button", { name: "Side panel" }).click();
    await expect(page.getByText("1 selected")).toBeVisible();
  });
});
