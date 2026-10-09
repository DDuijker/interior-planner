import type { Part } from "@/core/model/types";
import { ball, box, cone, cyl, legs } from "./parts";
import type { Dims, Params } from "./types";

/**
 * Parametric archetypes. Every builder fits its parts inside the w x d x h
 * box centred on the item (x, y) with its base at z = 0.
 */

const num = (p: Params, k: string, d: number) => (typeof p[k] === "number" ? (p[k] as number) : d);
const str = (p: Params, k: string, d: string) => (typeof p[k] === "string" ? (p[k] as string) : d);
const bool = (p: Params, k: string) => p[k] === true;

// ------------------------------------------------------------------ seating

export function sofa({ w, d, h }: Dims, p: Params): Part[] {
  const arm = str(p, "arms", "square") === "none" ? 0 : Math.min(22, w * 0.1);
  const legH = bool(p, "floor") ? 0 : 10;
  const seatH = Math.min(45, h * 0.5);
  const backD = Math.min(22, d * 0.25);
  const seats = Math.max(1, num(p, "seats", 3));
  const inner = w - 2 * arm;
  const parts: Part[] = [];
  if (legH) parts.push(...legs(w, d, legH, 5, 6, "black"));
  parts.push(box(0, 0, legH, w, d, seatH - legH - 12, "main"));
  parts.push(box(0, -d / 2 + backD / 2, legH, w, backD, h - legH, "main"));
  const round = str(p, "arms", "square") === "round";
  if (arm) {
    const armH = Math.min(h * 0.75, seatH + 20) - legH;
    const make = round ? cyl : box;
    parts.push(make(-w / 2 + arm / 2, 0, legH, arm, d, armH, "main"));
    parts.push(make(w / 2 - arm / 2, 0, legH, arm, d, armH, "main"));
  }
  const cw = inner / seats;
  for (let i = 0; i < seats; i++) {
    parts.push(
      box(-inner / 2 + cw * (i + 0.5), backD / 2, seatH - 12, cw - 2, d - backD - 4, 12, "second"),
    );
  }
  const chaise = str(p, "chaise", "");
  if (chaise) {
    // Chaise extends forward at one end inside the footprint: the footprint is the full L.
    const cwid = Math.min(90, w * 0.35);
    const x = chaise === "left" ? -w / 2 + cwid / 2 : w / 2 - cwid / 2;
    parts.push(box(x, d / 4, seatH - 12, cwid - 4, d / 2, 12, "second"));
  }
  if (bool(p, "tufted")) {
    for (let i = 0; i < seats * 2; i++) {
      parts.push(
        ball(
          -inner / 2 + (inner / (seats * 2)) * (i + 0.5),
          -d / 2 + backD,
          h * 0.7,
          3,
          3,
          3,
          "black",
        ),
      );
    }
  }
  if (bool(p, "bed")) parts.push(box(0, d / 4, seatH, inner - 4, d / 2, 6, "white"));
  return parts;
}

/** L-shaped sofa: the footprint covers the whole L. */
export function cornerSofa({ w, d, h }: Dims, p: Params): Part[] {
  const depth = Math.min(95, d * 0.55);
  const side = str(p, "side", "left");
  const u = bool(p, "u");
  const parts: Part[] = [
    ...sofa({ w, d: depth, h }, { arms: "square", seats: Math.max(2, Math.round(w / 80)) }),
  ].map((q) => ({
    ...q,
    y: q.y - d / 2 + depth / 2,
  }));
  const legLen = d - depth;
  const ends = u ? ["left", "right"] : [side];
  for (const s of ends) {
    const x = s === "left" ? -w / 2 + depth / 2 : w / 2 - depth / 2;
    parts.push(box(x, depth / 2, 10, depth, legLen, 23, "main"));
    parts.push(box(x, depth / 2, 33, depth - 6, legLen - 4, 12, "second"));
    parts.push(
      box(
        s === "left" ? x - depth / 2 + 10 : x + depth / 2 - 10,
        depth / 2,
        10,
        20,
        legLen,
        h - 10,
        "main",
      ),
    );
  }
  return parts;
}

