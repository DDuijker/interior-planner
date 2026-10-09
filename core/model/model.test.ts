import { describe, expect, it } from "vitest";
import {
  addFloor,
  addFixture,
  addItem,
  addOpening,
  addRoom,
  createDesign,
  createProject,
  duplicateItems,
  expandToGroups,
  getActiveVersion,
  getFloor,
  groupItems,
  loadProject,
  migrate,
  MigrationError,
  ModelError,
  moveItems,
  normalizeAngle,
  removeDesign,
  removeFixture,
  removeFloor,
  removeItems,
  removeOpening,
  removeRoom,
  renameProject,
  rotateItems,
  SCHEMA_VERSION,
  setActiveFloor,
  setActiveVersion,
  setLayerState,
  setWallOverride,
  ungroupItems,
  updateFixture,
  updateItems,
  updateOpening,
  updateRoom,
  validateProject,
  type Item,
  type Migration,
  type Project,
} from "./index";

function sofa(overrides: Partial<Item> = {}): Omit<Item, "id"> & { id?: string } {
  return {
    catalogId: "sofa-3",
    name: "Bank 3-zits",
    x: 200,
    y: 150,
    w: 220,
    d: 95,
    h: 85,
    rotation: 0,
    shape: "rect",
    layer: "furniture",
    mount: "floor",
    elevation: 0,
    ...overrides,
  };
}

function withSofa(): Project {
  return addItem(createProject("Test"), sofa({ id: "sofa" }));
}

describe("createProject", () => {
  it("stamps the current schema version", () => {
    expect(createProject().schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("produces a project that passes the schema", () => {
    const result = validateProject(createProject());
    expect(result.ok).toBe(true);
  });

  it("starts with one ground floor whose current situation is active", () => {
    const p = createProject();
    expect(p.floors).toHaveLength(1);
    const floor = getFloor(p);
    expect(floor.level).toBe(0);
    expect(floor.activeVersionId).toBe(floor.current.id);
    expect(floor.current.kind).toBe("current");
  });

  it("uses unique ids", () => {
    const a = createProject();
    const b = createProject();
    expect(a.id).not.toBe(b.id);
    expect(a.floors[0]!.id).not.toBe(b.floors[0]!.id);
  });

  it("defaults to cm and an 80 cm clearance", () => {
    const { settings } = createProject();
    expect(settings.unit).toBe("cm");
    expect(settings.clearance).toBe(80);
    expect(Object.values(settings.layers).every((l) => l.visible && !l.locked)).toBe(true);
  });
});

describe("validateProject", () => {
  it("rejects non-objects", () => {
    expect(validateProject(null).ok).toBe(false);
    expect(validateProject("nope").ok).toBe(false);
  });

  it("reports the path of a bad field", () => {
    const p = withSofa();
    const broken = structuredClone(p) as unknown as {
      floors: { current: { items: { w: unknown }[] } }[];
    };
    broken.floors[0]!.current.items[0]!.w = "wide";
    const result = validateProject(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]!.path).toBe("floors.0.current.items.0.w");
  });

  it("rejects negative sizes and bad colours", () => {
    const p = structuredClone(withSofa());
    p.floors[0]!.current.items[0]!.d = -5;
    p.floors[0]!.current.style.accent = "green";
    const result = validateProject(p);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues).toHaveLength(2);
  });

  it("rejects an unknown active floor or version", () => {
    const p = structuredClone(createProject());
    p.activeFloorId = "nope";
    p.floors[0]!.activeVersionId = "nope";
    const result = validateProject(p);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.path).sort()).toEqual([
        "activeFloorId",
        "floors.0.activeVersionId",
      ]);
    }
  });

  it("rejects a project without floors", () => {
    const p = structuredClone(createProject());
    p.floors = [];
    expect(validateProject(p).ok).toBe(false);
  });

  it("survives a JSON roundtrip", () => {
    const p = addRoom(withSofa(), {
      name: "Woonkamer",
      type: "living",
      shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 400, d: 300 }] },
    });
    const result = validateProject(JSON.parse(JSON.stringify(p)));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.project).toEqual(p);
  });
});

