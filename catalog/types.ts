import type { Layer, Mount, Part } from "@/core/model/types";

export const CATEGORIES = [
  "seating",
  "tables",
  "bedroom",
  "office",
  "storage",
  "kitchen",
  "bathroom",
  "decor",
  "plants",
  "textiles",
  "lighting",
  "life",
  "custom",
] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Dims {
  w: number;
  d: number;
  h: number;
}

export type Params = Record<string, number | string | boolean>;

export interface Colors {
  main: string;
  second: string;
}

/**
 * One catalog entry. Entries are data plus a build function that turns
 * dimensions, parameters and colours into primitive parts. The same parts
 * draw the 2D symbol (seen from above) and the 3D model.
 */
export interface CatalogEntry {
  id: string;
  name: { nl: string; en: string };
  category: Category;
  tags: string[];
  size: Dims;
  min: Dims;
  max: Dims;
  shape: "rect" | "round";
  layer: Layer;
  mount: Mount;
  /** Default height of the base above the floor for wall items. */
  elevation?: number;
  colors: Colors;
  /** Suggested colours shown in the editor. */
  palette?: string[];
  /** Back goes against a wall when placed. */
  againstWall?: boolean;
  /** Small items can stand on this; value is the surface height as a fraction of h. */
  surface?: number;
  /** Lamps. */
  light?: { color: string; intensity: number };
  /** Everyday "life" items that can be hidden in one go. */
  life?: boolean;
  params?: Params;
  build: (dims: Dims, params: Params) => Part[];
}