export function chair({ w, d, h }: Dims, p: Params): Part[] {
  const style = str(p, "style", "classic");
  const seatH = Math.min(46, h * 0.55);
  const parts: Part[] = [];
  if (style === "tulip") {
    parts.push(cyl(0, 0, 0, w * 0.6, d * 0.6, 2, "white"), cyl(0, 0, 0, 6, 6, seatH, "white"));
    parts.push(
      cyl(0, 0, seatH - 4, w, d, 6, "main"),
      box(0, -d / 2 + 4, seatH, w * 0.9, 6, h - seatH, "main"),
    );
    return parts;
  }
  const legMat = style === "industrial" ? "metal" : "wood";
  parts.push(...legs(w, d, seatH - 4, style === "bistro" ? 3 : 4, 3, legMat, style === "bistro"));
  parts.push(box(0, 0, seatH - 4, w, d, 4, style === "upholstered" ? "second" : "main"));
  if (style === "windsor" || style === "spindle") {
    for (let i = 0; i < 5; i++)
      parts.push(
        cyl(-w / 2 + 4 + (i * (w - 8)) / 4, -d / 2 + 3, seatH, 2, 2, h - seatH - 4, "wood"),
      );
    parts.push(box(0, -d / 2 + 3, h - 5, w, 4, 5, "wood"));
  } else if (style === "scandi") {
    parts.push(
      box(0, -d / 2 + 3, seatH + (h - seatH) * 0.45, w * 0.9, 3, (h - seatH) * 0.55, "main"),
    );
  } else {
    parts.push(
      box(0, -d / 2 + 3, seatH, w, 4, h - seatH, style === "upholstered" ? "second" : "main"),
    );
  }
  if (bool(p, "arms")) {
    parts.push(
      box(-w / 2 + 2, 0, seatH, 4, d * 0.8, 22, "main"),
      box(w / 2 - 2, 0, seatH, 4, d * 0.8, 22, "main"),
    );
  }
  return parts;
}

export function armchair({ w, d, h }: Dims, p: Params): Part[] {
  if (str(p, "style", "") === "wingback") {
    return [
      ...legs(w, d, 12, 5, 5, "wood"),
      box(0, 0, 12, w, d, 30, "main"),
      box(0, -d / 2 + 10, 12, w, 20, h - 12, "main"),
      box(-w / 2 + 8, -d / 4, 12, 16, d / 2, h - 20, "main"),
      box(w / 2 - 8, -d / 4, 12, 16, d / 2, h - 20, "main"),
      box(0, 8, 42, w - 34, d - 26, 10, "second"),
    ];
  }
  return sofa({ w, d, h }, { seats: 1, arms: str(p, "arms", "square") });
}

export function pouf({ w, d, h }: Dims, p: Params): Part[] {
  if (str(p, "shape", "round") === "square") return [box(0, 0, 0, w, d, h, "main")];
  return [cyl(0, 0, 0, w, d, h, "main"), cyl(0, 0, h - 2, w * 0.96, d * 0.96, 2, "second")];
}

export function stool({ w, d, h }: Dims, p: Params): Part[] {
  const bar = bool(p, "bar");
  const top = cyl(0, 0, h - 4, w, d, 4, "main");
  const ls = legs(w * 0.85, d * 0.85, h - 4, 3, 2, bar ? "metal" : "wood", true);
  return bar ? [...ls, top, box(0, 0, h * 0.35, w * 0.7, 2, 2, "metal")] : [...ls, top];
}

export function bench({ w, d, h }: Dims, p: Params): Part[] {
  const back = bool(p, "back");
  const seatH = back ? Math.min(46, h * 0.55) : h;
  const cushion = bool(p, "cushion") ? 5 : 0;
  const top = seatH - cushion;
  const parts = [...legs(w, d, top - 5, 5, 4, "wood"), box(0, 0, top - 5, w, d, 5, "wood")];
  if (cushion) parts.push(box(0, 0, top, w - 4, d - 4, cushion, "second"));
  if (back) parts.push(box(0, -d / 2 + 3, seatH, w, 4, h - seatH, "wood"));
  return parts;
}

export function hangingChair({ w, d, h }: Dims): Part[] {
  return [
    cyl(0, 0, 0, w * 0.6, d * 0.6, 3, "metal"),
    cyl(w * 0.25, 0, 0, 3, 3, h, "metal"),
    ball(0, 0, h * 0.25, w * 0.8, d * 0.8, h * 0.5, "main"),
    ball(0, 4, h * 0.3, w * 0.55, d * 0.5, h * 0.25, "second"),
  ];
}

export function chaiseLongue({ w, d, h }: Dims): Part[] {
  return [
    ...legs(w, d, 12, 4, 6, "wood"),
    box(0, 0, 12, w, d, 26, "main"),
    box(0, -d / 2 + 25, 38, w, 50, h - 38, "main"),
    box(0, 15, 38, w - 6, d - 60, 8, "second"),
  ];
}

// ------------------------------------------------------------------- tables

