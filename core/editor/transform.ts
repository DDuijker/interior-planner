import { rotatePoint } from "../geometry/polygon";
import type { Cardinal, Item, Point } from "../model/types";
import { snapAngle } from "./snap";

/** Rotation for an item whose back faces `back` (N = 0, clockwise). */
export const ROTATION_FOR_BACK: Record<Cardinal, number> = { N: 0, E: 90, S: 180, W: 270 };

export function rotationForBack(back: Cardinal): number {
  return ROTATION_FOR_BACK[back];
}

/** Nearest cardinal for a rotation (for showing "back against" in the UI). */
export function backForRotation(rotation: number): Cardinal {
  const order: Cardinal[] = ["N", "E", "S", "W"];
  return order[Math.round((((rotation % 360) + 360) % 360) / 90) % 4]!;
}

/**
 * The rotate handle sits north of an unrotated item, so dragging it to
 * `pointer` gives this rotation (clockwise, 0 = north).
 * `step` snaps (15 degrees by default); pass 0 for free rotation (Alt).
 */
export function rotationFromPointer(center: Point, pointer: Point, step = 15): number {
  const deg = (Math.atan2(pointer.x - center.x, -(pointer.y - center.y)) * 180) / Math.PI;
  return snapAngle(deg, step);
}

export type Handle = "n" | "e" | "s" | "w" | "ne" | "nw" | "se" | "sw";

export interface Box {
  x: number;
  y: number;
  w: number;
  d: number;
}

/**
 * Resize a rotated box by dragging `handle` to `pointer` (world). The
 * opposite edge or corner stays put. Sizes never drop below `min`.
 */
export function resizeFromHandle(
  item: Pick<Item, "x" | "y" | "w" | "d" | "rotation">,
  handle: Handle,
  pointer: Point,
  min = 5,
  grid = 0,
): Box {
  const centre = { x: item.x, y: item.y };
  const local = rotatePoint(pointer, -item.rotation, centre);
  const lx = local.x - centre.x;
  const ly = local.y - centre.y;
  const hw = item.w / 2,
    hd = item.d / 2;
  let left = -hw,
    right = hw,
    top = -hd,
    bottom = hd;
  const snap = (v: number) => (grid > 0 ? Math.round(v / grid) * grid : v);
  if (handle.includes("e")) right = Math.max(left + min, left + snap(lx - left));
  if (handle.includes("w")) left = Math.min(right - min, right - snap(right - lx));
  if (handle.includes("s")) bottom = Math.max(top + min, top + snap(ly - top));
  if (handle.includes("n")) top = Math.min(bottom - min, bottom - snap(bottom - ly));
  const localCentre = { x: centre.x + (left + right) / 2, y: centre.y + (top + bottom) / 2 };
  const world = rotatePoint(localCentre, item.rotation, centre);
  return { x: world.x, y: world.y, w: right - left, d: bottom - top };
}

/** Positions of the resize handles and the rotate handle in world space. */
export function handlePositions(
  item: Pick<Item, "x" | "y" | "w" | "d" | "rotation">,
  rotateOffset = 30,
): Record<Handle | "rotate", Point> {
  const c = { x: item.x, y: item.y };
  const hw = item.w / 2,
    hd = item.d / 2;
  const local: Record<Handle | "rotate", Point> = {
    n: { x: 0, y: -hd },
    s: { x: 0, y: hd },
    e: { x: hw, y: 0 },
    w: { x: -hw, y: 0 },
    ne: { x: hw, y: -hd },
    nw: { x: -hw, y: -hd },
    se: { x: hw, y: hd },
    sw: { x: -hw, y: hd },
    rotate: { x: 0, y: -hd - rotateOffset },
  };
  const out = {} as Record<Handle | "rotate", Point>;
  for (const [k, p] of Object.entries(local) as [Handle | "rotate", Point][]) {
    out[k] = rotatePoint({ x: c.x + p.x, y: c.y + p.y }, item.rotation, c);
  }
  return out;
}
