import { z } from "zod";
import { FIXTURE_SPECS } from "@/core/fixtures/fixtures";
import { newId } from "@/core/model/ids";
import { colorSchema, floorFinishSchema, wallFinishSchema } from "@/core/model/schema";
import {
  CARDINALS,
  FIXTURE_TYPES,
  FLOOR_FINISH_KINDS,
  PANEL_STYLES,
  WALL_FINISH_KINDS,
  WALLPAPER_PATTERNS,
  type Cardinal,
  type Fixture,
  type FixtureType,
  type Id,
  type Opening,
  type Project,
  type Rect,
  type Wall,
} from "@/core/model/types";
import { updateActiveVersion } from "@/core/model/actions";
import { roomWalls } from "@/core/photos/photos";

/**
 * AI photo analysis of the current interior (E13-75), pure part. Claude
 * looks at photos of one room and proposes finishes and elements. Sizes
 * come from the floor plan: the photo only fills in finish and placement.
 * Nothing is applied without the user ticking it in the review step.
 */

export const ELEMENT_TYPES = ["window", "door", "radiator", ...FIXTURE_TYPES] as const;
export type ElementType = (typeof ELEMENT_TYPES)[number];

export const interiorProposalSchema = z.object({
  wall: wallFinishSchema.optional(),
  floor: floorFinishSchema.optional(),
  ceiling: colorSchema.optional(),
  /** Estimated floor-to-ceiling height in cm. */
  ceilingHeight: z.number().min(180).max(600).optional(),
  /** Walls that differ from the rest of the room. */
  walls: z
    .array(z.object({ side: z.enum(CARDINALS), finish: wallFinishSchema }))
    .max(8)
    .default([]),
  elements: z
    .array(
      z.object({
        type: z.enum(ELEMENT_TYPES),
        side: z.enum(CARDINALS),
        /** 0 = west/north end of that side, 1 = east/south end. */
        position: z.number().min(0).max(1),
        width: z.number().min(10).max(800).optional(),
        note: z.string().max(200).optional(),
      }),
    )
    .max(30)
    .default([]),
  notes: z.array(z.string().max(300)).max(10).default([]),
});
export type InteriorProposal = z.infer<typeof interiorProposalSchema>;

export const INTERIOR_SYSTEM = `You look at photos of one room of a home and describe its current finishes and fixed elements for an interior planner.

You get the room's floor plan facts (size and which compass side each wall is on, with north up) and one or more photos. For each photo you may get the wall it faces. Work out which wall in each photo is which.

Answer with one JSON object and nothing else:
{
  "wall": { "kind": one of ${JSON.stringify(WALL_FINISH_KINDS)}, "color": "#RRGGBB", "color2"?: "#RRGGBB", "height"?: cm, "pattern"?: one of ${JSON.stringify(WALLPAPER_PATTERNS)}, "panel"?: one of ${JSON.stringify(PANEL_STYLES)} },
  "floor": { "kind": one of ${JSON.stringify(FLOOR_FINISH_KINDS)}, "color": "#RRGGBB", "color2"?: "#RRGGBB", "plankWidth"?: cm, "tileSize"?: cm },
  "ceiling": "#RRGGBB",
  "ceilingHeight"?: estimated floor-to-ceiling height in cm,
  "walls": [ { "side": "N"|"E"|"S"|"W", "finish": <wall finish> } ]  (only walls that differ from "wall"),
  "elements": [ { "type": one of ${JSON.stringify(ELEMENT_TYPES)}, "side": "N"|"E"|"S"|"W", "position": 0..1 (where along that wall the centre is: 0 = west or north end, 1 = east or south end), "width"?: cm, "note"?: short text } ],
  "notes": [ "short remark for the user, in the user's language" ]
}

Rules:
- Colours are the real colour of the material under neutral light, not the shadowed colour in the photo.
- "current" means you cannot tell; prefer a concrete kind. "panel" with "height" is wainscoting below a painted wall (then "color2" is the panel colour).
- Only list elements you can actually see. "kitchen" is a run of base cabinets, "tall" a tall cupboard, "radiator" a heating radiator.
- Leave out anything you are unsure of rather than guessing; say so in "notes".`;

export interface RoomFacts {
  name: string;
  /** Width (x) and depth (y) of the room in cm. */
  w: number;
  d: number;
  floorHeight: number;
  /** Lengths of the walls on each side, cm. */
  sides: Partial<Record<Cardinal, number>>;
}

