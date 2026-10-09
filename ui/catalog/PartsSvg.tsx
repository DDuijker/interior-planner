"use client";

import { memo } from "react";
import { partColor, type CatalogEntry } from "@/catalog";
import type { Item, Part } from "@/core/model/types";

/** Parts seen from above, lowest first. Coordinates are the item's own frame. */
export function TopView({
  parts,
  item,
  entry,
  strokeWidth,
}: {
  parts: readonly Part[];
  item: Pick<Item, "color" | "color2">;
  entry?: CatalogEntry;
  strokeWidth: number;
}) {
  const sorted = [...parts].sort((a, b) => a.z + a.h - (b.z + b.h));
  return (
    <>
      {sorted.map((p, i) => {
        const fill = partColor(p, item, entry);
        return p.shape === "box" ? (
          <rect
            key={i}
            x={p.x - p.w / 2}
            y={p.y - p.d / 2}
            width={p.w}
            height={p.d}
            fill={fill}
            strokeWidth={strokeWidth}
          />
        ) : (
          <ellipse
            key={i}
            cx={p.x}
            cy={p.y}
            rx={p.w / 2}
            ry={p.d / 2}
            fill={fill}
            strokeWidth={strokeWidth}
          />
        );
      })}
    </>
  );
}

/** Small icon of a catalog entry for the catalogue list. */
export const EntryThumb = memo(function EntryThumb({
  entry,
  size = 44,
}: {
  entry: CatalogEntry;
  size?: number;
}) {
  const { w, d } = entry.size;
  const m = Math.max(w, d) * 0.08;
  const parts = entry.build(entry.size, entry.params ?? {});
  return (
    <svg
      className="entry-thumb"
      width={size}
      height={size}
      viewBox={`${-w / 2 - m} ${-d / 2 - m} ${w + 2 * m} ${d + 2 * m}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <g stroke="var(--c-text)">
        <TopView parts={parts} item={{}} entry={entry} strokeWidth={Math.max(w, d) / 60} />
      </g>
    </svg>
  );
});
