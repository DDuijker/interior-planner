import { describe, expect, it } from "vitest";
import { createFixture } from "../fixtures/fixtures";
import type { Item, Room, Wall } from "../model/types";
import { createDoor, snapOpening } from "../openings/openings";
import { generateWalls } from "../walls/generate";
import { checkLayout, conflictingIds, itemFootprint, type LayoutInput } from "./collision";

function item(
  id: string,
  x: number,
  y: number,
  w: number,
  d: number,
  extra: Partial<Item> = {},
): Item {
  return {
    id,
    catalogId: id,
    name: id,
    x,
    y,
    w,
    d,
    h: 80,
    rotation: 0,
    shape: "rect",
    layer: "furniture",
    mount: "floor",
    elevation: 0,
    ...extra,
  };
}

const empty: LayoutInput = { items: [], fixtures: [], walls: [], openings: [] };
const types = (input: Partial<LayoutInput>) =>
  checkLayout({ ...empty, ...input }).map((i) => i.type);

describe("item vs item", () => {
  it("flags overlap", () => {
    const issues = checkLayout({
      ...empty,
      items: [item("a", 0, 0, 100, 100), item("b", 90, 0, 100, 100)],
    });
    expect(issues).toEqual([{ type: "overlap", ids: ["a", "b"] }]);
    expect(conflictingIds(issues)).toEqual(new Set(["a", "b"]));
  });

  it("accepts touching furniture", () => {
    expect(types({ items: [item("a", 0, 0, 100, 100), item("b", 100, 0, 100, 100)] })).toEqual([]);
  });

  it("uses the rotated footprint, not the bounding box", () => {
    // Bounding boxes overlap but the rotated box clears the corner.
    const a = item("a", 0, 0, 100, 100);
    const b = item("b", 112, 112, 100, 100, { rotation: 45 });
    expect(types({ items: [a, b] })).not.toContain("overlap");
    const c = item("c", 60, 0, 100, 40, { rotation: 90 }); // x 40..80 after rotating
    expect(types({ items: [a, c] })).toContain("overlap");
  });

  it("treats round tables as round", () => {
    const table = item("t", 0, 0, 100, 100, { shape: "round" });
    expect(itemFootprint(table).length).toBeGreaterThan(4);
    // Square chair tucked into the corner of the table's bounding box.
    const chair = item("c", 48, 48, 30, 30, { rotation: 0 });
    const corner = types({ items: [table, { ...chair, x: 55, y: 55, w: 20, d: 20 }] });
    expect(corner).not.toContain("overlap");
    expect(types({ items: [table, item("c2", 55, 0, 20, 20)] })).toContain("overlap");
  });

  it("ignores stacked and wall items", () => {
    const table = item("t", 0, 0, 100, 100);
    const vase = item("v", 0, 0, 20, 20, { mount: "stack", elevation: 75 });
    const painting = item("p", 0, -45, 80, 4, { mount: "wall", elevation: 150 });
    expect(types({ items: [table, vase, painting] })).toEqual([]);
  });

  it("warns about narrow passages, but not about things placed against each other", () => {
    const sofa = item("sofa", 0, 0, 200, 90);
    expect(checkLayout({ ...empty, items: [sofa, item("t", 0, 110, 100, 60)] })).toEqual([
      { type: "clearance", ids: ["sofa", "t"], gap: 35 },
    ]);
    expect(types({ items: [sofa, item("n", 105, 0, 10, 40)] })).toEqual([]); // 5 cm: against
    expect(types({ items: [sofa, item("far", 0, 200, 100, 60)] })).toEqual([]); // 125 cm: fine
  });

  it("makes the clearance configurable", () => {
    const pair = [item("a", 0, 0, 100, 100), item("b", 0, 200, 100, 100)];
    expect(checkLayout({ ...empty, items: pair })).toEqual([]);
    expect(checkLayout({ ...empty, items: pair }, { clearance: 120 })[0]).toMatchObject({
      type: "clearance",
      gap: 100,
    });
  });
});

describe("fixtures and walls", () => {
  const rooms: Room[] = [
    {
      id: "a",
      name: "A",
      type: "living",
      shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 400, d: 300 }] },
    },
    {
      id: "b",
      name: "B",
      type: "bed",
      shape: { kind: "rects", rects: [{ x: 400, y: 0, w: 300, d: 300 }] },
    },
  ];
  const walls: Wall[] = generateWalls(rooms);

  it("flags furniture over a fixture", () => {
    const kitchen = createFixture("kitchen", 0, 0, { id: "k" });
    expect(
      checkLayout({ ...empty, items: [item("x", 50, 30, 60, 60)], fixtures: [kitchen] })[0],
    ).toMatchObject({
      type: "overlap",
      ids: ["x", "k"],
    });
  });

  it("flags furniture inside a wall", () => {
    const issues = checkLayout({ ...empty, walls, items: [item("x", 395, 150, 60, 60)] });
    expect(issues.map((i) => i.type)).toContain("wall");
  });

  it("allows furniture against a wall", () => {
    // Wall face of the interior wall is at x = 395.
    expect(
      checkLayout({ ...empty, walls, items: [item("x", 365, 150, 60, 60)] }).filter(
        (i) => i.type === "wall",
      ),
    ).toEqual([]);
  });

  it("does not see a wall where a door is", () => {
    const door = snapOpening(createDoor(400, 105, "v", { w: 90 }), walls)!; // spans y 105..195
    const inDoorway = item("x", 400, 150, 10, 40);
    expect(
      checkLayout({ ...empty, walls, openings: [door], items: [inDoorway] }).map((i) => i.type),
    ).not.toContain("wall");
  });

  it("reports one clearance issue per wall even if the wall is cut in pieces", () => {
    const door = snapOpening(createDoor(400, 150, "v", { w: 90 }), walls)!;
    const nearWall = item("x", 340, 150, 40, 250);
    const issues = checkLayout({ ...empty, walls, openings: [door], items: [nearWall] }).filter(
      (i) => i.type === "clearance",
    );
    const perWall = new Set(issues.map((i) => i.ids[1]));
    expect(perWall.size).toBe(issues.length);
  });
});

describe("door swings", () => {
  const wall: Wall = {
    id: "w",
    kind: "interior",
    rect: { x: 0, y: 295, w: 400, d: 10 },
    height: 260,
    rooms: {},
  };
  const door = {
    ...createDoor(100, 300, "h", { w: 80, swing: "b", hinge: "start", id: "d" }),
    wallId: "w",
  };

  it("flags an item in the swing", () => {
    const issues = checkLayout({
      ...empty,
      walls: [wall],
      openings: [door],
      items: [item("x", 140, 340, 40, 40)],
    });
    expect(issues).toContainEqual({ type: "door", ids: ["x", "d"] });
  });

  it("allows the corner outside the arc", () => {
    // In the swing square but beyond the 80 cm radius from the hinge.
    const corner = item("x", 175, 380, 10, 10);
    expect(types({ walls: [wall], openings: [door], items: [corner] })).not.toContain("door");
  });

  it("allows items on the other side of the wall", () => {
    expect(
      types({ walls: [wall], openings: [door], items: [item("x", 140, 250, 40, 40)] }),
    ).not.toContain("door");
  });

  it("works without a known wall", () => {
    const loose = { ...door, wallId: undefined };
    expect(types({ openings: [loose], items: [item("x", 120, 330, 30, 30)] })).toContain("door");
  });
});
