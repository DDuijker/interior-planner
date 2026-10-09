import { rotatePoint } from "../geometry/polygon";
import type { Fixture, Floor, Point, Project, Rect, Room } from "../model/types";
import { roomLabelAnchor } from "../editor/rooms";

/**
 * Pure maths for the 3D view. Coordinates: plan x, plan y, z up, in cm.
 * The three.js layer maps plan y to world z and z to world y.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

// ------------------------------------------------------------------ stairs

export interface Step {
  /** Footprint centre in plan coordinates. */
  x: number;
  y: number;
  w: number;
  d: number;
  /** Bottom and top of the step block. */
  z0: number;
  z1: number;
  rotation: number;
}

export interface StairCheck {
  risers: number;
  riserHeight: number;
  tread: number;
  /** Pitch of the stairs in degrees. */
  angle: number;
  /** Steeper than 45 degrees or risers over 22 cm. */
  tooSteep: boolean;
}

const UP_ANGLE = { N: 0, E: 90, S: 180, W: 270 } as const;

/** Run length of the walking line, in cm. */
function runLength(f: Fixture): number {
  const shape = f.stair?.shape ?? "straight";
  if (shape === "spiral") return Math.PI * Math.min(f.w, f.d) * 0.35 * 1.5;
  if (shape === "l") return Math.max(f.w, f.d) + Math.min(f.w, f.d) * 0.5;
  return Math.max(f.w, f.d);
}

/** Number of risers for a floor height: about 18 cm each. */
export function riserCount(floorHeight: number): number {
  return Math.max(2, Math.round(floorHeight / 18));
}

export function checkStairs(f: Fixture, floorHeight: number): StairCheck {
  const risers = riserCount(floorHeight);
  const riserHeight = floorHeight / risers;
  const run = runLength(f);
  const tread = run / (risers - 1);
  const angle = (Math.atan2(floorHeight, run) * 180) / Math.PI;
  return { risers, riserHeight, tread, angle, tooSteep: angle > 45 || riserHeight > 22 };
}

/**
 * Step blocks for a stairs fixture. The fixture's local frame has "up" along
 * -y before rotation (walking north); `stair.up` and `rotation` turn it.
 */
export function stairSteps(f: Fixture, floorHeight: number): Step[] {
  const shape = f.stair?.shape ?? "straight";
  const risers = riserCount(floorHeight);
  const rise = floorHeight / risers;
  const turn = (f.rotation + UP_ANGLE[f.stair?.up ?? "N"]) % 360;
  const centre = { x: f.x + f.w / 2, y: f.y + f.d / 2 };
  // Work in a frame where the long side runs along y and you walk towards -y.
  const swap = turn % 180 !== 0;
  const W = swap ? f.d : f.w;
  const D = swap ? f.w : f.d;
  const local: { x: number; y: number; w: number; d: number; rot: number }[] = [];
  if (shape === "spiral") {
    const r = Math.min(W, D) / 2;
    for (let i = 0; i < risers; i++) {
      const a = (i / risers) * Math.PI * 1.5;
      local.push({
        x: Math.cos(a) * r * 0.5,
        y: Math.sin(a) * r * 0.5,
        w: r,
        d: Math.max(12, (2 * Math.PI * r * 0.5 * 0.75) / risers + 4),
        rot: (a * 180) / Math.PI + 90,
      });
    }
  } else if (shape === "l") {
    const first = Math.ceil(risers * 0.6);
    const depth = D - W;
    const t1 = depth / first;
    for (let i = 0; i < first; i++)
      local.push({ x: 0, y: D / 2 - t1 * (i + 0.5), w: W, d: t1, rot: 0 });
    const second = risers - first;
    const t2 = W / Math.max(1, second);
    for (let i = 0; i < second; i++)
      local.push({ x: -W / 2 + t2 * (i + 0.5), y: -D / 2 + W / 2, w: t2, d: W, rot: 0 });
  } else {
    const t = D / risers;
    for (let i = 0; i < risers; i++)
      local.push({ x: 0, y: D / 2 - t * (i + 0.5), w: W, d: t, rot: 0 });
  }
  return local.map((s, i) => {
    const p = rotatePoint({ x: centre.x + s.x, y: centre.y + s.y }, turn, centre);
    return {
      x: p.x,
      y: p.y,
      w: s.w,
      d: s.d,
      z0: 0,
      z1: rise * (i + 1),
      rotation: (turn + s.rot) % 360,
    };
  });
}

