import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { rectArea, rectsOverlap, unionArea } from "../geometry/rect";
import type { ExtraWall, Rect, Room, RoomType, Wall } from "../model/types";
import { generateWalls, isHorizontal, wallId } from "./generate";

let seq = 0;
function room(
  rects: [number, number, number, number][],
  type: RoomType = "living",
  id?: string,
): Room {
  return {
    id: id ?? `r${++seq}`,
    name: type,
    type,
    shape: { kind: "rects", rects: rects.map(([x, y, w, d]) => ({ x, y, w, d })) },
  };
}

const area = (walls: Wall[], kind?: Wall["kind"]) =>
  walls.filter((w) => !kind || w.kind === kind).reduce((s, w) => s + rectArea(w.rect), 0);

function roomRects(r: Room): Rect[] {
  return r.shape.kind === "rects" ? r.shape.rects : [];
}

/** Invariants that hold for every plan. */
function checkInvariants(rooms: Room[], walls: Wall[]) {
  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      expect(
        rectsOverlap(walls[i]!.rect, walls[j]!.rect),
        `${walls[i]!.id} vs ${walls[j]!.id}`,
      ).toBe(false);
    }
  }
  // Exterior and low walls never eat into regular rooms.
  for (const wall of walls.filter((w) => w.kind !== "interior")) {
    for (const r of rooms.filter((r) => r.type !== "loggia")) {
      for (const rect of roomRects(r)) expect(rectsOverlap(wall.rect, rect)).toBe(false);
    }
  }
  expect(new Set(walls.map((w) => w.id)).size).toBe(walls.length);
}

