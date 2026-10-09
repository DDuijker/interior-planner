import { describe, expect, it } from "vitest";
import { getActiveVersion } from "../model/actions";
import { sampleApartment } from "../samples/apartment";
import { parseWithPositions, positionOf } from "./jsonpos";
import {
  findEntry,
  floorsToPlanCode,
  formatPlanCode,
  parsePlanCode,
  planToFloor,
  versionToPlan,
  type PlanCode,
} from "./plancode";

const simple = `{
  "name": "Huis begane grond",
  "height": 273,
  "rooms": [
    {"name": "Woonkamer", "type": "living", "rects": [[0, 0, 500, 400]]},
    {"name": "Keuken", "type": "kitchen", "rects": [[500, 0, 300, 400]]}
  ],
  "doors": [{"x": 500, "y": 150, "w": 90, "dir": "v"}],
  "windows": [{"x": 100, "y": -15, "w": 200, "dir": "h", "glass": true}],
  "fixtures": [{"type": "kitchen", "x": 510, "y": 0, "w": 240, "h": 60}],
  "items": [{"name": "Bank 3-zits", "x": 250, "y": 300, "back": "S"}, {"id": "lamp-floor", "x": 40, "y": 40}]
}`;

describe("jsonpos", () => {
  it("records positions per path", () => {
    const { value, positions } = parseWithPositions('{"a": [1, {"b": true}]}');
    expect(value).toEqual({ a: [1, { b: true }] });
    expect(positions.get("a.1.b")).toEqual({ line: 1, col: 17 });
    expect(positionOf(positions, ["a", 1, "missing"])).toEqual({ line: 1, col: 11 });
  });

  it("handles escapes, numbers and literals", () => {
    expect(parseWithPositions('["a\\"b\\u0041", -1.5e2, null, false]').value).toEqual([
      'a"bA',
      -150,
      null,
      false,
    ]);
  });

  it("reports syntax errors with line and column", () => {
    for (const [text, line] of [
      ['{\n  "a": 1,\n}', 3],
      ["[1 2]", 1],
      ['{"a": "x\ny"}', 1],
      ["", 1],
      ["{} x", 1],
      ['"\\q"', 1],
      ["tru", 1],
    ] as const) {
      const r = parsePlanCode(text);
      expect(r.ok, text).toBe(false);
      if (!r.ok) expect(r.errors[0]!.line, text).toBe(line);
    }
  });
});

describe("parsePlanCode", () => {
  it("accepts one plan or a list", () => {
    const one = parsePlanCode(simple);
    expect(one.ok && one.plans.length).toBe(1);
    const two = parsePlanCode(
      `[${simple}, ${simple.replace("begane grond", "eerste verdieping")}]`,
    );
    expect(two.ok && two.plans.map((p) => p.name)).toEqual([
      "Huis begane grond",
      "Huis eerste verdieping",
    ]);
  });

  it("points to the line and field of a bad value", () => {
    const bad = simple.replace('"type": "kitchen", "rects"', '"type": "garage", "rects"');
    const r = parsePlanCode(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]).toMatchObject({ line: 6, path: "rooms.1.type" });
  });

  it("reports errors inside a list of plans", () => {
    const r = parsePlanCode(
      `[${simple}, {"name": "Leeg", "rooms": [{"name": "X", "type": "bed"}]}]`,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.path).toBe("1.rooms.0");
  });

  it("rejects unknown fields and missing room geometry", () => {
    const r = parsePlanCode('{"name": "x", "rooms": [], "colour": "red"}');
    expect(r.ok).toBe(false);
    const both = parsePlanCode(
      '{"name": "x", "rooms": [{"name": "a", "type": "bed", "rects": [[0,0,1,1]], "points": [[0,0],[1,0],[0,1]]}]}',
    );
    expect(both.ok).toBe(false);
  });

  it("warns about unknown items but still imports", () => {
    const r = parsePlanCode(
      '{"name": "x", "rooms": [], "items": [{"name": "Ruimteschip", "x": 0, "y": 0}]}',
    );
    expect(r.ok).toBe(true);
    if (r.ok)
      expect(r.warnings).toEqual([
        { path: "items.0", message: 'Unknown item "Ruimteschip", placed as a plain box' },
      ]);
  });

  it("rejects items without id or name", () => {
    expect(parsePlanCode('{"name": "x", "rooms": [], "items": [{"x": 0, "y": 0}]}').ok).toBe(false);
  });
});