/** Area to cut out of the floor above (axis-aligned bounds of the stairs). */
export function stairwell(f: Fixture): Rect {
  const c = { x: f.x + f.w / 2, y: f.y + f.d / 2 };
  const pts = [
    { x: f.x, y: f.y },
    { x: f.x + f.w, y: f.y },
    { x: f.x + f.w, y: f.y + f.d },
    { x: f.x, y: f.y + f.d },
  ].map((p) => rotatePoint(p, f.rotation, c));
  const xs = pts.map((p) => p.x),
    ys = pts.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    d: Math.max(...ys) - Math.min(...ys),
  };
}

// ---------------------------------------------------------- floor stacking

export const SLAB = 25;
export type StackMode = "single" | "all" | "exploded";

/** Base height of every floor: the floors below plus slabs, extra gap when exploded. */
export function floorBases(
  project: Pick<Project, "floors">,
  mode: StackMode,
  gap = 200,
): Map<string, number> {
  const sorted = [...project.floors].sort((a, b) => a.level - b.level);
  const groundIndex = Math.max(
    0,
    sorted.findIndex((f) => f.level >= 0),
  );
  const bases = new Map<string, number>();
  let z = 0;
  for (let i = groundIndex; i < sorted.length; i++) {
    bases.set(sorted[i]!.id, z);
    z += sorted[i]!.height + SLAB + (mode === "exploded" ? gap : 0);
  }
  z = 0;
  for (let i = groundIndex - 1; i >= 0; i--) {
    z -= sorted[i]!.height + SLAB + (mode === "exploded" ? gap : 0);
    bases.set(sorted[i]!.id, z);
  }
  return bases;
}

/** Floors to draw for a mode, lowest first. */
export function visibleFloors(
  project: Pick<Project, "floors" | "activeFloorId">,
  mode: StackMode,
  hidden: ReadonlySet<string> = new Set(),
): Floor[] {
  const sorted = [...project.floors].sort((a, b) => a.level - b.level);
  if (mode === "single") return sorted.filter((f) => f.id === project.activeFloorId);
  return sorted.filter((f) => !hidden.has(f.id));
}

// -------------------------------------------------------------- viewpoints

export interface Viewpoint {
  position: Vec3;
  target: Vec3;
}

export function topView(bounds: Rect, base = 0): Viewpoint {
  const c = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.d / 2 };
  const h = Math.max(bounds.w, bounds.d) * 1.4 + 300;
  return { position: { x: c.x, y: c.y + 1, z: base + h }, target: { x: c.x, y: c.y, z: base } };
}

export function birdView(bounds: Rect, base = 0): Viewpoint {
  const c = { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.d / 2 };
  const r = Math.max(bounds.w, bounds.d);
  return {
    position: { x: c.x + r * 0.7, y: c.y + r * 0.9, z: base + r * 0.8 },
    target: { x: c.x, y: c.y, z: base },
  };
}

/** Standing in a room corner-ish, looking across it at eye height. */
export function roomView(room: Room, eyeHeight: number, base = 0): Viewpoint {
  const c = roomLabelAnchor(room);
  const rects = room.shape.kind === "rects" ? room.shape.rects : [];
  const r = rects[0] ?? { x: c.x - 100, y: c.y - 100, w: 200, d: 200 };
  const from = { x: r.x + r.w * 0.15, y: r.y + r.d * 0.85 };
  return {
    position: { x: from.x, y: from.y, z: base + eyeHeight },
    target: { x: c.x, y: c.y, z: base + eyeHeight * 0.8 },
  };
}

/** Ease between two viewpoints (t from 0 to 1). */
export function lerpView(a: Viewpoint, b: Viewpoint, t: number): Viewpoint {
  const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  const mix = (p: Vec3, q: Vec3): Vec3 => ({
    x: p.x + (q.x - p.x) * e,
    y: p.y + (q.y - p.y) * e,
    z: p.z + (q.z - p.z) * e,
  });
  return { position: mix(a.position, b.position), target: mix(a.target, b.target) };
}

// --------------------------------------------------------------- daylight

/**
 * Direction the sunlight comes from (unit vector pointing to the sun) for a
 * time of day in hours, in plan coordinates. `northAngle` is the compass
 * angle of plan-up; the sun rises in the east, peaks south at noon (NL).
 */
export function sunDirection(hour: number, northAngle = 0): Vec3 {
  const t = Math.min(1, Math.max(0, (hour - 6) / 14));
  const azimuth = 90 + t * 180; // east (90) via south (180) to west (270)
  const elevation = Math.sin(t * Math.PI) * 55 + 3;
  const a = ((azimuth - northAngle) * Math.PI) / 180;
  const e = (elevation * Math.PI) / 180;
  // Plan: north is -y, east is +x.
  return { x: Math.sin(a) * Math.cos(e), y: -Math.cos(a) * Math.cos(e), z: Math.sin(e) };
}

