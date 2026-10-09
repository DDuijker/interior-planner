import { produce } from "immer";
import { getActiveVersion, getFloor, updateActiveVersion } from "../model/actions";
import { newId } from "../model/ids";
import type {
  FloorFinish,
  FloorFinishKind,
  Id,
  Look,
  PanelStyle,
  Project,
  Room,
  RoomStyle,
  Side,
  Style,
  Trim,
  Version,
  Wall,
  WallFinish,
  WallpaperPattern,
} from "../model/types";

/** Full style of a room: the version style with the room's overrides on top. */
export function resolveRoomStyle(version: Version, room: Room | undefined): RoomStyle {
  const base = version.style;
  const own = room?.style ?? {};
  return {
    wall: own.wall ?? base.wall,
    floor: own.floor ?? base.floor,
    ceiling: own.ceiling ?? base.ceiling,
    trim: { ...base.trim, ...own.trim },
  };
}

export function resolveTrim(version: Version, room: Room | undefined): Trim {
  return resolveRoomStyle(version, room).trim as Trim;
}

/** Facade finish for the outside of exterior walls. */
export const OUTSIDE: WallFinish = { kind: "brick", color: "#9C5B43" };

/** Finish of one side of one wall: own override, then the room on that side. */
export function resolveWallFinish(version: Version, wall: Wall, side: Side): WallFinish {
  const own = version.wallOverrides[wall.id]?.[side];
  if (own) return own;
  const roomId = wall.rooms[side];
  if (!roomId) return wall.kind === "interior" ? version.style.wall : OUTSIDE;
  return resolveRoomStyle(
    version,
    version.rooms.find((r) => r.id === roomId),
  ).wall;
}

/** Set (or with undefined, clear) part of a room's own style. */
export function setRoomStyle(
  project: Project,
  roomId: Id,
  patch: Partial<RoomStyle> | undefined,
): Project {
  return updateActiveVersion(project, (v) => {
    const room = v.rooms.find((r) => r.id === roomId);
    if (!room) return;
    if (!patch) delete room.style;
    else room.style = { ...room.style, ...patch };
  });
}

export function setVersionStyle(project: Project, patch: Partial<Style>): Project {
  return updateActiveVersion(project, (v) => {
    Object.assign(v.style, patch);
  });
}

// ------------------------------------------------------------- presets

export interface StylePreset {
  id: string;
  name: { nl: string; en: string };
  palette: string[];
  style: Omit<Style, "name" | "presetId">;
  /** Suggested furniture colours: main, second. */
  furniture: [string, string];
}

const trim = (
  color: string,
  cornice: Trim["cornice"] = "none",
  rosette = false,
  skirting = 9,
): Trim => ({
  skirting: { style: cornice === "none" ? "flat" : "ogee", height: skirting, color },
  cornice,
  rosette,
  frameColor: color,
});

const p = (
  id: string,
  nl: string,
  en: string,
  palette: string[],
  wall: WallFinish,
  floor: FloorFinish,
  ceiling: string,
  t: Trim,
  furniture: [string, string],
): StylePreset => ({
  id,
  name: { nl, en },
  palette,
  style: { wall, floor, ceiling, accent: palette[2] ?? palette[0]!, trim: t },
  furniture,
});

