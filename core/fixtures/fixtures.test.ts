import { describe, expect, it } from "vitest";
import { FIXTURE_TYPES } from "../model/types";
import {
  clampFixtureSize,
  connectsFloors,
  createFixture,
  FIXTURE_SPECS,
  fixtureFootprint,
  fixtureHeight,
} from "./fixtures";
import { addFixture, createProject, getActiveVersion, updateFixture } from "../model";

describe("fixtures", () => {
  it("has a sane spec for every type", () => {
    for (const type of FIXTURE_TYPES) {
      const s = FIXTURE_SPECS[type];
      expect(s.min.w).toBeLessThanOrEqual(s.w);
      expect(s.w).toBeLessThanOrEqual(s.max.w);
      expect(s.min.d).toBeLessThanOrEqual(s.d);
      expect(s.d).toBeLessThanOrEqual(s.max.d);
    }
  });

  it("creates locked fixtures with default sizes", () => {
    const wc = createFixture("toilet", 10, 20);
    expect(wc).toMatchObject({
      type: "toilet",
      x: 10,
      y: 20,
      w: 40,
      d: 65,
      locked: true,
      rotation: 0,
    });
    expect(createFixture("bath", 0, 0, { w: 180 }).w).toBe(180);
  });

  it("clamps sizes to the type's range", () => {
    expect(clampFixtureSize("toilet", 10, 1000)).toEqual({ w: 35, d: 75 });
    expect(clampFixtureSize("kitchen", 300, 60)).toEqual({ w: 300, d: 60 });
  });

  it("computes a rotated footprint", () => {
    const f = createFixture("bath", 0, 0, { rotation: 90 });
    const xs = fixtureFootprint(f).map((p) => Math.round(p.x));
    expect(Math.max(...xs) - Math.min(...xs)).toBe(75);
  });

  it("runs columns, stairs and chimneys to the ceiling", () => {
    expect(fixtureHeight(createFixture("column", 0, 0), 273)).toBe(273);
    expect(fixtureHeight(createFixture("fridge", 0, 0), 273)).toBe(180);
    expect(connectsFloors("stairs")).toBe(true);
    expect(connectsFloors("sink")).toBe(false);
  });

  it("cannot be moved while locked, but can after unlocking", () => {
    const f = createFixture("kitchen", 0, 0, { id: "k" });
    let p = addFixture(createProject(), f);
    p = updateFixture(p, "k", { x: 100, w: 300 });
    expect(getActiveVersion(p).fixtures[0]).toMatchObject({ x: 0, w: 240 });
    p = updateFixture(updateFixture(p, "k", { locked: false }), "k", { x: 100, w: 300 });
    expect(getActiveVersion(p).fixtures[0]).toMatchObject({ x: 100, w: 300 });
  });
});
