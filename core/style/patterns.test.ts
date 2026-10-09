import { describe, expect, it } from "vitest";
import {
  FLOOR_FINISH_KINDS,
  PANEL_STYLES,
  WALLPAPER_PATTERNS,
  WALL_FINISH_KINDS,
} from "../model/types";
import { floorPattern, shade, wallPattern } from "./patterns";

describe("patterns", () => {
  it("shades colours", () => {
    expect(shade("#808080", 0)).toBe("#808080");
    expect(shade("#808080", 1)).toBe("#FFFFFF");
    expect(shade("#808080", -1)).toBe("#000000");
  });

  it("covers every floor kind and stays bounded", () => {
    for (const kind of FLOOR_FINISH_KINDS) {
      const p = floorPattern({ kind, color: "#B8916A", color2: "#2A2620" }, 400, 300, 7);
      expect(p.background).toMatch(/^#/);
      expect(p.shapes.length).toBeLessThanOrEqual(6000);
      if (kind !== "current") expect(p.shapes.length, kind).toBeGreaterThan(0);
    }
  });

  it("is deterministic per seed", () => {
    const a = floorPattern({ kind: "planks", color: "#B8916A" }, 300, 200, 3);
    expect(floorPattern({ kind: "planks", color: "#B8916A" }, 300, 200, 3)).toEqual(a);
    expect(floorPattern({ kind: "planks", color: "#B8916A" }, 300, 200, 4)).not.toEqual(a);
  });

  it("follows plank width and tile size", () => {
    const narrow = floorPattern({ kind: "planks", color: "#B8916A", plankWidth: 10 }, 300, 300)
      .shapes.length;
    const wide = floorPattern({ kind: "planks", color: "#B8916A", plankWidth: 30 }, 300, 300).shapes
      .length;
    expect(narrow).toBeGreaterThan(wide);
    expect(
      floorPattern({ kind: "checker", color: "#FFFFFF", tileSize: 50 }, 200, 200).shapes,
    ).toHaveLength(16);
  });

  it("covers every wall finish, pattern and panel style", () => {
    for (const kind of WALL_FINISH_KINDS)
      expect(wallPattern({ kind, color: "#F4F1EA" }, 300, 260).background).toMatch(/^#/);
    for (const pattern of WALLPAPER_PATTERNS)
      expect(
        wallPattern({ kind: "wallpaper", pattern, color: "#F4F1EA" }, 300, 260).shapes.length,
      ).toBeGreaterThan(0);
    for (const panel of PANEL_STYLES) {
      const p = wallPattern(
        { kind: "panel", panel, color: "#F4F1EA", color2: "#87A08C", height: 100 },
        300,
        260,
      );
      // Panels stay below their height.
      const tops = p.shapes.flatMap((s) => (s.kind === "rect" ? [s.y] : []));
      expect(Math.min(...tops), panel).toBeGreaterThanOrEqual(260 - 100 - 2);
    }
  });
});
