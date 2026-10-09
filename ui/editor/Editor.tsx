"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { checkLayout, conflictingIds } from "@/core/collision/collision";
import { zoomAt } from "@/core/editor/camera";
import { matchShortcut } from "@/core/editor/shortcuts";
import { boundingRect } from "@/core/geometry/rect";
import { canRedo, canUndo } from "@/core/history/history";
import {
  duplicateItems,
  getActiveVersion,
  getFloor,
  groupItems,
  moveItems,
  removeItems,
  rotateItems,
  ungroupItems,
  updateFixture,
  updateItems,
  updateRoom,
} from "@/core/model/actions";
import type { Id, Item, Point, Project } from "@/core/model/types";
import { cutWalls } from "@/core/openings/openings";
import { generateWalls } from "@/core/walls/generate";
import { useI18n } from "@/i18n/I18nProvider";
import { ContextMenu, type MenuEntry } from "./ContextMenu";
import { PlanCanvas, type ContextTarget } from "./PlanCanvas";
import { ShortcutsDialog } from "./ShortcutsDialog";
import { SidePanel } from "./SidePanel";
import { editorReducer, initialEditorState } from "./state";
import { Toolbar } from "./Toolbar";

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function Editor({
  initial,
  prepare,
}: {
  initial: Project;
  prepare?: (p: Project) => Project | null;
}) {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(editorReducer, initial, initialEditorState);
  const [menu, setMenu] = useState<{ target: ContextTarget; at: Point } | null>(null);
  const [help, setHelp] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const project = state.history.present;
  const floor = getFloor(project);
  const version = getActiveVersion(project);
  const { settings } = project;

  // Client-only setup: platform and optional dev tweaks from the URL.
  useEffect(() => {
    // navigator is only available after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const next = prepare?.(initial);
    if (next) dispatch({ type: "load", project: next });
  }, [initial, prepare]);

  const walls = useMemo(
    () =>
      generateWalls(version.rooms, version.extraWalls, {
        interior: settings.wallThickness.interior,
        exterior: settings.wallThickness.exterior,
        height: floor.height,
        lowHeight: settings.lowWallHeight,
      }),
    [
      version.rooms,
      version.extraWalls,
      settings.wallThickness,
      settings.lowWallHeight,
      floor.height,
    ],
  );
  const pieces = useMemo(() => cutWalls(walls, version.openings), [walls, version.openings]);
  const bounds = useMemo(
    () => boundingRect(walls.map((w) => w.rect)) ?? { x: 0, y: 0, w: 500, d: 400 },
    [walls],
  );
  // Collision checks can lag a frame behind while dragging.
  const deferred = useDeferredValue(version);
  const issues = useMemo(
    () =>
      checkLayout(
        {
          items: deferred.items,
          fixtures: deferred.fixtures,
          openings: deferred.openings,
          walls,
          rooms: deferred.rooms,
        },
        { clearance: settings.clearance },
      ),
    [deferred, walls, settings.clearance],
  );
  const conflicts = useMemo(() => conflictingIds(issues), [issues]);

  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const runAction = useCallback((action: ReturnType<typeof matchShortcut>) => {
    const s = stateRef.current;
    const p = s.history.present;
    const sel = s.selection;
    switch (action) {
      case "undo":
        return dispatch({ type: "undo" });
      case "redo":
        return dispatch({ type: "redo" });
      case "duplicate": {
        if (!sel.length) return;
        const r = duplicateItems(p, sel);
        return dispatch({ type: "apply", update: () => r.project, select: r.ids });
      }
      case "delete":
        return (
          sel.length && dispatch({ type: "apply", update: (q) => removeItems(q, sel), select: [] })
        );
      case "group":
        return (
          sel.length > 1 && dispatch({ type: "apply", update: (q) => groupItems(q, sel).project })
        );
      case "ungroup": {
        const groups = new Set(
          getActiveVersion(p)
            .items.filter((i) => sel.includes(i.id) && i.groupId)
            .map((i) => i.groupId!),
        );
        return (
          groups.size &&
          dispatch({ type: "apply", update: (q) => [...groups].reduce(ungroupItems, q) })
        );
      }
      case "selectAll": {
        const layers = p.settings.layers;
        const ids = getActiveVersion(p)
          .items.filter((i) => layers[i.layer].visible && !layers[i.layer].locked)
          .map((i) => i.id);
        return dispatch({ type: "select", ids });
      }
      case "deselect":
        if (s.tool !== "select") dispatch({ type: "tool", tool: "select" });
        return dispatch({ type: "select", ids: [] });
      case "rotate":
        return sel.length && dispatch({ type: "apply", update: (q) => rotateItems(q, sel, 15) });
      case "measure":
        return dispatch({ type: "tool", tool: s.tool === "measure" ? "select" : "measure" });
      case "help":
        return setHelp(true);
      case "zoomFit":
        return setFitSignal((n) => n + 1);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        setSpaceHeld(true);
        return;
      }
      if (
        (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) &&
        stateRef.current.selection.length
      ) {
        e.preventDefault();
        const r = canvasRef.current?.getBoundingClientRect();
        setMenu({
          target: { kind: "item", id: stateRef.current.selection[0]! },
          at: { x: (r?.width ?? 200) / 2, y: (r?.height ?? 200) / 2 },
        });
        return;
      }
      const arrows: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const dir = arrows[e.key];
      if (dir && stateRef.current.selection.length && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const sel = stateRef.current.selection;
        dispatch({ type: "apply", update: (q) => moveItems(q, sel, dir[0] * step, dir[1] * step) });
        return;
      }
      const action = matchShortcut(e, undefined, isMac);
      if (action) {
        e.preventDefault();
        runAction(action);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [isMac, runAction]);

  const apply = (update: (p: Project) => Project, select?: Id[]) =>
    dispatch({ type: "apply", update, select });
  const closeMenu = useCallback(() => setMenu(null), []);

  function menuEntries(target: ContextTarget): MenuEntry[] {
    if (target.kind === "room") {
      const room = version.rooms.find((r) => r.id === target.id);
      if (!room) return [];
      return [
        {
          label: room.labelHidden ? t("editor.showLabel") : t("editor.hideLabel"),
          onSelect: () => apply((p) => updateRoom(p, room.id, { labelHidden: !room.labelHidden })),
        },
      ];
    }
    if (target.kind === "fixture") {
      const f = version.fixtures.find((x) => x.id === target.id);
      if (!f) return [];
      return [
        {
          label: f.locked ? t("editor.fixture.unlock") : t("editor.fixture.lock"),
          onSelect: () => apply((p) => updateFixture(p, f.id, { locked: !f.locked })),
        },
      ];
    }
    const sel = state.selection;
    const items = version.items.filter((i) => sel.includes(i.id));
    const locked = items.every((i: Item) => i.locked);
    return [
      { label: t("editor.duplicate"), onSelect: () => runAction("duplicate") },
      { label: t("editor.rotateRight"), onSelect: () => runAction("rotate") },
      { label: t("editor.rotateLeft"), onSelect: () => apply((p) => rotateItems(p, sel, -15)) },
      { label: t("editor.group"), onSelect: () => runAction("group"), disabled: sel.length < 2 },
      {
        label: t("editor.ungroup"),
        onSelect: () => runAction("ungroup"),
        disabled: !items.some((i) => i.groupId),
      },
      {
        label: locked ? t("editor.unlock") : t("editor.lock"),
        onSelect: () => apply((p) => updateItems(p, sel, { locked: !locked })),
      },
      { label: t("editor.delete"), onSelect: () => runAction("delete") },
    ];
  }

  return (
    <div className="editor">
      <a href="#plan" className="skip-link">
        {t("nav.skip")}
      </a>
      <Toolbar
        tool={state.tool}
        onTool={(tool) => dispatch({ type: "tool", tool })}
        canUndo={canUndo(state.history)}
        canRedo={canRedo(state.history)}
        onUndo={() => dispatch({ type: "undo" })}
        onRedo={() => dispatch({ type: "redo" })}
        onZoom={(f) => {
          const r = canvasRef.current?.getBoundingClientRect();
          dispatch({
            type: "camera",
            camera: zoomAt(state.camera, { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 }, f),
          });
        }}
        onFit={() => setFitSignal((n) => n + 1)}
        showGrid={state.showGrid}
        onToggleGrid={() => dispatch({ type: "toggle", key: "showGrid" })}
        snap={settings.snapToGrid}
        onToggleSnap={() =>
          apply((p) => ({ ...p, settings: { ...p.settings, snapToGrid: !p.settings.snapToGrid } }))
        }
        gridSize={settings.gridSize}
        onGridSize={(gridSize) => apply((p) => ({ ...p, settings: { ...p.settings, gridSize } }))}
        unit={settings.unit}
        onUnit={(unit) => apply((p) => ({ ...p, settings: { ...p.settings, unit } }))}
        onHelp={() => setHelp(true)}
        panelOpen={panelOpen}
        onTogglePanel={() => setPanelOpen((o) => !o)}
      />
      <main className="editor-main">
        <div
          id="plan"
          ref={canvasRef}
          className="editor-canvas"
          tabIndex={0}
          role="application"
          aria-label={t("editor.canvas")}
          aria-roledescription={t("editor.title")}
          data-testid="plan"
        >
          <PlanCanvas
            state={state}
            dispatch={dispatch}
            project={project}
            version={version}
            walls={walls}
            pieces={pieces}
            bounds={bounds}
            conflicts={conflicts}
            spaceHeld={spaceHeld}
            fitSignal={fitSignal}
            onContextMenu={(target, at) => setMenu({ target, at })}
          />
          {menu && (
            <ContextMenu at={menu.at} entries={menuEntries(menu.target)} onClose={closeMenu} />
          )}
        </div>
        <SidePanel
          project={project}
          version={version}
          selection={state.selection}
          issues={issues}
          showLabels={state.showLabels}
          dispatch={dispatch}
          open={panelOpen}
        />
      </main>
      <ShortcutsDialog open={help} onClose={() => setHelp(false)} isMac={isMac} />
    </div>
  );
}
