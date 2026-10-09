"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { customEntry, getEntry, type CatalogEntry } from "@/catalog";
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
import { roomPath } from "@/core/editor/rooms";
import { snapPoint, snapValue } from "@/core/editor/snap";
import {
  handlePositions,
  resizeFromHandle,
  rotationFromPointer,
  type Handle,
} from "@/core/editor/transform";
import {
  closesPolygon,
  facesFromSegments,
  lRoomShape,
  moveVertex,
  moveWallLine,
  notchInCorner,
  pointAtLength,
  rectRoomShape,
  roomVertices,
  scaleFromReference,
  shapeFromPolygon,
  snapDirection,
  cleanPolygon,
  wallLine,
  type Segment,
  type WallLine,
} from "@/core/draw/draw";
import { pointInPolygon } from "@/core/geometry/polygon";
import { rectFromPoints, rectContainsPoint } from "@/core/geometry/rect";
import { fixtureFootprint } from "@/core/fixtures/fixtures";
import { dimensionLines, distance } from "@/core/measure/dimensions";
import { formatLength, parseLength } from "@/core/measure/units";
import { newId } from "@/core/model/ids";
import {
  addOpening,
  addRoom,
  moveItems,
  updateActiveVersion,
  updateFixture,
  updateItems,
  updateOpening,
  updateRoom,
} from "@/core/model/actions";
import type {
  Floor,
  Id,
  Item,
  Opening,
  Point,
  Project,
  Rect,
  Room,
  Version,
  Wall,
} from "@/core/model/types";
import {
  createDoor,
  createWindow,
  cutWalls,
  placeOnWall,
  snapOpening,
  type WallPiece,
} from "@/core/openings/openings";
import { generateWalls, isHorizontal } from "@/core/walls/generate";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { useToast } from "@/ui/components/Toast";
import { CATALOG_DRAG_TYPE } from "@/ui/catalog/CatalogPanel";
import { BackgroundImage } from "./BackgroundImage";
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

export type ContextTarget = {
  kind: "item" | "room" | "fixture" | "wall";
  id: Id;
  side?: "a" | "b";
};

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
  /** Floor below, drawn as a ghost. */
  below?: Floor;
  onDropEntry: (entry: CatalogEntry, at: Point) => void;
  settle: (ids: readonly Id[]) => void;
}

type Gesture =
  | { kind: "pan"; last: Point }
  | { kind: "pinch"; a: Point; b: Point }
  | { kind: "pending"; start: Point; screen: Point; touch: boolean; additive: boolean }
  | { kind: "drag"; ids: Id[]; start: Point; origin: Point; applied: Point }
  | { kind: "fixture"; id: Id; start: Point; origin: Point }
  | { kind: "marquee"; start: Point; current: Point; additive: boolean }
  | { kind: "rotate"; id: Id; center: Point }
  | { kind: "resize"; id: Id; handle: Handle }
  | { kind: "label"; roomId: Id; start: Point; origin: Point }
  | { kind: "wallMove"; line: WallLine; start: Point; rooms: Room[]; wallId: Id }
  | { kind: "vertex"; room: Room; index: number }
  | { kind: "opening"; id: Id; wall: Wall }
  | { kind: "drawRect"; start: Point; current: Point };

const HANDLES: Handle[] = ["n", "e", "s", "w", "ne", "nw", "se", "sw"];
const DRAW_TOOLS = new Set(["room-rect", "room-l", "room-poly", "wall"]);

