import { itemFootprint } from "../collision/collision";
import { convexOverlap, pointInPolygon } from "../geometry/polygon";
import type { Id, Item, Point, Rect } from "../model/types";

/** Top-most item under `p` (later items are drawn on top). */
export function hitItem(
  items: readonly Item[],
  p: Point,
  isHittable: (i: Item) => boolean = () => true,
): Item | null {
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]!;
    if (isHittable(item) && pointInPolygon(p, itemFootprint(item))) return item;
  }
  return null;
}

/** Items whose footprint touches the marquee rectangle. */
export function itemsInRect(
  items: readonly Item[],
  rect: Rect,
  isHittable: (i: Item) => boolean = () => true,
): Id[] {
  const box = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.d },
    { x: rect.x, y: rect.y + rect.d },
  ];
  return items
    .filter((i) => isHittable(i) && convexOverlap(itemFootprint(i), box, 0))
    .map((i) => i.id);
}
