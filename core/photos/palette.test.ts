import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  fromHex,
  kMeans,
  mergePalettes,
  paletteFromPixels,
  pickColor,
  samplePixels,
  toHex,
} from "./palette";

/** RGBA data: `n` pixels of each colour. */
function image(parts: [string, number][]): Uint8ClampedArray {
  const px: number[] = [];
  for (const [hex, n] of parts) {
    const [r, g, b] = fromHex(hex);
    for (let i = 0; i < n; i++) px.push(r, g, b, 255);
  }
  return new Uint8ClampedArray(px);
}

describe("hex", () => {
  it("round-trips", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffff }), (v) => {
        const hex = `#${v.toString(16).padStart(6, "0").toUpperCase()}`;
        expect(toHex(fromHex(hex))).toBe(hex);
      }),
    );
  });
});

describe("palette", () => {
  it("finds the main colours, most common first", () => {
    const data = image([
      ["#F4F1EA", 600],
      ["#4D6857", 300],
      ["#B08D57", 100],
    ]);
    const swatches = kMeans(samplePixels(data), 5, 3);
    expect(swatches[0]!.color).toBe("#F4F1EA");
    expect(swatches.map((s) => s.color)).toContain("#4D6857");
    expect(swatches.map((s) => s.color)).toContain("#B08D57");
    const total = swatches.reduce((s, x) => s + x.weight, 0);
    expect(total).toBeCloseTo(1);
  });

  it("is deterministic and between 1 and size colours", () => {
    const data = image([
      ["#112233", 50],
      ["#AA0000", 50],
      ["#00AA00", 50],
      ["#0000AA", 50],
      ["#EEEEEE", 50],
      ["#777777", 50],
    ]);
    const a = paletteFromPixels(data, 6, 9);
    expect(a).toEqual(paletteFromPixels(data, 6, 9));
    expect(a.length).toBeGreaterThanOrEqual(5);
    expect(a.length).toBeLessThanOrEqual(6);
  });

  it("merges near-identical shades", () => {
    const data = image([
      ["#FFFFFF", 200],
      ["#FEFEFE", 200],
      ["#FDFDFD", 200],
    ]);
    expect(kMeans(samplePixels(data), 5)).toHaveLength(1);
  });

  it("skips transparent pixels and handles empty input", () => {
    expect(samplePixels(new Uint8ClampedArray([255, 0, 0, 0]))).toEqual([]);
    expect(kMeans([], 5)).toEqual([]);
  });

  it("pools a moodboard", () => {
    const merged = mergePalettes([
      ["#4D6857", "#F4F1EA"],
      ["#4E6958", "#B08D57"],
    ]);
    expect(merged.length).toBeGreaterThanOrEqual(3);
    expect(merged.length).toBeLessThanOrEqual(8);
  });
});

describe("eyedropper", () => {
  it("averages the pixels around a point and clips at the edges", () => {
    // 2x2 image: red, red / blue, blue
    const data = image([
      ["#FF0000", 2],
      ["#0000FF", 2],
    ]);
    expect(pickColor(data, 2, 0, 0, 0)).toBe("#FF0000");
    expect(pickColor(data, 2, 1, 1, 0)).toBe("#0000FF");
    expect(pickColor(data, 2, 0, 0, 1)).toBe("#800080");
    expect(pickColor(data, 2, 50, 50, 0)).toBe("#000000");
  });
});
