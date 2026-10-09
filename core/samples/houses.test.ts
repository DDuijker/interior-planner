import { describe, expect, it } from "vitest";
import { checkLayout } from "../collision/collision";
import { validateProject } from "../model/schema";
import { generateWalls } from "../walls/generate";
import { SAMPLES } from "./houses";

describe("samples", () => {
  it("has at least three, including two floors", () => {
    expect(SAMPLES.length).toBeGreaterThanOrEqual(3);
    expect(SAMPLES.some((s) => s.create().floors.length === 2)).toBe(true);
  });

  for (const sample of SAMPLES) {
    it(`${sample.id} is valid and has no hard layout problems`, () => {
      const p = sample.create();
      expect(validateProject(p).ok).toBe(true);
      for (const floor of p.floors) {
        const v = floor.current;
        const walls = generateWalls(v.rooms, v.extraWalls, { height: floor.height });
        expect(
          v.openings.every((o) => o.wallId),
          `${sample.id} ${floor.name} openings on walls`,
        ).toBe(true);
        const hard = checkLayout({ ...v, walls }).filter((i) => i.type !== "clearance");
        expect(hard, `${sample.id} ${floor.name}`).toEqual([]);
      }
    });
  }

  it("lines the stairs up with the floor above", () => {
    const house = SAMPLES.find((s) => s.id === "house")!.create();
    const stairs = house.floors[0]!.current.fixtures.find((f) => f.type === "stairs")!;
    const landing = house.floors[1]!.current.rooms.find((r) => r.type === "hal")!;
    const r = landing.shape.kind === "rects" ? landing.shape.rects[0]! : null;
    expect(
      r && stairs.x >= r.x && stairs.x + stairs.w <= r.x + r.w && stairs.y + stairs.d <= r.y + r.d,
    ).toBe(true);
  });
});
