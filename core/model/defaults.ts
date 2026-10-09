import { newId } from "./ids";
import { SCHEMA_VERSION } from "./version";
import {
  LAYERS,
  type Floor,
  type Layer,
  type LayerState,
  type Project,
  type ProjectSettings,
  type Style,
  type Trim,
  type Version,
} from "./types";

export const DEFAULT_FLOOR_HEIGHT = 260;

export const DEFAULT_TRIM: Trim = {
  skirting: { style: "flat", height: 7, color: "#FBF9F4" },
  cornice: "none",
  rosette: false,
  frameColor: "#FBF9F4",
};

export const DEFAULT_STYLE: Style = {
  name: "Huidig",
  wall: { kind: "current", color: "#F4F1EA" },
  floor: { kind: "current", color: "#C9B8A0" },
  ceiling: "#FBF9F4",
  accent: "#87A08C",
  trim: DEFAULT_TRIM,
};

export function defaultSettings(): ProjectSettings {
  const layers = Object.fromEntries(
    LAYERS.map((layer) => [layer, { visible: true, locked: false }]),
  ) as Record<Layer, LayerState>;
  return {
    unit: "cm",
    wallThickness: { interior: 10, exterior: 30 },
    lowWallHeight: 100,
    gridSize: 10,
    snapToGrid: true,
    clearance: 80,
    layers,
    northAngle: 0,
    eyeHeight: 160,
    showLife: true,
  };
}

export function createVersion(
  name = "Huidige situatie",
  kind: Version["kind"] = "current",
): Version {
  return {
    id: newId("ver"),
    name,
    kind,
    rooms: [],
    extraWalls: [],
    openings: [],
    fixtures: [],
    items: [],
    style: structuredClone(DEFAULT_STYLE),
    wallOverrides: {},
    demolitions: [],
    wallFlags: {},
    moodboard: [],
  };
}

export function createFloor(
  name = "Begane grond",
  level = 0,
  height = DEFAULT_FLOOR_HEIGHT,
): Floor {
  const current = createVersion();
  return {
    id: newId("floor"),
    name,
    level,
    height,
    current,
    designs: [],
    activeVersionId: current.id,
  };
}

export function createProject(name = "Nieuw project", now = new Date()): Project {
  const floor = createFloor();
  const stamp = now.toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: newId("proj"),
    name,
    createdAt: stamp,
    updatedAt: stamp,
    settings: defaultSettings(),
    floors: [floor],
    activeFloorId: floor.id,
    photos: [],
    looks: [],
    customItems: [],
  };
}
