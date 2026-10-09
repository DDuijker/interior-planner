import { pointSegmentDistance } from "../geometry/polygon";
import { subtractInterval } from "../geometry/rect";
import { newId } from "../model/ids";
import type { Axis, Door, Id, Opening, Point, Rect, Wall, WallKind, Window } from "../model/types";
import { isHorizontal } from "../walls/generate";

/** Standard Dutch sizes. */
export const DOOR_DEFAULTS = { w: 83, height: 211 } as const;
export const WINDOW_DEFAULTS = { w: 120, sill: 90, lintel: 210 } as const;
/** Openings narrower than this are not worth cutting. */
const MIN_PIECE = 1;

export function createDoor(x: number, y: number, dir: Axis, patch: Partial<Door> = {}): Door {
  return {
    id: newId("door"),
    kind: "door",
    x,
    y,
    dir,
    w: DOOR_DEFAULTS.w,
    height: DOOR_DEFAULTS.height,
    hinge: "start",
    swing: "b",
    ...patch,
  };
}

export function createWindow(x: number, y: number, dir: Axis, patch: Partial<Window> = {}): Window {
  return {
    id: newId("win"),
    kind: "window",
    x,
    y,
    dir,
    w: WINDOW_DEFAULTS.w,
    sill: WINDOW_DEFAULTS.sill,
    lintel: WINDOW_DEFAULTS.lintel,
    glass: false,
    ...patch,
  };
}

/** Turn a window into a floor-to-ceiling glass wall (or back). */
export function setGlass(win: Window, glass: boolean, wallHeight: number): Window {
  return glass
    ? { ...win, glass, sill: 0, lintel: wallHeight }
    : {
        ...win,
        glass,
        sill: WINDOW_DEFAULTS.sill,
        lintel: Math.min(WINDOW_DEFAULTS.lintel, wallHeight),
      };
}

function wallAxis(wall: Wall): Axis {
  return isHorizontal(wall.rect) ? "h" : "v";
}

/** Centre line of a wall rect as a segment. */
export function wallCenterLine(rect: Rect): [Point, Point] {
  return isHorizontal(rect)
    ? [
        { x: rect.x, y: rect.y + rect.d / 2 },
        { x: rect.x + rect.w, y: rect.y + rect.d / 2 },
      ]
    : [
        { x: rect.x + rect.w / 2, y: rect.y },
        { x: rect.x + rect.w / 2, y: rect.y + rect.d },
      ];
}

/** Centre point of an opening. */
export function openingCenter(o: Opening): Point {
  return o.dir === "h" ? { x: o.x + o.w / 2, y: o.y } : { x: o.x, y: o.y + o.w / 2 };
}

const SNAP_KINDS: readonly WallKind[] = ["interior", "exterior"];

/**
 * Snap an opening to the nearest full wall within `maxDistance` cm of its
 * centre. The opening takes the wall's direction, sits on its centre line and
 * is kept inside the wall (narrowed if the wall is shorter).
 * Returns null when no wall is close enough.
 */
export function snapOpening<T extends Opening>(
  opening: T,
  walls: readonly Wall[],
  maxDistance = 60,
): T | null {
  const centre = openingCenter(opening);
  let best: { wall: Wall; dist: number } | null = null;
  for (const wall of walls) {
    if (!SNAP_KINDS.includes(wall.kind)) continue;
    const [a, b] = wallCenterLine(wall.rect);
    const dist = pointSegmentDistance(centre, a, b);
    if (dist <= maxDistance && (!best || dist < best.dist)) best = { wall, dist };
  }
  if (!best) return null;
  return placeOnWall(opening, best.wall, centre);
}

/** Put an opening on a wall, centred as close to `at` as the wall allows. */
export function placeOnWall<T extends Opening>(
  opening: T,
  wall: Wall,
  at: Point = openingCenter(opening),
): T {
  const dir = wallAxis(wall);
  const r = wall.rect;
  const length = dir === "h" ? r.w : r.d;
  const w = Math.min(opening.w, length);
  if (dir === "h") {
    const x = Math.min(Math.max(at.x - w / 2, r.x), r.x + r.w - w);
    return { ...opening, dir, w, x, y: r.y + r.d / 2, wallId: wall.id };
  }
  const y = Math.min(Math.max(at.y - w / 2, r.y), r.y + r.d - w);
  return { ...opening, dir, w, x: r.x + r.w / 2, y, wallId: wall.id };
}

/** Does the opening lie on this wall (same axis, centre line inside the wall)? */
export function openingOnWall(o: Opening, wall: Wall): boolean {
  if (o.dir !== wallAxis(wall)) return false;
  const r = wall.rect;
  if (o.dir === "h") return o.y >= r.y && o.y <= r.y + r.d && o.x < r.x + r.w && o.x + o.w > r.x;
  return o.x >= r.x && o.x <= r.x + r.w && o.y < r.y + r.d && o.y + o.w > r.y;
}

