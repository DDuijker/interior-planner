import type { FloorFinish, Point, WallFinish } from "../model/types";
import { rng } from "./style";

/**
 * Procedural patterns as drawing instructions (cm, y down from the top-left).
 * The 3D view paints them onto canvas textures; nothing is downloaded.
 */
export type PatternShape =
  | {
      kind: "rect";
      x: number;
      y: number;
      w: number;
      h: number;
      fill?: string;
      stroke?: string;
      lineWidth?: number;
    }
  | { kind: "poly"; points: Point[]; fill?: string; stroke?: string; lineWidth?: number }
  | {
      kind: "ellipse";
      cx: number;
      cy: number;
      rx: number;
      ry: number;
      rotation: number;
      fill: string;
    }
  | { kind: "line"; points: Point[]; stroke: string; lineWidth: number };

export interface Pattern {
  background: string;
  shapes: PatternShape[];
}

function hex(c: string): [number, number, number] {
  const v = parseInt(c.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** Lighten (amount > 0) or darken (< 0) a colour, amount in -1..1. */
export function shade(color: string, amount: number): string {
  const [r, g, b] = hex(color);
  const f = (v: number) =>
    Math.round(Math.min(255, Math.max(0, amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

const MAX_SHAPES = 6000;

function planks(
  w: number,
  h: number,
  color: string,
  joint: string,
  width: number,
  random: () => number,
): PatternShape[] {
  const out: PatternShape[] = [];
  const length = width * 9;
  for (let y = 0, row = 0; y < h && out.length < MAX_SHAPES; y += width, row++) {
    let x = -((row * 0.37 * length) % length);
    while (x < w) {
      const l = length * (0.7 + random() * 0.6);
      out.push({
        kind: "rect",
        x,
        y,
        w: l,
        h: width,
        fill: shade(color, (random() - 0.5) * 0.14),
        stroke: joint,
        lineWidth: 0.3,
      });
      x += l;
    }
  }
  return out;
}

/** Herringbone (rotate = 45) or chevron/Hongaarse punt (pointed). */
function herringbone(
  w: number,
  h: number,
  color: string,
  joint: string,
  width: number,
  random: () => number,
  chevron: boolean,
): PatternShape[] {
  const out: PatternShape[] = [];
  const L = width * 5;
  const s = Math.SQRT1_2;
  const stepY = width / s;
  const colW = L * s;
  for (let col = -1; col * colW < w + colW && out.length < MAX_SHAPES; col++) {
    const x0 = col * colW;
    const right = col % 2 === 0;
    for (let y = -L; y < h + L; y += stepY) {
      const fill = shade(color, (random() - 0.5) * 0.14);
      const off = chevron ? 0 : right ? stepY / 2 : 0;
      const top = y + off;
      // A plank as a parallelogram leaning left or right across the column.
      const points = right
        ? [
            { x: x0, y: top },
            { x: x0 + colW, y: top - colW },
            { x: x0 + colW, y: top - colW + stepY },
            { x: x0, y: top + stepY },
          ]
        : [
            { x: x0, y: top - colW },
            { x: x0 + colW, y: top },
            { x: x0 + colW, y: top + stepY },
            { x: x0, y: top - colW + stepY },
          ];
      out.push({ kind: "poly", points, fill, stroke: joint, lineWidth: 0.3 });
    }
  }
  return out;
}

function tiles(
  w: number,
  h: number,
  a: string,
  b: string | null,
  joint: string,
  size: number,
  random: () => number,
): PatternShape[] {
  const out: PatternShape[] = [];
  for (let y = 0, r = 0; y < h && out.length < MAX_SHAPES; y += size, r++) {
    for (let x = 0, c = 0; x < w; x += size, c++) {
      const fill = b && (r + c) % 2 ? b : shade(a, (random() - 0.5) * 0.06);
      out.push({
        kind: "rect",
        x,
        y,
        w: size,
        h: size,
        fill,
        stroke: joint,
        lineWidth: b ? 0.15 : 0.5,
      });
    }
  }
  return out;
}

function speckles(
  w: number,
  h: number,
  colors: string[],
  density: number,
  size: number,
  random: () => number,
): PatternShape[] {
  const out: PatternShape[] = [];
  const n = Math.min(MAX_SHAPES, Math.round((w * h * density) / 10000));
  for (let i = 0; i < n; i++) {
    const r = size * (0.4 + random());
    out.push({
      kind: "ellipse",
      cx: random() * w,
      cy: random() * h,
      rx: r,
      ry: r * (0.6 + random() * 0.6),
      rotation: random() * Math.PI,
      fill: colors[Math.floor(random() * colors.length)]!,
    });
  }
  return out;
}

export function floorPattern(f: FloorFinish, w: number, h: number, seed = 1): Pattern {
  const random = rng(seed);
  const color = f.color ?? "#C9B8A0";
  const joint = f.jointColor ?? shade(color, -0.35);
  switch (f.kind) {
    case "planks":
      return { background: color, shapes: planks(w, h, color, joint, f.plankWidth ?? 14, random) };
    case "herringbone":
      return {
        background: color,
        shapes: herringbone(w, h, color, joint, f.plankWidth ?? 9, random, false),
      };
    case "chevron":
      return {
        background: color,
        shapes: herringbone(w, h, color, joint, f.plankWidth ?? 10, random, true),
      };
    case "checker":
      return {
        background: color,
        shapes: tiles(w, h, color, f.color2 ?? "#2A2620", joint, f.tileSize ?? 40, random),
      };
    case "tiles":
      return {
        background: color,
        shapes: tiles(w, h, color, null, f.jointColor ?? "#E7DFD2", f.tileSize ?? 30, random),
      };
    case "terrazzo":
      return {
        background: color,
        shapes: speckles(
          w,
          h,
          [f.color2 ?? "#87A08C", shade(color, -0.3), shade(color, -0.15), "#FFFFFF"],
          220,
          1.4,
          random,
        ),
      };
    case "carpet":
      return {
        background: color,
        shapes: speckles(w, h, [shade(color, 0.05), shade(color, -0.05)], 400, 0.6, random),
      };
    case "concrete":
      return {
        background: color,
        shapes: speckles(w, h, [shade(color, 0.06), shade(color, -0.06)], 60, 6, random),
      };
    default:
      return { background: color, shapes: [] };
  }
}

function stripes(w: number, h: number, a: string, b: string): PatternShape[] {
  const out: PatternShape[] = [];
  for (let x = 0; x < w && out.length < MAX_SHAPES; x += 16)
    out.push({ kind: "rect", x: x + 8, y: 0, w: 8, h, fill: b });
  void a;
  return out;
}

function botanical(w: number, h: number, motif: string, random: () => number): PatternShape[] {
  const out: PatternShape[] = [];
  for (let y = 10; y < h && out.length < MAX_SHAPES; y += 28) {
    for (let x = ((y / 28) % 2) * 14 + 6; x < w; x += 28) {
      const stem = { x: x + (random() - 0.5) * 4, y: y + (random() - 0.5) * 4 };
      out.push({
        kind: "line",
        points: [stem, { x: stem.x + 6, y: stem.y + 12 }],
        stroke: shade(motif, -0.2),
        lineWidth: 0.5,
      });
      for (let k = 0; k < 3; k++) {
        out.push({
          kind: "ellipse",
          cx: stem.x + 2 * k,
          cy: stem.y + 4 * k,
          rx: 4,
          ry: 1.6,
          rotation: (k % 2 ? 0.6 : -0.6) + random() * 0.2,
          fill: motif,
        });
      }
    }
  }
  return out;
}

function toile(w: number, h: number, motif: string): PatternShape[] {
  const out: PatternShape[] = [];
  for (let y = 20; y < h && out.length < MAX_SHAPES; y += 50) {
    for (let x = ((y / 50) % 2) * 30 + 15; x < w; x += 60) {
      out.push({
        kind: "line",
        points: [
          { x: x - 12, y: y + 8 },
          { x: x - 4, y: y - 6 },
          { x: x + 6, y: y + 2 },
          { x: x + 14, y: y - 8 },
        ],
        stroke: motif,
        lineWidth: 0.8,
      });
      out.push({ kind: "ellipse", cx: x, cy: y + 10, rx: 7, ry: 3, rotation: 0, fill: motif });
      out.push({
        kind: "line",
        points: [
          { x: x - 8, y: y + 18 },
          { x: x + 8, y: y + 18 },
        ],
        stroke: motif,
        lineWidth: 0.6,
      });
    }
  }
  return out;
}

function bricks(w: number, h: number, color: string, random: () => number): PatternShape[] {
  const out: PatternShape[] = [];
  const bw = 21,
    bh = 5,
    j = 1;
  for (let y = 0, row = 0; y < h && out.length < MAX_SHAPES; y += bh + j, row++) {
    for (let x = row % 2 ? -bw / 2 : 0; x < w; x += bw + j) {
      out.push({ kind: "rect", x, y, w: bw, h: bh, fill: shade(color, (random() - 0.5) * 0.2) });
    }
  }
  return out;
}

/** Panel frames from the floor up to `top` (y measured from the top of the wall). */
function panels(
  w: number,
  wallH: number,
  style: string,
  color: string,
  top: number,
): PatternShape[] {
  const out: PatternShape[] = [];
  const panelTop = wallH - top;
  const line = shade(color, -0.25);
  const light = shade(color, 0.15);
  out.push({ kind: "rect", x: 0, y: panelTop, w, h: top, fill: color });
  out.push({
    kind: "rect",
    x: 0,
    y: panelTop - 2,
    w,
    h: 3,
    fill: light,
    stroke: line,
    lineWidth: 0.4,
  });
  if (style === "beadboard") {
    for (let x = 0; x < w && out.length < MAX_SHAPES; x += 8)
      out.push({
        kind: "line",
        points: [
          { x, y: panelTop },
          { x, y: wallH },
        ],
        stroke: line,
        lineWidth: 0.4,
      });
    return out;
  }
  const count = Math.max(
    1,
    Math.round(w / (style === "french" || style === "neoclassical" ? 70 : 55)),
  );
  const pw = w / count;
  const rows = style === "french" && top > 180 ? 2 : 1;
  const margin = style === "shaker" ? 8 : 10;
  for (let r = 0; r < rows; r++) {
    const rowTop = panelTop + (r * top) / rows;
    const rowH = top / rows;
    for (let i = 0; i < count; i++) {
      const x = i * pw + margin;
      const y = rowTop + margin + (r === rows - 1 ? 0 : 0);
      const hh = rowH - 2 * margin - (r === rows - 1 ? 10 : 0);
      out.push({
        kind: "rect",
        x,
        y,
        w: pw - 2 * margin,
        h: Math.max(4, hh),
        stroke: line,
        lineWidth: style === "neoclassical" ? 1 : 0.6,
      });
      if (style === "neoclassical" || style === "french") {
        out.push({
          kind: "rect",
          x: x + 3,
          y: y + 3,
          w: pw - 2 * margin - 6,
          h: Math.max(2, hh - 6),
          stroke: light,
          lineWidth: 0.4,
        });
      }
    }
  }
  return out;
}

/** Pattern for one wall face of `w` cm long and `h` cm high. */
export function wallPattern(f: WallFinish, w: number, h: number, seed = 1): Pattern {
  const random = rng(seed);
  const color = f.color ?? "#F4F1EA";
  switch (f.kind) {
    case "limewash":
      return {
        background: color,
        shapes: speckles(w, h, [shade(color, 0.05), shade(color, -0.04)], 25, 14, random),
      };
    case "brick":
      return { background: shade(color, 0.35), shapes: bricks(w, h, color, random) };
    case "wallpaper": {
      const motif = f.color2 ?? shade(color, -0.3);
      const shapes =
        f.pattern === "botanical"
          ? botanical(w, h, motif, random)
          : f.pattern === "toile"
            ? toile(w, h, motif)
            : stripes(w, h, color, motif);
      return { background: color, shapes };
    }
    case "panel":
      return {
        background: color,
        shapes: panels(w, h, f.panel ?? "shaker", f.color2 ?? color, Math.min(h, f.height ?? h)),
      };
    default:
      return { background: color, shapes: [] };
  }
}
