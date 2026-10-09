import { polygonArea } from "../geometry/polygon";
import { rectFromPoints, subtractRect } from "../geometry/rect";
import type { Point, Rect, Room, Wall } from "../model/types";
import { isHorizontal } from "../walls/generate";

/**
 * Pure helpers for drawing and reshaping the plan by hand (E06).
 */

export const ANGLE_STEP = 45;

/** Snap `p` so the segment from `from` runs at a multiple of 45 degrees. */
export function snapDirection(from: Point, p: Point, step = ANGLE_STEP): Point {
  const dx = p.x - from.x,
    dy = p.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return p;
  const angle =
    Math.round(Math.atan2(dy, dx) / ((step * Math.PI) / 180)) * ((step * Math.PI) / 180);
  return { x: round1(from.x + Math.cos(angle) * len), y: round1(from.y + Math.sin(angle) * len) };
}

/** Point at `length` cm from `from` in the direction of `towards`. */
export function pointAtLength(from: Point, towards: Point, length: number): Point {
  const dx = towards.x - from.x,
    dy = towards.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: round1(from.x + (dx / len) * length), y: round1(from.y + (dy / len) * length) };
}

const round1 = (v: number) => Math.round(v * 10) / 10 + 0;

/** Rectangle room from a drag. Returns null if it is too small to be a room. */
export function rectRoomShape(a: Point, b: Point, min = 30): Room["shape"] | null {
  const r = rectFromPoints(a, b);
  if (r.w < min || r.d < min) return null;
  return { kind: "rects", rects: [r] };
}

/**
 * L-shaped room: the outer rectangle minus a notch. The notch must touch a
 * corner of the outer rectangle, otherwise the result is not an L.
 */
export function lRoomShape(outer: Rect, notch: Rect): Room["shape"] | null {
  const touches =
    (Math.abs(notch.x - outer.x) < 1 || Math.abs(notch.x + notch.w - (outer.x + outer.w)) < 1) &&
    (Math.abs(notch.y - outer.y) < 1 || Math.abs(notch.y + notch.d - (outer.y + outer.d)) < 1);
  if (!touches) return null;
  const rest = subtractRect(outer, notch);
  if (rest.length !== 2) return null;
  return { kind: "rects", rects: rest };
}

/** Clamp a notch drag inside the outer rect and pull it into the nearest corner. */
export function notchInCorner(outer: Rect, a: Point, b: Point): Rect {
  const r = rectFromPoints(a, b);
  const w = Math.min(r.w, outer.w - 10),
    d = Math.min(r.d, outer.d - 10);
  const cx = r.x + r.w / 2,
    cy = r.y + r.d / 2;
  const left = cx < outer.x + outer.w / 2;
  const top = cy < outer.y + outer.d / 2;
  return {
    x: left ? outer.x : outer.x + outer.w - w,
    y: top ? outer.y : outer.y + outer.d - d,
    w,
    d,
  };
}

/** Is `p` close enough to the first point to close the polygon? */
export function closesPolygon(points: readonly Point[], p: Point, tolerance: number): boolean {
  return points.length >= 3 && Math.hypot(p.x - points[0]!.x, p.y - points[0]!.y) <= tolerance;
}

/** Remove repeated and collinear points; null when fewer than 3 remain. */
export function cleanPolygon(points: readonly Point[]): Point[] | null {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.5) out.push(p);
  }
  if (
    out.length > 1 &&
    Math.hypot(out[0]!.x - out[out.length - 1]!.x, out[0]!.y - out[out.length - 1]!.y) <= 0.5
  )
    out.pop();
  const simplified = out.filter((p, i) => {
    const a = out[(i - 1 + out.length) % out.length]!,
      c = out[(i + 1) % out.length]!;
    return Math.abs((p.x - a.x) * (c.y - a.y) - (p.y - a.y) * (c.x - a.x)) > 1e-6;
  });
  return simplified.length >= 3 && polygonArea(simplified) > 1 ? simplified : null;
}

// ------------------------------------------------------- rooms from walls

export interface Segment {
  a: Point;
  b: Point;
}

const key = (p: Point) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;

function intersect(s: Segment, t: Segment): Point | null {
  const d = (s.b.x - s.a.x) * (t.b.y - t.a.y) - (s.b.y - s.a.y) * (t.b.x - t.a.x);
  if (Math.abs(d) < 1e-9) return null;
  const u = ((t.a.x - s.a.x) * (t.b.y - t.a.y) - (t.a.y - s.a.y) * (t.b.x - t.a.x)) / d;
  const v = ((t.a.x - s.a.x) * (s.b.y - s.a.y) - (t.a.y - s.a.y) * (s.b.x - s.a.x)) / d;
  if (u < -1e-9 || u > 1 + 1e-9 || v < -1e-9 || v > 1 + 1e-9) return null;
  return { x: s.a.x + u * (s.b.x - s.a.x), y: s.a.y + u * (s.b.y - s.a.y) };
}

