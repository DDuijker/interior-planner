import { describe, expect, it } from "vitest";
import { getActiveVersion, setWallOverride, updateItems } from "../model/actions";
import { styleSchema } from "../model/schema";
import { sampleApartment } from "../samples/apartment";
import { generateWalls } from "../walls/generate";
import {
  applyLook,
  applyPreset,
  applySurprise,
  decodePalette,
  encodePalette,
  OUTSIDE,
  removeLook,
  resolveRoomStyle,
  resolveWallFinish,
  rng,
  saveLook,
  setRoomStyle,
  setVersionStyle,
  STYLE_PRESETS,
  surpriseStyle,
} from "./style";

const base = () => sampleApartment();

describe("resolving finishes", () => {
  it("room style falls back to the version style", () => {
    let p = base();
    const v = getActiveVersion(p);
    expect(resolveRoomStyle(v, v.rooms[0]).wall).toEqual(v.style.wall);
    p = setRoomStyle(p, "living", {
      wall: { kind: "paint", color: "#87A08C" },
      trim: { rosette: true },
    });
    const v2 = getActiveVersion(p);
    const rs = resolveRoomStyle(
      v2,
      v2.rooms.find((r) => r.id === "living"),
    );
    expect(rs.wall).toEqual({ kind: "paint", color: "#87A08C" });
    expect(rs.trim.rosette).toBe(true);
    expect(rs.trim.skirting).toEqual(v2.style.trim.skirting);
    expect(getActiveVersion(setRoomStyle(p, "living", undefined)).rooms[0]!.style).toBeUndefined();
  });

  it("walls: override, then room on that side, then outside", () => {
    let p = setRoomStyle(base(), "bed", {
      wall: { kind: "wallpaper", pattern: "stripe", color: "#F4F0E6" },
    });
    const v = getActiveVersion(p);
    const walls = generateWalls(v.rooms);
    const wall = walls.find(
      (w) => w.kind === "interior" && w.rooms.a === "living" && w.rooms.b === "bed",
    )!;
    expect(resolveWallFinish(v, wall, "b").kind).toBe("wallpaper");
    expect(resolveWallFinish(v, wall, "a")).toEqual(v.style.wall);
    const outer = walls.find((w) => w.kind === "exterior" && (!w.rooms.a || !w.rooms.b))!;
    const outside = outer.rooms.a ? "b" : "a";
    expect(resolveWallFinish(v, outer, outside)).toEqual(OUTSIDE);
    p = setWallOverride(p, wall.id, "b", { kind: "paint", color: "#2E3A35" });
    expect(resolveWallFinish(getActiveVersion(p), wall, "b")).toEqual({
      kind: "paint",
      color: "#2E3A35",
    });
    const interiorNoRoom = { ...wall, rooms: {} };
    expect(resolveWallFinish(v, interiorNoRoom, "a")).toEqual(v.style.wall);
  });
});

describe("presets", () => {
  it("has 20+ valid presets with the requested styles", () => {
    expect(STYLE_PRESETS.length).toBeGreaterThanOrEqual(20);
    for (const id of [
      "french-country",
      "neoclassical",
      "romantic",
      "japandi",
      "scandinavian",
      "art-deco",
    ]) {
      expect(
        STYLE_PRESETS.some((x) => x.id === id),
        id,
      ).toBe(true);
    }
    for (const preset of STYLE_PRESETS) {
      expect(styleSchema.safeParse({ ...preset.style, name: "x" }).success, preset.id).toBe(true);
      expect(new Set(STYLE_PRESETS.map((x) => x.id)).size).toBe(STYLE_PRESETS.length);
    }
  });

  it("applies to the whole version or one room, optionally recolouring furniture", () => {
    let p = setRoomStyle(base(), "bed", { wall: { kind: "paint", color: "#000000" } });
    p = applyPreset(p, "japandi", "all", true, "en");
    const v = getActiveVersion(p);
    expect(v.style).toMatchObject({ name: "Japandi", presetId: "japandi" });
    expect(v.rooms.every((r) => !r.style)).toBe(true);
    expect(v.items.find((i) => i.id === "sofa")!.color).toBe("#C8BBA6");
    expect(v.items.find((i) => i.id === "plant")!.color).toBe("#4D6857"); // decor keeps its colour
    const one = getActiveVersion(applyPreset(base(), "art-deco", "bed"));
    expect(one.rooms.find((r) => r.id === "bed")!.style!.floor!.kind).toBe("checker");
    expect(one.style.presetId).toBeUndefined();
    expect(applyPreset(p, "missing", "all")).toBe(p);
  });
});

describe("surprise me", () => {
  const palette = ["#F5F1E8", "#87A08C", "#4D6857", "#B08D57", "#4A3526"];

  it("is deterministic per seed and stays in the palette", () => {
    const a = surpriseStyle(palette, rng(42));
    const b = surpriseStyle(palette, rng(42));
    expect(a).toEqual(b);
    for (let seed = 0; seed < 40; seed++) {
      const s = surpriseStyle(palette, rng(seed));
      expect(styleSchema.safeParse({ ...s, name: "x" }).success).toBe(true);
      expect(palette).toContain(s.wall.color);
      expect(palette).toContain(s.ceiling);
      expect(palette).toContain(s.accent);
    }
  });

  it("varies between seeds", () => {
    const kinds = new Set(
      Array.from({ length: 30 }, (_, i) => surpriseStyle(palette, rng(i)).wall.kind),
    );
    expect(kinds.size).toBeGreaterThan(2);
  });

  it("applies to all or one room", () => {
    const all = getActiveVersion(applySurprise(base(), palette, 1, "all", "Verrassing"));
    expect(all.style.name).toBe("Verrassing");
    const one = getActiveVersion(applySurprise(base(), palette, 1, "bed", "x"));
    expect(one.rooms.find((r) => r.id === "bed")!.style).toBeDefined();
  });
});

describe("looks", () => {
  it("saves and restores style, rooms, walls and item colours", () => {
    let p = base();
    const saved = saveLook(p, "Origineel", new Date(0));
    p = saved.project;
    expect(p.looks[0]).toMatchObject({ name: "Origineel", createdAt: "1970-01-01T00:00:00.000Z" });
    p = applyPreset(p, "art-deco", "all", true);
    p = updateItems(p, ["vase"], { color: "#123456" });
    p = setVersionStyle(p, { accent: "#000000" });
    p = applyLook(p, saved.id);
    const v = getActiveVersion(p);
    expect(v.style).toEqual(getActiveVersion(base()).style);
    expect(v.items.find((i) => i.id === "sofa")!.color).toBe("#87A08C");
    expect(v.items.find((i) => i.id === "vase")!.color).toBeUndefined();
    expect(applyLook(p, "nope")).toBe(p);
    expect(removeLook(p, saved.id).looks).toEqual([]);
  });
});

describe("palette codes", () => {
  it("roundtrips and rejects garbage", () => {
    const pal = { name: "Mijn salie ✓", colors: ["#87A08C", "#4d6857"] };
    const code = encodePalette(pal);
    expect(code.startsWith("maison:")).toBe(true);
    expect(decodePalette(code)).toEqual({ name: "Mijn salie ✓", colors: ["#87A08C", "#4D6857"] });
    expect(decodePalette("nope")).toBeNull();
    expect(decodePalette("maison:!!!")).toBeNull();
    expect(decodePalette(encodePalette({ name: "x", colors: [] }))).toBeNull();
  });
});
