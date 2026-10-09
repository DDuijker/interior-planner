import { boundingRectOfPoints, rectsOverlap } from "../geometry/rect";
import {
  convexOverlap,
  ellipsePolygon,
  orientedBox,
  pointInPolygon,
  pointSegmentDistance,
  polygonDistance,
  type Polygon,
} from "../geometry/polygon";
import { fixtureFootprint } from "../fixtures/fixtures";
import type { Door, Fixture, Id, Item, Opening, Point, Rect, Room, Wall } from "../model/types";
import { cutWalls, doorSwing, openingOnWall } from "../openings/openings";

export type IssueType = "overlap" | "wall" | "clearance" | "door";

export interface LayoutIssue {
  type: IssueType;
  /** Item first, then the thing it conflicts with (item, fixture, wall or door id). */
  ids: [Id, Id];
  /** Free gap in cm for clearance issues. */
  gap?: number;
}

export interface LayoutInput {
  items: readonly Item[];
  fixtures: readonly Fixture[];
  walls: readonly Wall[];
  openings: readonly Opening[];
  /**
   * Optional. When given, clearance is only checked between things in the
   * same room (and walls bordering that room), not through walls.
   */
  rooms?: readonly Room[];
}

export interface LayoutOptions {
  /** Minimum free passage, cm. Default 80. */
  clearance: number;
  /**
   * Gaps smaller than this count as "placed against" rather than a passage
   * (a bed against a wall, a nightstand next to the bed). Default 15 cm.
   */
  againstGap: number;
  /** Touching within this tolerance is not an overlap. Default 0.5 cm. */
  tolerance: number;
}

/** Items this low (cm) are flat, like rugs. */
const FLAT = 3;

export const DEFAULT_LAYOUT_OPTIONS: LayoutOptions = {
  clearance: 80,
  againstGap: 15,
  tolerance: 0.5,
};

/** Footprint of an item: an oriented box, or an ellipse for round furniture. */
export function itemFootprint(item: Item): Point[] {
  return item.shape === "round"
    ? ellipsePolygon(item.x, item.y, item.w, item.d, item.rotation)
    : orientedBox(item.x, item.y, item.w, item.d, item.rotation);
}

function rectPolygon(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.w, y: r.y },
    { x: r.x + r.w, y: r.y + r.d },
    { x: r.x, y: r.y + r.d },
  ];
}

interface Shape {
  id: Id;
  poly: Polygon;
  box: Rect;
}

function shape(id: Id, poly: Polygon): Shape {
  return { id, poly, box: boundingRectOfPoints(poly)! };
}

function grow(r: Rect, by: number): Rect {
  return { x: r.x - by, y: r.y - by, w: r.w + 2 * by, d: r.d + 2 * by };
}

/** Distance from a point to a polygon (0 when inside). */
function pointPolygonDistance(p: Point, poly: Polygon): number {
  if (pointInPolygon(p, poly)) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    best = Math.min(best, pointSegmentDistance(p, poly[i]!, poly[(i + 1) % poly.length]!));
  }
  return best;
}

