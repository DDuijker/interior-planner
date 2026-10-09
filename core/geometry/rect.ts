import type { Point, Rect } from "../model/types";

export const EPS = 1e-9;

export function rectArea(r: Rect): number {
  return r.w * r.d;
}

export function rectRight(r: Rect): number {
  return r.x + r.w;
}

export function rectBottom(r: Rect): number {
  return r.y + r.d;
}

export function rectCenter(r: Rect): Point {
  return { x: r.x + r.w / 2, y: r.y + r.d / 2 };
}

/** Interiors overlap (touching edges do not count). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w - EPS && b.x < a.x + a.w - EPS && a.y < b.y + b.d - EPS && b.y < a.y + a.d - EPS
  );
}

export function rectContainsPoint(r: Rect, p: Point): boolean {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.d;
}

export function boundingRect(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x);
    y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w);
    y1 = Math.max(y1, r.y + r.d);
  }
  return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
}

export function boundingRectOfPoints(points: readonly Point[]): Rect | null {
  return boundingRect(points.map((p) => ({ x: p.x, y: p.y, w: 0, d: 0 })));
}

/** Normalise a rect drawn from any corner to positive width and depth. */
export function rectFromPoints(a: Point, b: Point): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    d: Math.abs(a.y - b.y),
  };
}

/** Exact area of a union of (possibly overlapping) rectangles. */
export function unionArea(rects: readonly Rect[]): number {
  const xs = [...new Set(rects.flatMap((r) => [r.x, r.x + r.w]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const x0 = xs[i]!,
      x1 = xs[i + 1]!;
    const spans = rects
      .filter((r) => r.x <= x0 && r.x + r.w >= x1 && r.w > 0)
      .map((r) => [r.y, r.y + r.d] as const)
      .sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let curStart = -Infinity,
      curEnd = -Infinity;
    for (const [s, e] of spans) {
      if (s > curEnd) {
        covered += curEnd - curStart > 0 ? curEnd - curStart : 0;
        curStart = s;
        curEnd = e;
      } else curEnd = Math.max(curEnd, e);
    }
    covered += curEnd - curStart > 0 ? curEnd - curStart : 0;
    area += covered * (x1 - x0);
  }
  return area;
}

/**
 * Remove the interval [cutStart, cutEnd] from [start, end]. Returns 0, 1 or 2
 * remaining intervals, dropping pieces shorter than `minLength`.
 */
export function subtractInterval(
  start: number,
  end: number,
  cutStart: number,
  cutEnd: number,
  minLength = EPS,
): [number, number][] {
  if (cutEnd <= start || cutStart >= end) return [[start, end]];
  const out: [number, number][] = [];
  if (cutStart - start > minLength) out.push([start, cutStart]);
  if (end - cutEnd > minLength) out.push([cutEnd, end]);
  return out;
}

/** `a` minus `b`: up to four rectangles covering what is left of `a`. */
export function subtractRect(a: Rect, b: Rect): Rect[] {
  if (!rectsOverlap(a, b)) return [a];
  const out: Rect[] = [];
  const ax2 = a.x + a.w,
    ay2 = a.y + a.d,
    bx2 = b.x + b.w,
    by2 = b.y + b.d;
  if (b.y > a.y) out.push({ x: a.x, y: a.y, w: a.w, d: b.y - a.y });
  if (by2 < ay2) out.push({ x: a.x, y: by2, w: a.w, d: ay2 - by2 });
  const top = Math.max(a.y, b.y),
    bottom = Math.min(ay2, by2);
  if (b.x > a.x) out.push({ x: a.x, y: top, w: b.x - a.x, d: bottom - top });
  if (bx2 < ax2) out.push({ x: bx2, y: top, w: ax2 - bx2, d: bottom - top });
  return out.filter((r) => r.w > EPS && r.d > EPS);
}