/** 22 complete looks. Colours are generic, no paint brands. */
export const STYLE_PRESETS: readonly StylePreset[] = [
  p(
    "french-country",
    "Frans landelijk",
    "French country",
    ["#EFE8DA", "#C9B8A0", "#87A08C", "#B08D57", "#6B5A48"],
    { kind: "panel", panel: "french", color: "#EFE8DA", color2: "#E4DACA", height: 260 },
    { kind: "herringbone", color: "#B8916A", plankWidth: 9 },
    "#F7F3EA",
    trim("#F3EEE3", "simple", true, 12),
    ["#E9E2D3", "#87A08C"],
  ),
  p(
    "neoclassical",
    "Neoklassiek",
    "Neoclassical",
    ["#F2EEE6", "#D9D2C3", "#7A8B99", "#B08D57", "#2A2620"],
    { kind: "panel", panel: "neoclassical", color: "#F2EEE6", color2: "#ECE6DA", height: 260 },
    { kind: "chevron", color: "#9C7A58", plankWidth: 10 },
    "#FBF9F4",
    trim("#FBF9F4", "ornate", true, 15),
    ["#D9D2C3", "#7A8B99"],
  ),
  p(
    "romantic",
    "Romantisch",
    "Romantic",
    ["#F3E6E1", "#E3C7C0", "#B56B5A", "#C9B8A0", "#6E4C46"],
    { kind: "wallpaper", pattern: "toile", color: "#F3E6E1", color2: "#C79A90" },
    { kind: "planks", color: "#D8C3A5", plankWidth: 14 },
    "#FBF6F2",
    trim("#FBF6F2", "simple", true, 10),
    ["#F3E6E1", "#B56B5A"],
  ),
  p(
    "japandi",
    "Japandi",
    "Japandi",
    ["#ECE6DB", "#C8BBA6", "#6E6A5E", "#3F3A33", "#A9A58B"],
    { kind: "limewash", color: "#E6DFD2" },
    { kind: "planks", color: "#C8A982", plankWidth: 20 },
    "#F2EEE6",
    trim("#E6DFD2", "none", false, 5),
    ["#C8BBA6", "#3F3A33"],
  ),
  p(
    "scandinavian",
    "Scandinavisch",
    "Scandinavian",
    ["#F7F5F0", "#E3E1DA", "#A7B5A9", "#D8C3A5", "#4B4A46"],
    { kind: "paint", color: "#F7F5F0" },
    { kind: "planks", color: "#E2CDAE", plankWidth: 18 },
    "#FFFFFF",
    trim("#F7F5F0", "none", false, 7),
    ["#E3E1DA", "#A7B5A9"],
  ),
  p(
    "art-deco",
    "Art deco",
    "Art deco",
    ["#1F3B3A", "#2A2620", "#B08D57", "#E9E2D3", "#7A3E3A"],
    { kind: "paint", color: "#1F3B3A" },
    { kind: "checker", color: "#F2EEE6", color2: "#2A2620", tileSize: 40 },
    "#E9E2D3",
    trim("#B08D57", "ornate", false, 12),
    ["#7A3E3A", "#B08D57"],
  ),
  p(
    "sage-cream",
    "Salie en crème",
    "Sage and cream",
    ["#F5F1E8", "#E3EAE2", "#87A08C", "#4D6857", "#B08D57"],
    { kind: "panel", panel: "shaker", color: "#F5F1E8", color2: "#87A08C", height: 110 },
    { kind: "herringbone", color: "#C9A97E", plankWidth: 9 },
    "#FBF9F4",
    trim("#F5F1E8", "simple", false, 9),
    ["#E9E2D3", "#87A08C"],
  ),
  p(
    "olive-greige",
    "Olijf-greige",
    "Olive greige",
    ["#E9E4D8", "#A9A58B", "#6F6E57", "#C9B8A0", "#4A3526"],
    { kind: "limewash", color: "#D9D3C2" },
    { kind: "planks", color: "#A9875F", plankWidth: 16 },
    "#F2EEE4",
    trim("#E9E4D8"),
    ["#A9A58B", "#E9E4D8"],
  ),
  p(
    "industrial",
    "Industrieel",
    "Industrial",
    ["#B9B6AE", "#4B4A46", "#8B6A4E", "#2A2620", "#C26B3A"],
    { kind: "brick", color: "#8E5A44" },
    { kind: "concrete", color: "#9C9A94" },
    "#D9D6CF",
    trim("#2A2620", "none", false, 6),
    ["#4B4A46", "#8B6A4E"],
  ),
  p(
    "mid-century",
    "Mid-century",
    "Mid-century",
    ["#F2EBDD", "#D9A441", "#2F5D62", "#8B5A3C", "#E07A5F"],
    { kind: "paint", color: "#F2EBDD" },
    { kind: "planks", color: "#9C6B45", plankWidth: 12 },
    "#FFFFFF",
    trim("#F2EBDD"),
    ["#2F5D62", "#D9A441"],
  ),
  p(
    "cottage",
    "Cottage",
    "Cottage",
    ["#F4EFE4", "#DCE4DB", "#9DB5A0", "#C9B08A", "#5B6E5D"],
    { kind: "panel", panel: "beadboard", color: "#F4EFE4", color2: "#DCE4DB", height: 120 },
    { kind: "planks", color: "#B89773", plankWidth: 15 },
    "#FBF8F1",
    trim("#F4EFE4", "simple"),
    ["#DCE4DB", "#C9B08A"],
  ),
  p(
    "botanical",
    "Botanisch",
    "Botanical",
    ["#EEF0E6", "#87A08C", "#4D6857", "#E0B8A0", "#2A3A2E"],
    { kind: "wallpaper", pattern: "botanical", color: "#EEF0E6", color2: "#6E8F72" },
    { kind: "terrazzo", color: "#EDE7DC", color2: "#87A08C" },
    "#FBF9F4",
    trim("#EEF0E6"),
    ["#4D6857", "#E0B8A0"],
  ),
  p(
    "coastal",
    "Kustgevoel",
    "Coastal",
    ["#F7F6F1", "#DCE9EC", "#7A99A8", "#E6D7BE", "#3E5866"],
    { kind: "panel", panel: "beadboard", color: "#F7F6F1", color2: "#DCE9EC", height: 110 },
    { kind: "planks", color: "#D7C3A3", plankWidth: 18 },
    "#FFFFFF",
    trim("#F7F6F1"),
    ["#DCE9EC", "#7A99A8"],
  ),
  p(
    "mediterranean",
    "Mediterraan",
    "Mediterranean",
    ["#F4EADB", "#D9B48F", "#B9714F", "#5C7A8C", "#6E5B3E"],
    { kind: "limewash", color: "#EFE3CF" },
    { kind: "tiles", color: "#B9714F", jointColor: "#E9DCC6", tileSize: 25 },
    "#F7F1E6",
    trim("#EFE3CF"),
    ["#D9B48F", "#5C7A8C"],
  ),
  p(
    "modern-minimal",
    "Modern minimalistisch",
    "Modern minimal",
    ["#FFFFFF", "#ECEBE8", "#BDBAB3", "#4B4A46", "#2A2620"],
    { kind: "paint", color: "#F4F3F0" },
    { kind: "concrete", color: "#CFCCC6" },
    "#FFFFFF",
    trim("#F4F3F0", "none", false, 4),
    ["#ECEBE8", "#4B4A46"],
  ),
  p(
    "warm-modern",
    "Warm modern",
    "Warm modern",
    ["#EFE6DA", "#C9A98A", "#8B6A4E", "#4A3526", "#A9A58B"],
    { kind: "paint", color: "#E8DCCB" },
    { kind: "planks", color: "#A27A55", plankWidth: 22 },
    "#F6F0E7",
    trim("#E8DCCB"),
    ["#C9A98A", "#4A3526"],
  ),
  p(
    "classic-dutch",
    "Klassiek Hollands",
    "Classic Dutch",
    ["#F2EDE3", "#2F3E4E", "#B08D57", "#8B2F2A", "#5B4636"],
    { kind: "panel", panel: "wainscot", color: "#F2EDE3", color2: "#2F3E4E", height: 100 },
    { kind: "checker", color: "#F2EEE6", color2: "#3D3A35", tileSize: 30 },
    "#FBF9F4",
    trim("#F2EDE3", "simple", true, 12),
    ["#2F3E4E", "#8B2F2A"],
  ),
  p(
    "boho",
    "Boho",
    "Boho",
    ["#F1E7D7", "#D9A577", "#B5654B", "#7A8B5A", "#5A4232"],
    { kind: "limewash", color: "#EADBC4" },
    { kind: "planks", color: "#B08D6A", plankWidth: 14 },
    "#F7F0E4",
    trim("#EADBC4"),
    ["#D9A577", "#7A8B5A"],
  ),
  p(
    "dark-moody",
    "Donker en sfeervol",
    "Dark and moody",
    ["#2E3330", "#4D6857", "#B08D57", "#6B3F2A", "#E9E2D3"],
    { kind: "paint", color: "#2E3A35" },
    { kind: "herringbone", color: "#6B4A33", plankWidth: 9 },
    "#2E3A35",
    trim("#2E3A35", "simple", false, 12),
    ["#6B3F2A", "#B08D57"],
  ),
  p(
    "stripe-classic",
    "Klassieke streep",
    "Classic stripe",
    ["#F4F0E6", "#CBD5C9", "#7A8B99", "#B08D57", "#2A2620"],
    { kind: "wallpaper", pattern: "stripe", color: "#F4F0E6", color2: "#CBD5C9" },
    { kind: "planks", color: "#B48E66", plankWidth: 12 },
    "#FBF9F4",
    trim("#F4F0E6", "simple"),
    ["#7A8B99", "#CBD5C9"],
  ),
  p(
    "terracotta",
    "Terracotta",
    "Terracotta",
    ["#F3E3D3", "#D9A07E", "#B9714F", "#87A08C", "#5A3B2C"],
    { kind: "paint", color: "#E9C9AF" },
    { kind: "tiles", color: "#C77F5A", jointColor: "#E7D2BD", tileSize: 20 },
    "#F8EFE6",
    trim("#F3E3D3"),
    ["#B9714F", "#87A08C"],
  ),
  p(
    "loft",
    "Loft",
    "Loft",
    ["#D8D4CC", "#9C9A94", "#4B4A46", "#B08D57", "#2A2620"],
    { kind: "brick", color: "#B07055" },
    { kind: "planks", color: "#7E5C40", plankWidth: 20 },
    "#E6E3DD",
    trim("#4B4A46", "none", false, 6),
    ["#4B4A46", "#B08D57"],
  ),
];

