import { describe, expect, it } from "vitest";
import { polygonArea } from "../geometry/polygon";
import { unionArea } from "../geometry/rect";
import type { Room, Wall } from "../model/types";
import {
  cleanPolygon,
  closesPolygon,
  facesFromSegments,
  lRoomShape,
  moveVertex,
  moveWallLine,
  notchInCorner,
  pointAtLength,
  rectRoomShape,
  roomVertices,
  scaleFromReference,
  shapeFromPolygon,
  snapDirection,
  wallLine,
  type Segment,
} from "./draw";

const seg = (ax: number, ay: number, bx: number, by: number): Segment => ({
  a: { x: ax, y: ay },
  b: { x: bx, y: by },
});
const square = (x: number, y: number, s: number): Segment[] => [
  seg(x, y, x + s, y),
  seg(x + s, y, x + s, y + s),
  seg(x + s, y + s, x, y + s),
  seg(x, y + s, x, y),
];

describe("snapping while drawing", () => {
  it("snaps to 0, 45 and 90 degrees", () => {
    expect(snapDirection({ x: 0, y: 0 }, { x: 100, y: 8 })).toEqual({ x: 100.3, y: 0 });
    const d = snapDirection({ x: 0, y: 0 }, { x: 100, y: 90 });
    expect(d.x).toBeCloseTo(d.y, 0);
    expect(snapDirection({ x: 0, y: 0 }, { x: 3, y: 200 }).x).toBe(0);
    expect(snapDirection({ x: 5, y: 5 }, { x: 5, y: 5 })).toEqual({ x: 5, y: 5 });
  });

  it("places a point at a typed length", () => {
    expect(pointAtLength({ x: 0, y: 0 }, { x: 10, y: 0 }, 350)).toEqual({ x: 350, y: 0 });
  });
});

describe("room shapes", () => {
  it("makes rect rooms from a drag and ignores tiny drags", () => {
    expect(rectRoomShape({ x: 400, y: 300 }, { x: 0, y: 0 })).toEqual({
      kind: "rects",
      rects: [{ x: 0, y: 0, w: 400, d: 300 }],
    });
    expect(rectRoomShape({ x: 0, y: 0 }, { x: 10, y: 400 })).toBeNull();
  });

  it("makes an L from an outer rect and a corner notch", () => {
    const outer = { x: 0, y: 0, w: 400, d: 400 };
    const notch = notchInCorner(outer, { x: 260, y: 250 }, { x: 390, y: 390 });
    expect(notch).toEqual({ x: 270, y: 260, w: 130, d: 140 });
    const shape = lRoomShape(outer, notch)!;
    expect(shape.kind === "rects" && unionArea(shape.rects)).toBe(160000 - 130 * 140);
    expect(lRoomShape(outer, { x: 100, y: 100, w: 50, d: 50 })).toBeNull();
  });

  it("closes and cleans polygons", () => {
    const pts = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
    ];
    expect(closesPolygon(pts, { x: 5, y: 3 }, 10)).toBe(true);
    expect(closesPolygon(pts.slice(0, 2), { x: 0, y: 0 }, 10)).toBe(false);
    expect(cleanPolygon([...pts, { x: 0, y: 0 }])).toEqual([
      { x: 0, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
    ]);
    expect(
      cleanPolygon([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ]),
    ).toBeNull();
  });

  it("turns rectangle polygons into rects", () => {
    expect(
      shapeFromPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 20 },
        { x: 0, y: 20 },
      ]),
    ).toEqual({ kind: "rects", rects: [{ x: 0, y: 0, w: 10, d: 20 }] });
    expect(
      shapeFromPolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 20 },
      ]).kind,
    ).toBe("polygon");
  });
});

describe("rooms from drawn walls", () => {
  it("finds one room in a closed square", () => {
    const faces = facesFromSegments(square(0, 0, 400));
    expect(faces).toHaveLength(1);
    expect(polygonArea(faces[0]!)).toBe(160000);
  });

  it("finds two rooms sharing a wall", () => {
    const faces = facesFromSegments([...square(0, 0, 400), seg(200, 0, 200, 400)]);
    expect(faces.map((f) => polygonArea(f))).toEqual([80000, 80000]);
  });

  it("splits crossing walls into four rooms", () => {
    const faces = facesFromSegments([
      ...square(0, 0, 400),
      seg(200, -50, 200, 450),
      seg(-50, 200, 450, 200),
    ]);
    expect(faces).toHaveLength(4);
    expect(faces.every((f) => polygonArea(f) === 40000)).toBe(true);
  });

  it("ignores walls that do not close and finds diagonal rooms", () => {
    expect(facesFromSegments([seg(0, 0, 100, 0), seg(100, 0, 100, 100)])).toEqual([]);
    const tri = facesFromSegments([
      seg(0, 0, 300, 0),
      seg(300, 0, 0, 300),
      seg(0, 300, 0, 0),
      seg(300, 0, 500, 0),
    ]);
    expect(tri).toHaveLength(1);
    expect(polygonArea(tri[0]!)).toBe(45000);
  });

  it("handles a wall ending on another wall (T-junction)", () => {
    const faces = facesFromSegments([...square(0, 0, 400), seg(0, 150, 400, 150)]);
    expect(faces.map((f) => polygonArea(f)).sort((a, b) => a - b)).toEqual([60000, 100000]);
  });
});

