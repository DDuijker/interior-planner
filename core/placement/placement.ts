import { itemFootprint } from "../collision/collision";
import { pointInPolygon } from "../geometry/polygon";
import type { Item, Wall } from "../model/types";

/** Surface height of an item that others can stand on, or undefined. */
export type SurfaceOf = (item: Item) => number | undefined;

/**
 * Small items stand on the highest surface under their centre (table,
 * dresser, shelf); without one they go to the floor.
 */
export function stackElevation(item: Item, others: readonly Item[], surfaceOf: SurfaceOf): number {
  let best = 0;
  for (const o of others) {
    if (o.id === item.id || o.mount === "stack") continue;
    const top = surfaceOf(o);
    if (top === undefined) continue;
    if (!pointInPolygon(item, itemFootprint(o))) continue;
    best = Math.max(best, o.elevation + top);
  }
  return best;
}

export interface WallSnap {
  x: number;
  y: number;
  rotation: number;
  wallId: string;
}

/**
 * Hang a wall item on the nearest wall face within `maxDistance`: back
 * against the wall, centred where it is along the wall.
 */
export function snapToWall(item: Item, walls: readonly Wall[], maxDistance = 120): WallSnap | null {
  let best: (WallSnap & { dist: number }) | null = null;
  const consider = (snap: WallSnap, dist: number) => {
    if (dist <= maxDistance && (!best || dist < best.dist)) best = { ...snap, dist };
  };
  for (const wall of walls) {
    if (wall.kind === "low") continue;
    const r = wall.rect;
    const half = item.d / 2;
    if (r.w >= r.d) {
      const alongMin = r.x + item.w / 2,
        alongMax = r.x + r.w - item.w / 2;
      if (item.x < r.x || item.x > r.x + r.w) continue;
      const x =
        alongMax < alongMin ? r.x + r.w / 2 : Math.min(alongMax, Math.max(alongMin, item.x));
      if (item.y <= r.y + r.d / 2)
        consider({ x, y: r.y - half, rotation: 180, wallId: wall.id }, Math.abs(item.y - r.y));
      else
        consider(
          { x, y: r.y + r.d + half, rotation: 0, wallId: wall.id },
          Math.abs(item.y - (r.y + r.d)),
        );
    } else {
      const alongMin = r.y + item.w / 2,
        alongMax = r.y + r.d - item.w / 2;
      if (item.y < r.y || item.y > r.y + r.d) continue;
      const y =
        alongMax < alongMin ? r.y + r.d / 2 : Math.min(alongMax, Math.max(alongMin, item.y));
      if (item.x <= r.x + r.w / 2)
        consider({ x: r.x - half, y, rotation: 90, wallId: wall.id }, Math.abs(item.x - r.x));
      else
        consider(
          { x: r.x + r.w + half, y, rotation: 270, wallId: wall.id },
          Math.abs(item.x - (r.x + r.w)),
        );
    }
  }
  if (!best) return null;
  const { dist: _dist, ...snap } = best as WallSnap & { dist: number };
  return snap;
}

/**
 * Settle an item after it was placed or moved: stacked items get the right
 * elevation, wall items hang on the nearest wall. Floor items are unchanged.
 */
export function settleItem(
  item: Item,
  others: readonly Item[],
  walls: readonly Wall[],
  surfaceOf: SurfaceOf,
): Pick<Item, "x" | "y" | "rotation" | "elevation"> {
  if (item.mount === "stack") {
    return {
      x: item.x,
      y: item.y,
      rotation: item.rotation,
      elevation: stackElevation(item, others, surfaceOf),
    };
  }
  if (item.mount === "wall") {
    const snap = snapToWall(item, walls);
    if (snap) return { x: snap.x, y: snap.y, rotation: snap.rotation, elevation: item.elevation };
  }
  return { x: item.x, y: item.y, rotation: item.rotation, elevation: item.elevation };
}
