import { describe, expect, it } from "vitest";
import { checkLayout } from "../collision/collision";
import { roomArea } from "../editor/rooms";
import { getActiveVersion, validateProject } from "../model";
import { generateWalls } from "../walls/generate";
import { sampleApartment } from "./apartment";

describe("sample apartment", () => {
  const project = sampleApartment();
  const version = getActiveVersion(project);
  const walls = generateWalls(version.rooms);

  it("is a valid project", () => {
    const result = validateProject(project);
    if (!result.ok) console.error(result.issues);
    expect(result.ok).toBe(true);
  });

  it("is about 70 m² including the loggia", () => {
    const total = version.rooms.reduce((s, r) => s + roomArea(r), 0) / 10000;
    expect(total).toBeGreaterThan(65);
    expect(total).toBeLessThan(80);
  });

  it("has all openings on walls", () => {
    expect(version.openings.every((o) => o.wallId && walls.some((w) => w.id === o.wallId))).toBe(
      true,
    );
  });

  it("has no overlaps, wall hits or blocked doors", () => {
    const issues = checkLayout({ ...version, walls });
    expect(issues.filter((i) => i.type !== "clearance")).toEqual([]);
  });

  it("never measures clearance through a wall", () => {
    const issues = checkLayout({ ...version, walls, rooms: version.rooms });
    const lowWalls = new Set(walls.filter((w) => w.kind === "low").map((w) => w.id));
    expect(issues.some((i) => lowWalls.has(i.ids[1]))).toBe(false);
    expect(issues.some((i) => i.ids.includes("tv-unit") && i.ids.includes("fx-kitchen"))).toBe(
      false,
    );
  });
});
