import { describe, expect, it } from "vitest";
import {
  clampSize,
  countByCategory,
  createItem,
  customEntry,
  ENTRIES,
  getEntry,
  itemParts,
  partColor,
  resolveEntry,
  scaleParts,
  searchCatalog,
  validateCatalog,
} from "./index";

describe("catalog", () => {
  it("validates: schema, unique ids, sizes and parts that fit", () => {
    expect(validateCatalog()).toEqual([]);
  });

  it("is broad enough per category (backlog E08)", () => {
    const c = countByCategory();
    expect(c.seating).toBeGreaterThanOrEqual(30);
    expect(c.tables).toBeGreaterThanOrEqual(20);
    expect(c.bedroom).toBeGreaterThanOrEqual(20);
    expect(c.office).toBeGreaterThanOrEqual(15);
    expect(c.storage).toBeGreaterThanOrEqual(25);
    expect(c.kitchen + c.bathroom).toBeGreaterThanOrEqual(25);
    expect(c.decor + c.plants + c.textiles).toBeGreaterThanOrEqual(50);
    expect(c.plants).toBeGreaterThanOrEqual(10);
    expect(c.lighting).toBeGreaterThanOrEqual(20);
    expect(c.life).toBeGreaterThanOrEqual(8);
    expect(ENTRIES.length).toBeGreaterThan(200);
  });

  it("has at least 6 chair styles and beds from 80 to 200", () => {
    expect(ENTRIES.filter((e) => e.id.startsWith("chair-")).length).toBeGreaterThanOrEqual(6);
    const widths = ENTRIES.filter((e) => /^bed-\d+$/.test(e.id)).map((e) => e.size.w);
    expect(Math.min(...widths)).toBe(80);
    expect(Math.max(...widths)).toBe(200);
  });

  it("builds every entry at its min and max size too", () => {
    for (const e of ENTRIES) {
      for (const dims of [e.min, e.max]) {
        const parts = e.build(dims, e.params ?? {});
        expect(parts.length, e.id).toBeGreaterThan(0);
        expect(
          parts.every((p) => [p.x, p.y, p.z, p.w, p.d, p.h].every(Number.isFinite)),
          e.id,
        ).toBe(true);
      }
    }
  });

  it("only lamps give light, and they are on the lighting layer", () => {
    for (const e of ENTRIES.filter((x) => x.light)) expect(e.layer).toBe("lighting");
  });
});

describe("search", () => {
  it("finds by Dutch and English name", () => {
    expect(searchCatalog("bank").some((e) => e.id === "sofa-3")).toBe(true);
    expect(searchCatalog("sofa 3").map((e) => e.id)).toContain("sofa-3");
    expect(searchCatalog("fauteuil").length).toBeGreaterThan(0);
  });

  it("ignores accents and case", () => {
    expect(searchCatalog("INDUSTRIELE").map((e) => e.id)).toContain("chair-industrial");
  });

  it("filters by category and tag", () => {
    expect(
      searchCatalog("", { category: "lighting" }).every((e) => e.category === "lighting"),
    ).toBe(true);
    expect(searchCatalog("lamp").length).toBeGreaterThanOrEqual(20);
    expect(
      searchCatalog("aansluiting")
        .map((e) => e.id)
        .sort(),
    ).toEqual(["marker-drain", "marker-water"]);
  });

  it("matches sizes", () => {
    expect(searchCatalog("bed 160x200").map((e) => e.id)).toContain("bed-160");
    expect(searchCatalog("bed 160x200").map((e) => e.id)).not.toContain("bed-90");
    expect(searchCatalog("bureau 240").map((e) => e.id)).toContain("desk-240");
  });
});

describe("items", () => {
  const sofa = getEntry("sofa-3")!;

  it("creates items at standard size", () => {
    const item = createItem(sofa, { at: { x: 10, y: 20 }, rotation: 90, locale: "en" });
    expect(item).toMatchObject({
      catalogId: "sofa-3",
      name: "Sofa 3-seater",
      x: 10,
      y: 20,
      w: 220,
      d: 95,
      rotation: 90,
      mount: "floor",
    });
    const lamp = createItem(getEntry("lamp-floor")!, { at: { x: 0, y: 0 } });
    expect(lamp.light).toEqual({ on: true, color: "#FFE2B8", intensity: 0.7 });
    expect(createItem(sofa, { at: { x: 0, y: 0 }, params: { seats: 2 } }).params).toEqual({
      seats: 2,
    });
  });

  it("builds parts that follow the item size and params", () => {
    const item = createItem(sofa, { at: { x: 0, y: 0 } });
    const wide = itemParts({ ...item, w: 300 });
    expect(Math.max(...wide.map((p) => p.x + p.w / 2))).toBeCloseTo(150);
    const two = itemParts({ ...item, params: { seats: 2 } }).filter((p) => p.material === "second");
    expect(two.length).toBe(2);
    expect(itemParts({ ...item, catalogId: "missing" })).toHaveLength(1);
  });

  it("resolves colours", () => {
    const item = createItem(sofa, { at: { x: 0, y: 0 } });
    expect(
      partColor({ shape: "box", x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, material: "main" }, item, sofa),
    ).toBe(sofa.colors.main);
    expect(
      partColor(
        { shape: "box", x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, material: "second" },
        { color2: "#123456" },
        sofa,
      ),
    ).toBe("#123456");
    expect(
      partColor({ shape: "box", x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, material: "leaf" }, item, sofa),
    ).toBe("#5E7D4F");
    expect(
      partColor(
        { shape: "box", x: 0, y: 0, z: 0, w: 1, d: 1, h: 1, material: "metal", color: "#000000" },
        item,
      ),
    ).toBe("#000000");
  });

  it("clamps sizes", () => {
    expect(clampSize(sofa, { w: 10, d: 95, h: 1000 })).toEqual({
      w: sofa.min.w,
      d: 95,
      h: sofa.max.h,
    });
  });

  it("supports custom items", () => {
    const def = {
      id: "custom_1",
      name: "Mijn kast",
      w: 100,
      d: 40,
      h: 100,
      layer: "furniture" as const,
      mount: "floor" as const,
      parts: [
        {
          shape: "box" as const,
          x: 0,
          y: 0,
          z: 0,
          w: 100,
          d: 40,
          h: 100,
          material: "main" as const,
        },
      ],
    };
    const e = customEntry(def);
    expect(e.build({ w: 200, d: 40, h: 50 }, {})[0]).toMatchObject({ w: 200, h: 50 });
    expect(resolveEntry({ catalogId: "custom_1" }, [def])?.name.nl).toBe("Mijn kast");
    expect(
      scaleParts(def.parts, { w: 100, d: 40, h: 100 }, { w: 50, d: 20, h: 100 })[0],
    ).toMatchObject({ w: 50, d: 20 });
  });
});
