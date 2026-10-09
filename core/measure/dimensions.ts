import { boundingRectOfPoints } from "../geometry/rect";
import type { Point, Rect } from "../model/types";

export function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export interface DimensionLine {
  from: Point;
  to: Point;
  length: number;
  direction: "N" | "E" | "S" | "W";
}

/**
 * Dimension lines from a footprint to the nearest obstacle (usually wall
 * pieces) in each of the four directions, measured from the footprint's
 * bounding box at its centre lines. Directions without an obstacle within
 * `maxDistance` are omitted.
 */
export function dimensionLines(
  footprint: readonly Point[],
  obstacles: readonly Rect[],
  maxDistance = 1000,
): DimensionLine[] {
  const box = boundingRectOfPoints(footprint);
  if (!box) return [];
  const cx = box.x + box.w / 2;
  const cy = box.y + box.d / 2;
  const lines: DimensionLine[] = [];

  const nearest = (hits: number[]) => (hits.length ? Math.min(...hits) : Infinity);

  const north = nearest(
    obstacles
      .filter((o) => o.x <= cx && o.x + o.w >= cx && o.y + o.d <= box.y)
      .map((o) => box.y - (o.y + o.d)),
  );
  const south = nearest(
    obstacles
      .filter((o) => o.x <= cx && o.x + o.w >= cx && o.y >= box.y + box.d)
      .map((o) => o.y - (box.y + box.d)),
  );
  const west = nearest(
    obstacles
      .filter((o) => o.y <= cy && o.y + o.d >= cy && o.x + o.w <= box.x)
      .map((o) => box.x - (o.x + o.w)),
  );
  const east = nearest(
    obstacles
      .filter((o) => o.y <= cy && o.y + o.d >= cy && o.x >= box.x + box.w)
      .map((o) => o.x - (box.x + box.w)),
  );

  if (north <= maxDistance)
    lines.push({
      direction: "N",
      from: { x: cx, y: box.y },
      to: { x: cx, y: box.y - north },
      length: north,
    });
  if (east <= maxDistance)
    lines.push({
      direction: "E",
      from: { x: box.x + box.w, y: cy },
      to: { x: box.x + box.w + east, y: cy },
      length: east,
    });
  if (south <= maxDistance)
    lines.push({
      direction: "S",
      from: { x: cx, y: box.y + box.d },
      to: { x: cx, y: box.y + box.d + south },
      length: south,
    });
  if (west <= maxDistance)
    lines.push({
      direction: "W",
      from: { x: box.x, y: cy },
      to: { x: box.x - west, y: cy },
      length: west,
    });
  return lines;
}