export function table({ w, d, h }: Dims, p: Params): Part[] {
  const shape = str(p, "shape", "rect");
  const top = Math.min(4, h * 0.08);
  const base = str(p, "base", "legs");
  const parts: Part[] = [];
  if (shape === "round" || shape === "oval") {
    parts.push(cyl(0, 0, h - top, w, d, top, "main"));
  } else {
    parts.push(box(0, 0, h - top, w, d, top, "main"));
  }
  if (base === "pedestal") {
    parts.push(
      cyl(0, 0, 0, Math.min(w, d) * 0.5, Math.min(w, d) * 0.5, 3, "second"),
      cyl(0, 0, 0, 12, 12, h - top, "second"),
    );
  } else if (base === "trestle") {
    parts.push(
      box(-w / 2 + 15, 0, 0, 6, d * 0.8, h - top, "second"),
      box(w / 2 - 15, 0, 0, 6, d * 0.8, h - top, "second"),
    );
  } else if (shape === "round" || shape === "oval") {
    parts.push(...legs(w * 0.7, d * 0.7, h - top, 4, 0, "second", true));
  } else {
    parts.push(...legs(w, d, h - top, base === "hairpin" ? 2 : 5, 3, "second", base === "hairpin"));
  }
  if (bool(p, "shelf")) parts.push(box(0, 0, h * 0.25, w - 8, d - 8, 2, "main"));
  if (bool(p, "drawer")) parts.push(box(0, d / 2 - 15, h - top - 12, w * 0.6, 28, 12, "main"));
  if (bool(p, "extendable")) parts.push(box(0, 0, h - top - 1, 2, d, 1, "black"));
  return parts;
}

// ------------------------------------------------------------------ bedroom

export function bed({ w, d, h }: Dims, p: Params): Part[] {
  const kind = str(p, "kind", "frame");
  const mattress = kind === "boxspring" ? 30 : 20;
  const baseH = kind === "boxspring" ? 35 : kind === "storage" ? 30 : 25;
  const parts: Part[] = [];
  if (kind === "bunk") {
    const lower = { w, d, h: 40 };
    for (const z of [0, 110]) {
      parts.push(
        ...bed(lower, { kind: "frame", headboard: false }).map((q) => ({ ...q, z: q.z + z })),
      );
    }
    parts.push(...legs(w, d, h, 6, 0, "wood"));
    parts.push(box(w / 2 - 4, d / 2 - 30, 40, 4, 40, 110, "wood"));
    return parts;
  }
  if (kind === "storage" || kind === "boxspring")
    parts.push(box(0, 0, 0, w, d, baseH, kind === "storage" ? "wood" : "main"));
  else parts.push(...legs(w, d, baseH, 6, 4, "wood"), box(0, 0, baseH - 8, w, d, 8, "wood"));
  parts.push(box(0, 4, baseH, w - 4, d - 8, mattress, "white"));
  // Linen and pillows in the second colour.
  parts.push(box(0, d * 0.12, baseH + mattress, w - 2, d * 0.7, 4, "second"));
  const pillows = w >= 140 ? 2 : 1;
  for (let i = 0; i < pillows; i++) {
    parts.push(
      box(
        -w / 2 + (w / pillows) * (i + 0.5),
        -d / 2 + 22,
        baseH + mattress,
        w / pillows - 12,
        34,
        10,
        "white",
      ),
    );
  }
  if (p.headboard !== false)
    parts.push(
      box(
        0,
        -d / 2 + 3,
        0,
        w,
        6,
        Math.max(h, baseH + mattress + 40),
        kind === "boxspring" ? "main" : "wood",
      ),
    );
  if (kind === "canopy") {
    for (const [x, y] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as const) {
      parts.push(cyl((x * (w - 6)) / 2, (y * (d - 6)) / 2, 0, 5, 5, 200, "wood"));
    }
    parts.push(box(0, 0, 196, w, d, 4, "wood"), box(0, 0, 160, w, d, 2, "fabric"));
  }
  return parts;
}

export function cabinet({ w, d, h }: Dims, p: Params): Part[] {
  const doors = num(p, "doors", 2);
  const drawers = num(p, "drawers", 0);
  const glass = bool(p, "glass");
  const sliding = bool(p, "sliding");
  const legH = bool(p, "legs") ? 12 : 0;
  const parts: Part[] = [];
  if (legH) parts.push(...legs(w, d, legH, 4, 3, "wood"));
  parts.push(box(0, 0, legH, w, d, h - legH, "main"));
  const front = d / 2;
  const bodyH = h - legH;
  const drawerH = drawers ? Math.min(20, bodyH / Math.max(drawers, 1)) : 0;
  for (let i = 0; i < drawers; i++) {
    parts.push(box(0, front, legH + i * drawerH + 1, w - 4, 1.5, drawerH - 2, "second"));
    parts.push(box(0, front + 1, legH + i * drawerH + drawerH / 2, w * 0.25, 1, 1.5, "metal"));
  }
  const doorZ = legH + drawers * drawerH;
  const doorH = h - doorZ - 2;
  if (doors > 0 && doorH > 10) {
    const dw = w / doors;
    for (let i = 0; i < doors; i++) {
      const x = -w / 2 + dw * (i + 0.5);
      const yOff = sliding ? (i % 2 ? 1.5 : 3) : 1.5;
      parts.push(
        box(x, front + yOff - 1.5, doorZ + 1, dw - 1.5, 1.5, doorH, glass ? "glass" : "second"),
      );
      if (!sliding)
        parts.push(
          box(
            x + (i % 2 ? -dw / 2 + 4 : dw / 2 - 4),
            front + 2,
            doorZ + doorH / 2,
            1.5,
            1.5,
            12,
            "metal",
          ),
        );
    }
  }
  return parts;
}

