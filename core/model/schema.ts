import { z } from "zod";
import {
  FIXTURE_TYPES,
  FLOOR_FINISH_KINDS,
  LAYERS,
  ROOM_TYPES,
  UNITS,
  WALL_FINISH_KINDS,
  type Project,
} from "./types";

/**
 * Runtime schema for a stored project (latest schema version). Used when
 * loading from IndexedDB or importing a project file, after migration.
 */

const num = z.number().finite();
const len = num.nonnegative();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #A1B2C3");

const rect = z.object({ x: num, y: num, w: len, d: len });
const point = z.object({ x: num, y: num });
const side = z.enum(["a", "b"]);

const wallFinish = z.object({
  kind: z.enum(WALL_FINISH_KINDS),
  color: color.optional(),
  height: len.optional(),
});
const floorFinish = z.object({ kind: z.enum(FLOOR_FINISH_KINDS), color: color.optional() });

const room = z.object({
  id: z.string().min(1),
  name: z.string(),
  type: z.enum(ROOM_TYPES),
  shape: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("rects"), rects: z.array(rect).min(1) }),
    z.object({ kind: z.literal("polygon"), points: z.array(point).min(3) }),
  ]),
  style: z.object({ wall: wallFinish, floor: floorFinish, ceiling: color }).partial().optional(),
  labelOffset: point.optional(),
  labelHidden: z.boolean().optional(),
});

const openingBase = {
  id: z.string().min(1),
  x: num,
  y: num,
  w: len,
  dir: z.enum(["h", "v"]),
  wallId: z.string().optional(),
};

const opening = z.discriminatedUnion("kind", [
  z.object({
    ...openingBase,
    kind: z.literal("door"),
    height: len,
    hinge: z.enum(["start", "end"]),
    swing: side,
  }),
  z.object({
    ...openingBase,
    kind: z.literal("window"),
    sill: len,
    lintel: len,
    glass: z.boolean(),
  }),
]);

const fixture = z.object({
  id: z.string().min(1),
  type: z.enum(FIXTURE_TYPES),
  x: num,
  y: num,
  w: len,
  d: len,
  rotation: num,
  locked: z.boolean(),
});

const item = z.object({
  id: z.string().min(1),
  catalogId: z.string(),
  name: z.string(),
  x: num,
  y: num,
  w: len,
  d: len,
  h: len,
  rotation: num,
  shape: z.enum(["rect", "round"]),
  layer: z.enum(LAYERS),
  mount: z.enum(["floor", "stack", "wall"]),
  elevation: len,
  color: color.optional(),
  groupId: z.string().optional(),
  locked: z.boolean().optional(),
});

const style = z.object({
  name: z.string(),
  wall: wallFinish,
  floor: floorFinish,
  ceiling: color,
  accent: color,
});

const version = z.object({
  id: z.string().min(1),
  name: z.string(),
  kind: z.enum(["current", "design"]),
  rooms: z.array(room),
  extraWalls: z.array(z.object({ id: z.string().min(1), rect })),
  openings: z.array(opening),
  fixtures: z.array(fixture),
  items: z.array(item),
  style,
  wallOverrides: z.record(z.string(), z.object({ a: wallFinish, b: wallFinish }).partial()),
});

const floor = z.object({
  id: z.string().min(1),
  name: z.string(),
  level: z.number().int(),
  height: len,
  current: version,
  designs: z.array(version),
  activeVersionId: z.string().min(1),
});

const layerState = z.object({ visible: z.boolean(), locked: z.boolean() });

export const projectSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    id: z.string().min(1),
    name: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    settings: z.object({
      unit: z.enum(UNITS),
      wallThickness: z.object({ interior: len, exterior: len }),
      lowWallHeight: len,
      gridSize: num.positive(),
      snapToGrid: z.boolean(),
      clearance: len,
      layers: z.object(
        Object.fromEntries(LAYERS.map((l) => [l, layerState])) as Record<
          (typeof LAYERS)[number],
          typeof layerState
        >,
      ),
    }),
    floors: z.array(floor).min(1),
    activeFloorId: z.string().min(1),
  })
  .superRefine((p, ctx) => {
    if (!p.floors.some((f) => f.id === p.activeFloorId)) {
      ctx.addIssue({ code: "custom", path: ["activeFloorId"], message: "Unknown floor id" });
    }
    p.floors.forEach((f, i) => {
      const ids = [f.current.id, ...f.designs.map((d) => d.id)];
      if (!ids.includes(f.activeVersionId)) {
        ctx.addIssue({
          code: "custom",
          path: ["floors", i, "activeVersionId"],
          message: "Unknown version id",
        });
      }
    });
  });

// Compile-time guard: the schema and the hand-written types must agree.
type Equals<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const schemaMatchesTypes: Equals<z.infer<typeof projectSchema>, Project> = true;
void schemaMatchesTypes;

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult =
  { ok: true; project: Project } | { ok: false; issues: ValidationIssue[] };

export function validateProject(input: unknown): ValidationResult {
  const result = projectSchema.safeParse(input);
  if (result.success) return { ok: true, project: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
