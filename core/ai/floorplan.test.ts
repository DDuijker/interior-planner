import { describe, expect, it } from "vitest";
import {
  estimateCost,
  extractJson,
  fitImage,
  floorplanUserText,
  FLOORPLAN_SYSTEM,
  imageTokens,
  parseFloorplanAnswer,
  repairText,
  roomSize,
  scaleFactor,
  scalePlan,
  typicalFloorplanCost,
} from "./floorplan";

const PLAN = {
  name: "Begane grond",
  rooms: [
    { name: "Woonkamer", type: "living", rects: [[0, 0, 500, 400]] },
    { name: "Keuken", type: "kitchen", rects: [[500, 0, 300, 400]] },
  ],
  doors: [{ x: 500, y: 150, w: 90, dir: "v" }],
};

describe("prompt", () => {
  it("lists every room and fixture type", () => {
    expect(FLOORPLAN_SYSTEM).toContain("loggia");
    expect(FLOORPLAN_SYSTEM).toContain("chimney");
  });

  it("adds floors, hint and language", () => {
    const text = floorplanUserText({ floors: 2, hint: " living 5.40 m ", locale: "nl" });
    expect(text).toContain("2 floors");
    expect(text).toContain("living 5.40 m");
    expect(text).toContain("Dutch");
    expect(floorplanUserText({ floors: "auto", locale: "en" })).not.toContain("floors;");
  });

  it("lists errors for a repair turn", () => {
    const text = repairText([{ line: 3, col: 1, path: "rooms.0.type", message: "Invalid option" }]);
    expect(text).toContain("rooms.0.type: Invalid option");
  });
});

describe("extractJson", () => {
  it("prefers a fenced block", () => {
    expect(extractJson('Here:\n```json\n{"a": 1}\n```\nDone')).toBe('{"a": 1}');
  });

  it("finds the outermost object, ignoring braces in strings", () => {
    expect(extractJson('ok {"a": "}", "b": {"c": [1]}} trailing')).toBe(
      '{"a": "}", "b": {"c": [1]}}',
    );
  });

  it("returns undefined without JSON", () => {
    expect(extractJson("sorry, no plan here")).toBeUndefined();
    expect(extractJson('{"open": ')).toBeUndefined();
  });
});

describe("parseFloorplanAnswer", () => {
  it("reads the wrapper with image placement and notes", () => {
    const answer = JSON.stringify({
      plans: [PLAN],
      image: { cmPerPx: 1.5, originX: 40, originY: 60 },
      notes: ["Keuken geschat"],
    });
    const r = parseFloorplanAnswer(answer);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plans).toHaveLength(1);
    expect(r.image).toEqual({ cmPerPx: 1.5, originX: 40, originY: 60 });
    expect(r.notes).toEqual(["Keuken geschat"]);
  });

  it("accepts bare plan-code", () => {
    const r = parseFloorplanAnswer(JSON.stringify(PLAN));
    expect(r.ok && r.plans[0]?.name).toBe("Begane grond");
  });

  it("drops a nonsense image placement", () => {
    const r = parseFloorplanAnswer(JSON.stringify({ plans: [PLAN], image: { cmPerPx: -2 } }));
    expect(r.ok && r.image).toBeUndefined();
  });

  it("reports schema errors with a path", () => {
    const bad = {
      plans: [{ ...PLAN, rooms: [{ name: "X", type: "garage", rects: [[0, 0, 1, 1]] }] }],
    };
    const r = parseFloorplanAnswer(JSON.stringify(bad));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors[0]?.path).toBe("0.rooms.0.type");
  });

  it("reports a missing answer", () => {
    const r = parseFloorplanAnswer("I cannot read this image.");
    expect(r.ok).toBe(false);
  });
});

describe("image and cost", () => {
  it("fits large images and keeps small ones", () => {
    expect(fitImage(3136, 2000)).toEqual({ w: 1568, h: 1000 });
    expect(fitImage(800, 600)).toEqual({ w: 800, h: 600 });
  });

  it("estimates tokens and cost", () => {
    expect(imageTokens(750, 100)).toBe(100);
    expect(estimateCost("claude-opus-5-5", 1e6, 1e6)).toBe(24);
    expect(estimateCost("unknown", 1, 1)).toBeUndefined();
    const typical = typicalFloorplanCost("claude-opus-5-5")!;
    expect(typical).toBeGreaterThan(0.1);
    expect(typical).toBeLessThan(0.5);
  });
});

describe("review step", () => {
  it("scales a plan", () => {
    const r = parseFloorplanAnswer(JSON.stringify(PLAN));
    if (!r.ok) throw new Error("bad fixture");
    const scaled = scalePlan(r.plans[0]!, 1.1);
    expect(scaled.rooms[0]?.rects?.[0]).toEqual([0, 0, 550, 440]);
    expect(scaled.doors?.[0]).toMatchObject({ x: 550, y: 165, w: 99, dir: "v" });
  });

  it("measures a room", () => {
    expect(
      roomSize({
        name: "L",
        type: "living",
        rects: [
          [0, 0, 300, 200],
          [0, 200, 100, 150],
        ],
      }),
    ).toEqual({
      w: 300,
      d: 350,
    });
    expect(
      roomSize({
        name: "P",
        type: "hal",
        points: [
          [10, 10],
          [110, 10],
          [60, 90],
        ],
      }),
    ).toEqual({ w: 100, d: 80 });
  });

  it("computes a sane scale factor", () => {
    expect(scaleFactor(500, 540)).toBeCloseTo(1.08);
    expect(scaleFactor(0, 540)).toBeUndefined();
    expect(scaleFactor(500, 50000)).toBeUndefined();
  });
});
