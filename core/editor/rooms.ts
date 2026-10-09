import { polygonArea, polygonCentroid } from "../geometry/polygon";
import { rectArea, rectCenter, unionArea } from "../geometry/rect";
import type { Point, Room } from "../model/types";

/** Floor area in cm² (overlapping rects counted once). */
export function roomArea(room: Room): number {
  return room.shape.kind === "rects" ? unionArea(room.shape.rects) : polygonArea(room.shape.points);
}

/** Where the label goes before the user's offset: inside the largest part. */
export function roomLabelAnchor(room: Room): Point {
  if (room.shape.kind === "polygon") return polygonCentroid(room.shape.points);
  const largest = [...room.shape.rects].sort((a, b) => rectArea(b) - rectArea(a))[0]!;
  return rectCenter(largest);
}

export function roomLabelPosition(room: Room): Point {
  const a = roomLabelAnchor(room);
  return { x: a.x + (room.labelOffset?.x ?? 0), y: a.y + (room.labelOffset?.y ?? 0) };
}

/** SVG path for a room's floor. */
export function roomPath(room: Room): string {
  if (room.shape.kind === "polygon") {
    return room.shape.points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("") + "Z";
  }
  return room.shape.rects.map((r) => `M${r.x} ${r.y}h${r.w}v${r.d}h${-r.w}Z`).join("");
}