export function getPreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((x) => x.id === id);
}

/**
 * Apply a preset to the whole version (all rooms follow) or to one room.
 * With `furniture`, items get the preset's furniture colours.
 */
export function applyPreset(
  project: Project,
  presetId: string,
  scope: "all" | Id,
  furniture = false,
  locale: "nl" | "en" = "nl",
): Project {
  const preset = getPreset(presetId);
  if (!preset) return project;
  return updateActiveVersion(project, (v) => {
    if (scope === "all") {
      v.style = { ...structuredClone(preset.style), name: preset.name[locale], presetId };
      for (const r of v.rooms) delete r.style;
      v.wallOverrides = {};
    } else {
      const room = v.rooms.find((r) => r.id === scope);
      if (room)
        room.style = {
          wall: preset.style.wall,
          floor: preset.style.floor,
          ceiling: preset.style.ceiling,
          trim: preset.style.trim,
        };
    }
    if (furniture) {
      for (const item of v.items) {
        if (item.layer !== "furniture") continue;
        item.color = preset.furniture[0];
        item.color2 = preset.furniture[1];
      }
    }
  });
}

// ------------------------------------------------------------ surprise me

/** Small seeded random generator, so "surprise me" can be tested. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(list: readonly T[], r: () => number): T => list[Math.floor(r() * list.length)]!;

function lightness(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  return (((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11) / 255;
}

/** A random but sensible style using only colours from `palette`. */
export function surpriseStyle(
  palette: readonly string[],
  random: () => number,
): Omit<Style, "name"> {
  const sorted = [...palette].sort((a, b) => lightness(b) - lightness(a));
  const light = sorted[0]!;
  const dark = sorted[sorted.length - 1]!;
  const mid = sorted[Math.floor(sorted.length / 2)]!;
  const wallKinds: WallFinish["kind"][] = ["paint", "limewash", "panel", "wallpaper"];
  const kind = pick(wallKinds, random);
  const wall: WallFinish =
    kind === "panel"
      ? {
          kind,
          panel: pick<PanelStyle>(
            ["french", "wainscot", "beadboard", "shaker", "neoclassical"],
            random,
          ),
          color: light,
          color2: pick(sorted.slice(1), random),
          height: pick([100, 120, 260], random),
        }
      : kind === "wallpaper"
        ? {
            kind,
            pattern: pick<WallpaperPattern>(["botanical", "stripe", "toile"], random),
            color: light,
            color2: mid,
          }
        : { kind, color: pick(sorted.slice(0, Math.max(2, sorted.length - 1)), random) };
  const floorKind = pick<FloorFinishKind>(
    ["planks", "herringbone", "chevron", "checker", "tiles", "terrazzo"],
    random,
  );
  const floor: FloorFinish =
    floorKind === "checker"
      ? { kind: floorKind, color: light, color2: dark, tileSize: 40 }
      : floorKind === "terrazzo"
        ? { kind: floorKind, color: light, color2: mid }
        : {
            kind: floorKind,
            color: pick(["#B8916A", "#9C7A58", "#C9A97E", "#7E5C40"], random),
            plankWidth: pick([9, 12, 18], random),
          };
  return {
    wall,
    floor,
    ceiling: light,
    accent: pick(sorted, random),
    trim: trim(
      light,
      pick<Trim["cornice"]>(["none", "simple", "ornate"], random),
      random() > 0.6,
      pick([7, 9, 12], random),
    ),
  };
}

