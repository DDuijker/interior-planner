import { describe, expect, it } from "vitest";
import type { Room, Wall } from "../model/types";
import { generateWalls } from "../walls/generate";
import {
  createDoor,
  createWindow,
  cutWalls,
  demolish,
  doorSwing,
  openingCenter,
  openingOnWall,
  placeOnWall,
  setGlass,
  snapOpening,
  validateOpening,
  wallCenterLine,
} from "./openings";

const hWall: Wall = {
  id: "h",
  kind: "interior",
  rect: { x: 0, y: 295, w: 400, d: 10 },
  height: 260,
  rooms: {},
};
const vWall: Wall = {
  id: "v",
  kind: "exterior",
  rect: { x: -30, y: 0, w: 30, d: 300 },
  height: 260,
  rooms: {},
};
const low: Wall = {
  id: "l",
  kind: "low",
  rect: { x: 0, y: 500, w: 400, d: 10 },
  height: 100,
  rooms: {},
};

describe("snapping", () => {
  it("snaps to the nearest wall centre line and takes its direction", () => {
    const door = createDoor(100, 280, "v");
    const snapped = snapOpening(door, [hWall, vWall])!;
    expect(snapped).toMatchObject({ dir: "h", y: 300, wallId: "h" });
    expect(openingCenter(snapped).x).toBeCloseTo(100);
  });

  it("returns null when no wall is near", () => {
    expect(snapOpening(createDoor(1000, 1000, "h"), [hWall])).toBeNull();
  });

  it("never snaps to a low edge", () => {
    expect(snapOpening(createWindow(150, 505, "h"), [low], 20)).toBeNull();
  });

  it("keeps the opening inside the wall and narrows it if needed", () => {
    const clamped = placeOnWall(createWindow(380, 300, "h"), hWall);
    expect(clamped.x + clamped.w).toBe(400);
    const narrow = placeOnWall(createWindow(0, 0, "v", { w: 500 }), vWall);
    expect(narrow).toMatchObject({ w: 300, y: 0, x: -15, dir: "v" });
  });

  it("knows which wall an opening is on", () => {
    const d = placeOnWall(createDoor(0, 0, "h"), hWall);
    expect(openingOnWall(d, hWall)).toBe(true);
    expect(openingOnWall(d, vWall)).toBe(false);
    expect(wallCenterLine(vWall.rect)).toEqual([
      { x: -15, y: 0 },
      { x: -15, y: 300 },
    ]);
  });
});

describe("cutWalls", () => {
  it("leaves a gap in 2D", () => {
    const door = createDoor(100, 300, "h", { w: 90 });
    const pieces = cutWalls([hWall], [door]);
    expect(pieces.map((p) => [p.rect.x, p.rect.w])).toEqual([
      [0, 100],
      [190, 210],
    ]);
  });

  it("adds a lintel above doors and sill plus lintel for windows in 3D", () => {
    const door = createDoor(100, 300, "h", { w: 90, height: 211 });
    const win = createWindow(250, 300, "h", { w: 100, sill: 90, lintel: 210 });
    const pieces = cutWalls([hWall], [door, win], true);
    const z = pieces.map((p) => [p.rect.x, p.z0, p.z1]);
    expect(z).toContainEqual([100, 211, 260]);
    expect(z).toContainEqual([250, 210, 260]);
    expect(z).toContainEqual([250, 0, 90]);
    expect(pieces.filter((p) => p.z0 === 0 && p.z1 === 260)).toHaveLength(3);
  });

  it("cuts a full glass wall without sill or lintel", () => {
    const glass = setGlass(createWindow(0, 300, "h", { w: 400 }), true, 260);
    expect(cutWalls([hWall], [glass], true)).toEqual([]);
    expect(setGlass(glass, false, 260)).toMatchObject({ sill: 90, lintel: 210, glass: false });
  });

  it("handles openings that run past the wall end", () => {
    const pieces = cutWalls([hWall], [createDoor(350, 300, "h", { w: 100 })], true);
    expect(pieces.map((p) => [p.rect.x, p.rect.w, p.z0])).toEqual([
      [0, 350, 0],
      [350, 50, 211],
    ]);
  });

  it("ignores openings on other walls and in low edges", () => {
    const door = createDoor(100, 300, "h");
    expect(cutWalls([vWall, low], [door])).toHaveLength(2);
  });

  it("works on generated walls: a door between two rooms", () => {
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
    const walls = generateWalls(rooms);
    const door = snapOpening(createDoor(400, 150, "h"), walls)!;
    expect(door).toMatchObject({ dir: "v", x: 400 });
    const before = cutWalls(walls, []).length;
    const after = cutWalls(walls, [door]);
    expect(after.length).toBe(before + 1);
    const interior = after.filter((p) => p.kind === "interior");
    expect(interior.reduce((s, p) => s + p.rect.d, 0)).toBeCloseTo(300 - 83);
  });
});

describe("doorSwing", () => {
  it("swings a horizontal door south from its start", () => {
    const s = doorSwing(createDoor(100, 300, "h", { w: 80, swing: "b", hinge: "start" }), 10);
    expect(s.hinge).toEqual({ x: 100, y: 305 });
    expect(s.open).toEqual({ x: 100, y: 385 });
    expect(s.closed).toEqual({ x: 180, y: 305 });
    expect(s.area).toEqual({ x: 100, y: 305, w: 80, d: 80 });
  });

  it("swings north from the end hinge", () => {
    const s = doorSwing(createDoor(100, 300, "h", { w: 80, swing: "a", hinge: "end" }), 10);
    expect(s.hinge).toEqual({ x: 180, y: 295 });
    expect(s.area).toEqual({ x: 100, y: 215, w: 80, d: 80 });
  });

  it("works for vertical doors", () => {
    const east = doorSwing(createDoor(400, 100, "v", { w: 80, swing: "b", hinge: "end" }), 10);
    expect(east.hinge).toEqual({ x: 405, y: 180 });
    expect(east.area).toEqual({ x: 405, y: 100, w: 80, d: 80 });
    const west = doorSwing(createDoor(400, 100, "v", { w: 80, swing: "a" }), 10);
    expect(west.area.x).toBe(315);
    expect(west.open).toEqual({ x: 315, y: 100 });
  });
});

describe("validateOpening", () => {
  it("accepts sane defaults", () => {
    expect(validateOpening(createDoor(0, 0, "h"), 260)).toEqual([]);
    expect(validateOpening(createWindow(0, 0, "h"), 260)).toEqual([]);
  });

  it("flags impossible heights", () => {
    expect(validateOpening(createDoor(0, 0, "h", { height: 300 }), 260)[0]!.field).toBe("height");
    const bad = validateOpening(createWindow(0, 0, "h", { sill: 150, lintel: 120, w: 0 }), 260);
    expect(bad.map((p) => p.field)).toEqual(["w", "lintel"]);
    expect(
      validateOpening(createWindow(0, 0, "h", { sill: -1, lintel: 300 }), 260).map((p) => p.field),
    ).toEqual(["sill", "lintel"]);
  });
});

describe("demolish", () => {
  it("removes demolished parts of walls and keeps ids", () => {
    const parts = demolish([hWall], [{ x: 100, y: 290, w: 100, d: 20 }]);
    expect(parts.map((w) => [w.id, w.rect.x, w.rect.w])).toEqual([
      ["h", 0, 100],
      ["h", 200, 200],
    ]);
    expect(demolish([hWall], [])).toEqual([hWall]);
    expect(cutWalls([hWall], [], false, [hWall.rect])).toEqual([]);
  });
});
