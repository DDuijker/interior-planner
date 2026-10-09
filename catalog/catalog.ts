import { z } from "zod";
import { newId } from "@/core/model/ids";
import {
  LAYERS,
  type CustomItemDef,
  type Item,
  type Part,
  type PartMaterial,
  type Point,
} from "@/core/model/types";
import { ENTRIES } from "./entries";
import { CATEGORIES, type CatalogEntry, type Category, type Dims, type Params } from "./types";

export { ENTRIES };

const BY_ID = new Map(ENTRIES.map((e) => [e.id, e]));

export function getEntry(id: string): CatalogEntry | undefined {
  return BY_ID.get(id);
}

/** Catalog entry for a project's custom item (E08-45). */
export function customEntry(def: CustomItemDef): CatalogEntry {
  const size = { w: def.w, d: def.d, h: def.h };
  return {
    id: def.id,
    name: { nl: def.name, en: def.name },
    category: "custom",
    tags: ["eigen", "custom"],
    size,
    min: { w: 1, d: 1, h: 1 },
    max: { w: 1000, d: 1000, h: 400 },
    shape: "rect",
    layer: def.layer,
    mount: def.mount,
    colors: { main: "#C9B8A0", second: "#E9E2D3" },
    build: (dims) => scaleParts(def.parts, size, dims),
  };
}

/** Scale parts designed at `from` to fit `to`. */
export function scaleParts(parts: readonly Part[], from: Dims, to: Dims): Part[] {
  const fx = to.w / (from.w || 1),
    fy = to.d / (from.d || 1),
    fz = to.h / (from.h || 1);
  return parts.map((p) => ({
    ...p,
    x: p.x * fx,
    y: p.y * fy,
    z: p.z * fz,
    w: p.w * fx,
    d: p.d * fy,
    h: p.h * fz,
  }));
}

export function resolveEntry(
  item: Pick<Item, "catalogId">,
  custom: readonly CustomItemDef[] = [],
): CatalogEntry | undefined {
  const own = custom.find((c) => c.id === item.catalogId);
  return own ? customEntry(own) : getEntry(item.catalogId);
}

/** Parts for an item at its current size and parameters. */
export function itemParts(item: Item, custom: readonly CustomItemDef[] = []): Part[] {
  const entry = resolveEntry(item, custom);
  const dims = { w: item.w, d: item.d, h: item.h };
  if (!entry)
    return [
      {
        shape: item.shape === "round" ? "cylinder" : "box",
        x: 0,
        y: 0,
        z: 0,
        ...dims,
        material: "main",
      },
    ];
  return entry.build(dims, { ...entry.params, ...item.params });
}

const FIXED: Partial<Record<PartMaterial, string>> = {
  wood: "#8B6A4E",
  metal: "#9C9A94",
  glass: "#CFE3E8",
  leaf: "#5E7D4F",
  light: "#FFF4D6",
  white: "#F7F5F0",
  black: "#2A2620",
};

/** Colour of a part: explicit, then item colours, then catalog defaults. */
export function partColor(
  part: Part,
  item: Pick<Item, "color" | "color2">,
  entry?: CatalogEntry,
): string {
  if (part.color) return part.color;
  const main = item.color ?? entry?.colors.main ?? "#C9B8A0";
  const second = item.color2 ?? entry?.colors.second ?? main;
  if (part.material === "main") return main;
  if (part.material === "second" || part.material === "fabric") return second;
  return FIXED[part.material] ?? main;
}

export interface CreateOptions {
  at: Point;
  rotation?: number;
  params?: Params;
  locale?: "nl" | "en";
  custom?: readonly CustomItemDef[];
}

/** A new item from a catalog entry, at its standard size. */
export function createItem(
  entry: CatalogEntry,
  { at, rotation = 0, params, locale = "nl" }: CreateOptions,
): Item {
  const item: Item = {
    id: newId("item"),
    catalogId: entry.id,
    name: entry.name[locale],
    x: at.x,
    y: at.y,
    w: entry.size.w,
    d: entry.size.d,
    h: entry.size.h,
    rotation,
    shape: entry.shape,
    layer: entry.layer,
    mount: entry.mount,
    elevation: entry.elevation ?? 0,
  };
  if (params && Object.keys(params).length) item.params = params;
  if (entry.light)
    item.light = { on: true, color: entry.light.color, intensity: entry.light.intensity };
  return item;
}

/** Clamp a size to the entry's allowed range. */
export function clampSize(entry: CatalogEntry, dims: Dims): Dims {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    w: c(dims.w, entry.min.w, entry.max.w),
    d: c(dims.d, entry.min.d, entry.max.d),
    h: c(dims.h, entry.min.h, entry.max.h),
  };
}

