import { getEntry } from "@/catalog";
import { createFixture } from "../fixtures/fixtures";
import { createProject } from "../model/defaults";
import type { Item, Project, Room, RoomType } from "../model/types";
import { createDoor, createWindow, snapOpening } from "../openings/openings";
import { generateWalls } from "../walls/generate";

/**
 * Generic sample: a ground floor apartment of about 70 m² with a loggia.
 * Not a real address; used for the editor demo and tests.
 */

function room(
  id: string,
  name: string,
  type: RoomType,
  rects: [number, number, number, number][],
): Room {
  return {
    id,
    name,
    type,
    shape: { kind: "rects", rects: rects.map(([x, y, w, d]) => ({ x, y, w, d })) },
  };
}

type ItemSpec = Pick<Item, "name" | "x" | "y" | "w" | "d" | "h"> & Partial<Item>;

/** Sample item id -> catalog entry. */
const CATALOG: Record<string, string> = {
  sofa: "sofa-3",
  "coffee-table": "coffee-table",
  armchair: "armchair",
  "tv-unit": "tv-unit",
  "dining-table": "dining-round",
  "floor-lamp": "lamp-floor",
  plant: "plant-monstera",
  vase: "vase-small",
  painting: "painting-medium",
  pendant: "lamp-pendant",
  bed: "bed-160",
  "nightstand-l": "nightstand",
  "nightstand-r": "nightstand",
  wardrobe: "wardrobe-sliding",
};

function item(id: string, spec: ItemSpec): Item {
  const light = getEntry(CATALOG[id] ?? id)?.light;
  return {
    ...(light ? { light: { on: true, color: light.color, intensity: light.intensity } } : {}),
    id,
    catalogId: CATALOG[id] ?? id,
    rotation: 0,
    shape: "rect",
    layer: "furniture",
    mount: "floor",
    elevation: 0,
    ...spec,
  };
}