export interface WallPiece {
  wallId: Id;
  kind: WallKind;
  rect: Rect;
  /** Bottom and top height of this piece, cm. */
  z0: number;
  z1: number;
}

function spanOf(o: Opening): [number, number] {
  return o.dir === "h" ? [o.x, o.x + o.w] : [o.y, o.y + o.w];
}

function pieceRect(wall: Rect, horizontal: boolean, s: number, e: number): Rect {
  return horizontal
    ? { x: s, y: wall.y, w: e - s, d: wall.d }
    : { x: wall.x, y: s, w: wall.w, d: e - s };
}

/**
 * Split walls around openings. Without `threeD` you get the floor-level
 * pieces for the 2D plan (openings are gaps). With `threeD` you also get the
 * lintel above every opening and the sill below every window.
 */
export function cutWalls(
  walls: readonly Wall[],
  openings: readonly Opening[],
  threeD = false,
): WallPiece[] {
  const out: WallPiece[] = [];
  for (const wall of walls) {
    const horizontal = isHorizontal(wall.rect);
    const start = horizontal ? wall.rect.x : wall.rect.y;
    const end = horizontal ? wall.rect.x + wall.rect.w : wall.rect.y + wall.rect.d;
    const on = openings.filter((o) => wall.kind !== "low" && openingOnWall(o, wall));
    let free: [number, number][] = [[start, end]];
    for (const o of on) {
      const [s, e] = spanOf(o);
      free = free.flatMap(([a, b]) => subtractInterval(a, b, s, e, MIN_PIECE));
    }
    for (const [s, e] of free) {
      out.push({
        wallId: wall.id,
        kind: wall.kind,
        rect: pieceRect(wall.rect, horizontal, s, e),
        z0: 0,
        z1: wall.height,
      });
    }
    if (!threeD) continue;
    for (const o of on) {
      const [s0, e0] = spanOf(o);
      const s = Math.max(s0, start),
        e = Math.min(e0, end);
      if (e - s < MIN_PIECE) continue;
      const rect = pieceRect(wall.rect, horizontal, s, e);
      const top = o.kind === "window" ? o.lintel : o.height;
      if (top < wall.height)
        out.push({ wallId: wall.id, kind: wall.kind, rect, z0: top, z1: wall.height });
      if (o.kind === "window" && o.sill > 0) {
        out.push({
          wallId: wall.id,
          kind: wall.kind,
          rect,
          z0: 0,
          z1: Math.min(o.sill, wall.height),
        });
      }
    }
  }
  return out;
}

export interface DoorSwing {
  /** Hinge position on the wall face. */
  hinge: Point;
  /** Leaf tip when closed (along the wall) and when open 90 degrees. */
  closed: Point;
  open: Point;
  radius: number;
  /** Square the leaf sweeps through, for collision checks. */
  area: Rect;
}

/**
 * Geometry of a door leaf swinging 90 degrees into side `swing`
 * (a = north/west, b = south/east) from a wall `thickness` cm thick.
 */
export function doorSwing(door: Door, thickness: number): DoorSwing {
  const r = door.w;
  const half = thickness / 2;
  const sign = door.swing === "a" ? -1 : 1;
  if (door.dir === "h") {
    const faceY = door.y + sign * half;
    const hingeX = door.hinge === "start" ? door.x : door.x + door.w;
    const tipX = door.hinge === "start" ? door.x + r : door.x;
    const hinge = { x: hingeX, y: faceY };
    return {
      hinge,
      closed: { x: tipX, y: faceY },
      open: { x: hingeX, y: faceY + sign * r },
      radius: r,
      area: { x: door.x, y: sign < 0 ? faceY - r : faceY, w: r, d: r },
    };
  }
  const faceX = door.x + sign * half;
  const hingeY = door.hinge === "start" ? door.y : door.y + door.w;
  const tipY = door.hinge === "start" ? door.y + r : door.y;
  return {
    hinge: { x: faceX, y: hingeY },
    closed: { x: faceX, y: tipY },
    open: { x: faceX + sign * r, y: hingeY },
    radius: r,
    area: { x: sign < 0 ? faceX - r : faceX, y: door.y, w: r, d: r },
  };
}

export interface OpeningProblem {
  field: string;
  message: string;
}

/** Sanity checks for heights; the editor shows these next to the inputs. */
export function validateOpening(o: Opening, wallHeight: number): OpeningProblem[] {
  const problems: OpeningProblem[] = [];
  if (o.w <= 0) problems.push({ field: "w", message: "Width must be positive" });
  if (o.kind !== "window") {
    if (o.height <= 0 || o.height > wallHeight)
      problems.push({ field: "height", message: "Door taller than wall" });
  } else {
    if (o.sill < 0) problems.push({ field: "sill", message: "Sill below floor" });
    if (o.lintel <= o.sill)
      problems.push({ field: "lintel", message: "Lintel must be above sill" });
    if (o.lintel > wallHeight) problems.push({ field: "lintel", message: "Lintel above ceiling" });
  }
  return problems;
}