export function shelves({ w, d, h }: Dims, p: Params): Part[] {
  const n = num(p, "shelves", Math.max(2, Math.round(h / 35)));
  const back = !bool(p, "open");
  const parts: Part[] = [
    box(-w / 2 + 1, 0, 0, 2, d, h, "main"),
    box(w / 2 - 1, 0, 0, 2, d, h, "main"),
  ];
  if (back) parts.push(box(0, -d / 2 + 0.5, 0, w, 1, h, "main"));
  for (let i = 0; i <= n; i++) parts.push(box(0, 0, (i * (h - 2)) / n, w - 4, d, 2, "main"));
  if (bool(p, "books")) {
    for (let i = 0; i < n; i++) {
      const z = (i * (h - 2)) / n + 2;
      let x = -w / 2 + 4;
      let k = 0;
      while (x < w / 2 - 10) {
        const bw = 2 + ((i * 7 + k * 3) % 4);
        const bh = Math.min(((h - 2) / n) * 0.8, 22 + ((k * 5) % 9));
        parts.push(box(x + bw / 2, 0, z, bw, d * 0.8, bh, "second"));
        x += bw + 0.5;
        k++;
      }
    }
  }
  return parts;
}

/** Floating shelf or wall-mounted unit (base z is its elevation). */
export function wallShelf({ w, d, h }: Dims): Part[] {
  return [box(0, 0, h - 3, w, d, 3, "main")];
}

export function coatRack({ w, d, h }: Dims, p: Params): Part[] {
  if (bool(p, "wall")) {
    const parts = [box(0, -d / 2 + 1, 0, w, 2, h, "wood")];
    for (let i = 0; i < 5; i++)
      parts.push(cyl(-w / 2 + 8 + (i * (w - 16)) / 4, 0, h / 2, 2, d, 2, "metal"));
    return parts;
  }
  return [
    cyl(0, 0, 0, w * 0.6, d * 0.6, 2, "metal"),
    cyl(0, 0, 0, 3, 3, h, "metal"),
    ball(0, 0, h - 10, w * 0.8, d * 0.8, 6, "metal"),
  ];
}

export function mirror({ w, d, h }: Dims, p: Params): Part[] {
  const round = bool(p, "round");
  const make = round ? cyl : box;
  const frame = make(0, 0, 0, w, d, h, "second");
  return round
    ? [{ ...frame, shape: "cylinder" }, { ...cyl(0, 1, 2, w - 4, d, h - 4, "glass") }]
    : [frame, box(0, 0.5, 3, w - 6, d, h - 6, "glass")];
}

export function frame({ w, d, h }: Dims): Part[] {
  return [box(0, 0, 0, w, d, h, "second"), box(0, 0.5, 4, w - 8, d, h - 8, "main")];
}

export function tv({ w, d, h }: Dims, p: Params): Part[] {
  if (bool(p, "wall")) return [box(0, 0, 0, w, d, h, "black")];
  return [
    box(0, 0, 0, w * 0.3, d, 2, "black"),
    box(0, 0, 2, 4, 3, 8, "black"),
    box(0, 0, 8, w, 3, h - 8, "black"),
  ];
}

// ---------------------------------------------------------- office

export function desk({ w, d, h }: Dims, p: Params): Part[] {
  if (bool(p, "corner")) {
    const arm = Math.min(70, d * 0.55);
    return [
      box(0, -d / 2 + arm / 2, h - 3, w, arm, 3, "main"),
      box(-w / 2 + arm / 2, arm / 2, h - 3, arm, d - arm, 3, "main"),
      ...legs(w, d, h - 3, 4, 3, "metal"),
    ];
  }
  const parts: Part[] = [box(0, 0, h - 3, w, d, 3, "main")];
  if (bool(p, "standing")) {
    parts.push(
      box(-w / 2 + 8, 0, 0, 6, d * 0.8, 3, "metal"),
      box(w / 2 - 8, 0, 0, 6, d * 0.8, 3, "metal"),
    );
    parts.push(
      box(-w / 2 + 8, 0, 0, 6, 6, h - 3, "metal"),
      box(w / 2 - 8, 0, 0, 6, 6, h - 3, "metal"),
    );
  } else {
    parts.push(...legs(w, d, h - 3, 4, 3, "second"));
  }
  if (bool(p, "drawers")) parts.push(box(w / 2 - 22, 0, 0, 40, d - 6, h - 4, "main"));
  return parts;
}

