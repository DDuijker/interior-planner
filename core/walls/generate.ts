import { pointInPolygon } from "../geometry/polygon";
import type { ExtraWall, Id, Rect, Room, Wall, WallKind } from "../model/types";

/**
 * Walls from rooms.
 *
 * Rooms are rasterised on a grid (5 cm by default). Every cell gets a room
 * label. Wall cells are then marked:
 *
 * - interior: room cells next to a cell of another room, split over both
 *   sides of the boundary (so a 10 cm wall takes 5 cm from each room);
 * - exterior: empty cells (or loggia cells) within the exterior thickness
 *   of a regular room, so rooms keep their measured size;
 * - low: empty cells around a loggia or balcony (a parapet, not a full wall);
 * - extra walls from the plan are rasterised as interior walls.
 *
 * Finally cells of the same kind are merged into rectangles.
 */

export interface WallOptions {
  /** Interior wall thickness, cm. */
  interior: number;
  /** Exterior wall thickness, cm. */
  exterior: number;
  /** Thickness of the low edge around a loggia, cm. */
  low: number;
  /** Full wall height, cm. */
  height: number;
  /** Height of the low edge, cm. */
  lowHeight: number;
  /** Grid cell size, cm. */
  cell: number;
}

export const DEFAULT_WALL_OPTIONS: WallOptions = {
  interior: 10,
  exterior: 30,
  low: 10,
  height: 260,
  lowHeight: 100,
  cell: 5,
};

const EMPTY = -1;
const NONE = 0;
const LOW = 1;
const INTERIOR = 2;
const EXTERIOR = 3;
const KIND_BY_CLASS: Record<number, WallKind> = {
  [LOW]: "low",
  [INTERIOR]: "interior",
  [EXTERIOR]: "exterior",
};

/** Rasterised plan. Exposed for tests and for debugging overlays. */
export interface WallGrid {
  /** World position of cell (0, 0)'s top-left corner. */
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  cell: number;
  /** Room index per cell, -1 for empty. */
  labels: Int32Array;
  /** Wall class per cell: 0 none, 1 low, 2 interior, 3 exterior. */
  classes: Uint8Array;
}

function roomBounds(room: Room): Rect {
  if (room.shape.kind === "rects") {
    let x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const r of room.shape.rects) {
      x0 = Math.min(x0, r.x);
      y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w);
      y1 = Math.max(y1, r.y + r.d);
    }
    return { x: x0, y: y0, w: x1 - x0, d: y1 - y0 };
  }
  const xs = room.shape.points.map((p) => p.x);
  const ys = room.shape.points.map((p) => p.y);
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs) - Math.min(...xs),
    d: Math.max(...ys) - Math.min(...ys),
  };
}

function isLoggia(room: Room | undefined): boolean {
  return room?.type === "loggia";
}

/** Fill cells whose centre lies inside `rect` with `fn(index)`. */
function forCellsInRect(grid: WallGrid, rect: Rect, fn: (index: number) => void) {
  const { x0, y0, cell, cols, rows } = grid;
  const c0 = Math.max(0, Math.ceil((rect.x - x0) / cell - 0.5));
  const c1 = Math.min(cols - 1, Math.floor((rect.x + rect.w - x0) / cell - 0.5 - 1e-9));
  const r0 = Math.max(0, Math.ceil((rect.y - y0) / cell - 0.5));
  const r1 = Math.min(rows - 1, Math.floor((rect.y + rect.d - y0) / cell - 0.5 - 1e-9));
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(r * cols + c);
}

export function rasterize(
  rooms: readonly Room[],
  extraWalls: readonly ExtraWall[],
  opts: WallOptions,
): WallGrid {
  const { cell } = opts;
  const bounds = [...rooms.map(roomBounds), ...extraWalls.map((w) => w.rect)];
  const pad = Math.ceil(Math.max(opts.exterior, opts.low, opts.interior) / cell) + 1;
  if (bounds.length === 0) {
    return {
      x0: 0,
      y0: 0,
      cols: 0,
      rows: 0,
      cell,
      labels: new Int32Array(0),
      classes: new Uint8Array(0),
    };
  }
  const minX = Math.min(...bounds.map((b) => b.x));
  const minY = Math.min(...bounds.map((b) => b.y));
  const maxX = Math.max(...bounds.map((b) => b.x + b.w));
  const maxY = Math.max(...bounds.map((b) => b.y + b.d));
  const x0 = Math.floor(minX / cell) * cell - pad * cell;
  const y0 = Math.floor(minY / cell) * cell - pad * cell;
  const cols = Math.ceil((maxX - x0) / cell) + pad;
  const rows = Math.ceil((maxY - y0) / cell) + pad;
  const grid: WallGrid = {
    x0,
    y0,
    cols,
    rows,
    cell,
    labels: new Int32Array(cols * rows).fill(EMPTY),
    classes: new Uint8Array(cols * rows),
  };

  rooms.forEach((room, index) => {
    if (room.shape.kind === "rects") {
      for (const rect of room.shape.rects)
        forCellsInRect(grid, rect, (i) => (grid.labels[i] = index));
    } else {
      const poly = room.shape.points;
      forCellsInRect(grid, roomBounds(room), (i) => {
        const cx = x0 + ((i % cols) + 0.5) * cell;
        const cy = y0 + (Math.floor(i / cols) + 0.5) * cell;
        if (pointInPolygon({ x: cx, y: cy }, poly)) grid.labels[i] = index;
      });
    }
  });
  return grid;
}