describe("migrate", () => {
  it("leaves current documents alone", () => {
    const p = createProject();
    expect(migrate(p)).toBe(p);
  });

  it("upgrades unversioned (v0) documents to v1", () => {
    const { schemaVersion: _drop, createdAt: _c, updatedAt: _u, ...legacy } = createProject();
    const out = migrate(legacy, 1);
    expect(out.schemaVersion).toBe(1);
    expect(typeof out.createdAt).toBe("string");
    expect(legacy).not.toHaveProperty("schemaVersion");
  });

  it("runs every step in order and never mutates the input", () => {
    const chain: Record<number, Migration> = {
      1: (d) => ({ ...d, schemaVersion: 2, a: 1 }),
      2: (d) => ({ ...d, schemaVersion: 3, b: (d.a as number) + 1 }),
    };
    const input = Object.freeze({ schemaVersion: 1 });
    expect(migrate(input, 3, chain)).toEqual({ schemaVersion: 3, a: 1, b: 2 });
  });

  it("fails on a missing step", () => {
    expect(() => migrate({ schemaVersion: 1 }, 3, {})).toThrow(/No migration from schema 1/);
  });

  it("fails when a step forgets to bump the version", () => {
    const chain: Record<number, Migration> = { 1: (d) => ({ ...d }) };
    expect(() => migrate({ schemaVersion: 1 }, 2, chain)).toThrow(MigrationError);
  });

  it("refuses documents from a newer app", () => {
    expect(() => migrate({ schemaVersion: SCHEMA_VERSION + 1 })).toThrow(/newer version/);
  });

  it("refuses garbage", () => {
    expect(() => migrate([])).toThrow(MigrationError);
    expect(() => migrate({ schemaVersion: "2" })).toThrow(/Invalid schemaVersion/);
    expect(() => migrate({ schemaVersion: -1 })).toThrow(MigrationError);
  });
});

describe("loadProject", () => {
  it("loads a stored project", () => {
    const p = withSofa();
    const result = loadProject(JSON.parse(JSON.stringify(p)));
    expect(result).toEqual({ ok: true, project: p, migratedFrom: SCHEMA_VERSION });
  });

  it("migrates and validates a legacy project", () => {
    const { schemaVersion: _s, ...legacy } = createProject();
    const result = loadProject(legacy);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.migratedFrom).toBe(0);
  });

  it("returns issues instead of throwing", () => {
    expect(loadProject({ schemaVersion: 99 }).ok).toBe(false);
    expect(loadProject({ schemaVersion: 1, name: 3 }).ok).toBe(false);
  });
});

describe("immutable updates", () => {
  it("never mutates the input project", () => {
    const p = withSofa();
    const before = JSON.stringify(p);
    moveItems(p, ["sofa"], 10, 10);
    renameProject(p, "x");
    removeItems(p, ["sofa"]);
    expect(JSON.stringify(p)).toBe(before);
  });

  it("freezes results so accidental mutation fails loudly", () => {
    const p = withSofa();
    expect(Object.isFrozen(getActiveVersion(p).items[0])).toBe(true);
  });

  it("shares untouched branches (cheap snapshots for undo/redo)", () => {
    const p = addFloor(withSofa(), "Eerste verdieping");
    const moved = moveItems(setActiveFloor(p, p.floors[0]!.id), ["sofa"], 5, 0);
    expect(moved.floors[1]).toBe(p.floors[1]);
    expect(moved.settings).toBe(p.settings);
  });

  it("returns the same object when nothing changed", () => {
    const p = withSofa();
    expect(moveItems(p, ["missing"], 5, 5)).toBe(p);
  });
});

describe("floors and versions", () => {
  it("adds floors above the highest level and activates them", () => {
    const p = addFloor(createProject(), "Eerste verdieping");
    expect(p.floors.map((f) => f.level)).toEqual([0, 1]);
    expect(p.activeFloorId).toBe(p.floors[1]!.id);
  });

  it("keeps floors sorted by level", () => {
    const p = addFloor(createProject(), "Kelder", -1);
    expect(p.floors.map((f) => f.name)).toEqual(["Kelder", "Begane grond"]);
  });

  it("removes floors but never the last one", () => {
    const p = addFloor(createProject(), "Zolder");
    const removed = removeFloor(p, p.activeFloorId);
    expect(removed.floors).toHaveLength(1);
    expect(removed.activeFloorId).toBe(removed.floors[0]!.id);
    expect(() => removeFloor(removed, removed.floors[0]!.id)).toThrow(ModelError);
  });

  it("rejects unknown floors", () => {
    expect(() => setActiveFloor(createProject(), "nope")).toThrow(ModelError);
    expect(() => getFloor(createProject(), "nope")).toThrow(ModelError);
  });

  it("creates a design as a copy of the current situation", () => {
    const p = withSofa();
    const floorId = p.activeFloorId;
    const withDesign = createDesign(p, floorId, "Ontwerp A");
    const floor = getFloor(withDesign);
    expect(floor.designs).toHaveLength(1);
    const design = floor.designs[0]!;
    expect(design.kind).toBe("design");
    expect(design.id).not.toBe(floor.current.id);
    expect(design.items).toEqual(floor.current.items);
    expect(floor.activeVersionId).toBe(design.id);
  });

  it("rejects designs on unknown floors", () => {
    expect(() => createDesign(withSofa(), "nope", "x")).toThrow(ModelError);
  });

  it("edits only the active version", () => {
    const base = withSofa();
    const p = createDesign(base, base.activeFloorId, "Ontwerp A");
    const moved = moveItems(p, ["sofa"], 100, 0);
    const floor = getFloor(moved);
    expect(floor.designs[0]!.items[0]!.x).toBe(300);
    expect(floor.current.items[0]!.x).toBe(200);
  });

  it("switches and removes designs", () => {
    const base = withSofa();
    const floorId = base.activeFloorId;
    const p = createDesign(base, floorId, "Ontwerp A");
    const designId = getFloor(p).designs[0]!.id;
    const back = setActiveVersion(p, floorId, getFloor(p).current.id);
    expect(getActiveVersion(back).kind).toBe("current");
    const removed = removeDesign(setActiveVersion(back, floorId, designId), floorId, designId);
    expect(getFloor(removed).designs).toHaveLength(0);
    expect(getFloor(removed).activeVersionId).toBe(getFloor(removed).current.id);
    expect(() => setActiveVersion(p, floorId, "nope")).toThrow(ModelError);
  });
});

