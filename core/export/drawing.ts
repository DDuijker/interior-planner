import { itemParts, partColor, resolveEntry } from "@/catalog";
import { roomArea, roomLabelPosition } from "../editor/rooms";
import { rotatePoint } from "../geometry/polygon";
import { boundingRect } from "../geometry/rect";
import { formatArea, formatLength } from "../measure/units";
import type {
  CustomItemDef,
  Fixture,
  Item,
  Point,
  Rect,
  Room,
  Unit,
  Version,
  Wall,
} from "../model/types";
import { doorSwing, type WallPiece } from "../openings/openings";

/**
 * A flat list of shapes describing a floor plan, in world centimetres.
 * The same list renders to SVG (screen, PNG) and to PDF (print at scale).
 */
export type Shape =
  | {
      kind: "poly";
      points: Point[];
      fill?: string;
      stroke?: string;
      width?: number;
      dash?: number[];
    }
  | { kind: "line"; points: Point[]; stroke: string; width: number; dash?: number[] }
  | {
      kind: "text";
      x: number;
      y: number;
      text: string;
      size: number;
      color: string;
      anchor: "start" | "middle" | "end";
      bold?: boolean;
    };

export interface DrawingOptions {
  unit: Unit;
  /** World cm per output point: sets line widths and text size. */
  px: number;
  items?: boolean;
  labels?: boolean;
  /** Overall dimension lines around the plan. */
  dimensions?: boolean;
  roomName?: (room: Room) => string;
  custom?: readonly CustomItemDef[];
  /** Hide everyday "life" items. */
  hideLife?: boolean;
  tints?: Partial<Record<Room["type"], string>>;
}

export interface Drawing {
  shapes: Shape[];
  bounds: Rect;
}

const INK = "#2A2620";
const MUTED = "#6A6357";
const WALL = "#2A2620";
const LOW = "#A9A58B";

function rectPoints(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
  ];
}

function ellipsePoints(cx: number, cy: number, rx: number, ry: number, segments = 24): Point[] {
  return Array.from({ length: segments }, (_, i) => {
    const t = (i / segments) * Math.PI * 2;
    return { x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) };
  });
}

function arcPoints(center: Point, from: Point, to: Point, segments = 12): Point[] {
  const a0 = Math.atan2(from.y - center.y, from.x - center.x);
  let a1 = Math.atan2(to.y - center.y, to.x - center.x);
  let delta = a1 - a0;
  if (delta > Math.PI) delta -= 2 * Math.PI;
  if (delta < -Math.PI) delta += 2 * Math.PI;
  a1 = a0 + delta;
  const r = Math.hypot(from.x - center.x, from.y - center.y);
  return Array.from({ length: segments + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / segments;
    return { x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) };
  });
}

function roomPolygons(room: Room): Point[][] {
  return room.shape.kind === "polygon" ? [room.shape.points] : room.shape.rects.map(rectPoints);
}

function fixtureShapes(f: Fixture, px: number): Shape[] {
  const c = { x: f.x + f.w / 2, y: f.y + f.d / 2 };
  const rot = (pts: Point[]) => pts.map((p) => rotatePoint(p, f.rotation, c));
  const out: Shape[] = [
    { kind: "poly", points: rot(rectPoints(f)), fill: "#FBF9F4", stroke: MUTED, width: px },
  ];
  if (f.type === "stairs") {
    const steps = Math.max(2, Math.floor(f.d / 25));
    for (let i = 1; i <= steps; i++) {
      const y = f.y + (i * f.d) / (steps + 1);
      out.push({
        kind: "line",
        points: rot([
          { x: f.x, y },
          { x: f.x + f.w, y },
        ]),
        stroke: MUTED,
        width: px * 0.7,
      });
    }
  } else if (f.type === "toilet" || f.type === "sink") {
    out.push({
      kind: "poly",
      points: rot(ellipsePoints(c.x, c.y + f.d * 0.1, f.w * 0.33, f.d * 0.3)),
      stroke: MUTED,
      width: px * 0.7,
    });
  } else if (f.type === "shower") {
    out.push({
      kind: "line",
      points: rot([
        { x: f.x, y: f.y },
        { x: f.x + f.w, y: f.y + f.d },
      ]),
      stroke: MUTED,
      width: px * 0.7,
    });
    out.push({
      kind: "line",
      points: rot([
        { x: f.x + f.w, y: f.y },
        { x: f.x, y: f.y + f.d },
      ]),
      stroke: MUTED,
      width: px * 0.7,
    });
  } else if (f.type === "bath") {
    out.push({
      kind: "poly",
      points: rot(rectPoints({ x: f.x + 6, y: f.y + 6, w: f.w - 12, d: f.d - 12 })),
      stroke: MUTED,
      width: px * 0.7,
    });
  }
  return out;
}