/** Rect of an opening across its wall. */
export function openingRect(o: Opening, walls: readonly Wall[]): Rect {
  const wall = walls.find((w) => w.id === o.wallId);
  const t = wall ? (o.dir === "h" ? wall.rect.d : wall.rect.w) : 10;
  return o.dir === "h"
    ? { x: o.x, y: o.y - t / 2, w: o.w, d: t }
    : { x: o.x - t / 2, y: o.y, w: t, d: o.w };
}

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
  below,
  onDropEntry,
  settle,
}: Props) {
  const { t } = useI18n();
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [measure, setMeasure] = useState<{ a: Point; b: Point; fixed: boolean } | null>(null);
  const [preview, setPreview] = useState<Rect | null>(null);
  const [lOuter, setLOuter] = useState<Rect | null>(null);
  const [poly, setPoly] = useState<Point[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  /** Where the next wall segment starts; null between chains. */
  const [chain, setChain] = useState<Point | null>(null);
  const [hover, setHover] = useState<Point | null>(null);
  const [lengthText, setLengthText] = useState("");
  const [scaleRef, setScaleRef] = useState<{ a: Point; b?: Point } | null>(null);
  const { camera, selection, tool } = state;
  const { settings } = project;
  const unit = settings.unit;
  const px = useCallback((n: number) => n / camera.scale, [camera.scale]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fittedFor = useRef(-1);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (size.w === 0 || fittedFor.current === fitSignal) return;
    fittedFor.current = fitSignal;
    dispatch({ type: "camera", camera: fitBounds(bounds, size.w, size.h) });
    setReady(true);
  }, [size, bounds, fitSignal, dispatch]);

  const cameraRef = useRef(camera);
  useEffect(() => {
    cameraRef.current = camera;
  }, [camera]);

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

  // Reset drafts when the tool changes.
  useEffect(() => {
    // Clearing local drawing state in response to the tool prop changing.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tool !== "measure") setMeasure(null);
    if (tool !== "room-l") setLOuter(null);
    if (tool !== "room-poly") setPoly([]);
    if (tool !== "scale-ref") setScaleRef(null);
    setPreview(null);
    setLengthText("");
  }, [tool]);

  const layers = settings.layers;
  const hideLife = !settings.showLife;
  // Flat things (rugs) first, then floor furniture, then things on top and on walls.
  const visibleItems = useMemo(() => {
    const rank = (i: Item) =>
      i.h <= 3 ? 0 : i.mount === "floor" ? 1 : i.mount === "stack" ? 2 : 3;
    return version.items
      .filter(
        (i) => layers[i.layer].visible && !(hideLife && (getEntry(i.catalogId)?.life ?? false)),
      )
      .map((item, index) => ({ item, index }))
      .sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index)
      .map((x) => x.item);
  }, [version.items, layers, hideLife]);
  const hittable = useCallback(
    (i: Item) => layers[i.layer].visible && !layers[i.layer].locked,
    [layers],
  );
  const selectedSet = useMemo(() => new Set(selection), [selection]);
  const single =
    selection.length === 1 ? version.items.find((i) => i.id === selection[0]) : undefined;
  const pickedWall = state.wall ? walls.find((w) => w.id === state.wall!.wallId) : undefined;
  const pickedRoom = state.room ? version.rooms.find((r) => r.id === state.room) : undefined;
  const pickedOpening = state.opening
    ? version.openings.find((o) => o.id === state.opening)
    : undefined;

  const toScreen = (e: { clientX: number; clientY: number }): Point => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const snap = (v: number) => (settings.snapToGrid ? snapValue(v, settings.gridSize) : v);
  const snapP = (p: Point) =>
    settings.snapToGrid
      ? snapPoint(p, settings.gridSize)
      : { x: Math.round(p.x), y: Math.round(p.y) };

  const fixtureAt = (p: Point) =>
    [...version.fixtures].reverse().find((f) => pointInPolygon(p, fixtureFootprint(f)));
  const roomAtPoint = (p: Point) =>
    [...version.rooms]
      .reverse()
      .find((r) =>
        r.shape.kind === "rects"
          ? r.shape.rects.some((q) => rectContainsPoint(q, p))
          : pointInPolygon(p, r.shape.points),
      );
  const wallAt = (p: Point): { wall: Wall; side: "a" | "b" } | null => {
    const piece = pieces.find((w) => w.z0 === 0 && rectContainsPoint(w.rect, p));
    const wall = piece && walls.find((w) => w.id === piece.wallId);
    if (!wall) return null;
    const side = isHorizontal(wall.rect)
      ? p.y < wall.rect.y + wall.rect.d / 2
        ? "a"
        : "b"
      : p.x < wall.rect.x + wall.rect.w / 2
        ? "a"
        : "b";
    return { wall, side };
  };
  const openingAt = (p: Point) =>
    version.openings.find((o) => rectContainsPoint(openingRect(o, walls), p));

  const apply = (update: (p: Project) => Project, select?: Id[]) =>
    dispatch({ type: "apply", update, select });

  function addNewRoom(shape: Room["shape"]) {
    const id = newId("room");
    apply((p) => addRoom(p, { id, name: t("room.living"), type: "living", shape }));
    dispatch({ type: "tool", tool: "select" });
    dispatch({ type: "pickRoom", room: id });
  }

  function finishPolygon(points: Point[]) {
    const clean = cleanPolygon(points);
    setPoly([]);
    if (!clean) return toast(t("draw.tooSmall"), "warning");
    addNewRoom(shapeFromPolygon(clean));
  }

  function finishWalls(all: Segment[]) {
    const faces = facesFromSegments(all);
    if (!faces.length) {
      toast(t("draw.noRooms"), "warning");
      return;
    }
    const shapes = faces.map(shapeFromPolygon);
    apply((p) =>
      shapes.reduce(
        (acc, shape, i) =>
          addRoom(acc, { name: `${t("room.living")} ${i + 1}`, type: "living", shape }),
        p,
      ),
    );
    setSegments([]);
    setChain(null);
    setHover(null);
    toast(t("draw.roomsFound", { count: faces.length }), "success");
    dispatch({ type: "tool", tool: "select" });
  }

  function placeOpening(at: Point) {
    const near = wallAt(at)?.wall ?? null;
    const dir = near ? (isHorizontal(near.rect) ? "h" : "v") : "h";
    const base: Opening =
      tool === "door"
        ? createDoor(at.x, at.y, dir)
        : tool === "window"
          ? createWindow(at.x, at.y, dir)
          : { id: newId("pass"), kind: "passage", x: at.x, y: at.y, w: 100, dir, height: 211 };
    const centred =
      dir === "h" ? { ...base, x: at.x - base.w / 2 } : { ...base, y: at.y - base.w / 2 };
    const snapped = snapOpening(centred, walls, 60);
    if (!snapped) return toast(t("draw.clickWall"), "warning");
    apply((p) => addOpening(p, snapped));
    dispatch({ type: "tool", tool: "select" });
    dispatch({ type: "pickOpening", opening: snapped.id });
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.button === 2) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    const screen = toScreen(e);
    pointers.current.set(e.pointerId, screen);
    if (pointers.current.size === 2) {
      if (gesture.current && !["pan", "pending", "marquee"].includes(gesture.current.kind))
        dispatch({ type: "commit" });
      const [a, b] = [...pointers.current.values()];
      gesture.current = { kind: "pinch", a: a!, b: b! };
      setMarquee(null);
      return;
    }
    const world = screenToWorld(camera, screen);
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
    if (tool === "scale-ref") {
      setScaleRef((s) => (!s || s.b ? { a: world } : { ...s, b: world }));
      return;
    }
    if (tool === "door" || tool === "window" || tool === "passage") return placeOpening(world);
    if (tool === "room-rect" || tool === "room-l") {
      const start = snapP(world);
      gesture.current = { kind: "drawRect", start, current: start };
      return;
    }
    if (tool === "room-poly" || tool === "wall") return; // handled on click (pointerup)

    // ---- select tool
    const handleTarget = (e.target as Element).closest<SVGElement>("[data-handle]");
    const handle = handleTarget?.dataset.handle;
    if (handle === "wall-move" && pickedWall) {
      dispatch({ type: "begin" });
      gesture.current = {
        kind: "wallMove",
        line: wallLine(pickedWall),
        start: world,
        rooms: version.rooms,
        wallId: pickedWall.id,
      };
      return;
    }
    if (handle?.startsWith("vertex-") && pickedRoom) {
      dispatch({ type: "begin" });
      gesture.current = { kind: "vertex", room: pickedRoom, index: Number(handle.slice(7)) };
      return;
    }
    if (handle && single) {
      dispatch({ type: "begin" });
      gesture.current =
        handle === "rotate"
          ? { kind: "rotate", id: single.id, center: { x: single.x, y: single.y } }
          : { kind: "resize", id: single.id, handle: handle as Handle };
      return;
    }
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
      };
      return;
    }
    const opening = openingAt(world);
    const openingWall = opening && walls.find((w) => w.id === opening.wallId);
    if (opening) {
      dispatch({ type: "pickOpening", opening: opening.id });
      if (openingWall) {
        dispatch({ type: "begin" });
        gesture.current = { kind: "opening", id: opening.id, wall: openingWall };
      }
      return;
    }
    const fixture = fixtureAt(world);
    if (fixture) dispatch({ type: "pickFixture", fixture: fixture.id });
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
    if (fixture) return;
    const wallHit = wallAt(world);
    if (wallHit) {
      dispatch({ type: "pickWall", wall: { wallId: wallHit.wall.id, side: wallHit.side } });
      return;
    }
    gesture.current = {
      kind: "pending",
      start: world,
      screen,
      touch: e.pointerType === "touch",
      additive: e.shiftKey,
    };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const screen = toScreen(e);
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, screen);
    const world = screenToWorld(camera, screen);
    if (tool === "measure" && measure && !measure.fixed)
      setMeasure({ ...measure, b: { x: Math.round(world.x), y: Math.round(world.y) } });
    if (tool === "room-poly" || tool === "wall") {
      const last = tool === "room-poly" ? poly[poly.length - 1] : chain;
      const p = snapP(world);
      setHover(last && !e.altKey ? snapDirection(last, p) : p);
    }
    if (tool === "scale-ref" && scaleRef && !scaleRef.b) setHover(world);
    const g = gesture.current;
    if (!g) return;
    switch (g.kind) {
      case "pan":
        dispatch({
          type: "camera",
          camera: panBy(camera, screen.x - g.last.x, screen.y - g.last.y),
        });
        g.last = screen;
        return;
      case "pinch": {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;
        dispatch({ type: "camera", camera: pinch(camera, g.a, g.b, a, b) });
        g.a = a;
        g.b = b;
        return;
      }
      case "pending": {
        if (Math.hypot(screen.x - g.screen.x, screen.y - g.screen.y) < 6) return;
        if (g.touch) {
          if (!g.additive) dispatch({ type: "select", ids: [] });
          gesture.current = { kind: "pan", last: screen };
        } else {
          if (!g.additive) {
            dispatch({ type: "select", ids: [] });
            dispatch({ type: "pickRoom", room: null });
          }
          gesture.current = {
            kind: "marquee",
            start: g.start,
            current: world,
            additive: g.additive,
          };
          setMarquee(rectFromPoints(g.start, world));
        }
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
        apply((p) => moveItems(p, g.ids, ddx, ddy));
        return;
      }
      case "fixture": {
        const x = snap(g.origin.x + world.x - g.start.x),
          y = snap(g.origin.y + world.y - g.start.y);
        apply((p) => updateFixture(p, g.id, { x, y }));
        return;
      }
      case "rotate": {
        const rotation = rotationFromPointer(g.center, world, e.altKey ? 0 : 15);
        apply((p) => updateItems(p, [g.id], { rotation }));
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
        apply((p) => updateItems(p, [g.id], box));
        return;
      }
      case "label": {
        const labelOffset = {
          x: Math.round(g.origin.x + world.x - g.start.x),
          y: Math.round(g.origin.y + world.y - g.start.y),
        };
        apply((p) => updateRoom(p, g.roomId, { labelOffset }));
        return;
      }
      case "wallMove": {
        const raw = g.line.axis === "h" ? world.y - g.start.y : world.x - g.start.x;
        const delta = snap(raw);
        const rooms = moveWallLine(g.rooms, g.line, delta);
        apply((p) => updateActiveVersion(p, (v) => void (v.rooms = rooms)));
        return;
      }
      case "vertex": {
        const moved = moveVertex(g.room, g.index, snapP(world));
        apply((p) => updateRoom(p, g.room.id, { shape: moved.shape }));
        return;
      }
      case "opening": {
        const o = version.openings.find((x) => x.id === g.id);
        if (!o) return;
        const placed = placeOnWall(o, g.wall, snapP(world));
        apply((p) => updateOpening(p, g.id, { x: placed.x, y: placed.y }));
        return;
      }
      case "drawRect": {
        g.current = snapP(world);
        setPreview(
          tool === "room-l" && lOuter
            ? notchInCorner(lOuter, g.start, g.current)
            : rectFromPoints(g.start, g.current),
        );
        return;
      }
      case "marquee":
        g.current = world;
        setMarquee(rectFromPoints(g.start, world));
        return;
    }
  }

  function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    const world = screenToWorld(camera, toScreen(e));
    const g = gesture.current;
    gesture.current = null;
    if (!g) {
      if (tool === "room-poly" && e.button === 0) {
        const p = hover ?? snapP(world);
        if (closesPolygon(poly, p, px(12))) return finishPolygon(poly);
        setPoly((pts) => [...pts, p]);
      }
      if (tool === "wall" && e.button === 0) {
        const p = hover ?? snapP(world);
        if (chain && Math.hypot(p.x - chain.x, p.y - chain.y) > 1)
          setSegments((segs) => [...segs, { a: chain, b: p }]);
        setChain(p);
      }
      return;
    }
    switch (g.kind) {
      case "pinch":
      case "pan":
        return;
      case "pending": {
        // A click on the floor: pick the room, or clear everything.
        const room = roomAtPoint(g.start);
        dispatch({ type: "select", ids: [] });
        dispatch({ type: "pickRoom", room: room?.id ?? null });
        return;
      }
      case "marquee": {
        const rect = rectFromPoints(g.start, g.current);
        if (rect.w > px(3) || rect.d > px(3))
          dispatch({
            type: "select",
            ids: itemsInRect(visibleItems, rect, hittable),
            additive: g.additive,
          });
        setMarquee(null);
        return;
      }
      case "drawRect": {
        setPreview(null);
        if (tool === "room-rect") {
          const shape = rectRoomShape(g.start, g.current);
          if (shape) addNewRoom(shape);
          else toast(t("draw.tooSmall"), "warning");
        } else if (tool === "room-l") {
          if (!lOuter) {
            const r = rectFromPoints(g.start, g.current);
            if (r.w >= 60 && r.d >= 60) setLOuter(r);
            else toast(t("draw.tooSmall"), "warning");
          } else {
            const shape = lRoomShape(lOuter, notchInCorner(lOuter, g.start, g.current));
            setLOuter(null);
            if (shape) addNewRoom(shape);
            else toast(t("draw.notL"), "warning");
          }
        }
        return;
      }
      case "drag":
        settle(g.ids);
        dispatch({ type: "commit" });
        return;
      default:
        dispatch({ type: "commit" });
    }
  }

  function onPointerCancel(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;
    if (g && !["pan", "pinch", "pending", "marquee", "drawRect"].includes(g.kind))
      dispatch({ type: "cancel" });
    gesture.current = null;
    setMarquee(null);
    setPreview(null);
  }

  function onDoubleClick() {
    if (tool === "room-poly" && poly.length >= 3) finishPolygon(poly);
    if (tool === "wall") setChain(null);
  }

  // Keyboard while drawing: Enter finishes, Escape cancels, Backspace undoes a point.
  useEffect(() => {
    if (!DRAW_TOOLS.has(tool) && tool !== "scale-ref") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (e.key === "Escape") {
        setPoly([]);
        setSegments([]);
        setLOuter(null);
        setChain(null);
      } else if (e.key === "Enter") {
        if (tool === "room-poly" && poly.length >= 3) finishPolygon(poly);
        if (tool === "wall" && segments.length) finishWalls(segments);
      } else if (e.key === "Backspace") {
        if (tool === "room-poly") setPoly((p) => p.slice(0, -1));
        if (tool === "wall") setSegments((s) => s.slice(0, -1));
      } else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function applyTypedLength() {
    const cm = parseLength(lengthText, unit);
    if (cm === null || cm <= 0) return;
    if (tool === "room-poly" && poly.length) {
      const last = poly[poly.length - 1]!;
      setPoly([...poly, pointAtLength(last, hover ?? { x: last.x + 1, y: last.y }, cm)]);
    }
    if (tool === "wall" && chain) {
      const next = pointAtLength(chain, hover ?? { x: chain.x + 1, y: chain.y }, cm);
      setSegments([...segments, { a: chain, b: next }]);
      setChain(next);
    }
    setLengthText("");
  }

  function applyScale() {
    const bg = version.background;
    if (!bg || !scaleRef?.b) return;
    const real = parseLength(lengthText, unit);
    if (!real) return;
    const scale = scaleFromReference(scaleRef.a, scaleRef.b, real, bg.scale);
    // Keep the first clicked point where it is.
    const imgX = (scaleRef.a.x - bg.x) / bg.scale,
      imgY = (scaleRef.a.y - bg.y) / bg.scale;
    apply((p) =>
      updateActiveVersion(
        p,
        (v) =>
          void (v.background = {
            ...bg,
            scale,
            x: scaleRef.a.x - imgX * scale,
            y: scaleRef.a.y - imgY * scale,
          }),
      ),
    );
    setScaleRef(null);
    setLengthText("");
    dispatch({ type: "tool", tool: "select" });
    toast(t("bg.scaled"), "success");
  }

  function onContext(e: React.MouseEvent<SVGSVGElement>) {
    e.preventDefault();
    const world = screenToWorld(camera, toScreen(e));
    const at = toScreen(e);
    const hit = hitItem(visibleItems, world, hittable);
    if (hit) {
      if (!selectedSet.has(hit.id)) dispatch({ type: "select", ids: [hit.id] });
      return onContextMenu({ kind: "item", id: hit.id }, at);
    }
    const fixture = fixtureAt(world);
    if (fixture) return onContextMenu({ kind: "fixture", id: fixture.id }, at);
    const wallHit = wallAt(world);
    if (wallHit)
      return onContextMenu({ kind: "wall", id: wallHit.wall.id, side: wallHit.side }, at);
    const room = roomAtPoint(world);
    if (room) onContextMenu({ kind: "room", id: room.id }, at);
  }

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(CATALOG_DRAG_TYPE)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }

  function onDrop(e: React.DragEvent) {
    const id = e.dataTransfer.getData(CATALOG_DRAG_TYPE);
    if (!id) return;
    e.preventDefault();
    const own = project.customItems.find((c) => c.id === id);
    const entry = own ? customEntry(own) : getEntry(id);
    if (entry) onDropEntry(entry, snapP(screenToWorld(camera, toScreen(e))));
  }

  const view = visibleRect(camera, Math.max(size.w, 1), Math.max(size.h, 1));
  const gridStep = useMemo(() => {
    let step = settings.gridSize;
    while (step * camera.scale < 8) step *= 5;
    return step;
  }, [settings.gridSize, camera.scale]);

  const dims = single && layers.dimensions.visible ? selectionDimensions(single, walls) : [];
  const ghost = useGhost(below);
  const stairsBelow = ghost?.version.fixtures.filter((f) => f.type === "stairs") ?? [];

  const roomName = useCallback((room: Room) => room.name || t(`room.${room.type}`), [t]);
  const drawing = DRAW_TOOLS.has(tool);
  const cursor = spaceHeld || tool === "pan" ? "grab" : tool === "select" ? "default" : "crosshair";
  const bearing = version.wallFlags;

  return (
    <div ref={wrapRef} className="plan-wrap" onDragOver={onDragOver} onDrop={onDrop}>
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
        data-scale={camera.scale.toFixed(3)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContext}
      >
        <defs>
          <pattern id="plan-grid" width={gridStep} height={gridStep} patternUnits="userSpaceOnUse">
            <path
              d={`M${gridStep} 0H0V${gridStep}`}
              className="plan-grid-line"
              strokeWidth={px(1)}
            />
          </pattern>
          <pattern
            id="bearing-hatch"
            width={px(8)}
            height={px(8)}
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <path d={`M0 0V${px(8)}`} stroke="var(--c-brass)" strokeWidth={px(3)} />
          </pattern>
        </defs>
        {state.showGrid && (
          <rect x={view.x} y={view.y} width={view.w} height={view.d} fill="url(#plan-grid)" />
        )}
        <g style={{ ["--px" as string]: `${px(1)}px` }} strokeWidth={px(1)}>
          {version.background && <BackgroundImage bg={version.background} />}
          {ghost && (
            <g className="plan-ghost" aria-hidden="true">
              {ghost.version.rooms.map((r) => (
                <path key={r.id} d={roomPath(r)} />
              ))}
              {ghost.pieces.map((p, i) => (
                <rect key={i} x={p.rect.x} y={p.rect.y} width={p.rect.w} height={p.rect.d} />
              ))}
            </g>
          )}
          <RoomsLayer rooms={version.rooms} />
          {stairsBelow.map((s) => (
            <g
              key={s.id}
              className="plan-stairwell"
              transform={`rotate(${s.rotation} ${s.x + s.w / 2} ${s.y + s.d / 2})`}
            >
              <rect x={s.x} y={s.y} width={s.w} height={s.d} strokeWidth={px(1.5)} />
              <text x={s.x + s.w / 2} y={s.y + s.d / 2} fontSize={px(11)} textAnchor="middle">
                {t("stairs.void")}
              </text>
            </g>
          ))}
          <WallsLayer pieces={pieces} />
          {pieces
            .filter((p) => bearing[p.wallId]?.bearing)
            .map((p, i) => (
              <rect
                key={`b${i}`}
                x={p.rect.x}
                y={p.rect.y}
                width={p.rect.w}
                height={p.rect.d}
                fill="url(#bearing-hatch)"
                className="plan-bearing"
              />
            ))}
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
              custom={project.customItems}
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

          {pickedWall && state.wall && tool === "select" && (
            <WallPick wall={pickedWall} side={state.wall.side} px={px} />
          )}
          {pickedRoom && tool === "select" && (
            <g className="plan-room-pick">
              <path d={roomPath(pickedRoom)} strokeWidth={px(2.5)} />
              {roomVertices(pickedRoom).map((v, i) => (
                <g
                  key={i}
                  data-handle={`vertex-${i}`}
                  className="plan-handle plan-handle-vertex"
                  aria-label={t("draw.vertex")}
                >
                  <circle cx={v.x} cy={v.y} r={px(22)} className="plan-handle-hit" />
                  <circle cx={v.x} cy={v.y} r={px(6)} strokeWidth={px(1.5)} />
                </g>
              ))}
            </g>
          )}
          {state.fixture &&
            (() => {
              const f = version.fixtures.find((x) => x.id === state.fixture);
              if (!f) return null;
              return (
                <rect
                  x={f.x - px(3)}
                  y={f.y - px(3)}
                  width={f.w + px(6)}
                  height={f.d + px(6)}
                  transform={`rotate(${f.rotation} ${f.x + f.w / 2} ${f.y + f.d / 2})`}
                  className="plan-opening-pick"
                  strokeWidth={px(2)}
                />
              );
            })()}
          {pickedOpening &&
            (() => {
              const r = openingRect(pickedOpening, walls);
              return (
                <rect
                  x={r.x - px(3)}
                  y={r.y - px(3)}
                  width={r.w + px(6)}
                  height={r.d + px(6)}
                  className="plan-opening-pick"
                  strokeWidth={px(2)}
                />
              );
            })()}

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
          {lOuter && (
            <rect
              x={lOuter.x}
              y={lOuter.y}
              width={lOuter.w}
              height={lOuter.d}
              className="plan-draft"
              strokeWidth={px(2)}
            />
          )}
          {preview && (
            <g className="plan-draft">
              <rect
                x={preview.x}
                y={preview.y}
                width={preview.w}
                height={preview.d}
                strokeWidth={px(2)}
                className={lOuter ? "plan-draft-notch" : ""}
              />
              <text
                x={preview.x + preview.w / 2}
                y={preview.y - px(6)}
                fontSize={px(12)}
                textAnchor="middle"
              >
                {formatLength(preview.w, unit)} x {formatLength(preview.d, unit)}
              </text>
            </g>
          )}
          {tool === "room-poly" && poly.length > 0 && (
            <g className="plan-draft">
              <path
                d={[...poly, ...(hover ? [hover] : [])]
                  .map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`)
                  .join("")}
                strokeWidth={px(2)}
              />
              {poly.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={px(i === 0 ? 7 : 4)} />
              ))}
              {hover && poly.length > 0 && (
                <text
                  x={(poly[poly.length - 1]!.x + hover.x) / 2}
                  y={(poly[poly.length - 1]!.y + hover.y) / 2 - px(8)}
                  fontSize={px(12)}
                  textAnchor="middle"
                >
                  {formatLength(distance(poly[poly.length - 1]!, hover), unit)}
                </text>
              )}
            </g>
          )}
          {tool === "wall" && (
            <g className="plan-draft plan-draft-walls">
              {segments.map((s, i) => (
                <line key={i} x1={s.a.x} y1={s.a.y} x2={s.b.x} y2={s.b.y} strokeWidth={px(6)} />
              ))}
              {chain &&
                hover &&
                (() => {
                  const end = chain;
                  return (
                    <>
                      <line
                        x1={end.x}
                        y1={end.y}
                        x2={hover.x}
                        y2={hover.y}
                        strokeWidth={px(3)}
                        strokeDasharray={`${px(6)} ${px(4)}`}
                      />
                      <text
                        x={(end.x + hover.x) / 2}
                        y={(end.y + hover.y) / 2 - px(8)}
                        fontSize={px(12)}
                        textAnchor="middle"
                      >
                        {formatLength(distance(end, hover), unit)}
                      </text>
                    </>
                  );
                })()}
              {hover && <circle cx={hover.x} cy={hover.y} r={px(4)} />}
            </g>
          )}
          {scaleRef && (
            <g className="plan-measure">
              <path
                d={`M${scaleRef.a.x} ${scaleRef.a.y}L${(scaleRef.b ?? hover ?? scaleRef.a).x} ${(scaleRef.b ?? hover ?? scaleRef.a).y}`}
                strokeWidth={px(2)}
              />
              <circle cx={scaleRef.a.x} cy={scaleRef.a.y} r={px(4)} />
            </g>
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
      {(drawing || tool === "door" || tool === "window" || tool === "passage") && (
        <div className="plan-hint plan-draw-bar" role="status">
          <span>{t(`draw.hint.${tool}` as never)}</span>
          {(tool === "room-poly" || tool === "wall") && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                applyTypedLength();
              }}
            >
              <label className="sr-only" htmlFor="draw-length">
                {t("draw.length")}
              </label>
              <input
                id="draw-length"
                className="input input-length"
                placeholder={t("draw.length")}
                value={lengthText}
                onChange={(e) => setLengthText(e.target.value)}
              />
            </form>
          )}
          {tool === "room-poly" && poly.length >= 3 && (
            <Button variant="primary" onClick={() => finishPolygon(poly)}>
              {t("draw.close")}
            </Button>
          )}
          {tool === "wall" && segments.length > 0 && (
            <>
              <Button variant="primary" onClick={() => finishWalls(segments)}>
                {t("draw.detect")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setSegments([]);
                  setChain(null);
                }}
              >
                {t("draw.clear")}
              </Button>
            </>
          )}
        </div>
      )}
      {tool === "scale-ref" && (
        <div className="plan-hint plan-draw-bar" role="status">
          <span>
            {version.background
              ? scaleRef?.b
                ? t("bg.enterLength")
                : t("bg.clickTwo")
              : t("bg.none")}
          </span>
          {scaleRef?.b && (
            <form
              className="row"
              onSubmit={(e) => {
                e.preventDefault();
                applyScale();
              }}
            >
              <label className="sr-only" htmlFor="scale-length">
                {t("bg.realLength")}
              </label>
              <input
                id="scale-length"
                className="input input-length"
                autoFocus
                placeholder={formatLength(distance(scaleRef.a, scaleRef.b), unit)}
                value={lengthText}
                onChange={(e) => setLengthText(e.target.value)}
              />
              <Button variant="primary" type="submit">
                {t("common.apply")}
              </Button>
            </form>
          )}
        </div>
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

function selectionDimensions(item: Item, walls: readonly Wall[]) {
  const h = handlePositions(item);
  return dimensionLines(
    [h.nw, h.ne, h.se, h.sw],
    walls.map((w) => w.rect),
    600,
  );
}

/** Rooms and walls of the floor below, for the ghost view. */
function useGhost(below: Floor | undefined) {
  const version = below
    ? (below.designs.find((d) => d.id === below.activeVersionId) ?? below.current)
    : undefined;
  const height = below?.height ?? 0;
  return useMemo(() => {
    if (!version) return null;
    const w = generateWalls(version.rooms, version.extraWalls, { height });
    return { version, pieces: cutWalls(w, version.openings, false, version.demolitions) };
  }, [version, height]);
}

function WallPick({ wall, side, px }: { wall: Wall; side: "a" | "b"; px: (n: number) => number }) {
  const { t } = useI18n();
  const r = wall.rect;
  const horizontal = isHorizontal(r);
  const cx = r.x + r.w / 2,
    cy = r.y + r.d / 2;
  const off = px(26) * (side === "a" ? -1 : 1);
  const handle = horizontal ? { x: cx, y: cy + off } : { x: cx + off, y: cy };
  return (
    <g className="plan-wall-pick">
      <rect x={r.x} y={r.y} width={r.w} height={r.d} strokeWidth={px(3)} />
      <g
        data-handle="wall-move"
        className="plan-handle plan-handle-wall"
        aria-label={t("wall.move")}
        style={{ cursor: horizontal ? "ns-resize" : "ew-resize" }}
      >
        <circle cx={handle.x} cy={handle.y} r={px(22)} className="plan-handle-hit" />
        <circle cx={handle.x} cy={handle.y} r={px(8)} strokeWidth={px(1.5)} />
        <path
          d={
            horizontal
              ? `M${handle.x} ${handle.y - px(5)}v${px(10)}M${handle.x - px(3)} ${handle.y - px(2)}l${px(3)} ${-px(3)}l${px(3)} ${px(3)}`
              : `M${handle.x - px(5)} ${handle.y}h${px(10)}`
          }
          strokeWidth={px(1.5)}
          fill="none"
        />
      </g>
    </g>
  );
}

function SelectionHandles({ item, px }: { item: Item; px: (n: number) => number }) {
  const { t } = useI18n();
  const h = handlePositions(item);
  const r = px(6);
  const hitR = px(22);
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