describe("planToFloor", () => {
  const r = parsePlanCode(simple);
  if (!r.ok) throw new Error("fixture");
  const floor = planToFloor(r.plans[0]!);
  const v = floor.current;

  it("builds rooms, openings, fixtures and items", () => {
    expect(floor).toMatchObject({ name: "Huis begane grond", height: 273, level: 0 });
    expect(v.rooms.map((x) => x.type)).toEqual(["living", "kitchen"]);
    expect(v.openings.map((o) => o.kind)).toEqual(["door", "window"]);
    expect(v.openings[0]!.wallId).toBeDefined();
    expect(v.fixtures[0]).toMatchObject({ type: "kitchen", w: 240, d: 60, locked: true });
    expect(v.items[0]).toMatchObject({ catalogId: "sofa-3", rotation: 180, x: 250 });
    expect(v.items[1]).toMatchObject({ catalogId: "lamp-floor", layer: "lighting" });
  });

  it("makes glass windows floor to ceiling", () => {
    const glass = v.openings[1]!;
    expect(glass.kind === "window" && [glass.sill, glass.lintel]).toEqual([0, 273]);
  });

  it("finds catalog entries by id or by name in either language", () => {
    expect(findEntry({ name: "sofa 3-seater" })?.id).toBe("sofa-3");
    expect(findEntry({ id: "nope", name: "Fauteuil" })?.id).toBe("armchair");
    expect(findEntry({ name: "?" })).toBeUndefined();
  });

  it("supports polygons, extra walls, passages and stairs", () => {
    const p: PlanCode = {
      name: "x",
      rooms: [
        {
          name: "Driehoek",
          type: "hal",
          points: [
            [0, 0],
            [300, 0],
            [0, 300],
          ],
        },
      ],
      walls: [[100, 0, 10, 100]],
      passages: [{ x: 0, y: 0, w: 80, dir: "h" }],
      fixtures: [{ type: "stairs", x: 10, y: 10, w: 90, h: 280, shape: "l", up: "E" }],
      items: [{ name: "Onbekend ding", x: 5, y: 5, w: 20, d: 30, h: 40, rotation: 45 }],
    };
    const f = planToFloor(p, 2);
    expect(f.level).toBe(2);
    expect(f.current.rooms[0]!.shape.kind).toBe("polygon");
    expect(f.current.extraWalls).toHaveLength(1);
    expect(f.current.openings[0]!.kind).toBe("passage");
    expect(f.current.fixtures[0]!.stair).toEqual({ shape: "l", up: "E" });
    expect(f.current.items[0]).toMatchObject({ catalogId: "unknown", w: 20, rotation: 45 });
  });
});

describe("roundtrip", () => {
  it("export then import gives an identical plan", () => {
    const project = sampleApartment();
    const floor = project.floors[0]!;
    const text = floorsToPlanCode(project.floors);
    const r = parsePlanCode(text);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const again = planToFloor(r.plans[0]!);
    expect(formatPlanCode(versionToPlan(again, again.current))).toBe(text);
    expect(again.current.items.map((i) => [i.catalogId, i.x, i.y, i.rotation])).toEqual(
      getActiveVersion(project).items.map((i) => [i.catalogId, i.x, i.y, i.rotation]),
    );
    expect(again.current.openings.length).toBe(floor.current.openings.length);
  });

  it("formats number arrays on one line", () => {
    expect(
      formatPlanCode({ name: "x", rooms: [{ name: "a", type: "bed", rects: [[0, 0, 10, 20]] }] }),
    ).toContain("[0, 0, 10, 20]");
  });

  it("exports several floors as a list", () => {
    const p = sampleApartment();
    const text = floorsToPlanCode([p.floors[0]!, { ...p.floors[0]!, name: "Boven", level: 1 }]);
    const r = parsePlanCode(text);
    expect(r.ok && r.plans.map((x) => x.level)).toEqual([0, 1]);
  });
});
