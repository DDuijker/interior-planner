import { produce } from "immer";
import { roomLabelAnchor } from "@/core/editor/rooms";
import { rectCenter } from "@/core/geometry/rect";
import type { Cardinal, Id, Photo, Point, Project, Room, Side, Wall } from "@/core/model/types";
import type { Viewpoint } from "@/core/scene/scene";

/**
 * Photo library and moodboard (E13-71, 72, 74). The images themselves live
 * in IndexedDB; the project only holds the metadata.
 */

export function addPhoto(project: Project, photo: Photo, moodboardOf?: Id): Project {
  return produce(project, (d) => {
    d.photos.push(photo);
    if (moodboardOf) {
      for (const f of d.floors)
        for (const v of [f.current, ...f.designs])
          if (v.id === moodboardOf && !v.moodboard.includes(photo.id)) v.moodboard.push(photo.id);
    }
  });
}

export function updatePhoto(project: Project, id: Id, patch: Partial<Omit<Photo, "id">>): Project {
  return produce(project, (d) => {
    const p = d.photos.find((x) => x.id === id);
    if (!p) return;
    Object.assign(p, patch);
    // `undefined` in the patch removes the field.
    for (const [k, v] of Object.entries(patch)) if (v === undefined) delete p[k as keyof Photo];
  });
}

/** Remove a photo and every reference to it (moodboards). */
export function removePhoto(project: Project, id: Id): Project {
  return produce(project, (d) => {
    d.photos = d.photos.filter((p) => p.id !== id);
    for (const f of d.floors)
      for (const v of [f.current, ...f.designs]) v.moodboard = v.moodboard.filter((m) => m !== id);
  });
}

export function setMoodboard(project: Project, versionId: Id, ids: readonly Id[]): Project {
  return produce(project, (d) => {
    for (const f of d.floors)
      for (const v of [f.current, ...f.designs]) if (v.id === versionId) v.moodboard = [...ids];
  });
}

/** Move an entry within a list, for drag-to-order and keyboard buttons. */
export function reorder<T>(list: readonly T[], from: number, to: number): T[] {
  const out = [...list];
  if (from < 0 || from >= out.length) return out;
  const [item] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, item as T);
  return out;
}

// ------------------------------------------------------------- source link

/**
 * Normalise a link the user pasted (e.g. a Pinterest pin). It is only
 * stored and shown as a link; the app never fetches it.
 */
export function cleanSourceUrl(input: string): string | undefined {
  const text = input.trim();
  if (!text) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
    if (!url.hostname.includes(".")) return undefined;
    // Tracking parameters say nothing about the picture.
    for (const k of [...url.searchParams.keys()])
      if (/^utm_|^fbclid$|^gclid$/i.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return undefined;
  }
}

export function isPinterest(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return /(^|\.)pinterest\.[a-z.]+$/i.test(host) || host === "pin.it";
  } catch {
    return false;
  }
}

// ------------------------------------------------------------- walls of a room

/**
 * The walls around a room by compass side, with the side of each wall that
 * faces the room. Plan north is up (y down), as everywhere in the app.
 */
export function roomWalls(
  walls: readonly Wall[],
  roomId: Id,
): Record<Cardinal, { wall: Wall; side: Side }[]> {
  const out: Record<Cardinal, { wall: Wall; side: Side }[]> = { N: [], E: [], S: [], W: [] };
  for (const wall of walls) {
    const horizontal = wall.rect.w >= wall.rect.d;
    // Side a is north/west of the wall. A room on side a sees this wall to its south/east.
    if (wall.rooms.a === roomId) out[horizontal ? "S" : "E"].push({ wall, side: "a" });
    if (wall.rooms.b === roomId) out[horizontal ? "N" : "W"].push({ wall, side: "b" });
  }
  return out;
}

/** The compass side of a room a wall is on, if the wall borders it. */
export function wallDirection(
  walls: readonly Wall[],
  roomId: Id,
  wallId: Id,
): Cardinal | undefined {
  const all = roomWalls(walls, roomId);
  return (Object.keys(all) as Cardinal[]).find((c) => all[c].some((w) => w.wall.id === wallId));
}

// ------------------------------------------------------------- standpoint

const DIR_DEG: Record<Cardinal, number> = { N: 0, E: 90, S: 180, W: 270 };

/** Unit vector for a plan direction in degrees: 0 = up (north), clockwise. */
export function dirVector(deg: number): Point {
  const r = (deg * Math.PI) / 180;
  return { x: Math.sin(r), y: -Math.cos(r) };
}

/** Direction in degrees (0 = north, clockwise) from one point to another. */
export function dirTo(from: Point, to: Point): number {
  const deg = (Math.atan2(to.x - from.x, -(to.y - from.y)) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

/**
 * Where a photo was taken from and where it looks, in plan coordinates.
 * An explicit standpoint wins; otherwise stand in the room and face the
 * linked wall; otherwise the room's own default view.
 */
export function photoStandpoint(
  link: NonNullable<Photo["link"]>,
  rooms: readonly Room[],
  walls: readonly Wall[],
): { at: Point; dir: number } | undefined {
  const room = rooms.find((r) => r.id === link.roomId);
  if (link.at) {
    return { at: link.at, dir: link.dir ?? 0 };
  }
  const wall = walls.find((w) => w.id === link.wallId);
  if (wall) {
    const centre = rectCenter(wall.rect);
    const roomId = link.roomId ?? (link.side === "b" ? wall.rooms.b : wall.rooms.a);
    const r = rooms.find((x) => x.id === roomId);
    const horizontal = wall.rect.w >= wall.rect.d;
    // Stand a few metres back from the wall, on the room's side.
    const back = 300;
    const facingSide = link.side ?? (r && wall.rooms.b === r.id ? "b" : "a");
    const sign = facingSide === "a" ? -1 : 1;
    const at = horizontal
      ? { x: centre.x, y: centre.y + sign * back }
      : { x: centre.x + sign * back, y: centre.y };
    const anchor = r ? roomLabelAnchor(r) : at;
    // Do not stand outside the room: use the room centre if it is closer.
    const stand = Math.hypot(anchor.x - centre.x, anchor.y - centre.y) < back ? anchor : at;
    return { at: stand, dir: dirTo(stand, centre) };
  }
  if (room) {
    const c = roomLabelAnchor(room);
    return { at: c, dir: link.dir ?? 0 };
  }
  return undefined;
}

/** 3D viewpoint for a standpoint, at eye height, to compare with the photo. */
export function standpointView(
  sp: { at: Point; dir: number },
  eyeHeight: number,
  base = 0,
): Viewpoint {
  const v = dirVector(sp.dir);
  return {
    position: { x: sp.at.x, y: sp.at.y, z: base + eyeHeight },
    target: { x: sp.at.x + v.x * 200, y: sp.at.y + v.y * 200, z: base + eyeHeight * 0.9 },
  };
}

/** Compass direction for a wall link or N/E/S/W. */
export function cardinalDeg(c: Cardinal): number {
  return DIR_DEG[c];
}

/** Photos linked to a floor, for the camera icons in 2D. */
export function photosOnFloor(project: Project, floorId: Id): Photo[] {
  return project.photos.filter((p) => p.link?.floorId === floorId);
}
