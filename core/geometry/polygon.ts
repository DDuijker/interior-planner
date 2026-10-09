import type { Point } from "../model/types";
import { EPS } from "./rect";

export type Polygon = readonly Point[];

export function polygonArea(points: Polygon): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!,
      b = points[(i + 1) % points.length]!;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function polygonCentroid(points: Polygon): Point {
  let a = 0,
    cx = 0,
    cy = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!,
      q = points[(i + 1) % points.length]!;
    const cross = p.x * q.y - q.x * p.y;
    a += cross;
    cx += (p.x + q.x) * cross;
    cy += (p.y + q.y) * cross;
  }
  if (Math.abs(a) < EPS) {
    const n = points.length || 1;
    return {
      x: points.reduce((s, p) => s + p.x, 0) / n,
      y: points.reduce((s, p) => s + p.y, 0) / n,
    };
  }
  return { x: cx / (3 * a), y: cy / (3 * a) };
}

/** Even-odd point in polygon test. Points exactly on an edge may go either way. */
export function pointInPolygon(p: Point, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!,
      b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

/** Rotate a point clockwise (y down) by `deg` around `origin`. */
export function rotatePoint(p: Point, deg: number, origin: Point = { x: 0, y: 0 }): Point {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r),
    s = Math.sin(r);
  const dx = p.x - origin.x,
    dy = p.y - origin.y;
  return { x: origin.x + dx * c - dy * s, y: origin.y + dx * s + dy * c };
}

/** Corners of a w x d box centred on (cx, cy) and rotated clockwise. */
export function orientedBox(
  cx: number,
  cy: number,
  w: number,
  d: number,
  rotation: number,
): Point[] {
  const hw = w / 2,
    hd = d / 2;
  const centre = { x: cx, y: cy };
  return [
    { x: cx - hw, y: cy - hd },
    { x: cx + hw, y: cy - hd },
    { x: cx + hw, y: cy + hd },
    { x: cx - hw, y: cy + hd },
  ].map((p) => rotatePoint(p, rotation, centre));
}

/** Ellipse approximated by a convex polygon. */
export function ellipsePolygon(
  cx: number,
  cy: number,
  w: number,
  d: number,
  rotation = 0,
  segments = 24,
): Point[] {
  const centre = { x: cx, y: cy };
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    pts.push(
      rotatePoint(
        { x: cx + (w / 2) * Math.cos(t), y: cy + (d / 2) * Math.sin(t) },
        rotation,
        centre,
      ),
    );
  }
  return pts;
}

function project(poly: Polygon, ax: number, ay: number): [number, number] {
  let min = Infinity,
    max = -Infinity;
  for (const p of poly) {
    const v = p.x * ax + p.y * ay;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * Separating axis test for two convex polygons. Touching edges do not count
 * as overlap; `tolerance` (cm) lets near-touching shapes pass.
 */
export function convexOverlap(a: Polygon, b: Polygon, tolerance = 0.01): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]!,
        q = poly[(i + 1) % poly.length]!;
      let ax = -(q.y - p.y),
        ay = q.x - p.x;
      const len = Math.hypot(ax, ay);
      if (len < EPS) continue;
      ax /= len;
      ay /= len;
      const [minA, maxA] = project(a, ax, ay);
      const [minB, maxB] = project(b, ax, ay);
      if (maxA <= minB + tolerance || maxB <= minA + tolerance) return false;
    }
  }
  return true;
}

export function pointSegmentDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 < EPS ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function segmentsIntersect(a: Point, b: Point, c: Point, d: Point): boolean {
  const o = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  const d1 = o(c, d, a),
    d2 = o(c, d, b),
    d3 = o(a, b, c),
    d4 = o(a, b, d);
  return d1 * d2 < 0 && d3 * d4 < 0;
}

/** Shortest distance between two polygons' outlines; 0 if they overlap. */
export function polygonDistance(a: Polygon, b: Polygon): number {
  if (convexOverlap(a, b, 0)) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const p = a[i]!,
      q = a[(i + 1) % a.length]!;
    for (let j = 0; j < b.length; j++) {
      const r = b[j]!,
        s = b[(j + 1) % b.length]!;
      if (segmentsIntersect(p, q, r, s)) return 0;
      best = Math.min(
        best,
        pointSegmentDistance(p, r, s),
        pointSegmentDistance(q, r, s),
        pointSegmentDistance(r, p, q),
        pointSegmentDistance(s, p, q),
      );
    }
  }
  return best;
}
