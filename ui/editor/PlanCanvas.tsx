"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fitBounds,
  panBy,
  pinch,
  screenToWorld,
  visibleRect,
  zoomAt,
  type Camera,
} from "@/core/editor/camera";
import { hitItem, itemsInRect } from "@/core/editor/hit";
import { snapValue } from "@/core/editor/snap";
import {
  handlePositions,
  resizeFromHandle,
  rotationFromPointer,
  type Handle,
} from "@/core/editor/transform";
import { pointInPolygon } from "@/core/geometry/polygon";
import { rectFromPoints } from "@/core/geometry/rect";
import { fixtureFootprint } from "@/core/fixtures/fixtures";
import { dimensionLines, distance } from "@/core/measure/dimensions";
import { formatLength } from "@/core/measure/units";
import { moveItems, updateFixture, updateItems, updateRoom } from "@/core/model/actions";
import type { Id, Item, Point, Project, Rect, Room, Version, Wall } from "@/core/model/types";
import type { WallPiece } from "@/core/openings/openings";
import { useI18n } from "@/i18n/I18nProvider";
import {
  DimensionLines,
  FixturesLayer,
  footprintPath,
  ItemShape,
  OpeningsLayer,
  RoomLabels,
  RoomsLayer,
  WallsLayer,
} from "./layers";
import { Minimap } from "./Minimap";
import type { EditorAction, EditorState } from "./state";

export type ContextTarget = { kind: "item" | "room" | "fixture"; id: Id };

interface Props {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  project: Project;
  version: Version;
  walls: readonly Wall[];
  pieces: readonly WallPiece[];
  bounds: Rect;
  conflicts: ReadonlySet<Id>;
  spaceHeld: boolean;
  onContextMenu: (target: ContextTarget, at: Point) => void;
  /** Set by the editor to request a zoom-to-fit. */
  fitSignal: number;
}

type Gesture =
  | { kind: "pan"; last: Point }
  | { kind: "pinch"; a: Point; b: Point }
  | { kind: "drag"; ids: Id[]; start: Point; origin: Point; applied: Point; moved: boolean }
  | { kind: "fixture"; id: Id; start: Point; origin: Point }
  | { kind: "marquee"; start: Point; current: Point; additive: boolean }
  | { kind: "rotate"; id: Id; center: Point }
  | { kind: "resize"; id: Id; handle: Handle }
  | { kind: "label"; roomId: Id; start: Point; origin: Point };

const HANDLES: Handle[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];

