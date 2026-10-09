import { orientedBox } from "../geometry/polygon";
import { newId } from "../model/ids";
import type { Fixture, FixtureType, Point } from "../model/types";

export interface FixtureSpec {
  /** Default footprint, cm. `w` along the wall, `d` into the room. */
  w: number;
  d: number;
  /** Height for 3D, cm. */
  h: number;
  /** Allowed size range for resizing. */
  min: { w: number; d: number };
  max: { w: number; d: number };
}

/** Standard sizes for fixed elements. */
export const FIXTURE_SPECS: Record<FixtureType, FixtureSpec> = {
  kitchen: { w: 240, d: 60, h: 90, min: { w: 60, d: 50 }, max: { w: 800, d: 120 } },
  fridge: { w: 60, d: 65, h: 180, min: { w: 50, d: 55 }, max: { w: 100, d: 80 } },
  toilet: { w: 40, d: 65, h: 80, min: { w: 35, d: 50 }, max: { w: 50, d: 75 } },
  sink: { w: 60, d: 45, h: 85, min: { w: 30, d: 25 }, max: { w: 180, d: 60 } },
  shower: { w: 90, d: 90, h: 200, min: { w: 70, d: 70 }, max: { w: 200, d: 200 } },
  bath: { w: 170, d: 75, h: 60, min: { w: 120, d: 60 }, max: { w: 200, d: 100 } },
  tall: { w: 60, d: 60, h: 220, min: { w: 30, d: 30 }, max: { w: 300, d: 80 } },
  column: { w: 30, d: 30, h: 260, min: { w: 10, d: 10 }, max: { w: 100, d: 100 } },
  stairs: { w: 90, d: 280, h: 260, min: { w: 60, d: 100 }, max: { w: 200, d: 600 } },
  chimney: { w: 60, d: 40, h: 260, min: { w: 30, d: 20 }, max: { w: 200, d: 100 } },
};

/** New fixtures are locked so they cannot be moved by accident. */
export function createFixture(
  type: FixtureType,
  x: number,
  y: number,
  patch: Partial<Fixture> = {},
): Fixture {
  const spec = FIXTURE_SPECS[type];
  return {
    id: newId("fix"),
    type,
    x,
    y,
    w: spec.w,
    d: spec.d,
    rotation: 0,
    locked: true,
    ...patch,
  };
}

/** Clamp a requested size to what makes sense for this type. */
export function clampFixtureSize(
  type: FixtureType,
  w: number,
  d: number,
): { w: number; d: number } {
  const { min, max } = FIXTURE_SPECS[type];
  return {
    w: Math.min(max.w, Math.max(min.w, w)),
    d: Math.min(max.d, Math.max(min.d, d)),
  };
}

/** Footprint polygon. Fixtures are positioned by their top-left corner before rotation. */
export function fixtureFootprint(f: Fixture): Point[] {
  return orientedBox(f.x + f.w / 2, f.y + f.d / 2, f.w, f.d, f.rotation);
}

export function fixtureHeight(f: Fixture, floorHeight: number): number {
  const h = FIXTURE_SPECS[f.type].h;
  // Things that run to the ceiling follow the actual floor height.
  return f.type === "column" || f.type === "stairs" || f.type === "chimney" ? floorHeight : h;
}

/** Fixtures that pass through to the floor above (stairs) or the roof (chimney). */
export function connectsFloors(type: FixtureType): boolean {
  return type === "stairs" || type === "chimney";
}
