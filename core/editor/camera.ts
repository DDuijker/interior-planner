import type { Point, Rect } from "../model/types";

/**
 * 2D view: `x, y` is the world point (cm) at the top-left of the viewport,
 * `scale` is screen pixels per cm.
 */
export interface Camera {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 8;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function worldToScreen(cam: Camera, p: Point): Point {
  return { x: (p.x - cam.x) * cam.scale, y: (p.y - cam.y) * cam.scale };
}

export function screenToWorld(cam: Camera, p: Point): Point {
  return { x: p.x / cam.scale + cam.x, y: p.y / cam.scale + cam.y };
}

/** Zoom by `factor` keeping the world point under `screen` fixed. */
export function zoomAt(cam: Camera, screen: Point, factor: number): Camera {
  const scale = clampScale(cam.scale * factor);
  const world = screenToWorld(cam, screen);
  return { scale, x: world.x - screen.x / scale, y: world.y - screen.y / scale };
}

/** Pan by a screen-space delta (dragging the plan along with the pointer). */
export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { ...cam, x: cam.x - dx / cam.scale, y: cam.y - dy / cam.scale };
}

/** Camera that shows `bounds` centred in a viewport of `width` x `height` px. */
export function fitBounds(bounds: Rect, width: number, height: number, padding = 40): Camera {
  const w = Math.max(1, width - 2 * padding);
  const h = Math.max(1, height - 2 * padding);
  const scale = clampScale(Math.min(w / Math.max(bounds.w, 1), h / Math.max(bounds.d, 1)));
  return {
    scale,
    x: bounds.x + bounds.w / 2 - width / 2 / scale,
    y: bounds.y + bounds.d / 2 - height / 2 / scale,
  };
}

/** World rect visible in a viewport (for culling and the minimap). */
export function visibleRect(cam: Camera, width: number, height: number): Rect {
  return { x: cam.x, y: cam.y, w: width / cam.scale, d: height / cam.scale };
}

/** Pinch: new camera from two pointers moving from (a0, b0) to (a1, b1). */
export function pinch(cam: Camera, a0: Point, b0: Point, a1: Point, b1: Point): Camera {
  const d0 = Math.hypot(b0.x - a0.x, b0.y - a0.y);
  const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
  const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
  const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
  const zoomed = d0 > 0 ? zoomAt(cam, mid0, d1 / d0) : cam;
  return panBy(zoomed, mid1.x - mid0.x, mid1.y - mid0.y);
}
