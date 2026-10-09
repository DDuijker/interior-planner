import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  boundingRect,
  convexOverlap,
  ellipsePolygon,
  orientedBox,
  pointInPolygon,
  pointSegmentDistance,
  polygonArea,
  polygonCentroid,
  polygonDistance,
  rectArea,
  rectContainsPoint,
  rectFromPoints,
  rectsOverlap,
  rotatePoint,
  subtractInterval,
  unionArea,
  boundingRectOfPoints,
  rectCenter,
  subtractRect,
} from "./index";
import type { Rect } from "../model/types";

const arbRect = fc.record({
  x: fc.integer({ min: -500, max: 500 }),
  y: fc.integer({ min: -500, max: 500 }),
  w: fc.integer({ min: 1, max: 400 }),
  d: fc.integer({ min: 1, max: 400 }),
});

const square = (x: number, y: number, s: number) => orientedBox(x, y, s, s, 0);

describe("rects", () => {
  it("computes area, centre and bounds", () => {
    expect(rectArea({ x: 0, y: 0, w: 300, d: 200 })).toBe(60000);
    expect(rectCenter({ x: 10, y: 10, w: 20, d: 40 })).toEqual({ x: 20, y: 30 });
    expect(boundingRect([])).toBeNull();
    expect(
      boundingRectOfPoints([
        { x: 5, y: -5 },
        { x: -5, y: 5 },
      ]),
    ).toEqual({ x: -5, y: -5, w: 10, d: 10 });
    expect(
      boundingRect([
        { x: 0, y: 0, w: 10, d: 10 },
        { x: 20, y: 5, w: 5, d: 30 },
      ]),
    ).toEqual({ x: 0, y: 0, w: 25, d: 35 });
  });

  it("does not count touching edges as overlap", () => {
    const a = { x: 0, y: 0, w: 100, d: 100 };
    expect(rectsOverlap(a, { x: 100, y: 0, w: 50, d: 50 })).toBe(false);
    expect(rectsOverlap(a, { x: 99, y: 0, w: 50, d: 50 })).toBe(true);
    expect(rectContainsPoint(a, { x: 100, y: 100 })).toBe(true);
    expect(rectContainsPoint(a, { x: 101, y: 100 })).toBe(false);
  });

  it("normalises rects drawn backwards", () => {
    expect(rectFromPoints({ x: 10, y: 50 }, { x: 0, y: 20 })).toEqual({
      x: 0,
      y: 20,
      w: 10,
      d: 30,
    });
  });

  it("computes union area of overlapping rects (L-shape and overlap)", () => {
    expect(
      unionArea([
        { x: 0, y: 0, w: 400, d: 200 },
        { x: 0, y: 200, w: 200, d: 200 },
      ]),
    ).toBe(120000);
    expect(
      unionArea([
        { x: 0, y: 0, w: 100, d: 100 },
        { x: 50, y: 50, w: 100, d: 100 },
      ]),
    ).toBe(17500);
    expect(unionArea([])).toBe(0);
  });

  it("property: union area is between the largest rect and the sum", () => {
    fc.assert(
      fc.property(fc.array(arbRect, { minLength: 1, maxLength: 6 }), (rects: Rect[]) => {
        const u = unionArea(rects);
        const max = Math.max(...rects.map(rectArea));
        const sum = rects.reduce((s, r) => s + rectArea(r), 0);
        return u >= max - 1e-6 && u <= sum + 1e-6;
      }),
    );
  });

  it("property: union area of disjoint grid tiles equals the sum", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }), (cols, rows) => {
        const tiles: Rect[] = [];
        for (let i = 0; i < cols; i++)
          for (let j = 0; j < rows; j++) tiles.push({ x: i * 50, y: j * 30, w: 50, d: 30 });
        return unionArea(tiles) === cols * rows * 1500;
      }),
    );
  });

  it("subtracts intervals", () => {
    expect(subtractInterval(0, 100, 40, 60)).toEqual([
      [0, 40],
      [60, 100],
    ]);
    expect(subtractInterval(0, 100, -10, 30)).toEqual([[30, 100]]);
    expect(subtractInterval(0, 100, 80, 120)).toEqual([[0, 80]]);
    expect(subtractInterval(0, 100, 200, 300)).toEqual([[0, 100]]);
    expect(subtractInterval(0, 100, 0, 100)).toEqual([]);
    expect(subtractInterval(0, 100, 2, 100, 5)).toEqual([]);
  });
});