/** 0 at night, 1 at midday. */
export function daylight(hour: number): number {
  if (hour <= 6 || hour >= 21) return 0;
  return Math.max(0, Math.sin(((hour - 6) / 15) * Math.PI));
}

// ------------------------------------------------------------ light budget

export interface LightSource {
  id: string;
  position: Vec3;
  intensity: number;
}

/** Keep the lights that matter most from where you look: bright and close. */
export function pickLights<T extends LightSource>(
  lights: readonly T[],
  eye: Vec3,
  max: number,
): T[] {
  const score = (l: T) =>
    l.intensity /
    (1 +
      ((l.position.x - eye.x) ** 2 + (l.position.y - eye.y) ** 2 + (l.position.z - eye.z) ** 2) /
        250000);
  return [...lights].sort((a, b) => score(b) - score(a)).slice(0, Math.max(0, max));
}

// --------------------------------------------------------------- walking

/** Move a walker of radius `r` out of every obstacle rect it overlaps. */
export function collide(p: Point, r: number, obstacles: readonly Rect[]): Point {
  let q = { ...p };
  for (let pass = 0; pass < 3; pass++) {
    for (const o of obstacles) {
      const cx = Math.max(o.x, Math.min(q.x, o.x + o.w));
      const cy = Math.max(o.y, Math.min(q.y, o.y + o.d));
      const dx = q.x - cx,
        dy = q.y - cy;
      const dist = Math.hypot(dx, dy);
      if (dist >= r) continue;
      if (dist > 1e-6) {
        q = { x: cx + (dx / dist) * r, y: cy + (dy / dist) * r };
      } else {
        // Centre inside the rect: push out along the shortest axis.
        const left = q.x - o.x,
          right = o.x + o.w - q.x,
          top = q.y - o.y,
          bottom = o.y + o.d - q.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) q.x = o.x - r;
        else if (m === right) q.x = o.x + o.w + r;
        else if (m === top) q.y = o.y - r;
        else q.y = o.y + o.d + r;
      }
    }
  }
  return q;
}

/** How far up the stairs a point is (0 at the bottom step, 1 at the top), or null if not on them. */
export function stairProgress(f: Fixture, p: Point): number | null {
  const c = { x: f.x + f.w / 2, y: f.y + f.d / 2 };
  const turn = (f.rotation + UP_ANGLE[f.stair?.up ?? "N"]) % 360;
  const local = rotatePoint(p, -turn, c);
  const swap = turn % 180 !== 0;
  const W = swap ? f.d : f.w,
    D = swap ? f.w : f.d;
  if (Math.abs(local.x - c.x) > W / 2 || Math.abs(local.y - c.y) > D / 2) return null;
  return Math.min(1, Math.max(0, (c.y + D / 2 - local.y) / D));
}

// --------------------------------------------------------------- quality

export type QualityLevel = "low" | "medium" | "high";

export interface QualityPreset {
  pixelRatio: number;
  shadows: boolean;
  textureSize: number;
  /** Draw small decor (vases, books, plants on shelves). */
  decor: boolean;
  maxLights: number;
  antialias: boolean;
}

export const QUALITY: Record<QualityLevel, QualityPreset> = {
  low: {
    pixelRatio: 1,
    shadows: false,
    textureSize: 128,
    decor: false,
    maxLights: 2,
    antialias: false,
  },
  medium: {
    pixelRatio: 1.5,
    shadows: false,
    textureSize: 256,
    decor: true,
    maxLights: 4,
    antialias: true,
  },
  high: {
    pixelRatio: 2,
    shadows: true,
    textureSize: 512,
    decor: true,
    maxLights: 8,
    antialias: true,
  },
};

/**
 * Automatic quality: step down when the median frame time of the last
 * samples is above ~33 ms (below 30 fps), step up when it is under 14 ms.
 */
export function adjustQuality(current: QualityLevel, frameTimes: readonly number[]): QualityLevel {
  if (frameTimes.length < 30) return current;
  const sorted = [...frameTimes].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)]!;
  const order: QualityLevel[] = ["low", "medium", "high"];
  const i = order.indexOf(current);
  if (median > 33 && i > 0) return order[i - 1]!;
  if (median < 14 && i < order.length - 1) return order[i + 1]!;
  return current;
}
