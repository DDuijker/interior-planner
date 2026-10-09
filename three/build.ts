import * as THREE from "three";
import { itemParts, partColor, resolveEntry } from "@/catalog";
import { roomLabelAnchor } from "@/core/editor/rooms";
import { fixtureHeight } from "@/core/fixtures/fixtures";
import { subtractRect } from "@/core/geometry/rect";
import type {
  CustomItemDef,
  Floor,
  Id,
  Item,
  Project,
  Rect,
  Room,
  Version,
} from "@/core/model/types";
import { cutWalls, doorSwing } from "@/core/openings/openings";
import { stairSteps, stairwell } from "@/core/scene/scene";
import { floorPattern, wallPattern, shade } from "@/core/style/patterns";
import { resolveRoomStyle, resolveWallFinish } from "@/core/style/style";
import { generateWalls, isHorizontal } from "@/core/walls/generate";
import type { SceneCache } from "./materials";

/**
 * Builds three.js objects from the model. Plan (x, y) maps to world (X, Z),
 * height maps to world Y. One unit is one centimetre.
 */

export interface PickInfo {
  type: "item" | "wall" | "floor" | "fixture";
  id: Id;
  floorId: Id;
  /** Walls: which material index is side a / side b. */
  sides?: { a: number; b: number };
}

export interface LampInfo {
  id: Id;
  position: THREE.Vector3;
  color: string;
  intensity: number;
}

export interface FloorBuild {
  group: THREE.Group;
  lamps: LampInfo[];
  /** Wall meshes, for the dollhouse fade. */
  walls: THREE.Mesh[];
  /** Obstacles for walking: full-height wall pieces in plan coordinates. */
  obstacles: Rect[];
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function activeVersion(floor: Floor): Version {
  return floor.designs.find((d) => d.id === floor.activeVersionId) ?? floor.current;
}

function roomRects(room: Room): Rect[] {
  if (room.shape.kind === "rects") return room.shape.rects;
  return [];
}

function shapeFromPoints(points: { x: number; y: number }[]): THREE.Shape {
  const s = new THREE.Shape();
  points.forEach((p, i) => (i ? s.lineTo(p.x, p.y) : s.moveTo(p.x, p.y)));
  s.closePath();
  return s;
}

/** Horizontal slab in plan coordinates at height y. Materials are double-sided. */
function slab(
  shape: THREE.Shape,
  y: number,
  material: THREE.Material,
  w: number,
  d: number,
  origin: { x: number; y: number },
): THREE.Mesh {
  const geo = new THREE.ShapeGeometry(shape);
  // Map UVs to the room's bounding box so a texture covers it once.
  const pos = geo.attributes.position!;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = (pos.getX(i) - origin.x) / w;
    uv[i * 2 + 1] = 1 - (pos.getY(i) - origin.y) / d;
  }
  geo.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  // The shape lies in XY; turn it so plan y becomes world Z.
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = y;
  return mesh;
}

export interface BuildOptions {
  cache: SceneCache;
  custom: readonly CustomItemDef[];
  ceilings: boolean;
  decor: boolean;
  showLife: boolean;
  /** Stairwells to cut out of this floor (from the floor below). */
  holes: Rect[];
  shadows: boolean;
}

