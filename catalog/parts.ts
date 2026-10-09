import type { Part, PartMaterial } from "@/core/model/types";

/** Part helpers. Coordinates: centre x, centre y (negative = back), base z. */
export const box = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  material: PartMaterial = "main",
  color?: string,
): Part => ({
  shape: "box",
  x,
  y,
  z,
  w: Math.max(0.5, w),
  d: Math.max(0.5, d),
  h: Math.max(0.5, h),
  material,
  ...(color ? { color } : {}),
});

export const cyl = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  material: PartMaterial = "main",
  color?: string,
): Part => ({
  ...box(x, y, z, w, d, h, material, color),
  shape: "cylinder",
});

export const ball = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  material: PartMaterial = "main",
  color?: string,
): Part => ({
  ...box(x, y, z, w, d, h, material, color),
  shape: "sphere",
});

export const cone = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  h: number,
  material: PartMaterial = "main",
  color?: string,
): Part => ({
  ...box(x, y, z, w, d, h, material, color),
  shape: "cone",
});

/** Four legs inset from the corners. */
export function legs(
  w: number,
  d: number,
  h: number,
  size = 4,
  inset = 4,
  material: PartMaterial = "wood",
  round = false,
): Part[] {
  const make = round ? cyl : box;
  const x = w / 2 - inset - size / 2;
  const y = d / 2 - inset - size / 2;
  return [
    make(-x, -y, 0, size, size, h, material),
    make(x, -y, 0, size, size, h, material),
    make(-x, y, 0, size, size, h, material),
    make(x, y, 0, size, size, h, material),
  ];
}