/** Exact Chebyshev distance (in cells) to the nearest cell where `isSource` holds. */
function chebyshevDistance(grid: WallGrid, isSource: (i: number) => boolean): Int32Array {
  const { cols, rows } = grid;
  const INF = 1 << 29;
  const dist = new Int32Array(cols * rows);
  for (let i = 0; i < dist.length; i++) dist[i] = isSource(i) ? 0 : INF;
  // Two-pass chamfer with unit diagonal cost gives the exact Chebyshev metric.
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      let d = dist[i]!;
      if (c > 0) d = Math.min(d, dist[i - 1]! + 1);
      if (r > 0) {
        d = Math.min(d, dist[i - cols]! + 1);
        if (c > 0) d = Math.min(d, dist[i - cols - 1]! + 1);
        if (c < cols - 1) d = Math.min(d, dist[i - cols + 1]! + 1);
      }
      dist[i] = d;
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      let d = dist[i]!;
      if (c < cols - 1) d = Math.min(d, dist[i + 1]! + 1);
      if (r < rows - 1) {
        d = Math.min(d, dist[i + cols]! + 1);
        if (c < cols - 1) d = Math.min(d, dist[i + cols + 1]! + 1);
        if (c > 0) d = Math.min(d, dist[i + cols - 1]! + 1);
      }
      dist[i] = d;
    }
  }
  return dist;
}

export function classify(
  grid: WallGrid,
  rooms: readonly Room[],
  extraWalls: readonly ExtraWall[],
  opts: WallOptions,
): void {
  const { cols, rows, labels, classes, cell } = grid;
  const mark = (i: number, cls: number) => {
    if (classes[i]! < cls) classes[i] = cls;
  };
  const isRegular = (label: number) => label !== EMPTY && !isLoggia(rooms[label]);

  // Exterior: outside (empty or loggia) cells close to a regular room.
  const nExt = Math.round(opts.exterior / cell);
  if (nExt > 0) {
    const toRoom = chebyshevDistance(grid, (i) => isRegular(labels[i]!));
    for (let i = 0; i < labels.length; i++) {
      if (!isRegular(labels[i]!) && toRoom[i]! <= nExt) mark(i, EXTERIOR);
    }
  }

  // Low edge: empty cells close to a loggia.
  const nLow = Math.round(opts.low / cell);
  if (nLow > 0) {
    const toLoggia = chebyshevDistance(grid, (i) => isLoggia(rooms[labels[i]!]));
    for (let i = 0; i < labels.length; i++) {
      if (labels[i] === EMPTY && toLoggia[i]! <= nLow) mark(i, LOW);
    }
  }

  // Interior: split the thickness over both rooms. The room with the lower
  // index takes the larger half when the cell count is odd.
  const nInt = Math.round(opts.interior / cell);
  if (nInt > 0) {
    const big = Math.ceil(nInt / 2);
    const small = Math.floor(nInt / 2);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        const own = labels[i]!;
        if (!isRegular(own)) continue;
        search: for (let dr = -big; dr <= big; dr++) {
          const rr = r + dr;
          if (rr < 0 || rr >= rows) continue;
          for (let dc = -big; dc <= big; dc++) {
            const cc = c + dc;
            if (cc < 0 || cc >= cols) continue;
            const other = labels[rr * cols + cc]!;
            if (other === own || !isRegular(other)) continue;
            const reach = own < other ? big : small;
            if (Math.max(Math.abs(dr), Math.abs(dc)) <= reach) {
              mark(i, INTERIOR);
              break search;
            }
          }
        }
      }
    }
  }

  for (const wall of extraWalls) forCellsInRect(grid, wall.rect, (i) => mark(i, INTERIOR));
}