function itemShapes(
  item: Item,
  px: number,
  custom: readonly CustomItemDef[],
  showName: boolean,
): Shape[] {
  const entry = resolveEntry(item, custom);
  const parts = [...itemParts(item, custom)].sort((a, b) => a.z + a.h - (b.z + b.h));
  const centre = { x: item.x, y: item.y };
  const toWorld = (p: Point) =>
    rotatePoint({ x: item.x + p.x, y: item.y + p.y }, item.rotation, centre);
  const out: Shape[] = [];
  for (const part of parts) {
    const local =
      part.shape === "box"
        ? rectPoints({ x: part.x - part.w / 2, y: part.y - part.d / 2, w: part.w, d: part.d })
        : ellipsePoints(part.x, part.y, part.w / 2, part.d / 2, 16);
    out.push({
      kind: "poly",
      points: local.map(toWorld),
      fill: partColor(part, item, entry),
      stroke: INK,
      width: px * 0.4,
    });
  }
  if (showName && Math.min(item.w, item.d) > px * 30) {
    out.push({
      kind: "text",
      x: item.x,
      y: item.y + px * 4,
      text: item.name,
      size: px * 9,
      color: INK,
      anchor: "middle",
    });
  }
  return out;
}

/** Build the drawing for one version of a floor. */
export function buildDrawing(
  version: Version,
  walls: readonly Wall[],
  pieces: readonly WallPiece[],
  opts: DrawingOptions,
): Drawing {
  const { px, unit } = opts;
  const shapes: Shape[] = [];
  const tint = (r: Room) => opts.tints?.[r.type] ?? "#EFEBE1";

  for (const room of version.rooms)
    for (const poly of roomPolygons(room))
      shapes.push({ kind: "poly", points: poly, fill: tint(room) });

  for (const p of pieces)
    shapes.push({ kind: "poly", points: rectPoints(p.rect), fill: p.kind === "low" ? LOW : WALL });

  for (const o of version.openings) {
    const wall = walls.find((w) => w.id === o.wallId);
    const t = wall ? (o.dir === "h" ? wall.rect.d : wall.rect.w) : 10;
    const across =
      o.dir === "h"
        ? { x: o.x, y: o.y - t / 2, w: o.w, d: t }
        : { x: o.x - t / 2, y: o.y, w: t, d: o.w };
    if (o.kind === "window") {
      shapes.push({
        kind: "poly",
        points: rectPoints(across),
        fill: o.glass ? "#E3EAE2" : "#FFFFFF",
        stroke: WALL,
        width: px * 0.6,
      });
      const mid =
        o.dir === "h"
          ? [
              { x: o.x, y: o.y },
              { x: o.x + o.w, y: o.y },
            ]
          : [
              { x: o.x, y: o.y },
              { x: o.x, y: o.y + o.w },
            ];
      shapes.push({ kind: "line", points: mid, stroke: WALL, width: px * 0.6 });
    } else {
      shapes.push({ kind: "poly", points: rectPoints(across), fill: "#FFFFFF" });
      if (o.kind === "door") {
        const s = doorSwing(o, t);
        shapes.push({ kind: "line", points: [s.hinge, s.open], stroke: WALL, width: px * 1.2 });
        shapes.push({
          kind: "line",
          points: arcPoints(s.hinge, s.open, s.closed),
          stroke: MUTED,
          width: px * 0.6,
          dash: [px * 4, px * 3],
        });
      }
    }
  }

  for (const f of version.fixtures) shapes.push(...fixtureShapes(f, px));

  if (opts.items !== false) {
    const order = { floor: 0, stack: 1, wall: 2 } as const;
    const items = version.items
      .filter((i) => !(opts.hideLife && resolveEntry(i, opts.custom ?? [])?.life))
      .sort((a, b) => order[a.mount] - order[b.mount] || a.h - b.h);
    for (const item of items)
      shapes.push(...itemShapes(item, px, opts.custom ?? [], item.mount === "floor"));
  }

  if (opts.labels !== false) {
    for (const room of version.rooms) {
      if (room.labelHidden) continue;
      const p = roomLabelPosition(room);
      const name = opts.roomName?.(room) ?? room.name;
      shapes.push({
        kind: "text",
        x: p.x,
        y: p.y,
        text: name,
        size: px * 12,
        color: INK,
        anchor: "middle",
        bold: true,
      });
      shapes.push({
        kind: "text",
        x: p.x,
        y: p.y + px * 15,
        text: formatArea(roomArea(room), unit),
        size: px * 10,
        color: MUTED,
        anchor: "middle",
      });
    }
  }

  const bounds = boundingRect([
    ...walls.map((w) => w.rect),
    ...version.rooms.flatMap((r) =>
      r.shape.kind === "rects"
        ? r.shape.rects
        : [boundingRect(r.shape.points.map((p) => ({ ...p, w: 0, d: 0 })))!],
    ),
  ]) ?? { x: 0, y: 0, w: 100, d: 100 };

  if (opts.dimensions) {
    const gap = px * 25;
    const tick = px * 6;
    const top = bounds.y - gap;
    const left = bounds.x - gap;
    const line = (pts: Point[]) =>
      shapes.push({ kind: "line", points: pts, stroke: INK, width: px * 0.6 });
    line([
      { x: bounds.x, y: top },
      { x: bounds.x + bounds.w, y: top },
    ]);
    line([
      { x: bounds.x, y: top - tick },
      { x: bounds.x, y: top + tick },
    ]);
    line([
      { x: bounds.x + bounds.w, y: top - tick },
      { x: bounds.x + bounds.w, y: top + tick },
    ]);
    shapes.push({
      kind: "text",
      x: bounds.x + bounds.w / 2,
      y: top - px * 5,
      text: formatLength(bounds.w, unit),
      size: px * 10,
      color: INK,
      anchor: "middle",
    });
    line([
      { x: left, y: bounds.y },
      { x: left, y: bounds.y + bounds.d },
    ]);
    line([
      { x: left - tick, y: bounds.y },
      { x: left + tick, y: bounds.y },
    ]);
    line([
      { x: left - tick, y: bounds.y + bounds.d },
      { x: left + tick, y: bounds.y + bounds.d },
    ]);
    shapes.push({
      kind: "text",
      x: left - px * 5,
      y: bounds.y + bounds.d / 2,
      text: formatLength(bounds.d, unit),
      size: px * 10,
      color: INK,
      anchor: "end",
    });
    return {
      shapes,
      bounds: {
        x: left - px * 60,
        y: top - px * 20,
        w: bounds.w + gap + px * 60,
        d: bounds.d + gap + px * 20,
      },
    };
  }
  return { shapes, bounds };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const fmt = (v: number) => String(Math.round(v * 10) / 10);
const pts = (points: Point[]) => points.map((p) => `${fmt(p.x)},${fmt(p.y)}`).join(" ");

/** Render a drawing to standalone SVG markup. */
export function drawingToSvg(
  d: Drawing,
  opts: { width?: number; height?: number; padding?: number; background?: string } = {},
): string {
  const pad = opts.padding ?? 20;
  const vb = {
    x: d.bounds.x - pad,
    y: d.bounds.y - pad,
    w: d.bounds.w + 2 * pad,
    d: d.bounds.d + 2 * pad,
  };
  const size = opts.width
    ? ` width="${opts.width}" height="${opts.height ?? Math.round((opts.width * vb.d) / vb.w)}"`
    : "";
  const body = d.shapes
    .map((s) => {
      if (s.kind === "poly") {
        const stroke = s.stroke ? ` stroke="${s.stroke}" stroke-width="${fmt(s.width ?? 1)}"` : "";
        const dash = s.dash ? ` stroke-dasharray="${s.dash.map(fmt).join(" ")}"` : "";
        return `<polygon points="${pts(s.points)}" fill="${s.fill ?? "none"}"${stroke}${dash}/>`;
      }
      if (s.kind === "line") {
        const dash = s.dash ? ` stroke-dasharray="${s.dash.map(fmt).join(" ")}"` : "";
        return `<polyline points="${pts(s.points)}" fill="none" stroke="${s.stroke}" stroke-width="${fmt(s.width)}"${dash}/>`;
      }
      const weight = s.bold ? ` font-weight="700"` : "";
      return `<text x="${fmt(s.x)}" y="${fmt(s.y)}" font-size="${fmt(s.size)}" fill="${s.color}" text-anchor="${s.anchor}" font-family="Karla, Helvetica, Arial, sans-serif"${weight}>${esc(s.text)}</text>`;
    })
    .join("");
  const bg = opts.background
    ? `<rect x="${fmt(vb.x)}" y="${fmt(vb.y)}" width="${fmt(vb.w)}" height="${fmt(vb.d)}" fill="${opts.background}"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${fmt(vb.x)} ${fmt(vb.y)} ${fmt(vb.w)} ${fmt(vb.d)}"${size}>${bg}${body}</svg>`;
}
