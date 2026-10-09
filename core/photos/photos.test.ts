import { describe, expect, it } from "vitest";
import { createProject } from "@/core/model/defaults";
import type { Photo, Room } from "@/core/model/types";
import { generateWalls } from "@/core/walls/generate";
import {
  addPhoto,
  cleanSourceUrl,
  dirTo,
  dirVector,
  isPinterest,
  photoStandpoint,
  removePhoto,
  reorder,
  roomWalls,
  setMoodboard,
  standpointView,
  updatePhoto,
  wallDirection,
} from "./photos";

const photo = (id: string, kind: Photo["kind"] = "inspiration"): Photo => ({
  id,
  kind,
  name: id,
  width: 100,
  height: 80,
  createdAt: "2026-01-01T00:00:00.000Z",
});

const room = (id: string, x: number, y: number, w: number, d: number): Room => ({
  id,
  name: id,
  type: "living",
  shape: { kind: "rects", rects: [{ x, y, w, d }] },
});

describe("library and moodboard", () => {
  it("adds, updates and removes photos, cleaning moodboards", () => {
    let p = createProject();
    const vId = p.floors[0]!.current.id;
    p = addPhoto(p, photo("a"), vId);
    p = addPhoto(p, photo("b"), vId);
    expect(p.floors[0]!.current.moodboard).toEqual(["a", "b"]);
    p = updatePhoto(p, "a", { note: "warm", sourceUrl: "https://pin.it/x" });
    expect(p.photos[0]).toMatchObject({ note: "warm", sourceUrl: "https://pin.it/x" });
    p = updatePhoto(p, "a", { note: undefined });
    expect(p.photos[0]).not.toHaveProperty("note");
    p = setMoodboard(p, vId, ["b", "a"]);
    expect(p.floors[0]!.current.moodboard).toEqual(["b", "a"]);
    p = removePhoto(p, "b");
    expect(p.photos.map((x) => x.id)).toEqual(["a"]);
    expect(p.floors[0]!.current.moodboard).toEqual(["a"]);
  });

  it("reorders within bounds", () => {
    expect(reorder(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(reorder(["a", "b", "c"], 2, -5)).toEqual(["c", "a", "b"]);
    expect(reorder(["a"], 3, 0)).toEqual(["a"]);
  });
});

describe("source links", () => {
  it("keeps the link, drops tracking and rejects nonsense", () => {
    expect(cleanSourceUrl(" nl.pinterest.com/pin/123/?utm_source=x&a=1 ")).toBe(
      "https://nl.pinterest.com/pin/123/?a=1",
    );
    expect(cleanSourceUrl("javascript:alert(1)")).toBeUndefined();
    expect(cleanSourceUrl("hello")).toBeUndefined();
    expect(cleanSourceUrl("")).toBeUndefined();
  });

  it("recognises Pinterest", () => {
    expect(isPinterest("https://nl.pinterest.com/pin/1/")).toBe(true);
    expect(isPinterest("https://pin.it/abc")).toBe(true);
    expect(isPinterest("https://notpinterest.com.evil.io/")).toBe(false);
    expect(isPinterest(undefined)).toBe(false);
  });
});

describe("walls and standpoints", () => {
  const rooms = [room("living", 0, 0, 400, 300), room("kitchen", 400, 0, 300, 300)];
  const walls = generateWalls(rooms);

  it("finds the walls around a room by compass side", () => {
    const w = roomWalls(walls, "living");
    expect(w.N.length).toBeGreaterThan(0);
    expect(w.E.length).toBeGreaterThan(0);
    // The east wall of the living room is the shared wall; the kitchen sees it to the west.
    const shared = w.E[0]!.wall;
    expect(wallDirection(walls, "kitchen", shared.id)).toBe("W");
  });

  it("directions", () => {
    expect(dirTo({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(0);
    expect(dirTo({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(90);
    expect(dirTo({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(180);
    const v = dirVector(90);
    expect(v.x).toBeCloseTo(1);
    expect(v.y).toBeCloseTo(0);
  });

  it("faces a linked wall from inside the room", () => {
    const north = roomWalls(walls, "living").N[0]!;
    const sp = photoStandpoint(
      { roomId: "living", wallId: north.wall.id, side: north.side },
      rooms,
      walls,
    )!;
    expect(sp.at.y).toBeGreaterThan(0);
    expect(sp.at.y).toBeLessThan(300);
    expect(sp.dir).toBe(0);
  });

  it("uses an explicit standpoint, or the room centre", () => {
    expect(photoStandpoint({ at: { x: 5, y: 6 }, dir: 45 }, rooms, walls)).toEqual({
      at: { x: 5, y: 6 },
      dir: 45,
    });
    expect(photoStandpoint({ roomId: "kitchen" }, rooms, walls)?.at).toEqual({ x: 550, y: 150 });
    expect(photoStandpoint({}, rooms, walls)).toBeUndefined();
  });

  it("turns a standpoint into a 3D view at eye height", () => {
    const v = standpointView({ at: { x: 100, y: 100 }, dir: 90 }, 160, 285);
    expect(v.position).toEqual({ x: 100, y: 100, z: 445 });
    expect(v.target.x).toBeGreaterThan(100);
  });
});