describe("polygons", () => {
  const l = [
    { x: 0, y: 0 },
    { x: 400, y: 0 },
    { x: 400, y: 200 },
    { x: 200, y: 200 },
    { x: 200, y: 400 },
    { x: 0, y: 400 },
  ];

  it("computes area and centroid", () => {
    expect(polygonArea(l)).toBe(120000);
    const c = polygonCentroid(square(50, 50, 100));
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(50);
    expect(
      polygonCentroid([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).toEqual({ x: 10, y: 0 });
  });

  it("tests points inside an L-shape", () => {
    expect(pointInPolygon({ x: 100, y: 300 }, l)).toBe(true);
    expect(pointInPolygon({ x: 300, y: 300 }, l)).toBe(false);
    expect(pointInPolygon({ x: 300, y: 100 }, l)).toBe(true);
  });

  it("rotates clockwise with y pointing down", () => {
    const p = rotatePoint({ x: 10, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10);
  });

  it("builds oriented boxes", () => {
    const box = orientedBox(0, 0, 200, 100, 90);
    const xs = box.map((p) => Math.round(p.x)).sort((a, b) => a - b);
    expect(xs[0]).toBe(-50);
    expect(xs[3]).toBe(50);
  });

  it("detects overlap with SAT, also when rotated", () => {
    expect(convexOverlap(square(0, 0, 100), square(90, 0, 100))).toBe(true);
    expect(convexOverlap(square(0, 0, 100), square(100, 0, 100))).toBe(false);
    // A 45 degree box whose bounding box overlaps but which itself does not.
    const diamond = orientedBox(110, 110, 100, 100, 45);
    expect(convexOverlap(square(0, 0, 100), diamond)).toBe(false);
    expect(convexOverlap(square(0, 0, 100), orientedBox(80, 80, 100, 100, 45))).toBe(true);
  });

  it("handles round shapes", () => {
    const circle = ellipsePolygon(0, 0, 100, 100);
    expect(polygonArea(circle)).toBeGreaterThan(0.95 * Math.PI * 2500);
    // Corner of a square near a circle: bounding boxes overlap, shapes do not.
    expect(convexOverlap(circle, square(95, 95, 100))).toBe(false);
    expect(convexOverlap(circle, square(90, 0, 100))).toBe(true);
  });

  it("measures distances between shapes", () => {
    expect(polygonDistance(square(0, 0, 100), square(180, 0, 100))).toBeCloseTo(80);
    expect(polygonDistance(square(0, 0, 100), square(50, 0, 100))).toBe(0);
    expect(pointSegmentDistance({ x: 5, y: 5 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBeCloseTo(
      Math.SQRT2 * 5,
    );
  });

  it("property: overlap is symmetric and distance is zero exactly when overlapping", () => {
    const arbBox = fc.record({
      x: fc.integer({ min: -300, max: 300 }),
      y: fc.integer({ min: -300, max: 300 }),
      w: fc.integer({ min: 10, max: 200 }),
      d: fc.integer({ min: 10, max: 200 }),
      r: fc.integer({ min: 0, max: 359 }),
    });
    fc.assert(
      fc.property(arbBox, arbBox, (a, b) => {
        const pa = orientedBox(a.x, a.y, a.w, a.d, a.r);
        const pb = orientedBox(b.x, b.y, b.w, b.d, b.r);
        const overlap = convexOverlap(pa, pb, 0);
        if (overlap !== convexOverlap(pb, pa, 0)) return false;
        const dist = polygonDistance(pa, pb);
        return overlap ? dist === 0 : dist >= 0;
      }),
    );
  });

  it("property: rotation keeps area", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 1, max: 300 }),
        fc.integer({ min: 0, max: 359 }),
        (w, d, r) => {
          return Math.abs(polygonArea(orientedBox(0, 0, w, d, r)) - w * d) < 1e-6 * w * d;
        },
      ),
    );
  });
});

describe("subtractRect", () => {
  const a = { x: 0, y: 0, w: 100, d: 100 };
  it("cuts a hole into up to four parts covering the rest", () => {
    const parts = subtractRect(a, { x: 40, y: 40, w: 20, d: 20 });
    expect(parts).toHaveLength(4);
    expect(unionArea(parts)).toBe(10000 - 400);
  });
  it("handles no overlap and full cover", () => {
    expect(subtractRect(a, { x: 200, y: 0, w: 10, d: 10 })).toEqual([a]);
    expect(subtractRect(a, { x: -10, y: -10, w: 200, d: 200 })).toEqual([]);
  });
  it("property: area of the rest is area minus overlap", () => {
    fc.assert(
      fc.property(arbRect, arbRect, (r, s) => {
        const rest = subtractRect(r, s);
        const ox = Math.max(0, Math.min(r.x + r.w, s.x + s.w) - Math.max(r.x, s.x));
        const oy = Math.max(0, Math.min(r.y + r.d, s.y + s.d) - Math.max(r.y, s.y));
        return (
          Math.abs(unionArea(rest) - (rectArea(r) - ox * oy)) < 1e-6 &&
          rest.reduce((t, x) => t + rectArea(x), 0) - unionArea(rest) < 1e-6
        );
      }),
    );
  });
});
