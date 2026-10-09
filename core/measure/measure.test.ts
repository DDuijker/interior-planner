import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { orientedBox } from "../geometry/polygon";
import { UNITS } from "../model/types";
import { dimensionLines, distance } from "./dimensions";
import { formatArea, formatLength, fromUnit, parseLength, toUnit, unitStep } from "./units";

describe("units", () => {
  it("converts both ways", () => {
    expect(toUnit(254, "in")).toBeCloseTo(100);
    expect(fromUnit(1, "ft")).toBeCloseTo(30.48);
    expect(toUnit(1, "mm")).toBeCloseTo(10);
  });

  it("property: conversion roundtrips without data loss", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1e5, max: 1e5, noNaN: true }),
        fc.constantFrom(...UNITS),
        (cm, unit) => {
          return Math.abs(fromUnit(toUnit(cm, unit), unit) - cm) < 1e-9 * Math.max(1, Math.abs(cm));
        },
      ),
    );
  });

  it("formats lengths with sensible rounding", () => {
    expect(formatLength(240, "cm")).toBe("240 cm");
    expect(formatLength(240.4, "cm")).toBe("240 cm");
    expect(formatLength(83.5, "mm")).toBe("835 mm");
    expect(formatLength(100, "in")).toBe('39.4"');
    expect(formatLength(160, "ft")).toBe(`5' 3"`);
    expect(formatLength(30.48 * 6 - 0.5, "ft")).toBe(`6' 0"`);
    expect(formatLength(-30.48, "ft")).toBe(`-1' 0"`);
    expect(formatLength(-0.1, "cm")).toBe("0 cm");
    expect(formatLength(12.345, "cm", 1)).toBe("12.3 cm");
  });

  it("formats areas", () => {
    expect(formatArea(400 * 300, "cm")).toBe("12.0 m²");
    expect(formatArea(400 * 300, "ft")).toBe("129 sq ft");
  });

  it("parses user input", () => {
    expect(parseLength("240", "cm")).toBe(240);
    expect(parseLength("2,4 m", "cm")).toBe(240);
    expect(parseLength("35mm", "cm")).toBe(3.5);
    expect(parseLength("90 cm", "in")).toBe(90);
    expect(parseLength("10", "in")).toBeCloseTo(25.4);
    expect(parseLength('12"', "cm")).toBeCloseTo(30.48);
    expect(parseLength("5'", "cm")).toBeCloseTo(152.4);
    expect(parseLength(`5' 3"`, "cm")).toBeCloseTo(160.02);
    expect(parseLength("5ft 3in", "cm")).toBeCloseTo(160.02);
    expect(parseLength("-2'", "cm")).toBeCloseTo(-60.96);
    expect(parseLength("", "cm")).toBeNull();
    expect(parseLength("bank", "cm")).toBeNull();
    expect(parseLength("5 km", "cm")).toBeNull();
  });

  it("has a step per unit", () => {
    expect(unitStep("cm")).toBe(1);
    expect(unitStep("mm")).toBe(0.1);
    expect(unitStep("ft")).toBeCloseTo(2.54);
  });
});

describe("dimensions", () => {
  it("measures straight distances", () => {
    expect(distance({ x: 0, y: 0 }, { x: 300, y: 400 })).toBe(500);
  });

  it("draws lines to the nearest wall in each direction", () => {
    const walls = [
      { x: -10, y: -10, w: 420, d: 10 }, // north, inner face y=0
      { x: -10, y: 300, w: 420, d: 10 }, // south, inner face y=300
      { x: -10, y: -10, w: 10, d: 320 }, // west, inner face x=0
      { x: 400, y: -10, w: 10, d: 320 }, // east, inner face x=400
      { x: 380, y: 50, w: 10, d: 10 }, // column that is not in line
    ];
    const sofa = orientedBox(200, 100, 200, 90, 0); // x 100..300, y 55..145
    const lines = dimensionLines(sofa, walls);
    expect(Object.fromEntries(lines.map((l) => [l.direction, Math.round(l.length)]))).toEqual({
      N: 55,
      S: 155,
      W: 100,
      E: 100,
    });
    expect(lines.find((l) => l.direction === "N")!.to).toEqual({ x: 200, y: 0 });
  });

  it("omits directions without walls or too far away", () => {
    const sofa = orientedBox(0, 0, 100, 100, 0);
    expect(dimensionLines(sofa, [{ x: -50, y: 2000, w: 100, d: 10 }])).toEqual([]);
    expect(dimensionLines([], [])).toEqual([]);
  });
});