/**
 * Closed areas formed by drawn wall centre lines. Segments are split where
 * they cross, then the smallest faces of the planar graph are traced.
 * Returns polygons (clockwise in plan coordinates), largest first.
 */
export function facesFromSegments(segments: readonly Segment[], minArea = 1000): Point[][] {
  // 1. Split at intersections and at endpoints lying on other segments.
  const cuts = segments.map(() => [0, 1]);
  segments.forEach((s, i) =>
    segments.forEach((t, j) => {
      if (i >= j) return;
      const p = intersect(s, t);
      if (!p) return;
      const len = (q: Segment) => Math.hypot(q.b.x - q.a.x, q.b.y - q.a.y) || 1;
      cuts[i]!.push(Math.hypot(p.x - s.a.x, p.y - s.a.y) / len(s));
      cuts[j]!.push(Math.hypot(p.x - t.a.x, p.y - t.a.y) / len(t));
    }),
  );
  const nodes = new Map<string, Point>();
  const adj = new Map<string, Set<string>>();
  const node = (p: Point) => {
    const k = key(p);
    if (!nodes.has(k)) {
      nodes.set(k, { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 });
      adj.set(k, new Set());
    }
    return k;
  };
  segments.forEach((s, i) => {
    const ts = [...new Set(cuts[i]!.map((v) => Math.round(v * 1e6) / 1e6))].sort((a, b) => a - b);
    for (let k = 0; k < ts.length - 1; k++) {
      const p = { x: s.a.x + (s.b.x - s.a.x) * ts[k]!, y: s.a.y + (s.b.y - s.a.y) * ts[k]! };
      const q = {
        x: s.a.x + (s.b.x - s.a.x) * ts[k + 1]!,
        y: s.a.y + (s.b.y - s.a.y) * ts[k + 1]!,
      };
      const a = node(p),
        b = node(q);
      if (a === b) continue;
      adj.get(a)!.add(b);
      adj.get(b)!.add(a);
    }
  });
  // 2. Drop dangling edges (walls that end in the open).
  let pruned = true;
  while (pruned) {
    pruned = false;
    for (const [k, set] of adj) {
      if (set.size === 1) {
        const other = [...set][0]!;
        adj.get(other)!.delete(k);
        set.clear();
        pruned = true;
      }
    }
  }
  // 3. Trace faces: always take the next edge turning most to the right.
  const angle = (from: string, to: string) => {
    const a = nodes.get(from)!,
      b = nodes.get(to)!;
    return Math.atan2(b.y - a.y, b.x - a.x);
  };
  const used = new Set<string>();
  const faces: Point[][] = [];
  for (const [start, set] of adj) {
    for (const next of set) {
      if (used.has(`${start}>${next}`)) continue;
      const face: string[] = [start];
      let prev = start,
        cur = next;
      used.add(`${start}>${next}`);
      let guard = 0;
      while (cur !== start && guard++ < 10000) {
        face.push(cur);
        const back = angle(cur, prev);
        let best: string | null = null;
        let bestTurn = Infinity;
        for (const cand of adj.get(cur)!) {
          if (cand === prev && adj.get(cur)!.size > 1) continue;
          let turn = angle(cur, cand) - back;
          while (turn <= 0) turn += 2 * Math.PI;
          if (turn < bestTurn) {
            bestTurn = turn;
            best = cand;
          }
        }
        if (!best) break;
        used.add(`${cur}>${best}`);
        prev = cur;
        cur = best;
      }
      if (cur !== start) continue;
      const poly = face.map((k) => nodes.get(k)!);
      // With this turning rule inner faces come out with negative signed area
      // (y down); the outer boundary is the positive one and is skipped.
      let signed = 0;
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i]!,
          q = poly[(i + 1) % poly.length]!;
        signed += p.x * q.y - q.x * p.y;
      }
      if (-signed / 2 > minArea) {
        const clean = cleanPolygon(poly.reverse());
        if (clean) faces.push(clean);
      }
    }
  }
  return faces.sort((a, b) => polygonArea(b) - polygonArea(a));
}

/** Turn an axis-aligned rectangle polygon into a rect shape (nicer to edit). */
export function shapeFromPolygon(points: Point[]): Room["shape"] {
  if (points.length === 4) {
    const xs = [...new Set(points.map((p) => p.x))],
      ys = [...new Set(points.map((p) => p.y))];
    if (xs.length === 2 && ys.length === 2) {
      return {
        kind: "rects",
        rects: [rectFromPoints({ x: xs[0]!, y: ys[0]! }, { x: xs[1]!, y: ys[1]! })],
      };
    }
  }
  return { kind: "polygon", points };
}