export function PlanCanvas({
  state,
  dispatch,
  project,
  version,
  walls,
  pieces,
  bounds,
  conflicts,
  spaceHeld,
  onContextMenu,
  fitSignal,
}: Props) {
  const { t } = useI18n();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [measure, setMeasure] = useState<{ a: Point; b: Point; fixed: boolean } | null>(null);
  const { camera, selection, tool } = state;
  const { settings } = project;
  const unit = settings.unit;
  const px = useCallback((n: number) => n / camera.scale, [camera.scale]);

  // Track the viewport size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Fit on first layout and whenever the editor asks.
  const fittedFor = useRef(-1);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (size.w === 0 || fittedFor.current === fitSignal) return;
    fittedFor.current = fitSignal;
    dispatch({ type: "camera", camera: fitBounds(bounds, size.w, size.h) });
    // Show the plan only once it is framed, to avoid a jump on load.
    setReady(true);
  }, [size, bounds, fitSignal, dispatch]);

  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = svg.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      dispatch({
        type: "camera",
        camera: zoomAt(cameraRef.current, { x: e.clientX - r.left, y: e.clientY - r.top }, factor),
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [dispatch]);

  const layers = settings.layers;
  const visibleItems = useMemo(
    () => version.items.filter((i) => layers[i.layer].visible),
    [version.items, layers],
  );
  const hittable = useCallback(
    (i: Item) => layers[i.layer].visible && !layers[i.layer].locked,
    [layers],
  );
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const single =
    selection.length === 1 ? version.items.find((i) => i.id === selection[0]) : undefined;

  const toScreen = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const toWorld = (e: { clientX: number; clientY: number }) => screenToWorld(camera, toScreen(e));
  const snap = (v: number) => (settings.snapToGrid ? snapValue(v, settings.gridSize) : v);

  const fixtureAt = (p: Point) =>
    [...version.fixtures].reverse().find((f) => pointInPolygon(p, fixtureFootprint(f)));

  const roomAtPoint = (p: Point) =>
    [...version.rooms]
      .reverse()
      .find((r) =>
        r.shape.kind === "rects"
          ? r.shape.rects.some(
              (q) => p.x >= q.x && p.x <= q.x + q.w && p.y >= q.y && p.y <= q.y + q.d,
            )
          : pointInPolygon(p, r.shape.points),
      );

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button === 2) return; // context menu handles right click
    svgRef.current?.setPointerCapture(e.pointerId);
    const screen = toScreen(e);
    pointers.current.set(e.pointerId, screen);

    if (pointers.current.size === 2) {
      // Second finger: switch to pinch, abandon what the first finger started.
      if (gesture.current && gesture.current.kind !== "pan") dispatch({ type: "commit" });
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", a: a!, b: b! };
      setMarquee(null);
      return;
    }

    const world = screenToWorld(camera, screen);
    const handleTarget = (e.target as Element).closest<SVGElement>("[data-handle]");
    if (e.button === 1 || spaceHeld || tool === "pan") {
      gesture.current = { kind: "pan", last: screen };
      return;
    }
    if (tool === "measure") {
      const p = { x: Math.round(world.x), y: Math.round(world.y) };
      setMeasure((m) =>
        !m || m.fixed ? { a: p, b: p, fixed: false } : { ...m, b: p, fixed: true },
      );
      return;
    }
    if (handleTarget && single) {
      const h = handleTarget.dataset.handle as Handle | "rotate";
      dispatch({ type: "begin" });
      gesture.current =
        h === "rotate"
          ? { kind: "rotate", id: single.id, center: { x: single.x, y: single.y } }
          : { kind: "resize", id: single.id, handle: h };
      return;
    }
    // Labels are drawn on top, so the DOM target tells whether one was grabbed.
    const labelId = (e.target as Element).closest<SVGElement>("[data-label]")?.dataset.label;
    const label = labelId ? version.rooms.find((r) => r.id === labelId) : undefined;
    if (label) {
      dispatch({ type: "begin" });
      gesture.current = {
        kind: "label",
        roomId: label.id,
        start: world,
        origin: label.labelOffset ?? { x: 0, y: 0 },
      };
      return;
    }
    const hit = hitItem(visibleItems, world, hittable);
    if (hit) {
      const alreadySelected = selectedSet.has(hit.id);
      if (e.shiftKey) dispatch({ type: "select", ids: [hit.id], additive: true });
      else if (!alreadySelected) dispatch({ type: "select", ids: [hit.id] });
      const ids = e.shiftKey || alreadySelected ? [...new Set([...selection, hit.id])] : [hit.id];
      dispatch({ type: "begin" });
      gesture.current = {
        kind: "drag",
        ids,
        start: world,
        origin: { x: hit.x, y: hit.y },
        applied: { x: 0, y: 0 },
        moved: false,
      };
      return;
    }
    const fixture = fixtureAt(world);
    if (fixture && !fixture.locked) {
      dispatch({ type: "begin" });
      gesture.current = {
        kind: "fixture",
        id: fixture.id,
        start: world,
        origin: { x: fixture.x, y: fixture.y },
      };
      return;
    }
    if (e.pointerType === "touch") {
      // One finger on empty floor pans; selecting is done by tapping items.
      if (!e.shiftKey) dispatch({ type: "select", ids: [] });
      gesture.current = { kind: "pan", last: screen };
      return;
    }
    gesture.current = { kind: "marquee", start: world, current: world, additive: e.shiftKey };
    if (!e.shiftKey) dispatch({ type: "select", ids: [] });
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const screen = toScreen(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, screen);
    const world = screenToWorld(camera, screen);
    if (tool === "measure" && measure && !measure.fixed) {
      setMeasure({ ...measure, b: { x: Math.round(world.x), y: Math.round(world.y) } });
    }
    const g = gesture.current;
    if (!g) return;
    switch (g.kind) {
      case "pan": {
        dispatch({
          type: "camera",
          camera: panBy(camera, screen.x - g.last.x, screen.y - g.last.y),
        });
        g.last = screen;
        return;
      }
      case "pinch": {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;
        dispatch({ type: "camera", camera: pinch(camera, g.a, g.b, a, b) });
        g.a = a;
        g.b = b;
        return;
      }
      case "drag": {
        const target = {
          x: snap(g.origin.x + world.x - g.start.x),
          y: snap(g.origin.y + world.y - g.start.y),
        };
        const dx = target.x - g.origin.x,
          dy = target.y - g.origin.y;
        if (dx === g.applied.x && dy === g.applied.y) return;
        const ddx = dx - g.applied.x,
          ddy = dy - g.applied.y;
        g.applied = { x: dx, y: dy };
        g.moved = true;
        dispatch({ type: "apply", update: (p) => moveItems(p, g.ids, ddx, ddy) });
        return;
      }
      case "fixture": {
        const x = snap(g.origin.x + world.x - g.start.x),
          y = snap(g.origin.y + world.y - g.start.y);
        dispatch({ type: "apply", update: (p) => updateFixture(p, g.id, { x, y }) });
        return;
      }
      case "rotate": {
        const rotation = rotationFromPointer(g.center, world, e.altKey ? 0 : 15);
        dispatch({ type: "apply", update: (p) => updateItems(p, [g.id], { rotation }) });
        return;
      }
      case "resize": {
        const item = version.items.find((i) => i.id === g.id);
        if (!item) return;
        const box = resizeFromHandle(
          item,
          g.handle,
          world,
          5,
          settings.snapToGrid ? settings.gridSize : 0,
        );
        dispatch({ type: "apply", update: (p) => updateItems(p, [g.id], box) });
        return;
      }
      case "label": {
        const labelOffset = {
          x: Math.round(g.origin.x + world.x - g.start.x),
          y: Math.round(g.origin.y + world.y - g.start.y),
        };
        dispatch({ type: "apply", update: (p) => updateRoom(p, g.roomId, { labelOffset }) });
        return;
      }
      case "marquee": {
        g.current = world;
        setMarquee(rectFromPoints(g.start, world));
        return;
      }
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      // Lifting one finger ends the pinch; the other finger does nothing more.
      gesture.current = null;
      return;
    }
    if (g.kind === "marquee") {
      const rect = rectFromPoints(g.start, g.current);
      if (rect.w > px(3) || rect.d > px(3)) {
        dispatch({
          type: "select",
          ids: itemsInRect(visibleItems, rect, hittable),
          additive: g.additive,
        });
      }
      setMarquee(null);
    }
    if (g.kind !== "pan") dispatch({ type: "commit" });
    gesture.current = null;
  }

  function onPointerCancel(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (gesture.current && gesture.current.kind !== "pan" && gesture.current.kind !== "pinch") {
      dispatch({ type: "cancel" });
    }
    gesture.current = null;
    setMarquee(null);
  }

  function onContext(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    const world = toWorld(e);
    const at = toScreen(e);
    const hit = hitItem(visibleItems, world, hittable);
    if (hit) {
      if (!selectedSet.has(hit.id)) dispatch({ type: "select", ids: [hit.id] });
      onContextMenu({ kind: "item", id: hit.id }, at);
      return;
    }
    const fixture = fixtureAt(world);
    if (fixture) return onContextMenu({ kind: "fixture", id: fixture.id }, at);
    const room = roomAtPoint(world);
    if (room) onContextMenu({ kind: "room", id: room.id }, at);
  }

  // Reset the tape measure when leaving the tool.
  useEffect(() => {
    // Clearing local UI state in response to the tool prop changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tool !== "measure") setMeasure(null);
  }, [tool]);

  const view = visibleRect(camera, Math.max(size.w, 1), Math.max(size.h, 1));
  const gridStep = useMemo(() => {
    let step = settings.gridSize;
    while (step * camera.scale < 8) step *= 5;
    return step;
  }, [settings.gridSize, camera.scale]);

  const dims = useMemo(() => {
    if (!single || !layers.dimensions.visible) return [];
    // Measure to walls including windows and doors: a window is still a wall.
    const obstacles = walls.map((w) => w.rect);
    return dimensionLines(
      single.shape === "round"
        ? [
            { x: single.x - single.w / 2, y: single.y - single.d / 2 },
            { x: single.x + single.w / 2, y: single.y + single.d / 2 },
          ]
        : handlePositionsCorners(single),
      obstacles,
      600,
    );
  }, [single, walls, layers.dimensions.visible]);

  const roomName = useCallback((room: Room) => room.name || t(`room.${room.type}`), [t]);
  const cursor =
    spaceHeld || tool === "pan" ? "grab" : tool === "measure" ? "crosshair" : "default";

  return (
    <div ref={wrapRef} className="plan-wrap">
      <svg
        ref={svgRef}
        className="plan-svg"
        role="img"
        aria-label={t("editor.title")}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.d}`}
        width="100%"
        height="100%"
        style={{ cursor, touchAction: "none", visibility: ready ? "visible" : "hidden" }}
        data-ready={ready || undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onContextMenu={onContext}
        data-scale={camera.scale.toFixed(3)}
      >
        <defs>
          <pattern id="plan-grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path
              d={`M${gridStep} 0H0V${gridStep}`}
              className="plan-grid-line"
              strokeWidth={px(1)}
            />
          </pattern>
        </defs>
        {state.showGrid && (
          <rect x={view.x} y={view.y} width={view.w} height={view.d} fill="url(#plan-grid)" />
        )}
        <g style={{ ["--px" as string]: `${px(1)}px` }} strokeWidth={px(1)}>
          <RoomsLayer rooms={version.rooms} />
          <WallsLayer pieces={pieces} />
          <OpeningsLayer openings={version.openings} walls={walls} />
          <FixturesLayer fixtures={version.fixtures} conflicts={conflicts} />
          {visibleItems.map((item) => (
            <ItemShape
              key={item.id}
              item={item}
              selected={selectedSet.has(item.id)}
              conflict={conflicts.has(item.id)}
              px={px}
              showName={item.mount === "floor"}
            />
          ))}
          {state.showLabels && (
            <RoomLabels rooms={version.rooms} unit={unit} px={px} names={roomName} />
          )}
          {selection.map((id) => {
            const item = version.items.find((i) => i.id === id);
            return item ? (
              <path
                key={id}
                d={footprintPath(item)}
                className="plan-selection"
                strokeWidth={px(2)}
              />
            ) : null;
          })}
          {dims.length > 0 && <DimensionLines lines={dims} unit={unit} px={px} />}
          {single && !single.locked && !layers[single.layer].locked && tool === "select" && (
            <SelectionHandles item={single} px={px} />
          )}
          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.d}
              className="plan-marquee"
              strokeWidth={px(1)}
            />
          )}
          {measure && (
            <g className="plan-measure">
              <path
                d={`M${measure.a.x} ${measure.a.y}L${measure.b.x} ${measure.b.y}`}
                strokeWidth={px(2)}
              />
              <circle cx={measure.a.x} cy={measure.a.y} r={px(4)} />
              <circle cx={measure.b.x} cy={measure.b.y} r={px(4)} />
              <text
                x={(measure.a.x + measure.b.x) / 2}
                y={(measure.a.y + measure.b.y) / 2 - px(8)}
                fontSize={px(13)}
                textAnchor="middle"
              >
                {formatLength(distance(measure.a, measure.b), unit)}
              </text>
            </g>
          )}
        </g>
      </svg>
      {tool === "measure" && (
        <p className="plan-hint" role="status">
          {measure?.fixed
            ? t("editor.measure.result", {
                value: formatLength(distance(measure.a, measure.b), unit),
              })
            : t("editor.measure.hint")}
        </p>
      )}
      {state.showMinimap && size.w > 0 && (
        <Minimap
          rooms={version.rooms}
          bounds={bounds}
          view={view}
          onCenter={(p) =>
            dispatch({
              type: "camera",
              camera: { ...camera, x: p.x - view.w / 2, y: p.y - view.d / 2 } as Camera,
            })
          }
        />
      )}
    </div>
  );
}

function handlePositionsCorners(item: Item): Point[] {
  const h = handlePositions(item);
  return [h.nw, h.ne, h.se, h.sw];
}

function SelectionHandles({ item, px }: { item: Item; px: (n: number) => number }) {
  const { t } = useI18n();
  const h = handlePositions(item);
  const r = px(6);
  const hitR = px(22); // 44 px touch target
  const rotate = handlePositions(item, px(30)).rotate;
  return (
    <g className="plan-handles">
      <path
        d={`M${h.n.x} ${h.n.y}L${rotate.x} ${rotate.y}`}
        className="plan-handle-stem"
        strokeWidth={px(1)}
      />
      {HANDLES.map((k) => (
        <g
          key={k}
          data-handle={k}
          className={`plan-handle plan-handle-${k}`}
          aria-label={t("editor.resize")}
        >
          <circle cx={h[k].x} cy={h[k].y} r={hitR} className="plan-handle-hit" />
          <rect x={h[k].x - r} y={h[k].y - r} width={2 * r} height={2 * r} strokeWidth={px(1.5)} />
        </g>
      ))}
      <g
        data-handle="rotate"
        className="plan-handle plan-handle-rotate"
        aria-label={t("editor.rotate")}
      >
        <circle cx={rotate.x} cy={rotate.y} r={hitR} className="plan-handle-hit" />
        <circle cx={rotate.x} cy={rotate.y} r={r * 1.2} strokeWidth={px(1.5)} />
      </g>
    </g>
  );
}
