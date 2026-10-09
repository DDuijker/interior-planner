"use client";

import { memo } from "react";
import { itemFootprint } from "@/core/collision/collision";
import { roomLabelPosition, roomPath } from "@/core/editor/rooms";
import { roomArea } from "@/core/editor/rooms";
import { formatArea, formatLength } from "@/core/measure/units";
import type { DimensionLine } from "@/core/measure/dimensions";
import { doorSwing, type WallPiece } from "@/core/openings/openings";
import type { Fixture, Id, Item, Opening, Room, Unit, Wall } from "@/core/model/types";
import { ROOM_TINTS } from "./roomColors";

/** Screen pixels to world units at the current zoom. */
export type Px = (px: number) => number;

export const RoomsLayer = memo(function RoomsLayer({ rooms }: { rooms: readonly Room[] }) {
  return (
    <g className="plan-rooms">
      {rooms.map((room) => (
        <path
          key={room.id}
          d={roomPath(room)}
          fill={ROOM_TINTS[room.type]}
          className="plan-room"
          data-room={room.id}
        />
      ))}
    </g>
  );
});

export const WallsLayer = memo(function WallsLayer({ pieces }: { pieces: readonly WallPiece[] }) {
  return (
    <g className="plan-walls">
      {pieces.map((p, i) => (
        <rect
          key={`${p.wallId}-${i}`}
          x={p.rect.x}
          y={p.rect.y}
          width={p.rect.w}
          height={p.rect.d}
          className={p.kind === "low" ? "plan-wall-low" : "plan-wall"}
        />
      ))}
    </g>
  );
});

export const OpeningsLayer = memo(function OpeningsLayer({
  openings,
  walls,
}: {
  openings: readonly Opening[];
  walls: readonly Wall[];
}) {
  return (
    <g className="plan-openings">
      {openings.map((o) => {
        const wall = walls.find((w) => w.id === o.wallId);
        const t = wall ? (o.dir === "h" ? wall.rect.d : wall.rect.w) : 10;
        const across =
          o.dir === "h"
            ? { x: o.x, y: o.y - t / 2, w: o.w, d: t }
            : { x: o.x - t / 2, y: o.y, w: t, d: o.w };
        if (o.kind === "window") {
          const mid = o.dir === "h" ? `M${o.x} ${o.y}h${o.w}` : `M${o.x} ${o.y}v${o.w}`;
          return (
            <g key={o.id} className={o.glass ? "plan-glass" : "plan-window"}>
              <rect x={across.x} y={across.y} width={across.w} height={across.d} />
              <path d={mid} />
            </g>
          );
        }
        const s = doorSwing(o, t);
        const sweep = sweepFlag(o);
        return (
          <g key={o.id} className="plan-door">
            <rect
              x={across.x}
              y={across.y}
              width={across.w}
              height={across.d}
              className="plan-door-gap"
            />
            <path
              d={`M${s.hinge.x} ${s.hinge.y}L${s.open.x} ${s.open.y}`}
              className="plan-door-leaf"
            />
            <path
              d={`M${s.open.x} ${s.open.y}A${s.radius} ${s.radius} 0 0 ${sweep} ${s.closed.x} ${s.closed.y}`}
              className="plan-door-arc"
            />
          </g>
        );
      })}
    </g>
  );
});

/** SVG arc sweep flag from the open leaf back to the closed position. */
function sweepFlag(o: Opening & { kind: "door" }): 0 | 1 {
  const start = o.hinge === "start";
  const b = o.swing === "b";
  if (o.dir === "h") return start === b ? 0 : 1;
  return start === b ? 1 : 0;
}

export const FixturesLayer = memo(function FixturesLayer({
  fixtures,
  conflicts,
}: {
  fixtures: readonly Fixture[];
  conflicts: ReadonlySet<Id>;
}) {
  return (
    <g className="plan-fixtures">
      {fixtures.map((f) => (
        <g
          key={f.id}
          transform={`rotate(${f.rotation} ${f.x + f.w / 2} ${f.y + f.d / 2})`}
          className={`plan-fixture${conflicts.has(f.id) ? " is-conflict" : ""}${f.locked ? "" : " is-unlocked"}`}
          data-fixture={f.id}
        >
          <rect x={f.x} y={f.y} width={f.w} height={f.d} rx={2} />
          <FixtureGlyph f={f} />
        </g>
      ))}
    </g>
  );
});

