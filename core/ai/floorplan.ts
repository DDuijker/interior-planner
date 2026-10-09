import { FIXTURE_TYPES, ROOM_TYPES } from "@/core/model/types";
import {
  parsePlanCode,
  type PlanCode,
  type PlanCodeError,
  type PlanCodeWarning,
} from "@/core/plancode/plancode";

/**
 * The AI floor plan reader (E07-32), pure part: the prompt, reading Claude's
 * answer back into plan-code, and the maths for the review step (E07-33).
 * The network call itself lives in ui/ai, this file never talks to anything.
 */

export const FLOORPLAN_SYSTEM = `You read floor plans (photos, scans, drawings, real-estate brochures) and turn them into plan-code: a small JSON format for an interior planner.

Plan-code rules:
- All sizes are centimetres. x grows to the right, y grows down. Put the top-left of the building near (0, 0).
- One plan per floor: {"name", "level", "height", "rooms", "doors", "windows", "passages", "fixtures"}.
- rooms: {"name", "type", "rects": [[x, y, w, d], ...]} or {"name", "type", "points": [[x, y], ...]} for a room that is not made of rectangles. Give either rects or points, never both. Room types: ${ROOM_TYPES.join(", ")}. Use "hal" for halls and landings, "loggia" for balconies and loggias, "storage" for closets and technical rooms.
- Rooms are the clear inside of each space. Rooms that share a wall touch exactly (no gap): walls are generated from the shared edges, so never add walls between rooms. Only use "walls" ([[x, y, w, d]]) for a free-standing wall that does not separate two rooms.
- doors: {"x", "y", "w", "dir"} where (x, y) is the start of the door on the wall centre line, w the width (usually 73 to 93), dir "h" for a door in a horizontal wall (along x) and "v" for a vertical wall (along y). Optional "hinge" ("start"/"end") and "swing" ("a" = north/west side, "b" = south/east side) if the swing arc is visible.
- windows: like doors. Add "glass": true for floor-to-ceiling glass and sliding doors to a balcony.
- passages: openings without a door, like doors.
- fixtures: fixed elements only, {"type", "x", "y", "w", "h"} with top-left x, y, width w and depth h (h is the depth in plan). Types: ${FIXTURE_TYPES.join(", ")}. "kitchen" is a run of base cabinets, "tall" is a tall cabinet. Stairs take "shape" ("straight", "l", "spiral") and "up" ("N", "E", "S", "W": the direction you walk up).
- Do not add furniture. The plan should show the empty current situation.

How to work:
- Use dimensions printed on the plan when there are any. Otherwise use the scale bar, or a door (about 83 cm wide) or the total area if it is given. Round to 5 cm.
- Make the outline consistent: rooms in a row line up, the total width matches. Check that each room area roughly matches any area printed on the plan.
- If the image holds several floors, return one plan per floor, in the same coordinate system so the stairs line up.
- If something is unreadable, make your best guess and say so in "notes".

Answer with one JSON object and nothing else:
{
  "plans": [ <plan-code plan>, ... ],
  "image": { "cmPerPx": <centimetres per pixel of the image you saw>, "originX": <pixel x of plan (0,0)>, "originY": <pixel y of plan (0,0)> },
  "notes": [ "<short remark for the user, in the user's language>", ... ]
}
"image" describes the first floor in the image; it is used to lay the image under the plan for checking.`;

export interface FloorplanRequest {
  /** "auto" lets Claude decide; a number says how many floors are on the image. */
  floors: "auto" | number;
  /** A length the user knows, e.g. "the living room is 5.40 m wide". */
  hint?: string;
  /** Language for the notes. */
  locale: "nl" | "en";
}

/** The text that goes with the image. */
export function floorplanUserText(req: FloorplanRequest): string {
  const lines = ["Read this floor plan and return plan-code as described."];
  if (req.floors !== "auto") {
    lines.push(
      req.floors === 1
        ? "The image shows one floor."
        : `The image shows ${req.floors} floors; return ${req.floors} plans, lowest level first.`,
    );
  }
  if (req.hint?.trim()) lines.push(`Known measurement from the user: ${req.hint.trim()}`);
  lines.push(`Write the notes in ${req.locale === "nl" ? "Dutch" : "English"}.`);
  return lines.join("\n");
}

/** Message asking Claude to fix plan-code that did not validate. */
export function repairText(errors: readonly PlanCodeError[]): string {
  const list = errors
    .slice(0, 20)
    .map((e) => `- ${e.path || `line ${e.line}`}: ${e.message}`)
    .join("\n");
  return `The plan-code did not validate:\n${list}\nReturn the corrected JSON object, same shape, nothing else.`;
}

/**
 * Find the JSON in an answer: a fenced block if there is one, otherwise the
 * outermost object or list. Returns undefined when there is none.
 */
