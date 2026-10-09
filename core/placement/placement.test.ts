import { describe, expect, it } from "vitest";
import type { Item, Wall } from "../model/types";
import { settleItem, snapToWall, stackElevation } from "./placement";

function item(id: string, x: number, y: number, extra: Partial<Item> = {}): Item {
  return {
    id,
    catalogId: id,
    name: id,
    x,
    y,
    w: 100,
    d: 60,
    h: 75,
    rotation: 0,
    shape: "rect",
    layer: "furniture",
    mount: "floor",
    elevation: 0,
    ...extra,
  };
}

const surfaces: Record<string, number> = { table: 75, shelf: 4 };
const surfaceOf = (i: Item) => surfaces[i.catalogId];

const north: Wall = {
  id: "n",
  kind: "interior",
  rect: { x: 0, y: -10, w: 400, d: 10 },
  height: 260,
  rooms: {},
};
const west: Wall = {
  id: "w",
  kind: "exterior",
  rect: { x: -30, y: 0, w: 30, d: 300 },
  height: 260,
  rooms: {},
};
const low: Wall = {
  id: "l",
  kind: "low",
  rect: { x: 0, y: 300, w: 400, d: 10 },
  height: 100,
  rooms: {},
};

describe("stacking", () => {
  const table = item("table", 200, 150);
  const vase = item("vase", 210, 160, { mount: "stack", w: 15, d: 15, h: 30 });

  it("puts small items on the surface below", () => {
    expect(stackElevation(vase, [table], surfaceOf)).toBe(75);
  });

  it("uses the highest surface and stacks on wall shelves", () => {
    const shelf = item("shelf", 210, 160, {
      catalogId: "shelf",
      mount: "wall",
      elevation: 140,
      w: 60,
      d: 20,
      h: 4,
    });
    expect(stackElevation(vase, [table, shelf], surfaceOf)).toBe(144);
  });

  it("falls back to the floor", () => {
    expect(stackElevation({ ...vase, x: 0, y: 0 }, [table], surfaceOf)).toBe(0);
    expect(stackElevation(vase, [item("sofa", 200, 150, { catalogId: "sofa" })], surfaceOf)).toBe(
      0,
    );
  });

  it("ignores other stacked items and itself", () => {
    expect(stackElevation(vase, [vase, { ...vase, id: "v2", catalogId: "table" }], surfaceOf)).toBe(
      0,
    );
  });
});

describe("wall items", () => {
  const painting = item("p", 150, 40, { mount: "wall", w: 80, d: 4, elevation: 140 });

  it("hang on the nearest wall with the back against it", () => {
    expect(snapToWall(painting, [north, west])).toEqual({ x: 150, y: 2, rotation: 0, wallId: "n" });
    expect(snapToWall({ ...painting, x: 20, y: 150 }, [north, west])).toEqual({
      x: 2,
      y: 150,
      rotation: 270,
      wallId: "w",
    });
  });

  it("works from the other side of a wall", () => {
    expect(snapToWall({ ...painting, y: -50 }, [north])).toMatchObject({ y: -12, rotation: 180 });
    expect(snapToWall({ ...painting, x: -80, y: 150 }, [west])).toMatchObject({
      x: -32,
      rotation: 90,
    });
  });

  it("stays inside the wall and skips low edges", () => {
    expect(snapToWall({ ...painting, x: 395 }, [north])!.x).toBe(360);
    expect(snapToWall({ ...painting, y: 290 }, [low])).toBeNull();
    expect(snapToWall({ ...painting, x: 1000 }, [north])).toBeNull();
    expect(snapToWall({ ...painting, w: 500 }, [north])!.x).toBe(200);
  });
});

describe("settleItem", () => {
  it("dispatches on mount", () => {
    const table = item("table", 200, 150);
    expect(
      settleItem(item("v", 200, 150, { mount: "stack" }), [table], [], surfaceOf).elevation,
    ).toBe(75);
    expect(
      settleItem(item("p", 150, 40, { mount: "wall", d: 4 }), [], [north], surfaceOf),
    ).toMatchObject({ y: 2, rotation: 0 });
    expect(settleItem(item("p", 150, 40, { mount: "wall" }), [], [], surfaceOf)).toMatchObject({
      x: 150,
      y: 40,
    });
    expect(settleItem(table, [], [north], surfaceOf)).toEqual({
      x: 200,
      y: 150,
      rotation: 0,
      elevation: 0,
    });
  });
});