export function interiorUserText(
  facts: RoomFacts,
  photos: readonly { facing?: Cardinal; note?: string }[],
  locale: "nl" | "en",
): string {
  const sides = (Object.keys(facts.sides) as Cardinal[])
    .map((c) => `${c} wall ${Math.round(facts.sides[c]!)} cm`)
    .join(", ");
  const lines = [
    `Room: ${facts.name}, ${Math.round(facts.w)} x ${Math.round(facts.d)} cm (width west-east x depth north-south), ceiling height on the plan ${facts.floorHeight} cm.`,
    sides ? `Walls: ${sides}.` : "",
    ...photos.map(
      (p, i) =>
        `Photo ${i + 1}: ${p.facing ? `faces the ${p.facing} wall` : "direction unknown"}${p.note ? ` (${p.note})` : ""}.`,
    ),
    `Write the notes in ${locale === "nl" ? "Dutch" : "English"}.`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ------------------------------------------------------------- applying

/** Keys of the parts of a proposal the user can tick. */
export function proposalKeys(p: InteriorProposal): string[] {
  const keys: string[] = [];
  if (p.wall) keys.push("wall");
  if (p.floor) keys.push("floor");
  if (p.ceiling) keys.push("ceiling");
  if (p.ceilingHeight) keys.push("height");
  p.walls.forEach((w) => keys.push(`side:${w.side}`));
  p.elements.forEach((e, i) => {
    if (e.type !== "radiator") keys.push(`el:${i}`);
  });
  return keys;
}

function sideExtent(parts: { wall: Wall }[], side: Cardinal): Rect | undefined {
  if (!parts.length) return undefined;
  const xs = parts.flatMap(({ wall: { rect } }) => [rect.x, rect.x + rect.w]);
  const ys = parts.flatMap(({ wall: { rect } }) => [rect.y, rect.y + rect.d]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  const r = { x, y, w: Math.max(...xs) - x, d: Math.max(...ys) - y };
  // Sanity: N/S sides are horizontal, E/W vertical.
  return (side === "N" || side === "S") === r.w >= r.d ? r : undefined;
}

const ROTATION: Record<Cardinal, number> = { N: 0, E: 90, S: 180, W: 270 };

/** A fixture with its back against the given side, centred at `t` along it. */
export function fixtureAgainst(
  type: FixtureType,
  side: Cardinal,
  wall: Rect,
  t: number,
  width?: number,
): Fixture {
  const spec = FIXTURE_SPECS[type];
  const w = Math.max(spec.min.w, Math.min(spec.max.w, width ?? spec.w));
  const d = spec.d;
  const horizontal = side === "N" || side === "S";
  const along = horizontal ? wall.x + wall.w * t : wall.y + wall.d * t;
  // Centre of the fixture, d/2 into the room from the wall's room face.
  const c = horizontal
    ? { x: along, y: side === "N" ? wall.y + wall.d + d / 2 : wall.y - d / 2 }
    : { x: side === "W" ? wall.x + wall.w + d / 2 : wall.x - d / 2, y: along };
  return {
    id: newId("fix"),
    type,
    x: Math.round(c.x - w / 2),
    y: Math.round(c.y - d / 2),
    w,
    d,
    rotation: ROTATION[side],
    locked: true,
  };
}

/** A door or window on the centre line of the given side. */
export function openingOn(
  kind: "door" | "window",
  wall: Rect,
  side: Cardinal,
  t: number,
  width?: number,
  wallId?: Id,
): Opening {
  const horizontal = side === "N" || side === "S";
  const length = horizontal ? wall.w : wall.d;
  const w = Math.max(40, Math.min(length - 10, width ?? (kind === "door" ? 83 : 120)));
  const start = Math.max(0, Math.min(length - w, length * t - w / 2));
  const base = horizontal
    ? { x: Math.round(wall.x + start), y: wall.y + wall.d / 2, dir: "h" as const }
    : { x: wall.x + wall.w / 2, y: Math.round(wall.y + start), dir: "v" as const };
  const id = newId(kind);
  return kind === "door"
    ? {
        ...base,
        id,
        kind,
        w,
        height: 211,
        hinge: "start",
        swing: side === "N" || side === "W" ? "b" : "a",
        wallId,
      }
    : { ...base, id, kind, w, sill: 90, lintel: 210, glass: false, wallId };
}

/**
 * Apply the ticked parts of a proposal to one room of the active version.
 * `walls` are the generated walls of that version.
 */
export function applyInteriorProposal(
  project: Project,
  roomId: Id,
  walls: readonly Wall[],
  proposal: InteriorProposal,
  accepted: ReadonlySet<string>,
): Project {
  const sides = roomWalls(walls, roomId);
  let next = updateActiveVersion(project, (v) => {
    const room = v.rooms.find((r) => r.id === roomId);
    if (!room) return;
    const style = { ...room.style };
    if (accepted.has("wall") && proposal.wall) style.wall = proposal.wall;
    if (accepted.has("floor") && proposal.floor) style.floor = proposal.floor;
    if (accepted.has("ceiling") && proposal.ceiling) style.ceiling = proposal.ceiling;
    room.style = style;
    for (const w of proposal.walls) {
      if (!accepted.has(`side:${w.side}`)) continue;
      for (const { wall, side } of sides[w.side]) {
        v.wallOverrides[wall.id] = { ...v.wallOverrides[wall.id], [side]: w.finish };
      }
    }
    proposal.elements.forEach((el, i) => {
      if (!accepted.has(`el:${i}`) || el.type === "radiator") return;
      const extent = sideExtent(sides[el.side], el.side);
      if (!extent) return;
      if (el.type === "window" || el.type === "door") {
        const t = el.position;
        const part = sides[el.side].find(({ wall: { rect } }) => {
          const along =
            el.side === "N" || el.side === "S" ? extent.x + extent.w * t : extent.y + extent.d * t;
          return el.side === "N" || el.side === "S"
            ? along >= rect.x && along <= rect.x + rect.w
            : along >= rect.y && along <= rect.y + rect.d;
        });
        v.openings.push(openingOn(el.type, extent, el.side, t, el.width, part?.wall.id));
      } else {
        v.fixtures.push(fixtureAgainst(el.type, el.side, extent, el.position, el.width));
      }
    });
  });
  if (accepted.has("height") && proposal.ceilingHeight) {
    const h = Math.round(proposal.ceilingHeight / 5) * 5;
    next = {
      ...next,
      floors: next.floors.map((f) => (f.id === next.activeFloorId ? { ...f, height: h } : f)),
    };
  }
  return next;
}