export function officeChair({ w, d, h }: Dims): Part[] {
  return [
    cyl(0, 0, 0, w, d, 5, "black"),
    cyl(0, 0, 5, 5, 5, 38, "metal"),
    box(0, 0, 43, w * 0.8, d * 0.75, 7, "main"),
    box(0, -d / 2 + 6, 50, w * 0.7, 5, h - 50, "main"),
  ];
}

export function monitor({ w, d, h }: Dims): Part[] {
  return [
    box(0, 0, 0, w * 0.35, d, 1.5, "black"),
    box(0, -d / 4, 0, 3, 3, h * 0.4, "black"),
    box(0, -d / 4, h * 0.35, w, 2, h * 0.65, "black"),
  ];
}

export function laptop({ w, d, h }: Dims): Part[] {
  return [box(0, d / 6, 0, w, d * 0.66, 1.5, "metal"), box(0, -d / 3 + 0.5, 1.5, w, 1, h, "metal")];
}

export function printer({ w, d, h }: Dims): Part[] {
  return [box(0, 0, 0, w, d, h, "main"), box(0, d / 2 - 4, h * 0.6, w * 0.6, 8, 1, "white")];
}

// ----------------------------------------------------- kitchen and bathroom

export function kitchenUnit({ w, d, h }: Dims, p: Params): Part[] {
  const kind = str(p, "kind", "base");
  if (kind === "wall") return cabinet({ w, d, h }, { doors: Math.max(1, Math.round(w / 50)) });
  const plinth = 10;
  const parts: Part[] = [
    box(0, -2, 0, w, d - 6, plinth, "black"),
    box(0, 0, plinth, w, d - 2, h - plinth - 4, "main"),
  ];
  parts.push(box(0, 1, h - 4, w + 1, d + 2, 4, "second"));
  const doors = Math.max(1, Math.round(w / 50));
  for (let i = 0; i < doors; i++)
    parts.push(
      box(
        -w / 2 + (w / doors) * (i + 0.5),
        d / 2 - 1,
        plinth + 1,
        w / doors - 1,
        1.5,
        h - plinth - 7,
        "main",
      ),
    );
  if (kind === "sink") {
    parts.push(
      box(0, 0, h - 3, Math.min(w - 10, 50), d * 0.6, 1, "metal"),
      cyl(0, -d / 2 + 8, h, 3, 3, 25, "metal"),
    );
  }
  if (kind === "hob") {
    for (const [x, y] of [
      [-12, -10],
      [12, -10],
      [-12, 12],
      [12, 12],
    ] as const) {
      parts.push(cyl(x, y, h, 16, 16, 0.6, "black"));
    }
  }
  if (kind === "island") parts.push(box(0, d / 2 - 15, h - 4, w + 10, 30, 4, "second"));
  return parts;
}

export function appliance({ w, d, h }: Dims, p: Params): Part[] {
  const kind = str(p, "kind", "washer");
  const parts: Part[] = [
    box(0, 0, 0, w, d, h, kind === "oven" || kind === "microwave" ? "black" : "white"),
  ];
  if (kind === "washer" || kind === "dryer")
    parts.push(cyl(0, d / 2, h * 0.3, w * 0.55, 2, w * 0.55, "glass"));
  if (kind === "fridge")
    parts.push(
      box(-w / 2 + 4, d / 2 + 1, h * 0.45, 2, 2, 30, "metal"),
      box(0, d / 2, h * 0.38, w - 1, 0.6, 0.6, "black"),
    );
  if (kind === "dishwasher") parts.push(box(0, d / 2 + 1, h - 8, w * 0.6, 2, 2, "metal"));
  if (kind === "oven" || kind === "microwave")
    parts.push(box(0, d / 2, h * 0.15, w * 0.8, 1, h * 0.6, "glass"));
  return parts;
}

