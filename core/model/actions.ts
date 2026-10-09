import { current, produce, type Draft } from "immer";
import { createFloor, createVersion } from "./defaults";
import { newId } from "./ids";
import type {
  Fixture,
  Floor,
  Id,
  Item,
  Layer,
  LayerState,
  Opening,
  Project,
  Room,
  Side,
  Version,
  WallFinish,
} from "./types";

/**
 * Pure, immutable project updates. Every function returns a new project and
 * shares unchanged branches with the input (immer), so snapshots are cheap
 * for undo/redo and React can compare by reference.
 */

export class ModelError extends Error {
  override name = "ModelError";
}

export function getFloor(project: Project, floorId: Id = project.activeFloorId): Floor {
  const floor = project.floors.find((f) => f.id === floorId);
  if (!floor) throw new ModelError(`Unknown floor ${floorId}`);
  return floor;
}

export function getVersion(floor: Floor, versionId: Id = floor.activeVersionId): Version {
  if (floor.current.id === versionId) return floor.current;
  const design = floor.designs.find((d) => d.id === versionId);
  if (!design) throw new ModelError(`Unknown version ${versionId}`);
  return design;
}

export function getActiveVersion(project: Project): Version {
  return getVersion(getFloor(project));
}

function draftActiveVersion(draft: Draft<Project>): Draft<Version> {
  const floor = draft.floors.find((f) => f.id === draft.activeFloorId);
  if (!floor) throw new ModelError(`Unknown floor ${draft.activeFloorId}`);
  if (floor.current.id === floor.activeVersionId) return floor.current;
  const design = floor.designs.find((d) => d.id === floor.activeVersionId);
  if (!design) throw new ModelError(`Unknown version ${floor.activeVersionId}`);
  return design;
}

/** Apply a recipe to the version that is open in the editor. */
export function updateActiveVersion(
  project: Project,
  recipe: (version: Draft<Version>) => void,
): Project {
  return produce(project, (draft) => {
    recipe(draftActiveVersion(draft));
  });
}

// ---------------------------------------------------------------- project

export function renameProject(project: Project, name: string): Project {
  return produce(project, (d) => {
    d.name = name;
  });
}

export function setLayerState(project: Project, layer: Layer, patch: Partial<LayerState>): Project {
  return produce(project, (d) => {
    Object.assign(d.settings.layers[layer], patch);
  });
}

// ----------------------------------------------------------------- floors

export function addFloor(project: Project, name: string, level?: number): Project {
  return produce(project, (d) => {
    const nextLevel = level ?? Math.max(...d.floors.map((f) => f.level)) + 1;
    const floor = createFloor(name, nextLevel, d.floors[0]?.height);
    d.floors.push(floor);
    d.floors.sort((a, b) => a.level - b.level);
    d.activeFloorId = floor.id;
  });
}

export function removeFloor(project: Project, floorId: Id): Project {
  if (project.floors.length <= 1) throw new ModelError("A project needs at least one floor");
  return produce(project, (d) => {
    d.floors = d.floors.filter((f) => f.id !== floorId);
    if (d.activeFloorId === floorId) d.activeFloorId = d.floors[0]!.id;
  });
}

export function setActiveFloor(project: Project, floorId: Id): Project {
  getFloor(project, floorId);
  return produce(project, (d) => {
    d.activeFloorId = floorId;
  });
}

// --------------------------------------------------------------- versions

/**
 * Start a new design as a copy of the floor's current situation. Child ids
 * are kept so rooms and items can be matched between the two for comparison.
 */
export function createDesign(project: Project, floorId: Id, name: string): Project {
  const copy = structuredClone(getFloor(project, floorId).current);
  const design: Version = { ...copy, id: createVersion().id, name, kind: "design" };
  return produce(project, (d) => {
    const floor = d.floors.find((f) => f.id === floorId)!;
    floor.designs.push(design);
    floor.activeVersionId = design.id;
  });
}

export function removeDesign(project: Project, floorId: Id, designId: Id): Project {
  return produce(project, (d) => {
    const floor = d.floors.find((f) => f.id === floorId);
    if (!floor) throw new ModelError(`Unknown floor ${floorId}`);
    floor.designs = floor.designs.filter((v) => v.id !== designId);
    if (floor.activeVersionId === designId) floor.activeVersionId = floor.current.id;
  });
}

export function setActiveVersion(project: Project, floorId: Id, versionId: Id): Project {
  getVersion(getFloor(project, floorId), versionId);
  return produce(project, (d) => {
    const floor = d.floors.find((f) => f.id === floorId)!;
    floor.activeVersionId = versionId;
  });
}

// ------------------------------------------------------------------ rooms

export function addRoom(project: Project, room: Omit<Room, "id"> & { id?: Id }): Project {
  return updateActiveVersion(project, (v) => {
    v.rooms.push({ ...room, id: room.id ?? newId("room") });
  });
}