describe("moving walls and vertices", () => {
  const a: Room = {
    id: "a",
    name: "A",
    type: "living",
    shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 400, d: 300 }] },
  };
  const b: Room = {
    id: "b",
    name: "B",
    type: "bed",
    shape: { kind: "rects", rects: [{ x: 400, y: 0, w: 300, d: 300 }] },
  };
  const inner: Wall = {
    id: "w",
    kind: "interior",
    rect: { x: 395, y: 0, w: 10, d: 300 },
    height: 260,
    rooms: { a: "a", b: "b" },
  };
  const outer: Wall = {
    id: "o",
    kind: "exterior",
    rect: { x: 0, y: -30, w: 700, d: 30 },
    height: 260,
    rooms: { b: "a" },
  };

  it("finds the room edge a wall stands on", () => {
    expect(wallLine(inner)).toEqual({ axis: "v", at: 400, from: 0, to: 300 });
    expect(wallLine(outer)).toEqual({ axis: "h", at: 0, from: 0, to: 700 });
    expect(
      wallLine({ ...outer, rect: { x: 0, y: 300, w: 700, d: 30 }, rooms: { a: "a" } }),
    ).toMatchObject({ at: 300 });
  });

  it("moves a shared wall: one room grows, the other shrinks", () => {
    const [na, nb] = moveWallLine([a, b], wallLine(inner), 50);
    expect(na!.shape.kind === "rects" && na!.shape.rects[0]).toEqual({
      x: 0,
      y: 0,
      w: 450,
      d: 300,
    });
    expect(nb!.shape.kind === "rects" && nb!.shape.rects[0]).toEqual({
      x: 450,
      y: 0,
      w: 250,
      d: 300,
    });
  });

  it("moves an outer wall and refuses to collapse rooms", () => {
    const [na] = moveWallLine([a], wallLine(outer), -40);
    expect(na!.shape.kind === "rects" && na!.shape.rects[0]).toEqual({
      x: 0,
      y: -40,
      w: 400,
      d: 340,
    });
    expect(moveWallLine([a], wallLine(outer), 299)[0]).toBe(a);
  });

  it("moves polygon edges", () => {
    const tri: Room = {
      ...a,
      shape: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 400, y: 0 },
          { x: 400, y: 300 },
          { x: 0, y: 300 },
        ],
      },
    };
    const [moved] = moveWallLine([tri], { axis: "v", at: 400, from: 0, to: 300 }, 20);
    expect(moved!.shape.kind === "polygon" && moved!.shape.points.map((p) => p.x)).toEqual([
      0, 420, 420, 0,
    ]);
  });

  it("drags vertices and rect corners", () => {
    expect(roomVertices(a)).toHaveLength(4);
    const r = moveVertex(a, 2, { x: 500, y: 350 });
    expect(r.shape.kind === "rects" && r.shape.rects[0]).toEqual({ x: 0, y: 0, w: 500, d: 350 });
    expect(moveVertex(a, 2, { x: 5, y: 5 })).toBe(a);
    expect(moveVertex(a, 9, { x: 5, y: 5 })).toBe(a);
    const poly: Room = {
      ...a,
      shape: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 0, y: 300 },
        ],
      },
    };
    expect(moveVertex(poly, 1, { x: 400, y: 0 }).shape).toEqual({
      kind: "polygon",
      points: [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
        { x: 0, y: 300 },
      ],
    });
  });
});

describe("background scale", () => {
  it("scales so the reference line has the real length", () => {
    // Line is 200 world cm at scale 1 cm/px = 200 px; real door is 90 cm.
    expect(scaleFromReference({ x: 0, y: 0 }, { x: 200, y: 0 }, 90, 1)).toBeCloseTo(0.45);
    expect(scaleFromReference({ x: 0, y: 0 }, { x: 0, y: 0 }, 90, 2)).toBe(2);
  });
});