export function vanity({ w, d, h }: Dims, p: Params): Part[] {
  const wall = bool(p, "wall");
  const z = wall ? 0 : 0;
  const parts = [box(0, 0, z, w, d, h - 12, "main"), box(0, 0, h - 12, w, d, 12, "white")];
  parts.push(
    cyl(0, 2, h - 2, w * 0.45, d * 0.55, 2, "white"),
    cyl(0, -d / 2 + 5, h, 3, 3, 18, "metal"),
  );
  return parts;
}

export function basin({ w, d, h }: Dims): Part[] {
  return [
    box(0, 0, h - 15, w, d, 15, "white"),
    cyl(0, 2, h - 1, w * 0.7, d * 0.6, 1, "glass"),
    box(0, -d / 2 + 3, h * 0.2, 8, 6, h * 0.65, "white"),
  ];
}

export function shower({ w, d, h }: Dims, p: Params): Part[] {
  const parts = [box(0, 0, 0, w, d, 4, "white"), box(w / 2 - 0.5, 0, 4, 1, d, h - 4, "glass")];
  if (!bool(p, "walkin")) parts.push(box(0, d / 2 - 0.5, 4, w, 1, h - 4, "glass"));
  parts.push(
    cyl(-w / 4, -d / 2 + 6, h - 20, 18, 18, 2, "metal"),
    cyl(-w / 4, -d / 2 + 2, 4, 2, 2, h - 20, "metal"),
  );
  return parts;
}

export function bathtub({ w, d, h }: Dims, p: Params): Part[] {
  if (bool(p, "freestanding")) {
    return [
      cyl(0, 0, 8, w, d, h - 8, "white"),
      cyl(0, 0, h - 1, w - 8, d - 8, 1, "glass"),
      ...legs(w * 0.8, d * 0.7, 8, 5, 0, "metal", true),
    ];
  }
  return [box(0, 0, 0, w, d, h, "white"), box(0, 0, h - 1, w - 12, d - 12, 1, "glass")];
}

export function toilet({ w, d, h }: Dims, p: Params): Part[] {
  const wall = bool(p, "wall");
  return [
    box(0, -d / 2 + 8, wall ? 30 : 0, w, 16, wall ? h - 30 : h, "white"),
    ball(0, 6, wall ? 25 : 0, w * 0.9, d * 0.75, 42 - (wall ? 25 : 0), "white"),
  ];
}

/** Water/drain connection marker (installations layer). */
export function marker({ w, d, h }: Dims, p: Params): Part[] {
  return [cyl(0, 0, 0, w, d, h, str(p, "kind", "water") === "drain" ? "black" : "metal")];
}

// --------------------------------------------------------------- decor

export function plant({ w, d, h }: Dims, p: Params): Part[] {
  const kind = str(p, "kind", "monstera");
  const potH = Math.min(h * 0.3, 40);
  const pot = cyl(0, 0, 0, w * 0.55, d * 0.55, potH, "second");
  const top = h - potH;
  switch (kind) {
    case "palm":
    case "bamboo":
      return [
        pot,
        cyl(0, 0, potH, 3, 3, top * 0.7, "wood"),
        cone(0, 0, potH + top * 0.4, w, d, top * 0.6, "leaf"),
      ];
    case "olive":
    case "ficus":
    case "fiddle":
      return [
        pot,
        cyl(0, 0, potH, 3, 3, top * 0.5, "wood"),
        ball(0, 0, potH + top * 0.35, w, d, top * 0.65, "leaf"),
      ];
    case "snake":
      return [
        pot,
        ...[-0.2, 0, 0.2].map((o) =>
          cone(o * w, o * d * 0.5, potH, w * 0.25, d * 0.25, top, "leaf"),
        ),
      ];
    case "cactus":
      return [
        pot,
        cyl(0, 0, potH, w * 0.3, d * 0.3, top, "leaf"),
        cyl(w * 0.18, 0, potH + top * 0.4, w * 0.15, d * 0.15, top * 0.35, "leaf"),
      ];
    case "fern":
    case "pothos":
      return [pot, ball(0, 0, potH * 0.6, w, d, top + potH * 0.4, "leaf")];
    case "orchid":
      return [
        pot,
        cyl(0, 0, potH, 1, 1, top, "wood"),
        ball(w * 0.15, 0, potH + top * 0.7, w * 0.5, d * 0.3, top * 0.3, "white"),
      ];
    case "succulent":
      return [pot, ball(0, 0, potH, w * 0.7, d * 0.7, top, "leaf")];
    case "hanging":
      return [
        cyl(0, 0, h * 0.5, w * 0.5, d * 0.5, h * 0.2, "second"),
        ball(0, 0, 0, w, d, h * 0.6, "leaf"),
      ];
    default:
      return [
        pot,
        ball(0, 0, potH, w, d, top * 0.9, "leaf"),
        ball(w * 0.2, 0, potH + top * 0.4, w * 0.6, d * 0.6, top * 0.6, "leaf"),
      ];
  }
}