export function updateRoom(
  project: Project,
  roomId: Id,
  patch: Partial<Omit<Room, "id">>,
): Project {
  return updateActiveVersion(project, (v) => {
    const room = v.rooms.find((r) => r.id === roomId);
    if (!room) throw new ModelError(`Unknown room ${roomId}`);
    Object.assign(room, patch);
  });
}

export function removeRoom(project: Project, roomId: Id): Project {
  return updateActiveVersion(project, (v) => {
    v.rooms = v.rooms.filter((r) => r.id !== roomId);
  });
}

// ------------------------------------------------------------------ items

export function addItem(project: Project, item: Omit<Item, "id"> & { id?: Id }): Project {
  return updateActiveVersion(project, (v) => {
    v.items.push({ ...item, id: item.id ?? newId("item") });
  });
}

export function updateItems(
  project: Project,
  ids: readonly Id[],
  patch: Partial<Omit<Item, "id">>,
): Project {
  const set = new Set(ids);
  return updateActiveVersion(project, (v) => {
    for (const item of v.items) if (set.has(item.id)) Object.assign(item, patch);
  });
}

export function moveItems(project: Project, ids: readonly Id[], dx: number, dy: number): Project {
  const set = new Set(ids);
  return updateActiveVersion(project, (v) => {
    for (const item of v.items) {
      if (!set.has(item.id) || item.locked) continue;
      item.x += dx;
      item.y += dy;
    }
  });
}

export function normalizeAngle(deg: number): number {
  const r = deg % 360;
  return r < 0 ? r + 360 : r + 0; // + 0 turns -0 into 0
}

/** Rotate items around their own centres by `delta` degrees (clockwise). */
export function rotateItems(project: Project, ids: readonly Id[], delta: number): Project {
  const set = new Set(ids);
  return updateActiveVersion(project, (v) => {
    for (const item of v.items) {
      if (!set.has(item.id) || item.locked) continue;
      item.rotation = normalizeAngle(item.rotation + delta);
    }
  });
}

export function removeItems(project: Project, ids: readonly Id[]): Project {
  const set = new Set(ids);
  return updateActiveVersion(project, (v) => {
    v.items = v.items.filter((i) => !set.has(i.id));
  });
}

/**
 * Copy items with a small offset. Groups are copied as new groups.
 * Returns the new project and the ids of the copies (in input order).
 */
export function duplicateItems(
  project: Project,
  ids: readonly Id[],
  offset = 20,
): { project: Project; ids: Id[] } {
  const created: Id[] = [];
  const next = updateActiveVersion(project, (v) => {
    const groupMap = new Map<Id, Id>();
    for (const id of ids) {
      const src = v.items.find((i) => i.id === id);
      if (!src) continue;
      const copy: Item = { ...current(src), id: newId("item") };
      copy.x += offset;
      copy.y += offset;
      if (src.groupId) {
        if (!groupMap.has(src.groupId)) groupMap.set(src.groupId, newId("group"));
        copy.groupId = groupMap.get(src.groupId);
      }
      v.items.push(copy);
      created.push(copy.id);
    }
  });
  return { project: next, ids: created };
}

export function groupItems(
  project: Project,
  ids: readonly Id[],
): { project: Project; groupId: Id } {
  if (ids.length < 2) throw new ModelError("A group needs at least two items");
  const groupId = newId("group");
  return { project: updateItems(project, ids, { groupId }), groupId };
}

export function ungroupItems(project: Project, groupId: Id): Project {
  return updateActiveVersion(project, (v) => {
    for (const item of v.items) if (item.groupId === groupId) delete item.groupId;
  });
}

/** Expand a selection so whole groups are selected together. */
export function expandToGroups(items: readonly Item[], ids: readonly Id[]): Id[] {
  const set = new Set(ids);
  const groups = new Set(items.filter((i) => set.has(i.id) && i.groupId).map((i) => i.groupId));
  for (const item of items) if (item.groupId && groups.has(item.groupId)) set.add(item.id);
  return items.filter((i) => set.has(i.id)).map((i) => i.id);
}

// --------------------------------------------------------------- openings

export function addOpening(project: Project, opening: Opening): Project {
  return updateActiveVersion(project, (v) => {
    v.openings.push(opening);
  });
}

export function updateOpening(project: Project, id: Id, patch: Partial<Opening>): Project {
  return updateActiveVersion(project, (v) => {
    const o = v.openings.find((x) => x.id === id);
    if (!o) throw new ModelError(`Unknown opening ${id}`);
    if (patch.kind && patch.kind !== o.kind) throw new ModelError("Cannot change opening kind");
    Object.assign(o, patch);
  });
}

export function removeOpening(project: Project, id: Id): Project {
  return updateActiveVersion(project, (v) => {
    v.openings = v.openings.filter((o) => o.id !== id);
  });
}

// --------------------------------------------------------------- fixtures

