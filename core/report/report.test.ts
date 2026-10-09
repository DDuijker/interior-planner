import { describe, expect, it } from "vitest";
import { buildErrorReport, scrub } from "./report";

describe("error report", () => {
  it("removes keys, e-mail and query strings", () => {
    const s = scrub(
      "key sk-ant-api03-AbC_123 by a.b@example.com at https://x.io/project/?id=secret#frag ok",
    );
    expect(s).toBe("key [key removed] by [e-mail removed] at https://x.io/project/ ok");
  });

  it("builds a readable report", () => {
    const r = buildErrorReport({
      message: "Boom with sk-ant-xyz",
      stack: "Error: Boom\n    at f (https://site/app.js?v=1:1:2)",
      url: "https://site/project/?id=p1",
      userAgent: "Test",
      version: "0.1.0",
      time: new Date("2026-01-02T03:04:05Z"),
    });
    expect(r).toContain("Time: 2026-01-02T03:04:05.000Z");
    expect(r).toContain("Error: Boom with [key removed]");
    expect(r).toContain("Page: https://site/project/");
    expect(r).not.toContain("id=p1");
    expect(r).toContain("at f (https://site/app.js)");
  });
});