export function vase({ w, d, h }: Dims, p: Params): Part[] {
  if (!bool(p, "flowers")) return [cyl(0, 0, 0, w, d, h, "main")];
  return [
    cyl(0, 0, 0, w * 0.6, d * 0.6, h * 0.6, "main"),
    ball(0, 0, h * 0.55, w, d, h * 0.45, "second"),
  ];
}

export function candles({ w, d, h }: Dims, p: Params): Part[] {
  const n = num(p, "count", 1);
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? 0 : -w / 2 + (w / n) * (i + 0.5);
    const ch = h * (1 - (i % 3) * 0.2);
    parts.push(
      cyl(x, 0, 0, Math.min(w / n, d) * 0.8, d * 0.8, ch - 2, "white"),
      cone(x, 0, ch - 2, 1, 1, 2, "light"),
    );
  }
  return parts;
}

export function books({ w, d, h }: Dims, p: Params): Part[] {
  const n = num(p, "count", 3);
  const parts: Part[] = [];
  const stacked = bool(p, "stack");
  for (let i = 0; i < n; i++) {
    if (stacked)
      parts.push(
        box(
          ((i % 2) - 0.5) * 2,
          0,
          (i * h) / n,
          w - (i % 3) * 2,
          d - (i % 2) * 2,
          h / n - 0.3,
          i % 2 ? "main" : "second",
        ),
      );
    else
      parts.push(
        box(
          -w / 2 + (w / n) * (i + 0.5),
          0,
          0,
          w / n - 0.4,
          d,
          h * (0.8 + (i % 3) * 0.1),
          i % 2 ? "main" : "second",
        ),
      );
  }
  return parts;
}

export function rug({ w, d, h }: Dims, p: Params): Part[] {
  const make = bool(p, "round") ? cyl : box;
  return [make(0, 0, 0, w, d, h, "main"), make(0, 0, h, w * 0.85, d * 0.85, 0.2, "second")];
}

export function curtains({ w, d, h }: Dims, p: Params): Part[] {
  const parts: Part[] = [cyl(0, 0, h - 3, w + 10, 3, 3, "metal")];
  const panel = w * (bool(p, "closed") ? 0.5 : 0.22);
  parts.push(
    box(-w / 2 + panel / 2, 0, 0, panel, d, h - 4, "main"),
    box(w / 2 - panel / 2, 0, 0, panel, d, h - 4, "main"),
  );
  return parts;
}

export function cushion({ w, d, h }: Dims): Part[] {
  return [box(0, 0, 0, w, d, h, "main")];
}

export function throwBlanket({ w, d, h }: Dims): Part[] {
  return [box(0, 0, 0, w, d, h, "main"), box(0, d / 2 - 3, 0, w, 1, h + 1, "second")];
}

export function bowl({ w, d, h }: Dims, p: Params): Part[] {
  const parts: Part[] = [cyl(0, 0, 0, w, d, h, "main")];
  if (bool(p, "fruit"))
    for (let i = 0; i < 3; i++)
      parts.push(ball((i - 1) * w * 0.2, 0, h * 0.6, w * 0.3, w * 0.3, w * 0.3, "second"));
  return parts;
}

export function sculpture({ w, d, h }: Dims): Part[] {
  return [
    box(0, 0, 0, w, d, h * 0.15, "black"),
    ball(0, 0, h * 0.15, w * 0.8, d * 0.8, h * 0.85, "main"),
  ];
}

export function clock({ w, d, h }: Dims): Part[] {
  return [cyl(0, 0, 0, w, d, h, "main"), cyl(0, 1, h * 0.1, w * 0.85, d, h * 0.8, "white")];
}

// ------------------------------------------------------------- lighting

