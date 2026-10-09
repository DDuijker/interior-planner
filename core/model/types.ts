/**
 * The Maison data model. All lengths are centimetres, all angles degrees.
 * Plan coordinates: x grows to the right, y grows downwards.
 *
 * Every object is treated as immutable: update through the functions in
 * `actions.ts` (built on immer) so history and undo/redo keep working.
 */

export type Id = string;

/** Axis-aligned rectangle: top-left corner plus width (x) and depth (y). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  d: number;
}

export interface Point {
  x: number;
  y: number;
}

export const ROOM_TYPES = [
  "living",
  "kitchen",
  "dining",
  "bed",
  "office",
  "bath",
  "toilet",
  "hal",
  "storage",
  "loggia",
] as const;
export type RoomType = (typeof ROOM_TYPES)[number];

/** A room is either a union of rectangles or a single polygon. */
export type RoomShape = { kind: "rects"; rects: Rect[] } | { kind: "polygon"; points: Point[] };

export type Side = "a" | "b";

export const WALL_FINISH_KINDS = ["current", "paint", "wallpaper", "panel"] as const;
export type WallFinishKind = (typeof WALL_FINISH_KINDS)[number];

export interface WallFinish {
  kind: WallFinishKind;
  /** CSS hex colour, e.g. "#E3EAE2". */
  color?: string;
  /** Finish height from the floor; undefined means full height. */
  height?: number;
}

export const FLOOR_FINISH_KINDS = [
  "current",
  "wood",
  "herringbone",
  "tiles",
  "terrazzo",
  "carpet",
  "concrete",
] as const;
export type FloorFinishKind = (typeof FLOOR_FINISH_KINDS)[number];

export interface FloorFinish {
  kind: FloorFinishKind;
  color?: string;
}

/** Room-level look. Walls inherit this unless they have an override. */
export interface RoomStyle {
  wall: WallFinish;
  floor: FloorFinish;
  ceiling: string;
}

export interface Room {
  id: Id;
  name: string;
  type: RoomType;
  shape: RoomShape;
  style?: Partial<RoomStyle>;
  /** Label offset from the room centroid, in cm. */
  labelOffset?: Point;
  labelHidden?: boolean;
}

export type WallKind = "interior" | "exterior" | "low";

/**
 * A generated wall segment. Walls are derived from rooms (see core/walls)
 * and never edited directly; their ids are stable for a given geometry so
 * per-wall overrides survive regeneration.
 */
export interface Wall {
  id: Id;
  rect: Rect;
  kind: WallKind;
  height: number;
  /** Rooms on side a (north/west) and side b (south/east), if any. */
  rooms: { a?: Id; b?: Id };
}

/** A manually drawn wall, on top of the generated ones (plan-code "walls"). */
export interface ExtraWall {
  id: Id;
  rect: Rect;
}

/** Per wall, per side finish override. Absent sides fall back to the room style. */
export type WallOverrides = Record<Id, Partial<Record<Side, WallFinish>>>;

export type Axis = "h" | "v";

interface OpeningBase {
  id: Id;
  /** Start point of the opening on the wall centre line. */
  x: number;
  y: number;
  /** Width along the wall. */
  w: number;
  dir: Axis;
  /** Wall this opening snapped to, if any. */
  wallId?: Id;
}

export interface Door extends OpeningBase {
  kind: "door";
  height: number;
  hinge: "start" | "end";
  /** Side of the wall the leaf swings into. */
  swing: Side;
}

export interface Window extends OpeningBase {
  kind: "window";
  /** Sill height from the floor. */
  sill: number;
  /** Lintel (top of the opening) height from the floor. */
  lintel: number;
  /** Floor-to-ceiling glass wall instead of a window. */
  glass: boolean;
}

export type Opening = Door | Window;

export const FIXTURE_TYPES = [
  "kitchen",
  "fridge",
  "toilet",
  "sink",
  "shower",
  "bath",
  "tall",
  "column",
  "stairs",
  "chimney",
] as const;
export type FixtureType = (typeof FIXTURE_TYPES)[number];

export interface Fixture {
  id: Id;
  type: FixtureType;
  x: number;
  y: number;
  w: number;
  d: number;
  /** Rotation in degrees, clockwise. */
  rotation: number;
  locked: boolean;
}

export const CARDINALS = ["N", "E", "S", "W"] as const;
export type Cardinal = (typeof CARDINALS)[number];

export const LAYERS = ["furniture", "decor", "lighting", "dimensions", "electrical"] as const;
export type Layer = (typeof LAYERS)[number];

/** How an item is placed: on the floor, on top of something, or on a wall. */
export type Mount = "floor" | "stack" | "wall";

export interface Item {
  id: Id;
  /** Catalog entry this item was created from. */
  catalogId: string;
  name: string;
  /** Centre of the footprint. */
  x: number;
  y: number;
  w: number;
  d: number;
  h: number;
  /** Rotation in degrees, clockwise. 0 means the back faces north. */
  rotation: number;
  shape: "rect" | "round";
  layer: Layer;
  mount: Mount;
  /** Height of the item's base above the floor (stacked or wall items). */
  elevation: number;
  color?: string;
  groupId?: Id;
  locked?: boolean;
}

/** Version-wide defaults; rooms and walls override these. */
export interface Style {
  name: string;
  wall: WallFinish;
  floor: FloorFinish;
  ceiling: string;
  accent: string;
}

/** "Huidige situatie" (current) or one of the designs of a floor. */
export interface Version {
  id: Id;
  name: string;
  kind: "current" | "design";
  rooms: Room[];
  extraWalls: ExtraWall[];
  openings: Opening[];
  fixtures: Fixture[];
  items: Item[];
  style: Style;
  wallOverrides: WallOverrides;
}

export interface Floor {
  id: Id;
  name: string;
  /** 0 = ground floor, 1 = first floor, -1 = basement. */
  level: number;
  /** Floor-to-ceiling height. */
  height: number;
  current: Version;
  designs: Version[];
  /** Id of the version shown in the editor (current or a design). */
  activeVersionId: Id;
}

export const UNITS = ["cm", "mm", "in", "ft"] as const;
export type Unit = (typeof UNITS)[number];

export interface LayerState {
  visible: boolean;
  locked: boolean;
}

export interface ProjectSettings {
  unit: Unit;
  wallThickness: { interior: number; exterior: number };
  /** Height of the low edge around a loggia or balcony. */
  lowWallHeight: number;
  gridSize: number;
  snapToGrid: boolean;
  /** Minimum free passage width before warning. */
  clearance: number;
  layers: Record<Layer, LayerState>;
}

export interface Project {
  schemaVersion: number;
  id: Id;
  name: string;
  createdAt: string;
  updatedAt: string;
  settings: ProjectSettings;
  floors: Floor[];
  activeFloorId: Id;
}
