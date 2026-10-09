import { expect, test, type Page, type Route } from "@playwright/test";

/**
 * The Claude floor plan reader, against a fake Anthropic API: no key, no
 * network, no cost. The fake answers with a streamed message in the same
 * server-sent-events shape the real API uses.
 */

const PLAN = {
  plans: [
    {
      name: "Scanned floor",
      height: 260,
      rooms: [
        { name: "Living", type: "living", rects: [[0, 0, 500, 400]] },
        { name: "Kitchen", type: "kitchen", rects: [[500, 0, 300, 400]] },
      ],
      doors: [{ x: 500, y: 150, w: 83, dir: "v" }],
    },
  ],
  image: { cmPerPx: 2, originX: 10, originY: 10 },
  notes: ["Kitchen depth estimated"],
};

function sse(text: string): string {
  const events: [string, object][] = [
    [
      "message_start",
      {
        type: "message_start",
        message: {
          id: "msg_test",
          type: "message",
          role: "assistant",
          model: "claude-opus-5-5",
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: { input_tokens: 1800, output_tokens: 0 },
        },
      },
    ],
    [
      "content_block_start",
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
    ],
    [
      "content_block_delta",
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
    ],
    ["content_block_stop", { type: "content_block_stop", index: 0 }],
    [
      "message_delta",
      {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: 900 },
      },
    ],
    ["message_stop", { type: "message_stop" }],
  ];
  return events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");
}

async function fakeClaude(
  page: Page,
  onRequest?: (body: unknown, headers: Record<string, string>) => void,
) {
  await page.route("https://api.anthropic.com/**", async (route: Route) => {
    const req = route.request();
    if (req.method() === "OPTIONS") {
      return route.fulfill({
        status: 204,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "POST, GET, OPTIONS",
        },
      });
    }
    onRequest?.(req.postDataJSON(), req.headers());
    return route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "access-control-allow-origin": "*" },
      body: sse(JSON.stringify(PLAN)),
    });
  });
}

// A tiny valid PNG (1x1).
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function openAiTab(page: Page) {
  await page.goto("/editor/");
  await expect(page.locator(".plan-svg[data-ready]")).toBeVisible();
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByRole("tab", { name: "Photo (AI)" }).click();
}

test("without a key the AI tab points to settings", async ({ page }) => {
  await openAiTab(page);
  await expect(page.getByRole("link", { name: "Enter key" })).toBeVisible();
  await page.getByRole("link", { name: "Enter key" }).click();
  await expect(page.getByLabel("Claude API key")).toBeVisible();
});

test("reads a plan with Claude, reviews and imports it", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "maison.settings",
      JSON.stringify({ apiKey: "sk-ant-test-key", model: "claude-opus-5-5" }),
    ),
  );
  let body: { model?: string; messages?: { content: { type: string }[] }[] } | undefined;
  let headers: Record<string, string> = {};
  await fakeClaude(page, (b, h) => {
    body = b as typeof body;
    headers = h;
  });
  await openAiTab(page);

  const start = page.getByRole("button", { name: "Read with Claude" });
  await expect(start).toBeDisabled();
  await page.getByLabel("Choose file").setInputFiles({
    name: "plan.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(start).toBeDisabled();
  await page.getByLabel("I agree to send this file to Claude").check();
  await start.click();

  await expect(page.getByRole("heading", { name: "Check the result" })).toBeVisible();
  await expect(page.getByText("Kitchen depth estimated")).toBeVisible();
  expect(body?.model).toBe("claude-opus-5-5");
  expect(body?.messages?.[0]?.content.map((c) => c.type)).toEqual(["image", "text"]);
  expect(headers["x-api-key"]).toBe("sk-ant-test-key");
  expect(page.url()).not.toContain("sk-ant");

  // Scale check: the living room is really 550 wide, not 500.
  await page.getByLabel("Real width").fill("550");
  await page.getByRole("button", { name: "Adjust scale" }).click();
  await expect(page.getByText("Plan scaled by 10%")).toBeVisible();

  await page.getByRole("button", { name: "Replace this floor" }).click();
  const plan = page.locator(".plan-svg");
  await expect(plan.getByText("Kitchen", { exact: true })).toBeVisible();
  // 550 x 440 after the scale check.
  await expect(plan.getByText("24.2 m²")).toBeVisible();
});