function FixtureGlyph({ f }: { f: Fixture }) {
  const cx = f.x + f.w / 2,
    cy = f.y + f.d / 2;
  switch (f.type) {
    case "toilet":
      return <ellipse cx={cx} cy={f.y + f.d * 0.6} rx={f.w * 0.35} ry={f.d * 0.32} />;
    case "sink":
      return <ellipse cx={cx} cy={cy} rx={f.w * 0.32} ry={f.d * 0.3} />;
    case "bath":
      return (
        <rect
          x={f.x + 6}
          y={f.y + 6}
          width={f.w - 12}
          height={f.d - 12}
          rx={Math.min(f.w, f.d) / 3}
        />
      );
    case "shower":
      return (
        <path
          d={`M${f.x} ${f.y}L${f.x + f.w} ${f.y + f.d}M${f.x + f.w} ${f.y}L${f.x} ${f.y + f.d}`}
        />
      );
    case "stairs": {
      const steps = Math.max(2, Math.floor(f.d / 25));
      return (
        <path
          d={Array.from(
            { length: steps },
            (_, i) => `M${f.x} ${f.y + ((i + 1) * f.d) / (steps + 1)}h${f.w}`,
          ).join("")}
        />
      );
    }
    case "kitchen":
      return <path d={`M${f.x} ${f.y + f.d * 0.8}h${f.w}`} />;
    case "fridge":
    case "tall":
      return <path d={`M${f.x} ${f.y}L${f.x + f.w} ${f.y + f.d}`} />;
    default:
      return null;
  }
}

export const ItemShape = memo(function ItemShape({
  item,
  selected,
  conflict,
  px,
  showName,
}: {
  item: Item;
  selected: boolean;
  conflict: boolean;
  px: Px;
  showName: boolean;
}) {
  const cls = [
    "plan-item",
    `plan-item-${item.mount}`,
    selected && "is-selected",
    conflict && "is-conflict",
  ]
    .filter(Boolean)
    .join(" ");
  const fill = item.color ?? "var(--c-panel)";
  const hw = item.w / 2,
    hd = item.d / 2;
  return (
    <g
      className={cls}
      data-item={item.id}
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
    >
      {item.shape === "round" ? (
        <ellipse rx={hw} ry={hd} fill={fill} />
      ) : (
        <>
          <rect
            x={-hw}
            y={-hd}
            width={item.w}
            height={item.d}
            rx={Math.min(4, hw, hd)}
            fill={fill}
          />
          {/* Back edge, so you can see which way it faces. */}
          {item.mount !== "wall" && (
            <path d={`M${-hw} ${-hd}h${item.w}`} className="plan-item-back" />
          )}
        </>
      )}
      {conflict && (
        <path
          d={`M${-hw} ${-hd}L${hw} ${hd}M${hw} ${-hd}L${-hw} ${hd}`}
          className="plan-item-conflict-mark"
        />
      )}
      {showName && Math.min(item.w, item.d) > px(28) && (
        <text
          className="plan-item-name"
          fontSize={px(11)}
          transform={`rotate(${-item.rotation})`}
          textAnchor="middle"
          dominantBaseline="middle"
        >
          {item.name}
        </text>
      )}
    </g>
  );
});

export function RoomLabels({
  rooms,
  unit,
  px,
  names,
}: {
  rooms: readonly Room[];
  unit: Unit;
  px: Px;
  names: (room: Room) => string;
}) {
  return (
    <g className="plan-labels">
      {rooms
        .filter((r) => !r.labelHidden)
        .map((room) => {
          const p = roomLabelPosition(room);
          return (
            <g
              key={room.id}
              transform={`translate(${p.x} ${p.y})`}
              className="plan-label"
              data-label={room.id}
            >
              <text textAnchor="middle" fontSize={px(13)} className="plan-label-name">
                {names(room)}
              </text>
              <text textAnchor="middle" y={px(16)} fontSize={px(11)} className="plan-label-area">
                {formatArea(roomArea(room), unit)}
              </text>
            </g>
          );
        })}
    </g>
  );
}

export function DimensionLines({
  lines,
  unit,
  px,
}: {
  lines: readonly DimensionLine[];
  unit: Unit;
  px: Px;
}) {
  return (
    <g className="plan-dimensions" aria-hidden="true">
      {lines.map((l) => {
        const mx = (l.from.x + l.to.x) / 2,
          my = (l.from.y + l.to.y) / 2;
        return (
          <g key={l.direction}>
            <path d={`M${l.from.x} ${l.from.y}L${l.to.x} ${l.to.y}`} />
            <text
              x={mx + (l.direction === "N" || l.direction === "S" ? px(4) : 0)}
              y={my - px(4)}
              fontSize={px(11)}
            >
              {formatLength(l.length, unit)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

/** Outline of a selected item's footprint (works for rotated and round items). */
export function footprintPath(item: Item): string {
  return (
    itemFootprint(item)
      .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
      .join("") + "Z"
  );
}