export function applySurprise(
  project: Project,
  palette: readonly string[],
  seed: number,
  scope: "all" | Id,
  name: string,
): Project {
  const style = surpriseStyle(palette, rng(seed));
  return updateActiveVersion(project, (v) => {
    if (scope === "all") {
      v.style = { ...style, name };
      for (const r of v.rooms) delete r.style;
    } else {
      const room = v.rooms.find((r) => r.id === scope);
      if (room)
        room.style = {
          wall: style.wall,
          floor: style.floor,
          ceiling: style.ceiling,
          trim: style.trim,
        };
    }
  });
}

// ---------------------------------------------------------------- looks

/** Snapshot of the active version's look (E09-53). */
export function saveLook(
  project: Project,
  name: string,
  now = new Date(),
): { project: Project; id: Id } {
  const v = getActiveVersion(project);
  const look: Look = {
    id: newId("look"),
    name,
    floorId: getFloor(project).id,
    createdAt: now.toISOString(),
    style: structuredClone(v.style),
    roomStyles: Object.fromEntries(
      v.rooms.filter((r) => r.style).map((r) => [r.id, structuredClone(r.style!)]),
    ),
    wallOverrides: structuredClone(v.wallOverrides),
    itemColors: Object.fromEntries(
      v.items.map((i) => [
        i.id,
        { ...(i.color ? { color: i.color } : {}), ...(i.color2 ? { color2: i.color2 } : {}) },
      ]),
    ),
  };
  return { project: produce(project, (d) => void d.looks.push(look)), id: look.id };
}

