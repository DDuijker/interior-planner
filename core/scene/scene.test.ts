import { describe, expect, it } from "vitest";
import { createFixture } from "../fixtures/fixtures";
import { createFloor, createProject } from "../model/defaults";
import type { Room } from "../model/types";
import {
  adjustQuality,
  birdView,
  checkStairs,
  collide,
  daylight,
  floorBases,
  lerpView,
  pickLights,
  QUALITY,
  riserCount,
  roomView,
  SLAB,
  stairProgress,
  stairSteps,
  stairwell,
  sunDirection,
  topView,
  visibleFloors,
} from "./scene";

describe("stairs", () => {
  const straight = createFixture("stairs", 0, 0, {
    w: 90,
    d: 280,
    stair: { shape: "straight", up: "N" },
  });

  it("uses about 18 cm risers", () => {
    expect(riserCount(270)).toBe(15);
    const steps = stairSteps(straight, 270);
    expect(steps).toHaveLength(15);
    expect(steps[14]!.z1).toBeCloseTo(270);
    // Walking north: the first step is at the south end.
    expect(steps[0]!.y).toBeGreaterThan(steps[14]!.y);
  });

  it("turns with the up direction and rotation", () => {
    const east = stairSteps({ ...straight, stair: { shape: "straight", up: "E" } }, 270);
    expect(east[0]!.x).toBeLessThan(east[14]!.x);
  });

  it("builds L and spiral stairs", () => {
    const l = stairSteps({ ...straight, w: 100, d: 250, stair: { shape: "l", up: "N" } }, 260);
    expect(l.length).toBe(riserCount(260));
    const spiral = stairSteps(
      { ...straight, w: 160, d: 160, stair: { shape: "spiral", up: "N" } },
      260,
    );
    expect(new Set(spiral.map((s) => Math.round(s.rotation))).size).toBeGreaterThan(5);
  });

  it("warns about steep stairs", () => {
    expect(checkStairs(straight, 270).tooSteep).toBe(false);
    const short = checkStairs({ ...straight, d: 150 }, 270);
    expect(short.tooSteep).toBe(true);
    expect(short.angle).toBeGreaterThan(45);
  });

  it("cuts a stairwell the size of the stairs", () => {
    expect(stairwell(straight)).toEqual({ x: 0, y: 0, w: 90, d: 280 });
    const r = stairwell({ ...straight, rotation: 90 });
    expect(r.w).toBeCloseTo(280);
  });

  it("knows how far up the stairs you are", () => {
    expect(stairProgress(straight, { x: 45, y: 279 })).toBeCloseTo(0, 1);
    expect(stairProgress(straight, { x: 45, y: 1 })).toBeCloseTo(1, 1);
    expect(stairProgress(straight, { x: 200, y: 100 })).toBeNull();
  });
});

describe("floor stacking", () => {
  const p = createProject();
  const first = createFloor("Boven", 1, 255);
  const cellar = createFloor("Kelder", -1, 220);
  p.floors.push(first, cellar);

  it("stacks floors with slabs and spreads them out when exploded", () => {
    const bases = floorBases(p, "all");
    expect(bases.get(p.floors[0]!.id)).toBe(0);
    expect(bases.get(first.id)).toBe(260 + SLAB);
    expect(bases.get(cellar.id)).toBe(-(220 + SLAB));
    expect(floorBases(p, "exploded").get(first.id)).toBe(260 + SLAB + 200);
  });

  it("chooses visible floors", () => {
    expect(visibleFloors(p, "single").map((f) => f.name)).toEqual(["Begane grond"]);
    expect(visibleFloors(p, "all").map((f) => f.level)).toEqual([-1, 0, 1]);
    expect(visibleFloors(p, "all", new Set([cellar.id])).map((f) => f.level)).toEqual([0, 1]);
  });
});

describe("viewpoints", () => {
  const bounds = { x: 0, y: 0, w: 800, d: 600 };
  it("looks down, from the side and from a room", () => {
    expect(topView(bounds).target).toEqual({ x: 400, y: 300, z: 0 });
    expect(topView(bounds).position.z).toBeGreaterThan(1000);
    expect(birdView(bounds).position.z).toBeGreaterThan(0);
    const room: Room = {
      id: "r",
      name: "",
      type: "bed",
      shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 400, d: 300 }] },
    };
    expect(roomView(room, 160).position.z).toBe(160);
  });

  it("eases between viewpoints", () => {
    const a = topView(bounds),
      b = birdView(bounds);
    expect(lerpView(a, b, 0)).toEqual(a);
    expect(lerpView(a, b, 1).position.x).toBeCloseTo(b.position.x);
  });
});

describe("daylight", () => {
  it("rises east, south at noon, sets west", () => {
    expect(sunDirection(6).x).toBeGreaterThan(0.9);
    const noon = sunDirection(13);
    expect(noon.y).toBeGreaterThan(0.3);
    expect(noon.z).toBeGreaterThan(0.7);
    expect(sunDirection(20).x).toBeLessThan(-0.9);
    // Plan-up facing east: the midday (south) sun is on the right.
    expect(sunDirection(13, 90).x).toBeGreaterThan(0.3);
  });

  it("is dark at night", () => {
    expect(daylight(3)).toBe(0);
    expect(daylight(13.5)).toBeCloseTo(1, 1);
  });
});

describe("lights and quality", () => {
  it("keeps the brightest nearby lights", () => {
    const lights = [
      { id: "far", position: { x: 2000, y: 0, z: 200 }, intensity: 1 },
      { id: "near", position: { x: 100, y: 0, z: 200 }, intensity: 0.5 },
      { id: "dim", position: { x: 50, y: 0, z: 200 }, intensity: 0.05 },
    ];
    expect(pickLights(lights, { x: 0, y: 0, z: 160 }, 2).map((l) => l.id)).toEqual(["near", "far"]);
    expect(pickLights(lights, { x: 0, y: 0, z: 0 }, 0)).toEqual([]);
  });

  it("steps quality down and up from frame times", () => {
    expect(adjustQuality("high", Array(30).fill(40))).toBe("medium");
    expect(adjustQuality("low", Array(30).fill(40))).toBe("low");
    expect(adjustQuality("medium", Array(30).fill(10))).toBe("high");
    expect(adjustQuality("medium", Array(10).fill(40))).toBe("medium");
    expect(QUALITY.low.shadows).toBe(false);
  });
});

describe("walking", () => {
  const wall = { x: 0, y: 0, w: 400, d: 10 };
  it("keeps the walker out of walls", () => {
    expect(collide({ x: 100, y: 20 }, 20, [wall])).toEqual({ x: 100, y: 30 });
    expect(collide({ x: 100, y: 100 }, 20, [wall])).toEqual({ x: 100, y: 100 });
    const inside = collide({ x: 100, y: 4 }, 20, [wall]);
    expect(inside.y).toBe(-20);
  });
});
