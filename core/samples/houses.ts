import { createProject } from "../model/defaults";
import type { Project } from "../model/types";
import { planCodeToFloors, type PlanCode } from "../plancode/plancode";
import { sampleApartment } from "./apartment";

/** Build a project from plan-code plans (one per floor). */
export function projectFromPlans(name: string, plans: readonly PlanCode[], now?: Date): Project {
  const project = createProject(name, now);
  const floors = planCodeToFloors(plans).sort((a, b) => a.level - b.level);
  project.floors = floors;
  project.activeFloorId = floors[0]!.id;
  return project;
}

/** Terraced house ground floor, 5.4 m wide, with a garden-side kitchen. */
export const TERRACED_GROUND: PlanCode = {
  version: 1,
  name: "Begane grond",
  level: 0,
  height: 260,
  rooms: [
    { name: "Hal", type: "hal", rects: [[0, 0, 200, 300]] },
    { name: "Toilet", type: "toilet", rects: [[200, 0, 100, 140]] },
    { name: "Meterkast", type: "storage", rects: [[200, 140, 100, 160]] },
    {
      name: "Woonkamer",
      type: "living",
      rects: [
        [0, 300, 540, 420],
        [300, 0, 240, 300],
      ],
    },
    { name: "Keuken", type: "kitchen", rects: [[0, 720, 540, 280]] },
  ],
  doors: [
    { x: 60, y: -15, w: 93, dir: "h", swing: "b" },
    { x: 200, y: 30, w: 73, dir: "v", swing: "b" },
    { x: 60, y: 300, w: 83, dir: "h", swing: "b" },
    { x: 380, y: 1015, w: 93, dir: "h", swing: "a" },
  ],
  windows: [
    { x: 330, y: -15, w: 180, dir: "h" },
    { x: 60, y: 1015, w: 280, dir: "h", glass: true },
  ],
  fixtures: [
    { type: "stairs", x: 110, y: 20, w: 85, h: 270, shape: "straight", up: "N" },
    { type: "toilet", x: 230, y: 70, w: 40, h: 65 },
    { type: "kitchen", x: 0, y: 720, w: 300, h: 60 },
    { type: "fridge", x: 300, y: 720, w: 60, h: 65 },
  ],
  items: [
    { id: "sofa-corner-left", x: 170, y: 560, back: "W" },
    { id: "coffee-table", x: 340, y: 560, rotation: 90 },
    { id: "tv-unit", x: 517, y: 560, back: "E" },
    { id: "dining-6", x: 260, y: 860 },
    { id: "rug-200", x: 340, y: 560, rotation: 90 },
  ],
};

export const HOUSE_FIRST: PlanCode = {
  version: 1,
  name: "Eerste verdieping",
  level: 1,
  height: 255,
  rooms: [
    { name: "Overloop", type: "hal", rects: [[0, 0, 200, 420]] },
    { name: "Badkamer", type: "bath", rects: [[200, 0, 340, 240]] },
    { name: "Slaapkamer", type: "bed", rects: [[0, 420, 540, 340]] },
    { name: "Kinderkamer", type: "bed", rects: [[200, 240, 340, 180]] },
    { name: "Werkkamer", type: "office", rects: [[0, 760, 540, 240]] },
  ],
  doors: [
    { x: 200, y: 280, w: 83, dir: "v", swing: "b" },
    { x: 200, y: 100, w: 83, dir: "v", swing: "b" },
    { x: 60, y: 420, w: 83, dir: "h", swing: "b" },
    { x: 60, y: 760, w: 83, dir: "h", swing: "b" },
  ],
  windows: [
    { x: 300, y: -15, w: 140, dir: "h" },
    { x: 150, y: 1015, w: 240, dir: "h" },
    { x: 555, y: 520, w: 160, dir: "v" },
  ],
  fixtures: [
    { type: "shower", x: 440, y: 0, w: 100, h: 100 },
    { type: "bath", x: 220, y: 175, w: 170, h: 65 },
    { type: "sink", x: 260, y: 0, w: 120, h: 50 },
    { type: "toilet", x: 480, y: 170, w: 40, h: 65, rotation: 0 },
  ],
  items: [
    { id: "bed-180", x: 300, y: 600, back: "S" },
    { id: "wardrobe-sliding", x: 360, y: 460, back: "N" },
    { id: "bed-90", x: 428, y: 330, back: "E" },
    { id: "desk-240", x: 270, y: 958, back: "S" },
  ],
};

export interface SampleInfo {
  id: "apartment" | "terraced" | "house";
  name: { nl: string; en: string };
  description: { nl: string; en: string };
  create: () => Project;
}

export const SAMPLES: readonly SampleInfo[] = [
  {
    id: "apartment",
    name: { nl: "Appartement", en: "Apartment" },
    description: {
      nl: "Benedenwoning van ongeveer 70 m² met loggia, ingericht.",
      en: "Ground floor flat of about 70 m² with a loggia, furnished.",
    },
    create: () => sampleApartment(),
  },
  {
    id: "terraced",
    name: { nl: "Rijtjeshuis", en: "Terraced house" },
    description: {
      nl: "Begane grond van een rijtjeshuis met tuinkeuken.",
      en: "Ground floor of a terraced house with a garden-side kitchen.",
    },
    create: () => projectFromPlans("Rijtjeshuis", [TERRACED_GROUND]),
  },
  {
    id: "house",
    name: { nl: "Huis met twee verdiepingen", en: "Two-storey house" },
    description: {
      nl: "Begane grond en eerste verdieping, verbonden met een trap.",
      en: "Ground and first floor, connected by stairs.",
    },
    create: () => projectFromPlans("Huis", [TERRACED_GROUND, HOUSE_FIRST]),
  },
];