/** Id of the room containing `p`, if any (later rooms win, like the wall generator). */
export function roomAt(rooms: readonly Room[], p: Point): Id | undefined {
  for (let i = rooms.length - 1; i >= 0; i--) {
    const room = rooms[i]!;
    const inside =
      room.shape.kind === "rects"
        ? room.shape.rects.some(
            (r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.d,
          )
        : pointInPolygon(p, room.shape.points);
    if (inside) return room.id;
  }
  return undefined;
}

/**
 * Check a layout. Only floor-standing items are checked: stacked items sit
 * on something by design and wall items hang above the furniture.
 */
export function checkLayout(
  input: LayoutInput,
  options: Partial<LayoutOptions> = {},
): LayoutIssue[] {
  const opts = { ...DEFAULT_LAYOUT_OPTIONS, ...options };
  const issues: LayoutIssue[] = [];
  const rooms = input.rooms ?? [];
  // Flat things (rugs) lie under the furniture and never collide.
  const floorItems = input.items.filter((i) => i.mount === "floor" && i.h > FLAT);
  const roomOf = new Map<Id, Id | undefined>();
  for (const i of floorItems) roomOf.set(i.id, roomAt(rooms, i));
  for (const f of input.fixtures)
    roomOf.set(f.id, roomAt(rooms, { x: f.x + f.w / 2, y: f.y + f.d / 2 }));
  const wallRooms = new Map(input.walls.map((w) => [w.id, [w.rooms.a, w.rooms.b]]));
  /** Can there be a passage between these two, or is there a wall in between? */
  const sameSpace = (a: Id, b: Id) => {
    if (rooms.length === 0) return true;
    const ra = roomOf.get(a);
    if (ra === undefined) return true;
    const wr = wallRooms.get(b);
    if (wr) return wr.includes(ra);
    const rb = roomOf.get(b);
    return rb === undefined || rb === ra;
  };
  const items = floorItems.map((i) => shape(i.id, itemFootprint(i)));
  // Lamps, plants and other decor do not block a passage in a meaningful way.
  const decorIds = new Set(floorItems.filter((i) => i.layer !== "furniture").map((i) => i.id));
  const narrowsPassage = (id: Id) => !decorIds.has(id);
  const fixtures = input.fixtures.map((f) => shape(f.id, fixtureFootprint(f)));

  const wallPieces = cutWalls(input.walls, input.openings).map((p) =>
    shape(p.wallId, rectPolygon(p.rect)),
  );
  const reach = Math.max(opts.clearance, opts.tolerance);

  const compare = (a: Shape, b: Shape, hitType: IssueType) => {
    if (!rectsOverlap(grow(a.box, reach), b.box)) return null;
    if (convexOverlap(a.poly, b.poly, opts.tolerance)) return { type: hitType, gap: 0 };
    if (!sameSpace(a.id, b.id)) return null;
    if (!narrowsPassage(a.id) || !narrowsPassage(b.id)) return null;
    const gap = polygonDistance(a.poly, b.poly);
    if (gap >= opts.againstGap && gap < opts.clearance) return { type: "clearance" as const, gap };
    return null;
  };

  // Item vs item and item vs fixture.
  for (let i = 0; i < items.length; i++) {
    const a = items[i]!;
    const others = [...items.slice(i + 1), ...fixtures];
    for (const b of others) {
      const hit = compare(a, b, "overlap");
      if (hit)
        issues.push({
          type: hit.type,
          ids: [a.id, b.id],
          ...(hit.type === "clearance" ? { gap: hit.gap } : {}),
        });
    }
  }

  // Item vs walls: keep the worst result per wall (a wall can be cut in pieces).
  for (const a of items) {
    const perWall = new Map<Id, { type: IssueType; gap: number }>();
    for (const w of wallPieces) {
      const hit = compare(a, w, "wall");
      if (!hit) continue;
      const prev = perWall.get(w.id);
      if (!prev || hit.gap < prev.gap) perWall.set(w.id, hit);
    }
    for (const [wallId, hit] of perWall) {
      issues.push({
        type: hit.type,
        ids: [a.id, wallId],
        ...(hit.type === "clearance" ? { gap: hit.gap } : {}),
      });
    }
  }

  // Door swings must stay free.
  const doors = input.openings.filter((o): o is Door => o.kind === "door");
  for (const door of doors) {
    const wall =
      input.walls.find((w) => w.id === door.wallId) ??
      input.walls.find((w) => openingOnWall(door, w));
    const thickness = wall ? (door.dir === "h" ? wall.rect.d : wall.rect.w) : 10;
    const swing = doorSwing(door, thickness);
    const square = rectPolygon(swing.area);
    for (const a of items) {
      if (!rectsOverlap(a.box, swing.area)) continue;
      if (
        convexOverlap(a.poly, square, opts.tolerance) &&
        pointPolygonDistance(swing.hinge, a.poly) < swing.radius - opts.tolerance
      ) {
        issues.push({ type: "door", ids: [a.id, door.id] });
      }
    }
  }
  return issues;
}

/** Ids involved in any issue, for red highlighting in the editor. */
export function conflictingIds(issues: readonly LayoutIssue[]): Set<Id> {
  const out = new Set<Id>();
  for (const issue of issues)
    if (issue.type !== "clearance") for (const id of issue.ids) out.add(id);
  return out;
}