// ------------------------------------------------------- moving walls

export interface WallLine {
  axis: "h" | "v";
  /** y for horizontal walls, x for vertical ones. */
  at: number;
  from: number;
  to: number;
}

/**
 * The room edge a wall stands on. Interior walls are centred on the edge;
 * exterior and low walls sit outside the room, so the edge is their inner face.
 */
export function wallLine(wall: Wall): WallLine {
  const r = wall.rect;
  if (isHorizontal(r)) {
    const at =
      wall.kind === "interior" ? r.y + r.d / 2 : wall.rooms.a && !wall.rooms.b ? r.y : r.y + r.d;
    return { axis: "h", at, from: r.x, to: r.x + r.w };
  }
  const at =
    wall.kind === "interior" ? r.x + r.w / 2 : wall.rooms.a && !wall.rooms.b ? r.x : r.x + r.w;
  return { axis: "v", at, from: r.y, to: r.y + r.d };
}

/** Move every room edge lying on `line` by `delta` (perpendicular to it). */
export function moveWallLine(
  rooms: readonly Room[],
  line: WallLine,
  delta: number,
  tolerance = 3,
): Room[] {
  const on = (v: number) => Math.abs(v - line.at) <= tolerance;
  const overlaps = (a: number, b: number) =>
    Math.min(a, b) < line.to - tolerance && Math.max(a, b) > line.from + tolerance;
  return rooms.map((room) => {
    if (room.shape.kind === "polygon") {
      const pts = room.shape.points;
      const moved = pts.map((p, i) => {
        const neighbours = [pts[(i - 1 + pts.length) % pts.length]!, pts[(i + 1) % pts.length]!];
        const onLine = line.axis === "h" ? on(p.y) : on(p.x);
        const alongEdge = neighbours.some((n) =>
          line.axis === "h" ? on(n.y) && overlaps(p.x, n.x) : on(n.x) && overlaps(p.y, n.y),
        );
        if (!onLine || !alongEdge) return p;
        return line.axis === "h" ? { ...p, y: p.y + delta } : { ...p, x: p.x + delta };
      });
      return moved.some((p, i) => p !== pts[i])
        ? { ...room, shape: { kind: "polygon", points: moved } }
        : room;
    }
    let changed = false;
    const rects = room.shape.rects.map((r) => {
      const next = { ...r };
      if (line.axis === "h" && overlaps(r.x, r.x + r.w)) {
        if (on(r.y)) {
          next.y += delta;
          next.d -= delta;
        } else if (on(r.y + r.d)) next.d += delta;
      }
      if (line.axis === "v" && overlaps(r.y, r.y + r.d)) {
        if (on(r.x)) {
          next.x += delta;
          next.w -= delta;
        } else if (on(r.x + r.w)) next.w += delta;
      }
      if (next.x !== r.x || next.y !== r.y || next.w !== r.w || next.d !== r.d) changed = true;
      return next;
    });
    if (!changed || rects.some((r) => r.w < 10 || r.d < 10)) return room;
    return { ...room, shape: { kind: "rects", rects } };
  });
}

/** Move one polygon vertex (or one rect corner) of a room. */
export function moveVertex(room: Room, index: number, to: Point): Room {
  if (room.shape.kind === "polygon") {
    const points = room.shape.points.map((p, i) => (i === index ? to : p));
    return cleanPolygon(points) ? { ...room, shape: { kind: "polygon", points } } : room;
  }
  // Rect corners are numbered 4 per rect: nw, ne, se, sw.
  const ri = Math.floor(index / 4),
    corner = index % 4;
  const r = room.shape.rects[ri];
  if (!r) return room;
  const opposite = [
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
  ][corner]!;
  const next = rectFromPoints(opposite, to);
  if (next.w < 10 || next.d < 10) return room;
  return {
    ...room,
    shape: { kind: "rects", rects: room.shape.rects.map((x, i) => (i === ri ? next : x)) },
  };
}

/** Vertices that can be dragged: polygon points or the corners of each rect. */
export function roomVertices(room: Room): Point[] {
  if (room.shape.kind === "polygon") return room.shape.points;
  return room.shape.rects.flatMap((r) => [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
  ]);
}

// ------------------------------------------------- background image scale

/**
 * New background scale (cm per image pixel) from two points the user
 * clicked (in world cm, at the current scale) and the real distance.
 */
export function scaleFromReference(
  a: Point,
  b: Point,
  realLength: number,
  currentScale: number,
): number {
  const world = Math.hypot(b.x - a.x, b.y - a.y);
  if (world <= 0 || realLength <= 0) return currentScale;
  const pixels = world / currentScale;
  return realLength / pixels;
}
