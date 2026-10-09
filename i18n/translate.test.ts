import { describe, expect, it } from "vitest";
import { detectLocale, messages, translate } from "./translate";

describe("messages", () => {
  it("has the same keys in every language", () => {
    expect(Object.keys(messages.en).sort()).toEqual(Object.keys(messages.nl).sort());
  });

  it("uses the same placeholders in every language", () => {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(messages.nl) as (keyof typeof messages.nl)[]) {
      expect(placeholders(messages.en[key]), key).toEqual(placeholders(messages.nl[key]));
    }
  });

  it("has no empty strings", () => {
    for (const locale of ["nl", "en"] as const) {
      for (const value of Object.values(messages[locale])) expect(value.trim()).not.toBe("");
    }
  });
});

describe("translate", () => {
  it("fills placeholders", () => {
    expect(translate("nl", "editor.selection.count", { count: 3 })).toBe("3 geselecteerd");
    expect(translate("en", "editor.selection.count", { count: 3 })).toBe("3 selected");
  });

  it("keeps unknown placeholders", () => {
    expect(translate("en", "editor.selection.count")).toBe("{count} selected");
    expect(translate("en", "editor.selection.count", { other: 1 })).toBe("{count} selected");
  });
});

describe("detectLocale", () => {
  it("matches language tags", () => {
    expect(detectLocale(["en-GB", "nl"])).toBe("en");
    expect(detectLocale(["de-DE", "NL-be"])).toBe("nl");
  });

  it("falls back to Dutch", () => {
    expect(detectLocale([])).toBe("nl");
    expect(detectLocale(["fr"])).toBe("nl");
  });
});

describe("editor texts", () => {
  it("has a label for every shortcut action", async () => {
    const { SHORTCUT_ACTIONS } = await import("@/core/editor/shortcuts");
    for (const action of SHORTCUT_ACTIONS) expect(messages.nl).toHaveProperty(`shortcut.${action}`);
  });
});
