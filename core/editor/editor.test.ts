import { describe, expect, it } from "vitest";
import type { Item, Room } from "../model/types";
import {
  backForRotation,
  DEFAULT_KEYMAP,
  fitBounds,
  formatCombo,
  handlePositions,
  hitItem,
  itemsInRect,
  matchShortcut,
  panBy,
  pinch,
  resizeFromHandle,
  roomArea,
  roomLabelPosition,
  roomPath,
  rotationForBack,
  rotationFromPointer,
  screenToWorld,
  snapAngle,
  snapPoint,
  snapValue,
  visibleRect,
  worldToScreen,
  zoomAt,
  type KeyLike,
} from "./index";

const cam = { x: 100, y: 50, scale: 2 };

describe("camera", () => {
  it("converts between world and screen", () => {
    expect(worldToScreen(cam, { x: 110, y: 60 })).toEqual({ x: 20, y: 20 });
    expect(screenToWorld(cam, { x: 20, y: 20 })).toEqual({ x: 110, y: 60 });
  });

  it("zooms around the pointer", () => {
    const pointer = { x: 200, y: 100 };
    const before = screenToWorld(cam, pointer);
    const zoomed = zoomAt(cam, pointer, 1.5);
    expect(zoomed.scale).toBe(3);
    const after = screenToWorld(zoomed, pointer);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("clamps zoom", () => {
    expect(zoomAt(cam, { x: 0, y: 0 }, 1000).scale).toBe(8);
    expect(zoomAt(cam, { x: 0, y: 0 }, 0.0001).scale).toBe(0.05);
  });

  it("pans with the pointer", () => {
    expect(panBy(cam, 20, -10)).toEqual({ x: 90, y: 55, scale: 2 });
  });

  it("fits bounds in the viewport", () => {
    const fit = fitBounds({ x: 0, y: 0, w: 1000, d: 500 }, 1080, 580, 40);
    expect(fit.scale).toBe(1);
    expect(fit).toMatchObject({ x: -40, y: -40 });
    expect(visibleRect(fit, 1080, 580)).toEqual({ x: -40, y: -40, w: 1080, d: 580 });
  });

  it("pinches: spreading fingers zooms in, moving them pans", () => {
    const a0 = { x: 100, y: 100 },
      b0 = { x: 200, y: 100 };
    const zoomed = pinch(cam, a0, b0, { x: 50, y: 100 }, { x: 250, y: 100 });
    expect(zoomed.scale).toBe(4);
    const panned = pinch(cam, a0, b0, { x: 110, y: 100 }, { x: 210, y: 100 });
    expect(panned.scale).toBe(2);
    expect(panned.x).toBeCloseTo(95);
    expect(pinch(cam, a0, a0, a0, b0).scale).toBe(2);
  });
});

describe("snapping", () => {
  it("snaps values, points and angles", () => {
    expect(snapValue(23, 10)).toBe(20);
    expect(snapValue(25, 10)).toBe(30);
    expect(snapValue(-4, 10)).toBe(0);
    expect(snapValue(23, 0)).toBe(23);
    expect(snapPoint({ x: 12, y: 18 }, 5)).toEqual({ x: 10, y: 20 });
    expect(snapAngle(22)).toBe(15);
    expect(snapAngle(-10)).toBe(345);
    expect(snapAngle(359)).toBe(0);
    expect(snapAngle(22, 0)).toBe(22);
  });
});

describe("transforms", () => {
  const sofa = { x: 100, y: 100, w: 200, d: 80, rotation: 0 };

  it("maps 'back' to rotation and back", () => {
    expect(rotationForBack("N")).toBe(0);
    expect(rotationForBack("W")).toBe(270);
    expect(backForRotation(91)).toBe("E");
    expect(backForRotation(-90)).toBe("W");
    expect(backForRotation(350)).toBe("N");
  });

  it("rotates from the handle with 15 degree steps or freely", () => {
    const c = { x: 0, y: 0 };
    expect(rotationFromPointer(c, { x: 0, y: -10 })).toBe(0);
    expect(rotationFromPointer(c, { x: 10, y: 0 })).toBe(90);
    expect(rotationFromPointer(c, { x: 0, y: 10 })).toBe(180);
    expect(rotationFromPointer(c, { x: 10, y: -12 })).toBe(45);
    expect(rotationFromPointer(c, { x: 10, y: -12 }, 0)).toBeCloseTo(39.8, 1);
  });

  it("resizes from an edge, keeping the opposite edge", () => {
    const r = resizeFromHandle(sofa, "e", { x: 250, y: 100 });
    expect(r).toEqual({ x: 125, y: 100, w: 250, d: 80 }); // west edge stays at x = 0
    const n = resizeFromHandle(sofa, "n", { x: 0, y: 40 });
    expect(n).toMatchObject({ w: 200, d: 100, y: 90 });
  });

  it("resizes from a corner and respects the minimum", () => {
    const r = resizeFromHandle(sofa, "sw", { x: 400, y: 0 }, 10);
    expect(r).toMatchObject({ w: 10, d: 10, x: 195, y: 65 });
  });

  it("resizes rotated items in their own frame", () => {
    const rotated = { ...sofa, rotation: 90 };
    // Rotated 90: the item's east handle points south in the world.
    const r = resizeFromHandle(rotated, "e", { x: 100, y: 250 });
    expect(r.w).toBeCloseTo(250);
    expect(r.d).toBeCloseTo(80);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(125);
  });

  it("snaps sizes to the grid", () => {
    expect(resizeFromHandle(sofa, "e", { x: 253, y: 100 }, 5, 10).w).toBe(250);
  });

  it("places handles around rotated items", () => {
    const h = handlePositions({ ...sofa, rotation: 90 });
    expect(h.n.x).toBeCloseTo(140);
    expect(h.n.y).toBeCloseTo(100);
    expect(h.rotate.x).toBeCloseTo(170);
  });
});

function item(id: string, x: number, y: number, extra: Partial<Item> = {}): Item {
  return {
    id,
    catalogId: id,
    name: id,
    x,
    y,
    w: 100,
    d: 50,
    h: 50,
    rotation: 0,
    shape: "rect",
    layer: "furniture",
    mount: "floor",
    elevation: 0,
    ...extra,
  };
}

describe("hit testing", () => {
  const items = [item("a", 0, 0), item("b", 40, 0), item("c", 300, 300, { layer: "decor" })];

  it("picks the top-most item", () => {
    expect(hitItem(items, { x: 45, y: 0 })?.id).toBe("b");
    expect(hitItem(items, { x: -45, y: 0 })?.id).toBe("a");
    expect(hitItem(items, { x: 500, y: 500 })).toBeNull();
    expect(hitItem(items, { x: 45, y: 0 }, (i) => i.id !== "b")?.id).toBe("a");
  });

  it("selects with a marquee", () => {
    expect(itemsInRect(items, { x: -100, y: -100, w: 150, d: 200 })).toEqual(["a", "b"]);
    expect(
      itemsInRect(items, { x: -100, y: -100, w: 500, d: 500 }, (i) => i.layer !== "decor"),
    ).toEqual(["a", "b"]);
  });
});

describe("rooms", () => {
  const l: Room = {
    id: "l",
    name: "Woonkamer",
    type: "living",
    shape: {
      kind: "rects",
      rects: [
        { x: 0, y: 0, w: 400, d: 200 },
        { x: 0, y: 200, w: 200, d: 300 },
      ],
    },
  };

  it("computes area and label position", () => {
    expect(roomArea(l)).toBe(140000);
    expect(roomLabelPosition(l)).toEqual({ x: 200, y: 100 }); // centre of the largest rect
    expect(roomLabelPosition({ ...l, labelOffset: { x: 10, y: -20 } })).toEqual({ x: 210, y: 80 });
  });

  it("handles polygons", () => {
    const tri: Room = {
      ...l,
      shape: {
        kind: "polygon",
        points: [
          { x: 0, y: 0 },
          { x: 300, y: 0 },
          { x: 0, y: 300 },
        ],
      },
    };
    expect(roomArea(tri)).toBe(45000);
    expect(roomLabelPosition(tri)).toEqual({ x: 100, y: 100 });
    expect(roomPath(tri)).toBe("M0 0L300 0L0 300Z");
    expect(roomPath(l)).toBe("M0 0h400v200h-400ZM0 200h200v300h-200Z");
  });
});

describe("shortcuts", () => {
  const key = (k: string, mods: Partial<KeyLike> = {}): KeyLike => ({
    key: k,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    ...mods,
  });

  it("matches Ctrl on Windows/Linux and Cmd on macOS", () => {
    expect(matchShortcut(key("z", { ctrlKey: true }))).toBe("undo");
    expect(matchShortcut(key("Z", { ctrlKey: true, shiftKey: true }))).toBe("redo");
    expect(matchShortcut(key("z", { metaKey: true }), DEFAULT_KEYMAP, true)).toBe("undo");
    expect(matchShortcut(key("z", { metaKey: true }))).toBeNull();
    expect(matchShortcut(key("z", { ctrlKey: true }), DEFAULT_KEYMAP, true)).toBeNull();
  });

  it("matches plain keys only without modifiers", () => {
    expect(matchShortcut(key("Delete"))).toBe("delete");
    expect(matchShortcut(key("r"))).toBe("rotate");
    expect(matchShortcut(key("r", { altKey: true }))).toBeNull();
    expect(matchShortcut(key("?", { shiftKey: true }))).toBe("help");
    expect(matchShortcut(key("x"))).toBeNull();
  });

  it("is configurable", () => {
    const custom = { ...DEFAULT_KEYMAP, rotate: ["e"] };
    expect(matchShortcut(key("e"), custom)).toBe("rotate");
    expect(matchShortcut(key("r"), custom)).toBeNull();
  });

  it("formats combos per platform", () => {
    expect(formatCombo("Mod+Shift+z")).toBe("Ctrl+Shift+Z");
    expect(formatCombo("Mod+Shift+z", true)).toBe("⌘⇧Z");
    expect(formatCombo("Delete")).toBe("Delete");
  });
});
