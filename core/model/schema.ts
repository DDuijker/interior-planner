import { z } from "zod";
import {
  CARDINALS,
  CORNICE_STYLES,
  FIXTURE_TYPES,
  FLOOR_FINISH_KINDS,
  LAYERS,
  PANEL_STYLES,
  PART_MATERIALS,
  PART_SHAPES,
  PHOTO_KINDS,
  ROOM_TYPES,
  SKIRTING_STYLES,
  STAIR_SHAPES,
  UNITS,
  WALL_FINISH_KINDS,
  WALLPAPER_PATTERNS,
  type Project,
} from "./types";

/**
 * Runtime schema for a stored project (latest schema version). Used when
 * loading from IndexedDB or importing a project file, after migration.
 */

const num = z.number().finite();
const len = num.nonnegative();
const id = z.string().min(1);
export const colorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour like #A1B2C3");
const color = colorSchema;

export const rectSchema = z.object({ x: num, y: num, w: len, d: len });
const rect = rectSchema;
const point = z.object({ x: num, y: num });
const side = z.enum(["a", "b"]);
const layer = z.enum(LAYERS);
const mount = z.enum(["floor", "stack", "wall"]);

export const wallFinishSchema = z.object({
  kind: z.enum(WALL_FINISH_KINDS),
  color: color.optional(),
  color2: color.optional(),
  height: len.optional(),
  pattern: z.enum(WALLPAPER_PATTERNS).optional(),
  panel: z.enum(PANEL_STYLES).optional(),
});
const wallFinish = wallFinishSchema;

export const floorFinishSchema = z.object({
  kind: z.enum(FLOOR_FINISH_KINDS),
  color: color.optional(),
  color2: color.optional(),
  jointColor: color.optional(),
  plankWidth: len.optional(),
  tileSize: len.optional(),
});
const floorFinish = floorFinishSchema;

export const trimSchema = z.object({
  skirting: z.object({ style: z.enum(SKIRTING_STYLES), height: len, color: color.optional() }),
  cornice: z.enum(CORNICE_STYLES),
  rosette: z.boolean(),
  frameColor: color.optional(),
});

export const roomStyleSchema = z
  .object({ wall: wallFinish, floor: floorFinish, ceiling: color, trim: trimSchema.partial() })
  .partial();

const room = z.object({
  id,
  name: z.string(),
  type: z.enum(ROOM_TYPES),
  shape: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("rects"), rects: z.array(rect).min(1) }),
    z.object({ kind: z.literal("polygon"), points: z.array(point).min(3) }),
  ]),
  style: roomStyleSchema.optional(),
  labelOffset: point.optional(),
  labelHidden: z.boolean().optional(),
});

const openingBase = {
  id,
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
  z.object({ ...openingBase, kind: z.literal("passage"), height: len }),
]);

const fixture = z.object({
  id,
  type: z.enum(FIXTURE_TYPES),
  x: num,
  y: num,
  w: len,
  d: len,
  rotation: num,
  locked: z.boolean(),
  stair: z.object({ shape: z.enum(STAIR_SHAPES), up: z.enum(CARDINALS) }).optional(),
});

export const partSchema = z.object({
  shape: z.enum(PART_SHAPES),
  x: num,
  y: num,
  z: num,
  w: len,
  d: len,
  h: len,
  material: z.enum(PART_MATERIALS),
  color: color.optional(),
});

const item = z.object({
  id,
  catalogId: z.string(),
  name: z.string(),
  x: num,
  y: num,
  w: len,
  d: len,
  h: len,
  rotation: num,
  shape: z.enum(["rect", "round"]),
  layer,
  mount,
  elevation: len,
  color: color.optional(),
  color2: color.optional(),
  groupId: z.string().optional(),
  locked: z.boolean().optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  light: z.object({ on: z.boolean(), color, intensity: z.number().min(0).max(1) }).optional(),
  price: len.optional(),
});

export const styleSchema = z.object({
  name: z.string(),
  wall: wallFinish,
  floor: floorFinish,
  ceiling: color,
  accent: color,
  trim: trimSchema,
  presetId: z.string().optional(),
});

const wallOverrides = z.record(z.string(), z.object({ a: wallFinish, b: wallFinish }).partial());

const version = z.object({
  id,
  name: z.string(),
  kind: z.enum(["current", "design"]),
  rooms: z.array(room),
  extraWalls: z.array(z.object({ id, rect })),
  openings: z.array(opening),
  fixtures: z.array(fixture),
  items: z.array(item),
  style: styleSchema,
  wallOverrides,
  demolitions: z.array(rect),
  wallFlags: z.record(z.string(), z.object({ bearing: z.boolean().optional() })),
  background: z
    .object({
      photoId: id,
      x: num,
      y: num,
      scale: num.positive(),
      rotation: num,
      opacity: z.number().min(0).max(1),
      keep: z.boolean(),
    })
    .optional(),
  moodboard: z.array(z.string()),
});

const floor = z.object({
  id,
  name: z.string(),
  level: z.number().int(),
  height: len,
  current: version,
  designs: z.array(version),
  activeVersionId: id,
});

const layerState = z.object({ visible: z.boolean(), locked: z.boolean() });

const photo = z.object({
  id,
  kind: z.enum(PHOTO_KINDS),
  name: z.string(),
  width: len,
  height: len,
  createdAt: z.string(),
  sourceUrl: z.string().optional(),
  note: z.string().optional(),
  link: z
    .object({
      floorId: z.string().optional(),
      roomId: z.string().optional(),
      wallId: z.string().optional(),
      side: side.optional(),
      at: point.optional(),
      dir: num.optional(),
    })
    .optional(),
  palette: z.array(color).optional(),
});

const look = z.object({
  id,
  name: z.string(),
  floorId: z.string(),
  createdAt: z.string(),
  style: styleSchema,
  roomStyles: z.record(z.string(), roomStyleSchema),
  wallOverrides,
  itemColors: z.record(z.string(), z.object({ color: color.optional(), color2: color.optional() })),
});

export const customItemSchema = z.object({
  id,
  name: z.string(),
  w: len,
  d: len,
  h: len,
  layer,
  mount,
  parts: z.array(partSchema).min(1),
});

export const projectSchema = z
  .object({
    schemaVersion: z.number().int().positive(),
    id,
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
      northAngle: num,
      eyeHeight: len,
      showLife: z.boolean(),
    }),
    floors: z.array(floor).min(1),
    activeFloorId: id,
    photos: z.array(photo),
    looks: z.array(look),
    customItems: z.array(customItemSchema),
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