describe("rooms", () => {
  it("adds, updates and removes rooms", () => {
    let p = addRoom(createProject(), {
      id: "r1",
      name: "Slaapkamer",
      type: "bed",
      shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 300, d: 300 }] },
    });
    p = updateRoom(p, "r1", { name: "Grote slaapkamer", labelHidden: true });
    expect(getActiveVersion(p).rooms[0]).toMatchObject({
      name: "Grote slaapkamer",
      labelHidden: true,
    });
    p = removeRoom(p, "r1");
    expect(getActiveVersion(p).rooms).toHaveLength(0);
    expect(() => updateRoom(p, "r1", {})).toThrow(ModelError);
  });

  it("generates an id when none is given", () => {
    const p = addRoom(createProject(), {
      name: "Hal",
      type: "hal",
      shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 100, d: 100 }] },
    });
    expect(getActiveVersion(p).rooms[0]!.id).toMatch(/^room_/);
  });
});

describe("items", () => {
  it("moves items but not locked ones", () => {
    let p = addItem(withSofa(), sofa({ id: "locked", locked: true }));
    p = moveItems(p, ["sofa", "locked"], 10, -5);
    const [a, b] = getActiveVersion(p).items;
    expect([a!.x, a!.y]).toEqual([210, 145]);
    expect([b!.x, b!.y]).toEqual([200, 150]);
  });

  it("rotates and normalises angles", () => {
    let p = rotateItems(withSofa(), ["sofa"], -90);
    expect(getActiveVersion(p).items[0]!.rotation).toBe(270);
    p = rotateItems(p, ["sofa"], 450);
    expect(getActiveVersion(p).items[0]!.rotation).toBe(0);
    expect(normalizeAngle(-720)).toBe(0);
  });

  it("updates and removes items", () => {
    let p = updateItems(withSofa(), ["sofa"], { color: "#4D6857" });
    expect(getActiveVersion(p).items[0]!.color).toBe("#4D6857");
    p = removeItems(p, ["sofa"]);
    expect(getActiveVersion(p).items).toHaveLength(0);
  });

  it("duplicates with an offset and new ids", () => {
    const { project, ids } = duplicateItems(withSofa(), ["sofa", "missing"]);
    const items = getActiveVersion(project).items;
    expect(ids).toHaveLength(1);
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ id: ids[0], x: 220, y: 170, name: "Bank 3-zits" });
  });

  it("groups, expands selection to groups and ungroups", () => {
    let p = addItem(withSofa(), sofa({ id: "chair" }));
    p = addItem(p, sofa({ id: "lamp" }));
    const grouped = groupItems(p, ["sofa", "chair"]);
    const items = getActiveVersion(grouped.project).items;
    expect(expandToGroups(items, ["chair"])).toEqual(["sofa", "chair"]);
    expect(expandToGroups(items, ["lamp"])).toEqual(["lamp"]);

    const dup = duplicateItems(grouped.project, ["sofa", "chair"]);
    const copies = getActiveVersion(dup.project).items.slice(3);
    expect(copies[0]!.groupId).toBeDefined();
    expect(copies[0]!.groupId).toBe(copies[1]!.groupId);
    expect(copies[0]!.groupId).not.toBe(grouped.groupId);

    const ungrouped = ungroupItems(grouped.project, grouped.groupId);
    expect(getActiveVersion(ungrouped).items.every((i) => !i.groupId)).toBe(true);
    expect(() => groupItems(p, ["sofa"])).toThrow(ModelError);
  });
});

