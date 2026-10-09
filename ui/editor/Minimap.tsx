"use client";

import { roomPath } from "@/core/editor/rooms";
import type { Point, Rect, Room } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { ROOM_TINTS } from "./roomColors";

const W = 160;

/** Overview of the whole plan with the visible area. Click or tap to jump. */
export function Minimap({
  rooms,
  bounds,
  view,
  onCenter,
}: {
  rooms: readonly Room[];
  bounds: Rect;
  view: Rect;
  onCenter: (p: Point) => void;
}) {
  const { t } = useI18n();
  const pad = 40;
  const vb = { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + 2 * pad, d: bounds.d + 2 * pad };
  const h = Math.max(60, Math.min(160, (W * vb.d) / Math.max(vb.w, 1)));
  // Only useful when part of the plan is off screen.
  const allVisible =
    view.x <= bounds.x &&
    view.y <= bounds.y &&
    view.x + view.w >= bounds.x + bounds.w &&
    view.y + view.d >= bounds.y + bounds.d;
  if (allVisible) return null;

  return (
    <svg
      className="minimap"
      role="button"
      tabIndex={0}
      aria-label={t("editor.minimap")}
      width={W}
      height={h}
      viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.d}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerDown={(e) => {
        e.stopPropagation();
        const svg = e.currentTarget;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const m = svg.getScreenCTM();
        if (!m) return;
        const p = pt.matrixTransform(m.inverse());
        onCenter({ x: p.x, y: p.y });
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCenter({ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.d / 2 });
        }
      }}
    >
      {rooms.map((r) => (
        <path
          key={r.id}
          d={roomPath(r)}
          fill={ROOM_TINTS[r.type]}
          stroke="var(--c-text-muted)"
          strokeWidth={vb.w / W}
        />
      ))}
      <rect
        x={view.x}
        y={view.y}
        width={view.w}
        height={view.d}
        className="minimap-view"
        strokeWidth={(2 * vb.w) / W}
      />
    </svg>
  );
}