/** Architecture of one floor: floors, walls, ceilings, openings, fixtures. */
export function buildArchitecture(
  floor: Floor,
  version: Version,
  project: Project,
  opts: BuildOptions,
): FloorBuild {
  const { cache } = opts;
  const group = new THREE.Group();
  group.name = `floor:${floor.id}`;
  const height = floor.height;
  const settings = project.settings;
  const walls = generateWalls(version.rooms, version.extraWalls, {
    interior: settings.wallThickness.interior,
    exterior: settings.wallThickness.exterior,
    height,
    lowHeight: settings.lowWallHeight,
  });
  const pieces = cutWalls(walls, version.openings, true, version.demolitions);
  const wallMeshes: THREE.Mesh[] = [];
  const obstacles: Rect[] = [];
  const plaster = cache.plain("#EDE8DE");

  // ---- floors and ceilings per room
  for (const room of version.rooms) {
    const style = resolveRoomStyle(version, room);
    const parts: { shape: THREE.Shape; rect: Rect }[] = [];
    if (room.shape.kind === "polygon") {
      const xs = room.shape.points.map((p) => p.x),
        ys = room.shape.points.map((p) => p.y);
      const rect = {
        x: Math.min(...xs),
        y: Math.min(...ys),
        w: Math.max(...xs) - Math.min(...xs),
        d: Math.max(...ys) - Math.min(...ys),
      };
      parts.push({ shape: shapeFromPoints(room.shape.points), rect });
    } else {
      for (const r of roomRects(room)) {
        let pieces2 = [r];
        for (const hole of opts.holes) pieces2 = pieces2.flatMap((p) => subtractRect(p, hole));
        for (const p of pieces2) {
          parts.push({
            shape: shapeFromPoints([
              { x: p.x, y: p.y },
              { x: p.x + p.w, y: p.y },
              { x: p.x + p.w, y: p.y + p.d },
              { x: p.x, y: p.y + p.d },
            ]),
            rect: r,
          });
        }
      }
    }
    const f = style.floor;
    for (const { shape, rect } of parts) {
      const pattern = floorPattern(f, rect.w, rect.d, hash(room.id));
      const mat =
        f.kind === "current"
          ? cache.plain(f.color ?? "#C9B8A0", 0.85, true)
          : cache.texturedMaterial(
              `floor:${JSON.stringify(f)}:${room.id}`,
              pattern,
              rect.w,
              rect.d,
              true,
            );
      const mesh = slab(shape, 0.2, mat, rect.w, rect.d, rect);
      mesh.receiveShadow = opts.shadows;
      mesh.userData.pick = { type: "floor", id: room.id, floorId: floor.id } satisfies PickInfo;
      group.add(mesh);
      if (opts.ceilings) {
        const ceil = slab(
          shape,
          height,
          cache.plain(style.ceiling ?? "#FBF9F4", 1, true),
          rect.w,
          rect.d,
          rect,
        );
        ceil.name = "ceiling";
        group.add(ceil);
      }
    }
    if (opts.ceilings && style.trim.rosette) {
      const c = roomLabelAnchor(room);
      const rose = new THREE.Mesh(cache.cylinder, cache.plain(style.ceiling ?? "#FBF9F4", 0.7));
      rose.scale.set(60, 3, 60);
      rose.position.set(c.x, height - 1.5, c.y);
      rose.name = "ceiling";
      group.add(rose);
    }
  }

  // ---- walls
  for (const piece of pieces) {
    const wall = walls.find((w) => w.id === piece.wallId)!;
    const r = piece.rect;
    const h = piece.z1 - piece.z0;
    const horizontal = isHorizontal(wall.rect);
    const full = piece.z0 === 0 && piece.z1 >= wall.height - 0.5;
    const faceMaterial = (side: "a" | "b") => {
      const finish = resolveWallFinish(version, wall, side);
      const color = finish.color ?? "#F4F1EA";
      if (finish.kind === "current" || finish.kind === "paint" || !full) {
        // Lintels and sills take the plain colour (or the panel colour low down).
        const below = finish.kind === "panel" && piece.z1 <= (finish.height ?? wall.height);
        return cache.plain(below ? (finish.color2 ?? color) : color, 0.95);
      }
      const length = horizontal ? r.w : r.d;
      return cache.texturedMaterial(
        `wall:${JSON.stringify(finish)}`,
        wallPattern(finish, length, h, hash(wall.id)),
        length,
        h,
      );
    };
    const mats: THREE.Material[] = [plaster, plaster, plaster, plaster, plaster, plaster];
    // BoxGeometry faces: +x, -x, +y, -y, +z, -z. Side a is north (-z) or west (-x).
    const sides = horizontal ? { a: 5, b: 4 } : { a: 1, b: 0 };
    mats[sides.a] = faceMaterial("a");
    mats[sides.b] = faceMaterial("b");
    const mesh = new THREE.Mesh(cache.box, mats);
    mesh.scale.set(r.w, h, r.d);
    mesh.position.set(r.x + r.w / 2, piece.z0 + h / 2, r.y + r.d / 2);
    mesh.castShadow = opts.shadows;
    mesh.receiveShadow = opts.shadows;
    mesh.userData.pick = { type: "wall", id: wall.id, floorId: floor.id, sides } satisfies PickInfo;
    mesh.userData.wallKind = wall.kind;
    group.add(mesh);
    wallMeshes.push(mesh);
    if (piece.z0 === 0 && piece.z1 > 100) obstacles.push(r);

    // Skirting and cornice on full-height pieces, on the sides that face a room.
    if (full && wall.kind !== "low") {
      for (const side of ["a", "b"] as const) {
        const roomId = wall.rooms[side];
        if (!roomId) continue;
        const trim = resolveRoomStyle(
          version,
          version.rooms.find((x) => x.id === roomId),
        ).trim;
        const sign = side === "a" ? -1 : 1;
        const strip = (z: number, hh: number, depth: number, color: string) => {
          const m = new THREE.Mesh(cache.box, cache.plain(color, 0.6));
          if (horizontal) {
            m.scale.set(r.w, hh, depth);
            m.position.set(r.x + r.w / 2, z + hh / 2, r.y + r.d / 2 + sign * (r.d / 2 + depth / 2));
          } else {
            m.scale.set(depth, hh, r.d);
            m.position.set(r.x + r.w / 2 + sign * (r.w / 2 + depth / 2), z + hh / 2, r.y + r.d / 2);
          }
          group.add(m);
        };
        if (trim.skirting && trim.skirting.style !== "none")
          strip(
            0,
            trim.skirting.height,
            trim.skirting.style === "ogee" ? 2 : 1.4,
            trim.skirting.color ?? "#FBF9F4",
          );
        if (opts.ceilings && trim.cornice && trim.cornice !== "none") {
          const ch = trim.cornice === "ornate" ? 14 : 8;
          strip(height - ch, ch, trim.cornice === "ornate" ? 6 : 4, version.style.ceiling);
        }
      }
    }
  }

  // ---- windows and doors
  for (const o of version.openings) {
    const wall = walls.find((w) => w.id === o.wallId);
    const t = wall ? (o.dir === "h" ? wall.rect.d : wall.rect.w) : 10;
    const frameColor = version.style.trim.frameColor ?? "#FBF9F4";
    const along = (
      len: number,
      depth: number,
      z0: number,
      hh: number,
      offset = 0,
      mat: THREE.Material = cache.plain(frameColor, 0.5),
    ) => {
      const m = new THREE.Mesh(cache.box, mat);
      if (o.dir === "h") {
        m.scale.set(len, hh, depth);
        m.position.set(o.x + o.w / 2 + offset, z0 + hh / 2, o.y);
      } else {
        m.scale.set(depth, hh, len);
        m.position.set(o.x, z0 + hh / 2, o.y + o.w / 2 + offset);
      }
      group.add(m);
      return m;
    };
    if (o.kind === "window") {
      const glass = cache.partMaterial("glass", "#CFE3E8");
      along(o.w - 4, 1, o.sill, o.lintel - o.sill, 0, glass);
      // Frame: sill and head and two jambs.
      along(o.w, t * 0.6, o.sill - 3, 3);
      along(o.w, t * 0.4, o.lintel, 3);
      along(4, t * 0.4, o.sill, o.lintel - o.sill, -o.w / 2 + 2);
      along(4, t * 0.4, o.sill, o.lintel - o.sill, o.w / 2 - 2);
      if (!o.glass && o.w > 90) along(3, t * 0.4, o.sill, o.lintel - o.sill, 0);
    } else if (o.kind === "door") {
      along(5, t + 2, 0, o.height, -o.w / 2 - 2.5);
      along(5, t + 2, 0, o.height, o.w / 2 + 2.5);
      along(o.w + 10, t + 2, o.height, 5);
      // Leaf, open about 70 degrees into the swing side.
      const s = doorSwing(o, t);
      const leaf = new THREE.Mesh(cache.box, cache.plain(shade(frameColor, -0.05), 0.6));
      leaf.scale.set(o.w - 2, o.height - 2, 4);
      const pivot = new THREE.Group();
      pivot.position.set(s.hinge.x, 0, s.hinge.y);
      const closedAngle = Math.atan2(s.closed.y - s.hinge.y, s.closed.x - s.hinge.x);
      const openAngle = Math.atan2(s.open.y - s.hinge.y, s.open.x - s.hinge.x);
      const a = closedAngle + (openAngle - closedAngle) * 0.75;
      leaf.position.set((o.w - 2) / 2, (o.height - 2) / 2, 0);
      pivot.rotation.y = -a;
      pivot.add(leaf);
      group.add(pivot);
    }
  }

  // ---- fixtures and stairs
  for (const f of version.fixtures) {
    if (f.type === "stairs") {
      const mat = cache.plain("#B8916A", 0.7);
      for (const step of stairSteps(f, height)) {
        const m = new THREE.Mesh(cache.box, mat);
        const hh = Math.max(4, step.z1 - Math.max(0, step.z1 - 22));
        m.scale.set(step.w, hh, step.d);
        m.position.set(step.x, step.z1 - hh / 2, step.y);
        m.rotation.y = (-step.rotation * Math.PI) / 180;
        m.castShadow = opts.shadows;
        group.add(m);
      }
      continue;
    }
    const h = fixtureHeight(f, height);
    const color = f.type === "kitchen" ? version.style.accent : "#F7F5F0";
    const mesh = new THREE.Mesh(cache.box, cache.plain(color, 0.5));
    mesh.scale.set(f.w, h, f.d);
    const pivot = new THREE.Group();
    pivot.position.set(f.x + f.w / 2, 0, f.y + f.d / 2);
    pivot.rotation.y = (-f.rotation * Math.PI) / 180;
    mesh.position.y = h / 2;
    mesh.userData.pick = { type: "fixture", id: f.id, floorId: floor.id } satisfies PickInfo;
    pivot.add(mesh);
    if (f.type === "kitchen") {
      const top = new THREE.Mesh(cache.box, cache.plain("#D9D4C7", 0.4));
      top.scale.set(f.w + 2, 4, f.d + 2);
      top.position.y = h + 2;
      pivot.add(top);
    }
    group.add(pivot);
  }

  return { group, lamps: [], walls: wallMeshes, obstacles };
}