describe("openings", () => {
  it("adds, updates and removes openings", () => {
    let p = addOpening(createProject(), {
      id: "d1",
      kind: "door",
      x: 0,
      y: 0,
      w: 90,
      dir: "h",
      height: 211,
      hinge: "start",
      swing: "b",
    });
    p = updateOpening(p, "d1", { w: 80 });
    expect(getActiveVersion(p).openings[0]!.w).toBe(80);
    expect(() => updateOpening(p, "d1", { kind: "window" })).toThrow(ModelError);
    expect(() => updateOpening(p, "x", {})).toThrow(ModelError);
    p = removeOpening(p, "d1");
    expect(getActiveVersion(p).openings).toHaveLength(0);
  });
});

describe("fixtures", () => {
  const base = () =>
    addFixture(createProject(), {
      id: "wc",
      type: "toilet",
      x: 0,
      y: 0,
      w: 40,
      d: 65,
      rotation: 0,
      locked: true,
    });

  it("ignores moves while locked", () => {
    const p = base();
    expect(updateFixture(p, "wc", { x: 50 })).toBe(p);
  });

  it("can be unlocked and then moved", () => {
    let p = updateFixture(base(), "wc", { locked: false });
    p = updateFixture(p, "wc", { x: 50 });
    expect(getActiveVersion(p).fixtures[0]).toMatchObject({ x: 50, locked: false });
  });

  it("removes fixtures and rejects unknown ids", () => {
    expect(getActiveVersion(removeFixture(base(), "wc")).fixtures).toHaveLength(0);
    expect(() => updateFixture(base(), "x", {})).toThrow(ModelError);
  });
});

describe("wall overrides and layers", () => {
  it("sets and resets an override per wall side", () => {
    let p = setWallOverride(createProject(), "w1", "a", { kind: "paint", color: "#87A08C" });
    p = setWallOverride(p, "w1", "b", { kind: "wallpaper", color: "#E3EAE2" });
    expect(getActiveVersion(p).wallOverrides.w1).toEqual({
      a: { kind: "paint", color: "#87A08C" },
      b: { kind: "wallpaper", color: "#E3EAE2" },
    });
    p = setWallOverride(p, "w1", "a", undefined);
    expect(getActiveVersion(p).wallOverrides.w1).toEqual({
      b: { kind: "wallpaper", color: "#E3EAE2" },
    });
    p = setWallOverride(p, "w1", "b", undefined);
    expect(getActiveVersion(p).wallOverrides).toEqual({});
  });

  it("stores layer visibility in the project", () => {
    const p = setLayerState(createProject(), "decor", { visible: false });
    expect(p.settings.layers.decor).toEqual({ visible: false, locked: false });
    expect(validateProject(p).ok).toBe(true);
  });
});

describe("migration 1 -> 2", () => {
  function v1Project() {
    const p = structuredClone(createProject("Oud")) as unknown as Record<string, unknown>;
    const floors = p.floors as Record<string, unknown>[];
    const current = floors[0]!.current as Record<string, unknown>;
    const style = current.style as Record<string, unknown>;
    delete style.trim;
    style.floor = { kind: "wood", color: "#C9B8A0" };
    current.rooms = [
      {
        id: "r",
        name: "Kamer",
        type: "living",
        shape: { kind: "rects", rects: [{ x: 0, y: 0, w: 100, d: 100 }] },
        style: { floor: { kind: "wood" } },
      },
    ];
    delete current.demolitions;
    delete current.wallFlags;
    delete current.moodboard;
    const settings = p.settings as Record<string, unknown>;
    delete settings.northAngle;
    delete settings.eyeHeight;
    delete settings.showLife;
    delete p.photos;
    delete p.looks;
    delete p.customItems;
    p.schemaVersion = 1;
    return p;
  }

  it("fills the new fields and renames wood to planks", () => {
    const result = loadProject(v1Project());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(1);
    const v = getActiveVersion(result.project);
    expect(v.style.floor.kind).toBe("planks");
    expect(v.rooms[0]!.style?.floor?.kind).toBe("planks");
    expect(v.style.trim.skirting.height).toBe(7);
    expect(v.demolitions).toEqual([]);
    expect(result.project.settings.eyeHeight).toBe(160);
    expect(result.project.photos).toEqual([]);
  });
});