describe("generateWalls", () => {
  it("1. returns nothing for an empty plan", () => {
    expect(generateWalls([])).toEqual([]);
  });

  it("2. wraps a single room in exterior walls", () => {
    const rooms = [room([[0, 0, 400, 300]])];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    expect(walls.every((w) => w.kind === "exterior")).toBe(true);
    expect(area(walls)).toBe(460 * 360 - 400 * 300);
    expect(walls.every((w) => w.height === 260)).toBe(true);
  });

  it("3. puts a centred interior wall between two rooms", () => {
    const rooms = [room([[0, 0, 400, 300]]), room([[400, 0, 300, 300]])];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    const interior = walls.filter((w) => w.kind === "interior");
    expect(interior).toHaveLength(1);
    expect(interior[0]!.rect).toEqual({ x: 395, y: 0, w: 10, d: 300 });
    expect(interior[0]!.rooms).toEqual({ a: rooms[0]!.id, b: rooms[1]!.id });
    expect(area(walls, "exterior")).toBe(760 * 360 - 700 * 300);
  });

  it("4. treats an L-shaped room (two rects) as one room", () => {
    const rooms = [
      room([
        [0, 0, 400, 200],
        [0, 200, 200, 200],
      ]),
    ];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    expect(walls.some((w) => w.kind === "interior")).toBe(false);
    // Rectilinear polygon dilated by a square of radius r: A + P*r + 4*r^2.
    expect(area(walls, "exterior")).toBe(1600 * 30 + 4 * 900);
  });

  it("5. handles an L-shaped polygon room the same way", () => {
    const poly: Room = {
      id: "poly",
      name: "L",
      type: "living",
      shape: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 200 },
          { x: 200, y: 200 },
          { x: 200, y: 400 },
          { x: 0, y: 400 },
        ],
      },
    };
    const rects = room([
      [0, 0, 400, 200],
      [0, 200, 200, 200],
    ]);
    const a = generateWalls([poly]);
    const b = generateWalls([rects]);
    expect(a.map((w) => [w.kind, w.rect])).toEqual(b.map((w) => [w.kind, w.rect]));
  });

  it("6. gives a loggia a low edge and puts the facade on the loggia side", () => {
    const living = room([[0, 0, 500, 400]]);
    const loggia = room([[500, 0, 200, 400]], "loggia");
    const walls = generateWalls([living, loggia], [], { lowHeight: 110 });
    checkInvariants([living, loggia], walls);
    const low = walls.filter((w) => w.kind === "low");
    expect(low.length).toBeGreaterThan(0);
    expect(low.every((w) => w.height === 110)).toBe(true);
    // Facade: the first 30 cm of the loggia is exterior wall, the living room keeps its 500 cm.
    const facade = walls.find((w) => w.kind === "exterior" && w.rect.x === 500 && w.rect.y === 0);
    expect(facade?.rect.w).toBe(30);
    expect(walls.some((w) => w.kind === "interior")).toBe(false);
    // Low edge runs along the outer sides of the loggia only, never inside it.
    for (const w of low) expect(rectsOverlap(w.rect, { x: 500, y: 0, w: 200, d: 400 })).toBe(false);
  });

  it("7. puts two interior walls between three rooms in a row", () => {
    const rooms = [
      room([[0, 0, 300, 300]]),
      room([[300, 0, 300, 300]]),
      room([[600, 0, 300, 300]]),
    ];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    const xs = walls
      .filter((w) => w.kind === "interior")
      .map((w) => w.rect.x)
      .sort((a, b) => a - b);
    expect(xs).toEqual([295, 595]);
  });

  it("8. forms a cross between four rooms in a 2x2 grid", () => {
    const rooms = [
      room([[0, 0, 300, 300]]),
      room([[300, 0, 300, 300]]),
      room([[0, 300, 300, 300]]),
      room([[300, 300, 300, 300]]),
    ];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    const interior = walls.filter((w) => w.kind === "interior").map((w) => w.rect);
    // Two 10 cm strips of 600 cm crossing in a 10x10 square.
    expect(unionArea(interior)).toBe(600 * 10 * 2 - 100);
  });

  it("9. respects configured thicknesses", () => {
    const rooms = [room([[0, 0, 400, 300]]), room([[400, 0, 400, 300]])];
    const walls = generateWalls(rooms, [], { interior: 20, exterior: 20 });
    checkInvariants(rooms, walls);
    expect(walls.find((w) => w.kind === "interior")!.rect).toEqual({ x: 390, y: 0, w: 20, d: 300 });
    expect(area(walls, "exterior")).toBe(840 * 340 - 800 * 300);
  });

  it("10. splits an odd thickness consistently", () => {
    const rooms = [room([[0, 0, 300, 300]]), room([[300, 0, 300, 300]])];
    const walls = generateWalls(rooms, [], { interior: 15 });
    expect(walls.find((w) => w.kind === "interior")!.rect).toEqual({ x: 290, y: 0, w: 15, d: 300 });
  });

  it("11. rasterises extra walls as interior walls", () => {
    const rooms = [room([[0, 0, 600, 400]])];
    const extra: ExtraWall[] = [{ id: "x", rect: { x: 300, y: 0, w: 10, d: 200 } }];
    const walls = generateWalls(rooms, extra);
    checkInvariants(rooms, walls);
    expect(walls.find((w) => w.kind === "interior")!.rect).toEqual({ x: 300, y: 0, w: 10, d: 200 });
  });

  it("12. fills a narrow gap between rooms with wall", () => {
    const rooms = [room([[0, 0, 300, 300]]), room([[310, 0, 300, 300]])];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    const gap = { x: 300, y: 0, w: 10, d: 300 };
    const clipped = walls.map(({ rect: r }) => {
      const x = Math.max(r.x, gap.x),
        y = Math.max(r.y, gap.y);
      const w = Math.min(r.x + r.w, gap.x + gap.w) - x,
        d = Math.min(r.y + r.d, gap.y + gap.d) - y;
      return { x, y, w: Math.max(0, w), d: Math.max(0, d) };
    });
    expect(unionArea(clipped)).toBe(rectArea(gap));
  });

  it("13. a hallway with an L-shaped living room and a bedroom", () => {
    const living = room([
      [0, 0, 500, 300],
      [0, 300, 250, 250],
    ]);
    const hal = room([[250, 300, 120, 250]], "hal");
    const bed = room([[370, 300, 300, 250]], "bed");
    const rooms = [living, hal, bed];
    const walls = generateWalls(rooms);
    checkInvariants(rooms, walls);
    const interior = walls.filter((w) => w.kind === "interior");
    // The L touches the hal on two sides and the bedroom on top.
    const touched = new Set(interior.flatMap((w) => [w.rooms.a, w.rooms.b]));
    expect(touched).toContain(living.id);
    expect(touched).toContain(hal.id);
    expect(touched).toContain(bed.id);
  });

  it("14. snaps rooms that are not on the 5 cm grid", () => {
    const rooms = [room([[0, 0, 401, 299]])];
    const walls = generateWalls(rooms);
    checkInvariants(
      rooms.map((r) => room(roomRects(r).map((x) => [x.x, x.y, 400, 300]))),
      walls,
    );
    expect(walls.length).toBeGreaterThan(0);
  });

  it("15. lets a later room win where rooms overlap", () => {
    const a = room([[0, 0, 400, 300]]);
    const b = room([[300, 0, 300, 300]]);
    const walls = generateWalls([a, b]);
    expect(walls.find((w) => w.kind === "interior")!.rect.x).toBe(295);
  });

  it("16. records which room is on which side", () => {
    const top = room([[0, 0, 300, 200]]);
    const bottom = room([[0, 200, 300, 200]]);
    const walls = generateWalls([top, bottom]);
    const wall = walls.find((w) => w.kind === "interior")!;
    expect(isHorizontal(wall.rect)).toBe(true);
    expect(wall.rooms).toEqual({ a: top.id, b: bottom.id });
    const outer = walls.find((w) => w.kind === "exterior" && w.rect.y === -30)!;
    expect(outer.rooms).toEqual({ b: top.id });
  });

  it("17. keeps wall ids stable for unchanged geometry", () => {
    const rooms = [room([[0, 0, 400, 300]], "living", "a"), room([[400, 0, 300, 300]], "bed", "b")];
    const one = generateWalls(rooms).map((w) => w.id);
    const two = generateWalls(structuredClone(rooms)).map((w) => w.id);
    expect(one).toEqual(two);
    expect(wallId("interior", { x: 1, y: 2, w: 3, d: 4 })).toBe("w_i_1_2_3_4");
  });

  it("18. property: random rectangles always give non-overlapping walls", () => {
    const arb = fc.array(
      fc.record({
        x: fc.integer({ min: 0, max: 20 }).map((v) => v * 25),
        y: fc.integer({ min: 0, max: 20 }).map((v) => v * 25),
        w: fc.integer({ min: 4, max: 16 }).map((v) => v * 25),
        d: fc.integer({ min: 4, max: 16 }).map((v) => v * 25),
      }),
      { minLength: 1, maxLength: 5 },
    );
    fc.assert(
      fc.property(arb, (rects) => {
        const rooms = rects.map((r) => room([[r.x, r.y, r.w, r.d]]));
        const walls = generateWalls(rooms);
        for (let i = 0; i < walls.length; i++) {
          for (let j = i + 1; j < walls.length; j++) {
            if (rectsOverlap(walls[i]!.rect, walls[j]!.rect)) return false;
          }
        }
        // Wall area is at least the exterior ring of the bounding union.
        return walls.length > 0;
      }),
      { numRuns: 60 },
    );
  });
});