/** Put a saved look back on the active version. */
export function applyLook(project: Project, lookId: Id): Project {
  const look = project.looks.find((l) => l.id === lookId);
  if (!look) return project;
  return updateActiveVersion(project, (v) => {
    v.style = structuredClone(look.style);
    for (const r of v.rooms) {
      const s = look.roomStyles[r.id];
      if (s) r.style = structuredClone(s);
      else delete r.style;
    }
    v.wallOverrides = structuredClone(look.wallOverrides);
    for (const item of v.items) {
      const c = look.itemColors[item.id];
      if (!c) continue;
      if (c.color) item.color = c.color;
      else delete item.color;
      if (c.color2) item.color2 = c.color2;
      else delete item.color2;
    }
  });
}

export function removeLook(project: Project, lookId: Id): Project {
  return produce(project, (d) => {
    d.looks = d.looks.filter((l) => l.id !== lookId);
  });
}

// ------------------------------------------------------------- palettes

export interface Palette {
  name: string;
  colors: string[];
}

export const QUICK_PALETTE: Palette = {
  name: "Maison",
  colors: ["#87A08C", "#4D6857", "#A9A58B", "#F5F1E8", "#B08D57", "#4A3526"],
};

const HEX = /^#[0-9A-Fa-f]{6}$/;

/** Short shareable code for a palette: "maison:" + base64url JSON. */
export function encodePalette(p: Palette): string {
  const json = JSON.stringify({ n: p.name, c: p.colors.map((c) => c.slice(1).toUpperCase()) });
  const b64 =
    typeof btoa === "function"
      ? btoa(unescape(encodeURIComponent(json)))
      : Buffer.from(json, "utf8").toString("base64");
  return "maison:" + b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decodePalette(code: string): Palette | null {
  const m = /^maison:([A-Za-z0-9_-]+)$/.exec(code.trim());
  if (!m) return null;
  try {
    const b64 = m[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const json =
      typeof atob === "function"
        ? decodeURIComponent(escape(atob(b64)))
        : Buffer.from(b64, "base64").toString("utf8");
    const raw = JSON.parse(json) as { n?: unknown; c?: unknown };
    if (typeof raw.n !== "string" || !Array.isArray(raw.c)) return null;
    const colors = raw.c.map((c) => `#${String(c)}`).filter((c) => HEX.test(c));
    if (!colors.length || colors.length !== raw.c.length || colors.length > 24) return null;
    return { name: raw.n.slice(0, 60), colors };
  } catch {
    return null;
  }
}
