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

export const WALL_FINISH_KINDS = [
  "current",
  "paint",
  "limewash",
  "brick",
  "wallpaper",
  "panel",
] as const;
export type WallFinishKind = (typeof WALL_FINISH_KINDS)[number];

export const WALLPAPER_PATTERNS = ["botanical", "stripe", "toile"] as const;
export type WallpaperPattern = (typeof WALLPAPER_PATTERNS)[number];

export const PANEL_STYLES = ["french", "wainscot", "beadboard", "shaker", "neoclassical"] as const;
export type PanelStyle = (typeof PANEL_STYLES)[number];

export interface WallFinish {
  kind: WallFinishKind;
  /** CSS hex colour, e.g. "#E3EAE2". */
  color?: string;
  /** Second colour: wallpaper motif, or the panels when the wall above is painted. */
  color2?: string;
  /** Panel or finish height from the floor; undefined means full height. */
  height?: number;
  pattern?: WallpaperPattern;
  panel?: PanelStyle;
}

export const FLOOR_FINISH_KINDS = [
  "current",
  "planks",
  "herringbone",
  "chevron",
  "checker",
  "tiles",
  "terrazzo",
  "carpet",
  "concrete",
] as const;
export type FloorFinishKind = (typeof FLOOR_FINISH_KINDS)[number];

export interface FloorFinish {
  kind: FloorFinishKind;
  color?: string;
  /** Second colour (checkerboard, terrazzo chips). */
  color2?: string;
  jointColor?: string;
  /** Plank width in cm. */
  plankWidth?: number;
  /** Tile size in cm. */
  tileSize?: number;
}

export const SKIRTING_STYLES = ["none", "flat", "ogee"] as const;
export const CORNICE_STYLES = ["none", "simple", "ornate"] as const;

/** Mouldings and frames. */
export interface Trim {
  skirting: { style: (typeof SKIRTING_STYLES)[number]; height: number; color?: string };
  cornice: (typeof CORNICE_STYLES)[number];
  rosette: boolean;
  /** Door and window frames. */
  frameColor?: string;
}

/** Room-level look. Walls inherit this unless they have an override. */
export interface RoomStyle {
  wall: WallFinish;
  floor: FloorFinish;
  ceiling: string;
  trim: Partial<Trim>;
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

/** An opening without a door: a breakthrough in a renovation scenario. */
export interface Passage extends OpeningBase {
  kind: "passage";
  height: number;
}

export type Opening = Door | Window | Passage;

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
  /** Stairs only: shape and the direction you walk up (in plan, before rotation). */
  stair?: { shape: StairShape; up: Cardinal };
}

export const STAIR_SHAPES = ["straight", "l", "spiral"] as const;
export type StairShape = (typeof STAIR_SHAPES)[number];

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
  /** Second colour: fabric, cushions, bed linen, shade. */
  color2?: string;
  groupId?: Id;
  locked?: boolean;
  /** Catalog parameters (seats, drawers, plant type...). */
  params?: Record<string, number | string | boolean>;
  /** Lamps: whether it is on, light colour and brightness (0-1). */
  light?: { on: boolean; color: string; intensity: number };
  /** Optional own price, in euros. */
  price?: number;
}

export const PART_SHAPES = ["box", "cylinder", "sphere", "cone"] as const;
export const PART_MATERIALS = [
  "main",
  "second",
  "wood",
  "metal",
  "glass",
  "fabric",
  "leaf",
  "light",
  "white",
  "black",
] as const;
export type PartMaterial = (typeof PART_MATERIALS)[number];

/**
 * A primitive piece of a 3D model in the item's own frame: x right, y back
 * to front (y < 0 is the back), z up from the floor. Sizes in cm.
 */
export interface Part {
  shape: (typeof PART_SHAPES)[number];
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  material: PartMaterial;
  color?: string;
}

/** A furniture piece the user built from parts (E08-45). */
export interface CustomItemDef {
  id: Id;
  name: string;
  w: number;
  d: number;
  h: number;
  layer: Layer;
  mount: Mount;
  parts: Part[];
}

/** Version-wide defaults; rooms and walls override these. */
export interface Style {
  name: string;
  wall: WallFinish;
  floor: FloorFinish;
  ceiling: string;
  accent: string;
  trim: Trim;
  /** Preset this style came from, if any. */
  presetId?: string;
}

/** Image under the plan to trace over (E06-30). */
export interface Background {
  photoId: Id;
  /** World position of the image's top-left corner. */
  x: number;
  y: number;
  /** Centimetres per image pixel. */
  scale: number;
  rotation: number;
  opacity: number;
  /** Keep the image in the project file, or only locally. */
  keep: boolean;
}

export interface WallFlags {
  /** Load-bearing: demolishing it gives a warning. */
  bearing?: boolean;
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
  /** Areas where walls are demolished in this version. */
  demolitions: Rect[];
  wallFlags: Record<Id, WallFlags>;
  background?: Background;
  /** Inspiration photos on this version's moodboard, in order. */
  moodboard: Id[];
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
  /** Compass angle of plan north (0 = up), for the sun. */
  northAngle: number;
  /** Eye height for the first-person walk. */
  eyeHeight: number;
  /** Show everyday "life" items (laid table, laundry, toys). */
  showLife: boolean;
}

export const PHOTO_KINDS = ["inspiration", "current"] as const;

/** Photo metadata. The image itself lives in IndexedDB under the same id. */
export interface Photo {
  id: Id;
  kind: (typeof PHOTO_KINDS)[number];
  name: string;
  width: number;
  height: number;
  createdAt: string;
  /** Where it came from, e.g. a Pinterest pin. Only stored, never fetched. */
  sourceUrl?: string;
  note?: string;
  /** Place in the current situation this photo shows. */
  link?: { floorId?: Id; roomId?: Id; wallId?: Id; side?: Side; at?: Point; dir?: number };
  palette?: string[];
}

/** A saved combination of styles and colours, to compare (E09-53). */
export interface Look {
  id: Id;
  name: string;
  floorId: Id;
  createdAt: string;
  style: Style;
  roomStyles: Record<Id, Partial<RoomStyle>>;
  wallOverrides: WallOverrides;
  itemColors: Record<Id, { color?: string; color2?: string }>;
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
  photos: Photo[];
  looks: Look[];
  customItems: CustomItemDef[];
}
