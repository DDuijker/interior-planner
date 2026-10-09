import { describe, expect, it } from "vitest";
import { getActiveVersion } from "@/core/model/actions";
import { createProject } from "@/core/model/defaults";
import type { Project, Room } from "@/core/model/types";
import { generateWalls } from "@/core/walls/generate";
import {
  applyInteriorProposal,
  fixtureAgainst,
  INTERIOR_SYSTEM,
  interiorProposalSchema,
  interiorUserText,
  openingOn,
  proposalKeys,
} from "./interior";
import { parseAiJson, repairJsonText } from "./json";
import {
  applyMoodboardProposal,
  moodboardProposalSchema,
  moodboardSystem,
  moodboardUserText,
} from "./moodboard";

const ROOM: Room = {
  id: "r1",
  name: "Woonkamer",
  type: "living",
  shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 500, d: 400 }] },
};

function withRoom(): Project {
  const p = createProject();
  p.floors[0]!.current.rooms.push(ROOM);
  return p;
}

describe("parseAiJson", () => {
  it("validates and reports paths", () => {
    const bad = parseAiJson('{"ceiling": "white", "walls": []}', interiorProposalSchema);
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.path).toBe("ceiling");
    expect(parseAiJson("nope", interiorProposalSchema).ok).toBe(false);
    expect(repairJsonText([{ path: "", message: "x" }])).toContain("(root): x");
  });
});

describe("interior analysis", () => {
  const answer = {
    wall: { kind: "paint", color: "#E8E2D6" },
    floor: { kind: "planks", color: "#A0784F", plankWidth: 18 },
    ceiling: "#FFFFFF",
    ceilingHeight: 263,
    walls: [{ side: "N", finish: { kind: "brick", color: "#9A4E3A" } }],
    elements: [
      { type: "window", side: "S", position: 0.5, width: 150 },
      { type: "radiator", side: "S", position: 0.5 },
      { type: "kitchen", side: "E", position: 0.5, width: 240 },
    ],
    notes: ["Vloer lijkt eiken"],
  };

  it("parses a proposal and lists tickable keys (no radiators)", () => {
    const r = parseAiJson(JSON.stringify(answer), interiorProposalSchema);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(proposalKeys(r.value)).toEqual([
      "wall",
      "floor",
      "ceiling",
      "height",
      "side:N",
      "el:0",
      "el:2",
    ]);
  });

  it("puts the facts in the prompt", () => {
    expect(INTERIOR_SYSTEM).toContain("radiator");
    const text = interiorUserText(
      { name: "Woonkamer", w: 500, d: 400, floorHeight: 260, sides: { N: 500 } },
      [{ facing: "N" }, {}],
      "nl",
    );
    expect(text).toContain("500 x 400");
    expect(text).toContain("faces the N wall");
    expect(text).toContain("direction unknown");
    expect(text).toContain("Dutch");
  });

  it("applies only what was ticked", () => {
    const p = withRoom();
    const walls = generateWalls([ROOM]);
    const proposal = interiorProposalSchema.parse(answer);
    const next = applyInteriorProposal(
      p,
      "r1",
      walls,
      proposal,
      new Set(["floor", "side:N", "el:0", "el:2", "height"]),
    );
    const v = getActiveVersion(next);
    const room = v.rooms[0]!;
    expect(room.style?.floor?.kind).toBe("planks");
    expect(room.style?.wall).toBeUndefined();
    expect(
      Object.values(v.wallOverrides).some((o) => o.b?.kind === "brick" || o.a?.kind === "brick"),
    ).toBe(true);
    expect(v.openings).toHaveLength(1);
    expect(v.openings[0]).toMatchObject({ kind: "window", w: 150, dir: "h" });
    expect(v.fixtures).toHaveLength(1);
    expect(v.fixtures[0]).toMatchObject({ type: "kitchen", rotation: 90, w: 240 });
    expect(next.floors[0]!.height).toBe(265);
    // The original is untouched.
    expect(getActiveVersion(p).fixtures).toHaveLength(0);
  });

  it("places fixtures with their back to the wall, inside the room", () => {
    const wall = { x: 0, y: -15, w: 500, d: 15 };
    const f = fixtureAgainst("sink", "N", wall, 0.5);
    expect(f).toMatchObject({ rotation: 0, x: 220, y: 0 });
    const e = fixtureAgainst("fridge", "E", { x: 500, y: 0, w: 15, d: 400 }, 0);
    expect(e.rotation).toBe(90);
    // Centre sits d/2 left of the wall face.
    expect(Math.abs(e.x + e.w / 2 - (500 - 65 / 2))).toBeLessThanOrEqual(1);
  });

  it("keeps openings on the wall", () => {
    const o = openingOn("door", { x: 0, y: 400, w: 500, d: 10 }, "S", 1, 90);
    expect(o).toMatchObject({ kind: "door", x: 410, y: 405, dir: "h", w: 90 });
  });
});

describe("moodboard style", () => {
  const answer = {
    name: "Warm minimalisme",
    presetId: "french-country",
    palette: ["#EFE8DA", "#C9B8A0", "#87A08C"],
    wall: { kind: "limewash", color: "#E9E1D2" },
    floor: { kind: "herringbone", color: "#B8916A" },
    ceiling: "#F7F3EA",
    accent: "#87A08C",
    furniture: [{ id: "sofa-3", why: "rustig" }],
    summary: "Zacht en warm.",
  };

  it("lists presets and catalogue ids in the prompt", () => {
    const s = moodboardSystem();
    expect(s).toContain("french-country");
    expect(s).toContain("sofa-3");
    expect(moodboardUserText(["linnen"], "Woonkamer", "en")).toContain("Note on photo 1: linnen");
  });

  it("rejects unknown ids", () => {
    const r = parseAiJson(
      JSON.stringify({ ...answer, presetId: "ikea-billy" }),
      moodboardProposalSchema,
    );
    expect(r.ok).toBe(false);
    const f = parseAiJson(
      JSON.stringify({ ...answer, furniture: [{ id: "brand-x" }] }),
      moodboardProposalSchema,
    );
    expect(f.ok).toBe(false);
  });

  it("applies to a new design and leaves the current situation alone", () => {
    const p = withRoom();
    p.floors[0]!.current.rooms[0]!.style = { ceiling: "#000000" };
    const proposal = moodboardProposalSchema.parse(answer);
    const { project, designId } = applyMoodboardProposal(p, p.floors[0]!.id, proposal, "Moodboard");
    const floor = project.floors[0]!;
    expect(floor.activeVersionId).toBe(designId);
    const design = floor.designs.find((d) => d.id === designId)!;
    expect(design.style).toMatchObject({
      name: "Warm minimalisme",
      presetId: "french-country",
      wall: { kind: "limewash" },
    });
    expect(design.rooms[0]!.style).toBeUndefined();
    expect(floor.current.rooms[0]!.style).toEqual({ ceiling: "#000000" });
    expect(floor.current.style).toEqual(p.floors[0]!.current.style);
  });
});
