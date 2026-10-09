import { describe, expect, it } from "vitest";
import { contrastRatio, luminance } from "./contrast";
import { colors, contrastPairs, themeCss } from "./tokens";

describe("contrast", () => {
  it("matches known WCAG values", () => {
    expect(luminance("#FFFFFF")).toBeCloseTo(1);
    expect(luminance("#000000")).toBeCloseTo(0);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("rejects bad input", () => {
    expect(() => luminance("sage")).toThrow();
  });

  for (const theme of ["light", "dark"] as const) {
    for (const [fg, bg] of contrastPairs) {
      it(`${theme}: ${fg} on ${bg} reaches AA`, () => {
        expect(contrastRatio(colors[theme][fg], colors[theme][bg])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});

describe("themeCss", () => {
  it("emits variables for both themes", () => {
    const css = themeCss();
    expect(css).toContain("--c-bg:#F5F1E8;");
    expect(css).toContain("--c-text-muted:#6A6357;");
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain("--touch:44px;");
  });
});
