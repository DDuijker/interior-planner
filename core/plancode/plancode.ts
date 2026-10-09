import { z } from "zod";
import { getEntry, ENTRIES, createItem, type CatalogEntry } from "@/catalog";
import { createFixture } from "../fixtures/fixtures";
import { createFloor } from "../model/defaults";
import { newId } from "../model/ids";
import {
  CARDINALS,
  FIXTURE_TYPES,
  ROOM_TYPES,
  STAIR_SHAPES,
  type Cardinal,
  type Floor,
  type Item,
  type Opening,
  type Room,
  type Version,
} from "../model/types";
import { createDoor, createWindow, snapOpening } from "../openings/openings";
import { backForRotation, rotationForBack } from "../editor/transform";
import { generateWalls } from "../walls/generate";
import { parseWithPositions, positionOf, JsonSyntaxError, type Position } from "./jsonpos";

/**
 * Plan-code: a small JSON format to type, paste or generate floor plans.
 * One plan per floor; a file is one plan or a list of plans. All sizes in
 * cm, x to the right, y down. See docs/plan-code.md.
 */
export const PLAN_CODE_VERSION = 1;

const n = z.number().finite();
const pos = n.nonnegative();
const rect4 = z.tuple([n, n, pos, pos]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const dir = z.enum(["h", "v"]);

const roomSchema = z
  .object({
    name: z.string(),
    type: z.enum(ROOM_TYPES),
    rects: z.array(rect4).min(1).optional(),
    points: z
      .array(z.tuple([n, n]))
      .min(3)
      .optional(),
  })
  .strict()
  .refine((r) => !!r.rects !== !!r.points, { message: "Give either rects or points" });

const planSchema = z
  .object({
    version: z.literal(PLAN_CODE_VERSION).optional(),
    name: z.string(),
    level: z.number().int().optional(),
    height: pos.optional(),
    rooms: z.array(roomSchema),
    walls: z.array(rect4).optional(),
    doors: z
      .array(
        z
          .object({
            x: n,
            y: n,
            w: pos,
            dir,
            height: pos.optional(),
            hinge: z.enum(["start", "end"]).optional(),
            swing: z.enum(["a", "b"]).optional(),
          })
          .strict(),
      )
      .optional(),
    windows: z
      .array(
        z
          .object({
            x: n,
            y: n,
            w: pos,
            dir,
            glass: z.boolean().optional(),
            sill: pos.optional(),
            lintel: pos.optional(),
          })
          .strict(),
      )
      .optional(),
    passages: z
      .array(z.object({ x: n, y: n, w: pos, dir, height: pos.optional() }).strict())
      .optional(),
    fixtures: z
      .array(
        z
          .object({
            type: z.enum(FIXTURE_TYPES),
            x: n,
            y: n,
            w: pos,
            h: pos,
            rotation: n.optional(),
            shape: z.enum(STAIR_SHAPES).optional(),
            up: z.enum(CARDINALS).optional(),
          })
          .strict(),
      )
      .optional(),
    items: z
      .array(
        z
          .object({
            id: z.string().optional(),
            name: z.string().optional(),
            x: n,
            y: n,
            back: z.enum(CARDINALS).optional(),
            rotation: n.optional(),
            w: pos.optional(),
            d: pos.optional(),
            h: pos.optional(),
            color: color.optional(),
            color2: color.optional(),
          })
          .strict()
          .refine((i) => i.id || i.name, { message: "An item needs an id or a name" }),
      )
      .optional(),
  })
  .strict();

export type PlanCode = z.infer<typeof planSchema>;
export const planCodeSchema = z.union([planSchema, z.array(planSchema).min(1)]);

export interface PlanCodeError {
  line: number;
  col: number;
  /** Dotted path, e.g. "rooms.0.rects.1". Empty for syntax errors. */
  path: string;
  message: string;
}

export interface PlanCodeWarning {
  path: string;
  message: string;
}

export type ParseResult =
  | { ok: true; plans: PlanCode[]; warnings: PlanCodeWarning[] }
  | { ok: false; errors: PlanCodeError[] };

/** Parse and validate plan-code text, with line and field for every error. */
export function parsePlanCode(text: string): ParseResult {
  let parsed;
  try {
    parsed = parseWithPositions(text);
  } catch (err) {
    if (err instanceof JsonSyntaxError) {
      return {
        ok: false,
        errors: [{ ...err.position, path: "", message: err.message.replace(/ \(line.*$/, "") }],
      };
    }
    throw err;
  }
  const result = planCodeSchema.safeParse(parsed.value);
  if (!result.success) {
    // Union errors: report the branch that matched best (object vs list).
    const isList = Array.isArray(parsed.value);
    const issues = result.error.issues.flatMap((issue) =>
      issue.code === "invalid_union" && "errors" in issue
        ? ((issue.errors as z.core.$ZodIssue[][])[isList ? 1 : 0] ?? [issue])
        : [issue],
    );
    return {
      ok: false,
      errors: issues.map((issue) => {
        const path = issue.path.map(String);
        const at: Position = positionOf(parsed.positions, path);
        return { ...at, path: path.join("."), message: issue.message };
      }),
    };
  }
  const plans = Array.isArray(result.data) ? result.data : [result.data];
  const warnings: PlanCodeWarning[] = [];
  plans.forEach((plan, p) =>
    plan.items?.forEach((item, i) => {
      if (!findEntry(item)) {
        warnings.push({
          path: `${plans.length > 1 ? `${p}.` : ""}items.${i}`,
          message: `Unknown item "${item.id ?? item.name}", placed as a plain box`,
        });
      }
    }),
  );
  return { ok: true, plans, warnings };
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

/** Find the catalog entry for a plan item: by id, then by exact NL/EN name. */
export function findEntry(item: { id?: string; name?: string }): CatalogEntry | undefined {
  if (item.id) {
    const e = getEntry(item.id);
    if (e) return e;
  }
  if (item.name) {
    const name = norm(item.name);
    return ENTRIES.find((e) => norm(e.name.nl) === name || norm(e.name.en) === name);
  }
  return undefined;
}

const DEFAULT_HEIGHT = 260;

/** Build a floor (current situation) from one plan. */
export function planToFloor(plan: PlanCode, levelIndex = 0): Floor {
  const height = plan.height ?? DEFAULT_HEIGHT;
  const floor = createFloor(plan.name, plan.level ?? levelIndex, height);
  const rooms: Room[] = plan.rooms.map((r) => ({
    id: newId("room"),
    name: r.name,
    type: r.type,
    shape: r.rects
      ? { kind: "rects", rects: r.rects.map(([x, y, w, d]) => ({ x, y, w, d })) }
      : { kind: "polygon", points: r.points!.map(([x, y]) => ({ x, y })) },
  }));
  const extraWalls = (plan.walls ?? []).map(([x, y, w, d]) => ({
    id: newId("wall"),
    rect: { x, y, w, d },
  }));
  const walls = generateWalls(rooms, extraWalls, { height });
  // Snap to walls when close, otherwise keep the coordinates as given.
  const snap = <T extends Opening>(o: T): T => snapOpening(o, walls, 40) ?? o;
  const openings: Opening[] = [
    ...(plan.doors ?? []).map((d) =>
      snap(
        createDoor(d.x, d.y, d.dir, {
          w: d.w,
          ...(d.height !== undefined ? { height: d.height } : {}),
          ...(d.hinge ? { hinge: d.hinge } : {}),
          ...(d.swing ? { swing: d.swing } : {}),
        }),
      ),
    ),
    ...(plan.windows ?? []).map((w) =>
      snap(
        createWindow(w.x, w.y, w.dir, {
          w: w.w,
          glass: w.glass ?? false,
          ...(w.glass ? { sill: 0, lintel: height } : {}),
          ...(w.sill !== undefined ? { sill: w.sill } : {}),
          ...(w.lintel !== undefined ? { lintel: w.lintel } : {}),
        }),
      ),
    ),
    ...(plan.passages ?? []).map((p) =>
      snap({
        id: newId("pass"),
        kind: "passage" as const,
        x: p.x,
        y: p.y,
        w: p.w,
        dir: p.dir,
        height: p.height ?? 211,
      }),
    ),
  ];
  const fixtures = (plan.fixtures ?? []).map((f) =>
    createFixture(f.type, f.x, f.y, {
      w: f.w,
      d: f.h,
      rotation: f.rotation ?? 0,
      ...(f.type === "stairs" ? { stair: { shape: f.shape ?? "straight", up: f.up ?? "N" } } : {}),
    }),
  );
  const items: Item[] = (plan.items ?? []).map((i) => {
    const entry = findEntry(i);
    const rotation = i.rotation ?? (i.back ? rotationForBack(i.back) : 0);
    const base: Item = entry
      ? createItem(entry, { at: { x: i.x, y: i.y }, rotation })
      : {
          id: newId("item"),
          catalogId: i.id ?? "unknown",
          name: i.name ?? i.id ?? "?",
          x: i.x,
          y: i.y,
          w: 50,
          d: 50,
          h: 50,
          rotation,
          shape: "rect",
          layer: "furniture",
          mount: "floor",
          elevation: 0,
        };
    if (i.name) base.name = i.name;
    if (i.w !== undefined) base.w = i.w;
    if (i.d !== undefined) base.d = i.d;
    if (i.h !== undefined) base.h = i.h;
    if (i.color) base.color = i.color;
    if (i.color2) base.color2 = i.color2;
    return base;
  });
  floor.current = { ...floor.current, rooms, extraWalls, openings, fixtures, items };
  return floor;
}

export function planCodeToFloors(plans: readonly PlanCode[]): Floor[] {
  return plans.map((p, i) => planToFloor(p, i));
}

const r1 = (v: number) => Math.round(v * 10) / 10 + 0;

/** One version as a plan. Rounds to 1 mm. */
export function versionToPlan(floor: Floor, version: Version): PlanCode {
  const plan: PlanCode = {
    version: PLAN_CODE_VERSION,
    name: floor.name,
    level: floor.level,
    height: floor.height,
    rooms: version.rooms.map((r) =>
      r.shape.kind === "rects"
        ? {
            name: r.name,
            type: r.type,
            rects: r.shape.rects.map(
              (q) => [r1(q.x), r1(q.y), r1(q.w), r1(q.d)] as [number, number, number, number],
            ),
          }
        : {
            name: r.name,
            type: r.type,
            points: r.shape.points.map((p) => [r1(p.x), r1(p.y)] as [number, number]),
          },
    ),
  };
  if (version.extraWalls.length)
    plan.walls = version.extraWalls.map(({ rect: q }) => [r1(q.x), r1(q.y), r1(q.w), r1(q.d)]);
  const doors = version.openings.filter((o) => o.kind === "door");
  if (doors.length)
    plan.doors = doors.map((d) => ({
      x: r1(d.x),
      y: r1(d.y),
      w: r1(d.w),
      dir: d.dir,
      height: r1(d.height),
      hinge: d.hinge,
      swing: d.swing,
    }));
  const windows = version.openings.filter((o) => o.kind === "window");
  if (windows.length)
    plan.windows = windows.map((w) => ({
      x: r1(w.x),
      y: r1(w.y),
      w: r1(w.w),
      dir: w.dir,
      glass: w.glass,
      sill: r1(w.sill),
      lintel: r1(w.lintel),
    }));
  const passages = version.openings.filter((o) => o.kind === "passage");
  if (passages.length)
    plan.passages = passages.map((p) => ({
      x: r1(p.x),
      y: r1(p.y),
      w: r1(p.w),
      dir: p.dir,
      height: r1(p.height),
    }));
  if (version.fixtures.length) {
    plan.fixtures = version.fixtures.map((f) => ({
      type: f.type,
      x: r1(f.x),
      y: r1(f.y),
      w: r1(f.w),
      h: r1(f.d),
      ...(f.rotation ? { rotation: r1(f.rotation) } : {}),
      ...(f.stair ? { shape: f.stair.shape, up: f.stair.up } : {}),
    }));
  }
  if (version.items.length) {
    plan.items = version.items.map((i) => {
      const entry = getEntry(i.catalogId);
      const out: NonNullable<PlanCode["items"]>[number] = {
        id: i.catalogId,
        name: i.name,
        x: r1(i.x),
        y: r1(i.y),
      };
      const back = backForRotation(i.rotation);
      if (rotationForBack(back) === r1(i.rotation)) out.back = back as Cardinal;
      else out.rotation = r1(i.rotation);
      if (!entry || entry.size.w !== i.w || entry.size.d !== i.d || entry.size.h !== i.h) {
        out.w = r1(i.w);
        out.d = r1(i.d);
        out.h = r1(i.h);
      }
      if (i.color) out.color = i.color;
      if (i.color2) out.color2 = i.color2;
      return out;
    });
  }
  return plan;
}

/** Pretty JSON with short number arrays on one line. */
export function formatPlanCode(plans: PlanCode | PlanCode[]): string {
  const json = JSON.stringify(plans, null, 2);
  return json.replace(
    /\[\s*(-?[\d.e+-]+(?:,\s*-?[\d.e+-]+)*)\s*\]/g,
    (_, inner: string) => `[${inner.split(/,\s*/).join(", ")}]`,
  );
}

/** Plan-code for the active version of every floor. */
export function floorsToPlanCode(floors: readonly Floor[]): string {
  const plans = floors.map((f) =>
    versionToPlan(
      f,
      f.activeVersionId === f.current.id
        ? f.current
        : (f.designs.find((d) => d.id === f.activeVersionId) ?? f.current),
    ),
  );
  return formatPlanCode(plans.length === 1 ? plans[0]! : plans);
}