export function extractJson(text: string): string | undefined {
  const fence = /```(?:json)?\s*\n([\s\S]*?)```/.exec(text);
  if (fence?.[1]) return fence[1].trim();
  const start = text.search(/[[{]/);
  if (start < 0) return undefined;
  const open = text[start]!;
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (c === "\\") i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return text.slice(start, i + 1);
  }
  return undefined;
}

export interface ImagePlacement {
  cmPerPx: number;
  originX: number;
  originY: number;
}

export type FloorplanResult =
  | {
      ok: true;
      plans: PlanCode[];
      warnings: PlanCodeWarning[];
      image?: ImagePlacement;
      notes: string[];
    }
  | { ok: false; errors: PlanCodeError[] };

function noJson(message: string): FloorplanResult {
  return { ok: false, errors: [{ line: 1, col: 1, path: "", message }] };
}

/** Read Claude's answer: the wrapper object, or bare plan-code as a fallback. */
export function parseFloorplanAnswer(text: string): FloorplanResult {
  const json = extractJson(text);
  if (!json) return noJson("The answer contains no JSON");
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    // Let the plan-code parser report the syntax error with a position.
    const r = parsePlanCode(json);
    return r.ok ? { ...r, notes: [] } : r;
  }
  const wrapper =
    value && typeof value === "object" && !Array.isArray(value) && "plans" in value
      ? (value as { plans: unknown; image?: unknown; notes?: unknown })
      : undefined;
  const plansText = JSON.stringify(wrapper ? wrapper.plans : value, null, 2);
  const parsed = parsePlanCode(plansText);
  if (!parsed.ok) return parsed;
  const notes = Array.isArray(wrapper?.notes)
    ? wrapper.notes.filter((n): n is string => typeof n === "string").slice(0, 20)
    : [];
  return { ...parsed, notes, image: readPlacement(wrapper?.image) };
}

function readPlacement(v: unknown): ImagePlacement | undefined {
  if (!v || typeof v !== "object") return undefined;
  const { cmPerPx, originX, originY } = v as Record<string, unknown>;
  const ok = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
  if (!ok(cmPerPx) || cmPerPx <= 0 || cmPerPx > 100) return undefined;
  return { cmPerPx, originX: ok(originX) ? originX : 0, originY: ok(originY) ? originY : 0 };
}

// ------------------------------------------------------------- image size

/**
 * Size to send an image at. Claude downsizes anything larger anyway, so
 * sending less saves upload time and tokens without losing detail.
 */
export function fitImage(width: number, height: number, max = 1568): { w: number; h: number } {
  const f = Math.min(1, max / Math.max(width, height, 1));
  return { w: Math.max(1, Math.round(width * f)), h: Math.max(1, Math.round(height * f)) };
}

/** Rough token count of an image (Anthropic's rule of thumb: w * h / 750). */
export function imageTokens(width: number, height: number): number {
  const { w, h } = fitImage(width, height);
  return Math.ceil((w * h) / 750);
}

// ------------------------------------------------------------- cost

/** Price in dollars per million tokens, input and output. */
export const PRICES: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 },
};

/** Cost in dollars for a call, or undefined for an unknown model. */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number | undefined {
  const p = PRICES[model];
  if (!p) return undefined;
  return (inputTokens * p.input + outputTokens * p.output) / 1e6;
}

/**
 * Typical cost of reading one plan: the image, the instructions and a few
 * thousand tokens of thinking and JSON. Shown before the user starts.
 */
export function typicalFloorplanCost(
  model: string,
  width = 1568,
  height = 1100,
): number | undefined {
  const input = imageTokens(width, height) + 1500;
  return estimateCost(model, input, 8000);
}

// ------------------------------------------------------------- review step

/** Scale every coordinate and size in a plan (rooms, openings, fixtures). */
export function scalePlan(plan: PlanCode, f: number): PlanCode {
  const s = (v: number) => Math.round(v * f * 10) / 10;
  const r4 = ([x, y, w, d]: readonly [number, number, number, number]) =>
    [s(x), s(y), s(w), s(d)] as [number, number, number, number];
  const opening = <T extends { x: number; y: number; w: number }>(o: T): T => ({
    ...o,
    x: s(o.x),
    y: s(o.y),
    w: s(o.w),
  });
  return {
    ...plan,
    rooms: plan.rooms.map((room) => ({
      ...room,
      rects: room.rects?.map(r4),
      points: room.points?.map(([x, y]) => [s(x), s(y)] as [number, number]),
    })),
    walls: plan.walls?.map(r4),
    doors: plan.doors?.map(opening),
    windows: plan.windows?.map(opening),
    passages: plan.passages?.map(opening),
    fixtures: plan.fixtures?.map((fx) => ({
      ...fx,
      x: s(fx.x),
      y: s(fx.y),
      w: s(fx.w),
      h: s(fx.h),
    })),
    items: plan.items?.map((i) => ({ ...i, x: s(i.x), y: s(i.y) })),
  };
}

/** Width and depth of a room's bounding box in plan-code. */
export function roomSize(room: PlanCode["rooms"][number]): { w: number; d: number } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [x, y, w, d] of room.rects ?? []) {
    xs.push(x, x + w);
    ys.push(y, y + d);
  }
  for (const [x, y] of room.points ?? []) {
    xs.push(x);
    ys.push(y);
  }
  if (!xs.length) return { w: 0, d: 0 };
  return { w: Math.max(...xs) - Math.min(...xs), d: Math.max(...ys) - Math.min(...ys) };
}

/**
 * Scale factor from one known length: the user says a room is really
 * `real` cm wide (or deep) where the plan says `measured`.
 */
export function scaleFactor(measured: number, real: number): number | undefined {
  if (!(measured > 0) || !(real > 0)) return undefined;
  const f = real / measured;
  return f > 0.2 && f < 5 ? f : undefined;
}