/** Greedy merge of same-class cells into rectangles (row runs grown downwards). */
export function mergeCells(grid: WallGrid): { rect: Rect; cls: number }[] {
  const { cols, rows, classes, cell, x0, y0 } = grid;
  const used = new Uint8Array(cols * rows);
  const out: { rect: Rect; cls: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const cls = classes[i]!;
      if (cls === NONE || used[i]) continue;
      let c1 = c;
      while (c1 + 1 < cols && classes[r * cols + c1 + 1] === cls && !used[r * cols + c1 + 1]) c1++;
      let r1 = r;
      grow: while (r1 + 1 < rows) {
        for (let k = c; k <= c1; k++) {
          const j = (r1 + 1) * cols + k;
          if (classes[j] !== cls || used[j]) break grow;
        }
        r1++;
      }
      for (let rr = r; rr <= r1; rr++) for (let k = c; k <= c1; k++) used[rr * cols + k] = 1;
      out.push({
        rect: {
          x: x0 + c * cell,
          y: y0 + r * cell,
          w: (c1 - c + 1) * cell,
          d: (r1 - r + 1) * cell,
        },
        cls,
      });
    }
  }
  return out;
}

function roomAt(grid: WallGrid, rooms: readonly Room[], x: number, y: number): Id | undefined {
  const c = Math.floor((x - grid.x0) / grid.cell);
  const r = Math.floor((y - grid.y0) / grid.cell);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return undefined;
  const label = grid.labels[r * grid.cols + c]!;
  return label === EMPTY ? undefined : rooms[label]?.id;
}

export function wallId(kind: WallKind, rect: Rect): Id {
  return `w_${kind[0]}_${rect.x}_${rect.y}_${rect.w}_${rect.d}`;
}

/** Is the wall drawn along x (horizontal) rather than along y? */
export function isHorizontal(rect: Rect): boolean {
  return rect.w >= rect.d;
}

export function generateWalls(
  rooms: readonly Room[],
  extraWalls: readonly ExtraWall[] = [],
  options: Partial<WallOptions> = {},
): Wall[] {
  const opts = { ...DEFAULT_WALL_OPTIONS, ...options };
  const grid = rasterize(rooms, extraWalls, opts);
  if (grid.cols === 0) return [];
  classify(grid, rooms, extraWalls, opts);
  const out: Wall[] = [];
  for (const { rect, cls } of mergeCells(grid)) {
    const kind = KIND_BY_CLASS[cls]!;
    // Split the wall where the room on either side changes, so every wall
    // segment borders at most one room per side (finishes are per room).
    for (const part of splitBySides(grid, rooms, rect)) {
      const roomsBySide: Wall["rooms"] = {};
      if (part.a) roomsBySide.a = part.a;
      if (part.b) roomsBySide.b = part.b;
      out.push({
        id: wallId(kind, part.rect),
        rect: part.rect,
        kind,
        height: kind === "low" ? opts.lowHeight : opts.height,
        rooms: roomsBySide,
      });
    }
  }
  return out;
}

function splitBySides(
  grid: WallGrid,
  rooms: readonly Room[],
  rect: Rect,
): { rect: Rect; a?: Id; b?: Id }[] {
  const { cell } = grid;
  const half = cell / 2;
  const horizontal = isHorizontal(rect);
  const length = horizontal ? rect.w : rect.d;
  const steps = Math.max(1, Math.round(length / cell));
  const sideAt = (i: number) => {
    const along = (horizontal ? rect.x : rect.y) + (i + 0.5) * cell;
    return horizontal
      ? {
          a: roomAt(grid, rooms, along, rect.y - half),
          b: roomAt(grid, rooms, along, rect.y + rect.d + half),
        }
      : {
          a: roomAt(grid, rooms, rect.x - half, along),
          b: roomAt(grid, rooms, rect.x + rect.w + half, along),
        };
  };
  const parts: { rect: Rect; a?: Id; b?: Id }[] = [];
  let start = 0;
  let current = sideAt(0);
  for (let i = 1; i <= steps; i++) {
    const next = i < steps ? sideAt(i) : null;
    if (next && next.a === current.a && next.b === current.b) continue;
    const from = start * cell,
      to = i === steps ? length : i * cell;
    const r = horizontal
      ? { x: rect.x + from, y: rect.y, w: to - from, d: rect.d }
      : { x: rect.x, y: rect.y + from, w: rect.w, d: to - from };
    parts.push({
      rect: r,
      ...(current.a ? { a: current.a } : {}),
      ...(current.b ? { b: current.b } : {}),
    });
    start = i;
    if (next) current = next;
  }
  return parts;
}