export function addFixture(project: Project, fixture: Omit<Fixture, "id"> & { id?: Id }): Project {
  return updateActiveVersion(project, (v) => {
    v.fixtures.push({ ...fixture, id: fixture.id ?? newId("fix") });
  });
}

/**
 * Update a fixture. Locked fixtures only accept changes to `locked` itself,
 * so they cannot be moved or resized by accident.
 */
export function updateFixture(
  project: Project,
  id: Id,
  patch: Partial<Omit<Fixture, "id">>,
): Project {
  return updateActiveVersion(project, (v) => {
    const f = v.fixtures.find((x) => x.id === id);
    if (!f) throw new ModelError(`Unknown fixture ${id}`);
    const keys = Object.keys(patch);
    if (f.locked && keys.some((k) => k !== "locked")) return;
    Object.assign(f, patch);
  });
}

export function removeFixture(project: Project, id: Id): Project {
  return updateActiveVersion(project, (v) => {
    v.fixtures = v.fixtures.filter((f) => f.id !== id);
  });
}

// ---------------------------------------------------------- wall finishes

/** Set (or with `undefined`, reset) the finish of one side of one wall. */
export function setWallOverride(
  project: Project,
  wallId: Id,
  side: Side,
  finish: WallFinish | undefined,
): Project {
  return updateActiveVersion(project, (v) => {
    const entry = v.wallOverrides[wallId] ?? {};
    if (finish) entry[side] = finish;
    else delete entry[side];
    if (Object.keys(entry).length === 0) delete v.wallOverrides[wallId];
    else v.wallOverrides[wallId] = entry;
  });
}

export function updateFloor(
  project: Project,
  floorId: Id,
  patch: Partial<Pick<Floor, "name" | "height">>,
): Project {
  getFloor(project, floorId);
  return produce(project, (d) => {
    Object.assign(
      d.floors.find((f) => f.id === floorId)!,
      patch,
    );
  });
}

/**
 * Move a floor one place up (+1) or down (-1) in the stack. Levels are
 * swapped with the neighbour, so the order and the level numbers stay in step.
 */
export function moveFloor(project: Project, floorId: Id, direction: 1 | -1): Project {
  const sorted = [...project.floors].sort((a, b) => a.level - b.level);
  const i = sorted.findIndex((f) => f.id === floorId);
  if (i < 0) throw new ModelError(`Unknown floor ${floorId}`);
  const j = i + direction;
  if (j < 0 || j >= sorted.length) return project;
  const a = sorted[i]!,
    b = sorted[j]!;
  return produce(project, (d) => {
    const da = d.floors.find((f) => f.id === a.id)!;
    const db = d.floors.find((f) => f.id === b.id)!;
    [da.level, db.level] = [b.level, a.level];
    d.floors.sort((x, y) => x.level - y.level);
  });
}

export function renameVersion(project: Project, floorId: Id, versionId: Id, name: string): Project {
  return produce(project, (d) => {
    const floor = d.floors.find((f) => f.id === floorId);
    if (!floor) throw new ModelError(`Unknown floor ${floorId}`);
    const v =
      floor.current.id === versionId
        ? floor.current
        : floor.designs.find((x) => x.id === versionId);
    if (!v) throw new ModelError(`Unknown version ${versionId}`);
    v.name = name;
  });
}

/** The floor directly below `floorId`, if any. */
export function floorBelow(project: Project, floorId: Id): Floor | undefined {
  const floor = getFloor(project, floorId);
  return [...project.floors]
    .filter((f) => f.level < floor.level)
    .sort((a, b) => b.level - a.level)[0];
}

/** The floor directly above `floorId`, if any. */
export function floorAbove(project: Project, floorId: Id): Floor | undefined {
  const floor = getFloor(project, floorId);
  return [...project.floors]
    .filter((f) => f.level > floor.level)
    .sort((a, b) => a.level - b.level)[0];
}

/** Replace the current situation of a floor (e.g. after importing a plan). */
export function replaceCurrent(project: Project, floorId: Id, source: Floor): Project {
  return produce(project, (d) => {
    const floor = d.floors.find((f) => f.id === floorId);
    if (!floor) throw new ModelError(`Unknown floor ${floorId}`);
    floor.current = {
      ...source.current,
      id: floor.current.id,
      kind: "current",
      name: floor.current.name,
    };
    floor.height = source.height;
    floor.activeVersionId = floor.current.id;
  });
}

/** Add floors on top of the existing ones, keeping their order. */
export function appendFloors(project: Project, floors: readonly Floor[]): Project {
  if (!floors.length) return project;
  return produce(project, (d) => {
    let level = Math.max(...d.floors.map((f) => f.level));
    for (const f of [...floors].sort((a, b) => a.level - b.level))
      d.floors.push({ ...f, level: ++level });
    d.activeFloorId = d.floors[d.floors.length - floors.length]!.id;
  });
}