// ------------------------------------------------------------------ search

export interface SearchFilter {
  category?: Category;
  locale?: "nl" | "en";
}

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Search by name (both languages), category, tag and size. Numbers in the
 * query match sizes from 20 cm up: "200" matches a width or depth within 15%, "160x200"
 * matches width and depth.
 */
export function searchCatalog(
  query: string,
  filter: SearchFilter = {},
  entries: readonly CatalogEntry[] = ENTRIES,
): CatalogEntry[] {
  const tokens = normalize(query).split(/\s+/).filter(Boolean);
  const sizes: [number, number?][] = [];
  const words: string[] = [];
  for (const t of tokens) {
    const m = /^(\d+)(?:x(\d+))?$/.exec(t);
    // Small numbers are part of names ("bank 3-zits"), sizes start at 20 cm.
    if (m && (m[2] || Number(m[1]) >= 20))
      sizes.push([Number(m[1]), m[2] ? Number(m[2]) : undefined]);
    else words.push(t);
  }
  const near = (a: number, b: number) => Math.abs(a - b) <= b * 0.15;
  return entries.filter((e) => {
    if (filter.category && e.category !== filter.category) return false;
    const hay = normalize([e.name.nl, e.name.en, e.category, ...e.tags].join(" "));
    if (!words.every((w) => hay.includes(w))) return false;
    return sizes.every(([a, bb]) =>
      bb === undefined
        ? near(e.size.w, a) || near(e.size.d, a) || near(e.size.h, a)
        : near(e.size.w, a) && near(e.size.d, bb),
    );
  });
}

// --------------------------------------------------------------- validation

const dims = z.object({
  w: z.number().positive(),
  d: z.number().positive(),
  h: z.number().positive(),
});
export const entrySchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.object({ nl: z.string().min(1), en: z.string().min(1) }),
  category: z.enum(CATEGORIES),
  tags: z.array(z.string()),
  size: dims,
  min: dims,
  max: dims,
  shape: z.enum(["rect", "round"]),
  layer: z.enum(LAYERS),
  mount: z.enum(["floor", "stack", "wall"]),
  elevation: z.number().nonnegative().optional(),
  colors: z.object({
    main: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    second: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  }),
  palette: z.array(z.string().regex(/^#[0-9A-Fa-f]{6}$/)).optional(),
  againstWall: z.boolean().optional(),
  surface: z.number().min(0).max(1).optional(),
  light: z.object({ color: z.string(), intensity: z.number().min(0).max(1) }).optional(),
  life: z.boolean().optional(),
  params: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).optional(),
  build: z.function(),
});

export interface CatalogProblem {
  id: string;
  message: string;
}

/** Validate the whole catalogue: schema, unique ids, sane sizes and parts that fit. */
export function validateCatalog(entries: readonly CatalogEntry[] = ENTRIES): CatalogProblem[] {
  const problems: CatalogProblem[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const r = entrySchema.safeParse(e);
    if (!r.success)
      problems.push({
        id: e.id,
        message: r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      });
    if (seen.has(e.id)) problems.push({ id: e.id, message: "duplicate id" });
    seen.add(e.id);
    for (const k of ["w", "d", "h"] as const) {
      if (!(e.min[k] <= e.size[k] && e.size[k] <= e.max[k]))
        problems.push({ id: e.id, message: `size.${k} outside min/max` });
    }
    const parts = e.build(e.size, e.params ?? {});
    if (parts.length === 0) problems.push({ id: e.id, message: "no parts" });
    const tol = 1;
    for (const p of parts) {
      const values = [p.x, p.y, p.z, p.w, p.d, p.h];
      if (values.some((v) => !Number.isFinite(v))) {
        problems.push({ id: e.id, message: "non-finite part" });
        break;
      }
      // Parts may stick out a little (handles, rails, curtain rod) but not wildly.
      const slack = Math.max(tol, 0.15 * Math.max(e.size.w, e.size.d));
      if (
        Math.abs(p.x) + p.w / 2 > e.size.w / 2 + slack ||
        Math.abs(p.y) + p.d / 2 > e.size.d / 2 + slack ||
        p.z + p.h > e.size.h * 1.3 + 5
      ) {
        problems.push({ id: e.id, message: `part ${p.shape} outside the item box` });
        break;
      }
    }
  }
  return problems;
}

export function countByCategory(
  entries: readonly CatalogEntry[] = ENTRIES,
): Record<Category, number> {
  const out = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<Category, number>;
  for (const e of entries) out[e.category]++;
  return out;
}