/** Floor height to the ceiling minus an item: where a ceiling lamp hangs. */
function itemBase(item: Item, floorHeight: number): number {
  if (item.mount === "wall" && item.layer === "lighting" && item.elevation === 0)
    return floorHeight - item.h;
  return item.elevation;
}

/** One item as a group of part meshes. */
export function buildItem(
  item: Item,
  floor: Floor,
  opts: Pick<BuildOptions, "cache" | "custom" | "shadows">,
): { group: THREE.Group; lamp?: LampInfo } {
  const { cache } = opts;
  const entry = resolveEntry(item, opts.custom);
  const g = new THREE.Group();
  g.name = `item:${item.id}`;
  const base = itemBase(item, floor.height);
  g.position.set(item.x, base, item.y);
  g.rotation.y = (-item.rotation * Math.PI) / 180;
  for (const part of itemParts(item, opts.custom)) {
    const geo =
      part.shape === "box"
        ? cache.box
        : part.shape === "cylinder"
          ? cache.cylinder
          : part.shape === "sphere"
            ? cache.sphere
            : cache.cone;
    const color = partColor(part, item, entry);
    const mat = cache.partMaterial(
      part.material === "light" && item.light && !item.light.on ? "white" : part.material,
      part.material === "light" && item.light ? item.light.color : color,
    );
    const m = new THREE.Mesh(geo, mat);
    m.scale.set(Math.max(0.5, part.w), Math.max(0.5, part.h), Math.max(0.5, part.d));
    m.position.set(part.x, part.z + part.h / 2, part.y);
    m.castShadow = opts.shadows && part.material !== "glass";
    m.receiveShadow = opts.shadows;
    m.userData.pick = { type: "item", id: item.id, floorId: floor.id } satisfies PickInfo;
    g.add(m);
  }
  let lamp: LampInfo | undefined;
  if (item.light?.on) {
    const lightParts = itemParts(item, opts.custom).filter(
      (p) => p.material === "light" || p.material === "second",
    );
    const top = lightParts.length
      ? Math.max(...lightParts.map((p) => p.z + p.h / 2))
      : item.h * 0.8;
    lamp = {
      id: item.id,
      position: new THREE.Vector3(item.x, base + top, item.y),
      color: item.light.color,
      intensity: item.light.intensity,
    };
  }
  return { group: g, lamp };
}

/** Stairwells cut into a floor: the stairs on the floor below. */
export function holesFor(project: Project, floor: Floor): Rect[] {
  const below = [...project.floors]
    .filter((f) => f.level < floor.level)
    .sort((a, b) => b.level - a.level)[0];
  if (!below) return [];
  return activeVersion(below)
    .fixtures.filter((f) => f.type === "stairs")
    .map(stairwell);
}
