"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { roomLabelAnchor } from "@/core/editor/rooms";
import { moveItems, setActiveFloor } from "@/core/model/actions";
import type { Id, Point } from "@/core/model/types";
import { standpointView } from "@/core/photos/photos";
import {
  adjustQuality,
  birdView,
  roomView,
  topView,
  type QualityLevel,
  type StackMode,
} from "@/core/scene/scene";
import { applyLook } from "@/core/style/style";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "@/ui/components/Button";
import { useSettings } from "@/ui/settings/settings";
import { useWorkspace } from "@/ui/workspace/context";
import { Engine } from "./engine";
import type { PickInfo } from "./build";

function supportsWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function ThreeView({
  panelOpen,
  onTogglePanel,
  standpoint,
}: {
  panelOpen: boolean;
  onTogglePanel: () => void;
  /** Look from here at eye height, e.g. where a photo was taken (E13-74). */
  standpoint?: { at: Point; dir: number };
}) {
  const { t } = useI18n();
  const ws = useWorkspace();
  const { project, dispatch, apply, settle, floor, version } = ws;
  const { settings: app } = useSettings();
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const standpointRef = useRef(standpoint);
  const [failed, setFailed] = useState(false);
  const [mode, setMode] = useState<StackMode>("single");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [quality, setQuality] = useState<QualityLevel>(
    app.quality === "auto" ? "medium" : app.quality,
  );
  const [hour, setHour] = useState(14);
  const [evening, setEvening] = useState(false);
  const [dollhouse, setDollhouse] = useState(true);
  const [shadows, setShadows] = useState(true);
  const [walking, setWalking] = useState(false);
  const [compare, setCompare] = useState<{ a: string; b: string; name: string } | null>(null);
  const [split, setSplit] = useState(50);
  const dragging = useRef<Id | null>(null);
  const projectRef = useRef(project);
  useEffect(() => {
    projectRef.current = project;
  }, [project]);
  const autoQuality = app.quality === "auto";

  const pickRef = useRef<(info: PickInfo | null, face: number | undefined) => void>(() => {});
  const dragRef = useRef<(id: Id, dx: number, dy: number, phase: "start" | "move" | "end") => void>(
    () => {},
  );
  const framesRef = useRef<(times: number[]) => void>(() => {});

  // Create the engine once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (!supportsWebGL()) {
      // Detecting WebGL needs the DOM.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    let engine: Engine;
    try {
      engine = new Engine(
        host,
        {
          onPick: (info, face) => pickRef.current(info, face),
          onDragItem: (id, dx, dy, phase) => dragRef.current(id, dx, dy, phase),
          onFrameTimes: (times) => framesRef.current(times),
          onWalkFloor: (floorId) => {
            if (projectRef.current.activeFloorId !== floorId)
              apply((p) => setActiveFloor(p, floorId));
          },
        },
        { mode: "single", hidden: new Set(), quality, hour, evening, dollhouse, shadows },
      );
    } catch {
      setFailed(true);
      return;
    }
    engineRef.current = engine;
    engine.setProject(projectRef.current);
    const b = engine.bounds();
    const base = engine.baseOf(projectRef.current.activeFloorId);
    const sp = standpointRef.current;
    engine.goTo(
      sp ? standpointView(sp, projectRef.current.settings.eyeHeight, base) : birdView(b, base),
      false,
    );
    ws.registerCapture("3d", (scale) => engine.capture(scale));
    return () => {
      ws.registerCapture("3d", null);
      engine.dispose();
      engineRef.current = null;
    };
    // The engine lives for the whole view; options are pushed below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    standpointRef.current = standpoint;
    const engine = engineRef.current;
    if (!engine || !standpoint) return;
    const p = projectRef.current;
    engine.goTo(standpointView(standpoint, p.settings.eyeHeight, engine.baseOf(p.activeFloorId)));
  }, [standpoint]);

  useEffect(() => {
    engineRef.current?.setOptions({ mode, hidden, quality, hour, evening, dollhouse, shadows });
  }, [mode, hidden, quality, hour, evening, dollhouse, shadows]);

  useEffect(() => {
    const id = requestAnimationFrame(() => engineRef.current?.setProject(project));
    return () => cancelAnimationFrame(id);
  }, [project]);

  useEffect(() => {
    pickRef.current = (info, face) => {
      if (!info) {
        dispatch({ type: "select", ids: [] });
        dispatch({ type: "pickWall", wall: null });
        return;
      }
      if (info.floorId !== project.activeFloorId) apply((p) => setActiveFloor(p, info.floorId));
      if (info.type === "item") dispatch({ type: "select", ids: [info.id] });
      else if (info.type === "wall") {
        const side = face === info.sides?.b ? "b" : "a";
        dispatch({ type: "pickWall", wall: { wallId: info.id, side } });
      } else if (info.type === "floor") dispatch({ type: "pickRoom", room: info.id });
    };
  }, [dispatch, apply, project.activeFloorId]);

  useEffect(() => {
    dragRef.current = (id, dx, dy, phase) => {
      if (phase === "start") {
        dragging.current = id;
        dispatch({ type: "begin" });
      } else if (phase === "move") {
        apply((p) => moveItems(p, [id], dx, dy));
      } else {
        settle([id]);
        dispatch({ type: "commit" });
        dragging.current = null;
      }
    };
  }, [dispatch, apply, settle]);

  useEffect(() => {
    framesRef.current = (times) => {
      if (!autoQuality) return;
      setQuality((q) => adjustQuality(q, times));
    };
  }, [autoQuality]);

  const view = useCallback(
    (kind: "top" | "bird" | Id) => {
      const engine = engineRef.current;
      if (!engine) return;
      const b = engine.bounds();
      const base = engine.baseOf(projectRef.current.activeFloorId);
      if (kind === "top") engine.goTo(topView(b, base));
      else if (kind === "bird") engine.goTo(birdView(b, base));
      else {
        const room = version.rooms.find((r) => r.id === kind);
        if (room) engine.goTo(roomView(room, projectRef.current.settings.eyeHeight, base));
      }
    },
    [version.rooms],
  );

  function toggleWalk() {
    const engine = engineRef.current;
    if (!engine) return;
    if (walking) {
      engine.stopWalk();
      setWalking(false);
      view("bird");
      return;
    }
    const room = version.rooms.find((r) => r.type === "hal") ?? version.rooms[0];
    const at = room ? roomLabelAnchor(room) : { x: 0, y: 0 };
    if (mode === "single" && project.floors.length > 1) setMode("all");
    engine.startWalk(at, project.settings.eyeHeight);
    setWalking(true);
  }

  async function compareWith(lookId: string) {
    const engine = engineRef.current;
    const look = project.looks.find((l) => l.id === lookId);
    if (!engine || !look) return;
    const a = engine.snapshot();
    engine.setProject(applyLook(project, lookId));
    const b = engine.snapshot();
    engine.setProject(project);
    setCompare({ a, b, name: look.name });
  }

  if (failed) {
    return (
      <div className="three-fallback" role="alert">
        <p>{t("three.noWebgl")}</p>
      </div>
    );
  }

  return (
    <div className="three-view">
      <div className="editor-bar three-bar" role="toolbar" aria-label={t("three.toolbar")}>
        <div className="tool-group">
          <Button variant="ghost" onClick={() => view("top")}>
            {t("three.top")}
          </Button>
          <Button variant="ghost" onClick={() => view("bird")}>
            {t("three.bird")}
          </Button>
          <label className="inline-select">
            <span className="sr-only">{t("three.room")}</span>
            <select
              className="input"
              value=""
              onChange={(e) => e.target.value && view(e.target.value)}
            >
              <option value="">{t("three.room")}</option>
              {version.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || t(`room.${r.type}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tool-group">
          <IconButton
            icon="cube"
            label={t("three.dollhouse")}
            pressed={dollhouse}
            onClick={() => setDollhouse((d) => !d)}
          />
          <IconButton
            icon="walk"
            label={walking ? t("three.stopWalk") : t("three.walk")}
            pressed={walking}
            onClick={toggleWalk}
          />
          <IconButton
            icon={evening ? "moon" : "sun"}
            label={evening ? t("three.day") : t("three.evening")}
            pressed={evening}
            onClick={() => setEvening((v) => !v)}
          />
          {!evening && (
            <label className="field inline-range">
              <span className="field-label small">
                {t("three.time", { hour: Math.floor(hour) })}
              </span>
              <input
                type="range"
                min={6}
                max={21}
                step={0.5}
                value={hour}
                onChange={(e) => setHour(Number(e.target.value))}
              />
            </label>
          )}
        </div>
        <div className="tool-group">
          <label className="inline-select">
            <span className="sr-only">{t("three.floors")}</span>
            <select
              className="input"
              value={mode}
              onChange={(e) => setMode(e.target.value as StackMode)}
            >
              <option value="single">{t("three.mode.single")}</option>
              <option value="all">{t("three.mode.all")}</option>
              <option value="exploded">{t("three.mode.exploded")}</option>
            </select>
          </label>
          {mode !== "single" &&
            project.floors.map((f) => (
              <button
                key={f.id}
                type="button"
                className="chip"
                aria-pressed={!hidden.has(f.id)}
                onClick={() =>
                  setHidden((h) => {
                    const n = new Set(h);
                    if (n.has(f.id)) n.delete(f.id);
                    else n.add(f.id);
                    return n;
                  })
                }
              >
                {f.name}
              </button>
            ))}
        </div>
        <div className="tool-group">
          <label className="inline-select">
            <span className="sr-only">{t("three.quality")}</span>
            <select
              className="input"
              value={quality}
              onChange={(e) => setQuality(e.target.value as QualityLevel)}
            >
              <option value="low">{t("quality.low")}</option>
              <option value="medium">{t("quality.medium")}</option>
              <option value="high">{t("quality.high")}</option>
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={shadows}
              onChange={(e) => setShadows(e.target.checked)}
            />
            {t("three.shadows")}
          </label>
          {project.looks.length > 0 && (
            <label className="inline-select">
              <span className="sr-only">{t("looks.compare")}</span>
              <select
                className="input"
                value=""
                onChange={(e) => e.target.value && void compareWith(e.target.value)}
              >
                <option value="">{t("looks.compare")}</option>
                {project.looks.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <IconButton
            icon="camera"
            label={t("three.photo")}
            onClick={async () => {
              const blob = await engineRef.current?.capture(2);
              if (!blob) return;
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${project.name}-3d.png`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 1000);
            }}
          />
          <IconButton
            icon="layers"
            label={t("editor.panel")}
            pressed={panelOpen}
            aria-expanded={panelOpen}
            aria-controls="editor-panel"
            onClick={onTogglePanel}
            className="panel-toggle"
          />
        </div>
      </div>
      <div
        className="three-wrap"
        ref={hostRef}
        aria-label={t("three.canvas", { floor: floor.name })}
        role="application"
        data-testid="three"
      >
        {walking && (
          <>
            <p className="plan-hint" role="status">
              {t("three.walkHint")}
            </p>
            <Joystick
              onChange={(x, y) => engineRef.current && (engineRef.current.joystick = { x, y })}
            />
            <Button variant="primary" className="walk-exit" onClick={toggleWalk}>
              {t("three.stopWalk")}
            </Button>
          </>
        )}
        {compare && (
          <div
            className="compare"
            role="group"
            aria-label={t("looks.compareWith", { name: compare.name })}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={compare.b}
              alt={t("looks.after", { name: compare.name })}
              className="compare-img"
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={compare.a}
              alt={t("looks.before")}
              className="compare-img"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            />
            <div className="compare-line" style={{ left: `${split}%` }} aria-hidden="true" />
            <label className="compare-slider">
              <span className="sr-only">{t("looks.slider")}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={split}
                onChange={(e) => setSplit(Number(e.target.value))}
              />
            </label>
            <span className="compare-label compare-label-a">{t("looks.now")}</span>
            <span className="compare-label compare-label-b">{compare.name}</span>
            <Button className="compare-close" onClick={() => setCompare(null)}>
              {t("common.close")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Virtual joystick for walking on touch screens. */
function Joystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const update = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    const k = len > 1 ? 1 / len : 1;
    setKnob({ x: dx * k, y: dy * k });
    onChange(dx * k, dy * k);
  };
  return (
    <div
      ref={ref}
      className="joystick"
      role="group"
      aria-label={t("three.joystick")}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => e.buttons && update(e)}
      onPointerUp={() => {
        setKnob({ x: 0, y: 0 });
        onChange(0, 0);
      }}
    >
      <span
        className="joystick-knob"
        style={{ transform: `translate(${knob.x * 40}px, ${knob.y * 40}px)` }}
      />
    </div>
  );
}