export function lamp({ w, d, h }: Dims, p: Params): Part[] {
  const kind = str(p, "kind", "floor");
  switch (kind) {
    case "pendant":
      return [
        cyl(0, 0, h - 2, 10, 10, 2, "black"),
        cyl(0, 0, h * 0.35, 1, 1, h * 0.65, "black"),
        cone(0, 0, 0, w, d, h * 0.35, "second"),
        ball(0, 0, 2, w * 0.3, d * 0.3, w * 0.3, "light"),
      ];
    case "globe":
      return [
        cyl(0, 0, h - 2, 10, 10, 2, "black"),
        cyl(0, 0, w, 1, 1, h - w, "black"),
        ball(0, 0, 0, w, d, w, "light"),
      ];
    case "ceiling":
      return [cyl(0, 0, 0, w, d, h, "light")];
    case "spots":
      return [
        box(0, 0, h - 3, w, 4, 3, "black"),
        ...[-1, 0, 1].map((i) => cyl((i * w) / 3, 0, 0, 7, 7, h - 3, "black")),
      ];
    case "chandelier": {
      const parts: Part[] = [
        cyl(0, 0, h * 0.5, 2, 2, h * 0.5, "metal"),
        ball(0, 0, h * 0.35, w * 0.25, d * 0.25, h * 0.2, "metal"),
      ];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        parts.push(
          cyl((Math.cos(a) * w) / 2.6, (Math.sin(a) * d) / 2.6, h * 0.3, 3, 3, h * 0.12, "light"),
        );
      }
      parts.push(cyl(0, 0, h * 0.3, w, d, 1, "metal"));
      return parts;
    }
    case "wall":
      return [
        box(0, -d / 2 + 1, 0, 10, 2, h, "metal"),
        cone(0, 0, h * 0.2, w, d * 0.8, h * 0.6, "second"),
      ];
    case "table":
      return [
        cyl(0, 0, 0, w * 0.5, d * 0.5, 2, "main"),
        cyl(0, 0, 2, 2, 2, h * 0.55, "main"),
        cone(0, 0, h * 0.5, w, d, h * 0.5, "second"),
      ];
    case "arc":
      return [
        box(-w / 2 + 15, 0, 0, 30, 30, 4, "black"),
        cyl(-w / 2 + 15, 0, 4, 2, 2, h - 30, "metal"),
        box(0, 0, h - 30, w - 30, 2, 2, "metal"),
        cone(w / 2 - 20, 0, h - 60, 40, 40, 30, "second"),
      ];
    case "tripod":
      return [
        ...legs(w * 0.7, d * 0.7, h * 0.65, 2, 0, "wood", true),
        cyl(0, 0, h * 0.6, w, d, h * 0.4, "second"),
      ];
    case "strip":
      return [box(0, 0, 0, w, d, h, "light")];
    default:
      return [
        cyl(0, 0, 0, w * 0.6, d * 0.6, 3, "black"),
        cyl(0, 0, 3, 2.5, 2.5, h - 30, "metal"),
        cyl(0, 0, h - 35, w, d, 35, "second"),
      ];
  }
}

// ------------------------------------------------------------------ life

export function laidTable({ w, d, h }: Dims, p: Params): Part[] {
  const places = num(p, "places", 4);
  const parts: Part[] = [];
  const perSide = Math.ceil(places / 2);
  for (let i = 0; i < places; i++) {
    const side = i < perSide ? -1 : 1;
    const k = i % perSide;
    const x = -w / 2 + (w / perSide) * (k + 0.5);
    const y = (side * d) / 3;
    parts.push(
      cyl(x, y, 0, 26, 26, 1.5, "white"),
      box(x - 16, y, 0, 2, 18, 0.5, "metal"),
      box(x + 16, y, 0, 2, 18, 0.5, "metal"),
    );
    parts.push(cyl(x + 12, y - side * 14, 0, 7, 7, h, "glass"));
  }
  parts.push(...bowl({ w: 26, d: 26, h: 8 }, { fruit: true }));
  return parts;
}

export function basket({ w, d, h }: Dims, p: Params): Part[] {
  const parts: Part[] = [cyl(0, 0, 0, w, d, h, "main")];
  if (bool(p, "full")) parts.push(ball(0, 0, h * 0.7, w * 0.85, d * 0.85, h * 0.45, "second"));
  return parts;
}

export function shoes({ w, d, h }: Dims): Part[] {
  return [box(-w / 4, 0, 0, w / 2 - 2, d, h, "main"), box(w / 4, 2, 0, w / 2 - 2, d, h, "main")];
}

export function coats({ w, d, h }: Dims): Part[] {
  return [
    box(-w / 4, 0, 0, w / 2 - 4, d, h, "main"),
    box(w / 4, 0, h * 0.1, w / 2 - 4, d, h * 0.9, "second"),
  ];
}

export function toys({ w, d, h }: Dims): Part[] {
  return [
    box(-w / 4, 0, 0, w / 3, d / 2, h * 0.5, "main"),
    ball(w / 4, -d / 5, 0, h * 0.6, h * 0.6, h * 0.6, "second"),
    box(0, d / 4, 0, w / 4, d / 4, h, "white"),
  ];
}

export function mug({ w, d, h }: Dims): Part[] {
  return [
    cyl(0, 0, 0, w * 0.75, d, h, "main"),
    box(w * 0.4, 0, h * 0.3, w * 0.2, 1, h * 0.4, "main"),
  ];
}

export function generic({ w, d, h }: Dims): Part[] {
  return [box(0, 0, 0, w, d, h, "main")];
}
