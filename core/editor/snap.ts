import type { Point } from "../model/types";

export function snapValue(v: number, grid: number): number {
  return grid > 0 ? Math.round(v / grid) * grid + 0 : v;
}

export function snapPoint(p: Point, grid: number): Point {
  return { x: snapValue(p.x, grid), y: snapValue(p.y, grid) };
}

/** Snap an angle to `step` degrees (15 by default) and normalise to [0, 360). */
export function snapAngle(deg: number, step = 15): number {
  const snapped = step > 0 ? Math.round(deg / step) * step : deg;
  const r = snapped % 360;
  return (r < 0 ? r + 360 : r) + 0;
}