export function sampleApartment(): Project {
  const project = createProject("Voorbeeld appartement", new Date("2026-01-01T00:00:00Z"));
  const floor = project.floors[0]!;
  const height = 260;

  const rooms: Room[] = [
    room("living", "Woonkamer", "living", [[0, 0, 520, 420]]),
    room("kitchen", "Keuken", "kitchen", [[520, 0, 280, 280]]),
    room("hal", "Hal", "hal", [
      [520, 280, 280, 140],
      [680, 420, 120, 350],
    ]),
    room("bed", "Slaapkamer", "bed", [[0, 420, 380, 350]]),
    room("bath", "Badkamer", "bath", [[380, 420, 200, 350]]),
    room("toilet", "Toilet", "toilet", [[580, 420, 100, 150]]),
    room("storage", "Berging", "storage", [[580, 570, 100, 200]]),
    room("loggia", "Loggia", "loggia", [[0, -180, 520, 180]]),
  ];
  const walls = generateWalls(rooms, [], { height });
  const snap = <T extends Parameters<typeof snapOpening>[0]>(o: T) => {
    const snapped = snapOpening(o, walls);
    if (!snapped) throw new Error(`Sample opening ${o.id} is not on a wall`);
    return snapped;
  };

  const openings = [
    snap(createDoor(815, 650, "v", { id: "front-door", w: 93, swing: "a" })),
    snap(createDoor(520, 325, "v", { id: "door-living", swing: "a", hinge: "end" })),
    snap(createDoor(600, 280, "h", { id: "door-kitchen", swing: "a" })),
    snap(createDoor(280, 420, "h", { id: "door-bed", swing: "b" })),
    snap(createDoor(400, 420, "h", { id: "door-bath", swing: "b", hinge: "end" })),
    snap(createDoor(680, 460, "v", { id: "door-toilet", w: 73, swing: "a" })),
    snap(createDoor(680, 630, "v", { id: "door-storage", w: 73, swing: "a" })),
    snap(
      createWindow(100, -15, "h", {
        id: "loggia-glass",
        w: 300,
        glass: true,
        sill: 0,
        lintel: height,
      }),
    ),
    snap(createWindow(-15, 110, "v", { id: "win-living", w: 200 })),
    snap(createWindow(-15, 500, "v", { id: "win-bed", w: 160 })),
    snap(createWindow(570, -15, "h", { id: "win-kitchen", w: 160 })),
    snap(createWindow(110, 785, "h", { id: "win-bed-south", w: 160 })),
  ];

  const fixtures = [
    createFixture("kitchen", 520, 0, { id: "fx-kitchen", w: 220 }),
    createFixture("fridge", 740, 0, { id: "fx-fridge" }),
    createFixture("toilet", 610, 505, { id: "fx-toilet" }),
    createFixture("sink", 470, 430, { id: "fx-sink", w: 80 }),
    createFixture("shower", 480, 670, { id: "fx-shower", w: 95, d: 95 }),
    createFixture("tall", 585, 575, { id: "fx-boiler", w: 50, d: 50 }),
  ];

  const items: Item[] = [
    item("sofa", {
      name: "Bank 3-zits",
      x: 48,
      y: 210,
      w: 220,
      d: 95,
      h: 85,
      rotation: 270,
      color: "#87A08C",
    }),
    item("coffee-table", {
      name: "Salontafel",
      x: 190,
      y: 210,
      w: 110,
      d: 60,
      h: 45,
      rotation: 90,
      color: "#4A3526",
    }),
    item("armchair", {
      name: "Fauteuil",
      x: 330,
      y: 90,
      w: 80,
      d: 85,
      h: 90,
      rotation: 200,
      color: "#A9A58B",
    }),
    item("tv-unit", {
      name: "Tv-meubel",
      x: 492,
      y: 190,
      w: 180,
      d: 45,
      h: 50,
      rotation: 90,
      color: "#4A3526",
    }),
    item("dining-table", {
      name: "Eettafel rond",
      x: 320,
      y: 320,
      w: 110,
      d: 110,
      h: 75,
      shape: "round",
      color: "#B08D57",
    }),
    item("floor-lamp", {
      name: "Staande lamp",
      x: 40,
      y: 50,
      w: 40,
      d: 40,
      h: 160,
      shape: "round",
      layer: "lighting",
    }),
    item("pendant", {
      name: "Hanglamp",
      x: 320,
      y: 320,
      w: 45,
      d: 45,
      h: 80,
      shape: "round",
      layer: "lighting",
      mount: "wall",
      elevation: 0,
    }),
    item("plant", {
      name: "Plant",
      x: 470,
      y: 35,
      w: 45,
      d: 45,
      h: 120,
      shape: "round",
      layer: "decor",
      color: "#4D6857",
    }),
    item("vase", {
      name: "Vaas",
      x: 190,
      y: 210,
      w: 15,
      d: 15,
      h: 25,
      shape: "round",
      layer: "decor",
      mount: "stack",
      elevation: 45,
    }),
    item("painting", {
      name: "Schilderij",
      x: 2,
      y: 210,
      w: 100,
      d: 3,
      h: 70,
      rotation: 270,
      layer: "decor",
      mount: "wall",
      elevation: 130,
    }),
    item("bed", {
      name: "Bed 160x200",
      x: 190,
      y: 670,
      w: 160,
      d: 200,
      h: 45,
      rotation: 180,
      color: "#E3EAE2",
    }),
    item("nightstand-l", {
      name: "Nachtkastje",
      x: 85,
      y: 750,
      w: 45,
      d: 40,
      h: 50,
      rotation: 180,
      color: "#4A3526",
    }),
    item("nightstand-r", {
      name: "Nachtkastje",
      x: 295,
      y: 750,
      w: 45,
      d: 40,
      h: 50,
      rotation: 180,
      color: "#4A3526",
    }),
    item("wardrobe", {
      name: "Kledingkast",
      x: 120,
      y: 455,
      w: 200,
      d: 60,
      h: 220,
      color: "#F5F1E8",
    }),
  ];

  floor.current = { ...floor.current, rooms, openings, fixtures, items };
  return project;
}
