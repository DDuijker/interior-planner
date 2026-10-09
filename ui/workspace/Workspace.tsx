"use client";

import dynamic from "next/dynamic";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { resolveEntry, type CatalogEntry, createItem } from "@/catalog";
import { checkLayout, conflictingIds } from "@/core/collision/collision";
import { screenToWorld, zoomAt } from "@/core/editor/camera";
import { matchShortcut } from "@/core/editor/shortcuts";
import { boundingRect } from "@/core/geometry/rect";
import { canRedo, canUndo } from "@/core/history/history";
import {
  addItem,
  duplicateItems,
  floorBelow,
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
import { settleItem } from "@/core/placement/placement";
import { generateWalls } from "@/core/walls/generate";
import { useI18n } from "@/i18n/I18nProvider";
import { CatalogPanel } from "@/ui/catalog/CatalogPanel";
import { useToast } from "@/ui/components/Toast";
import { ContextMenu, type MenuEntry } from "@/ui/editor/ContextMenu";
import { PlanCanvas, type ContextTarget } from "@/ui/editor/PlanCanvas";
import { ShortcutsDialog } from "@/ui/editor/ShortcutsDialog";
import { SidePanel } from "@/ui/editor/SidePanel";
import { editorReducer, initialEditorState, type EditorAction } from "@/ui/editor/state";
import { Toolbar } from "@/ui/editor/Toolbar";
import { countChange, shouldRemind } from "@/ui/projects/backupReminder";
import { useSettings } from "@/ui/settings/settings";
import { CustomBuilder } from "./CustomBuilder";
import { ExportDialog } from "./ExportDialog";
import { ImportDialog } from "./ImportDialog";
import { EmptyPlanTip, Onboarding } from "./Onboarding";
import { TopBar, type SaveStatus } from "./TopBar";
import { WorkspaceContext, type Capture } from "./context";

const ThreeView = dynamic(() => import("@/three/ThreeView").then((m) => m.ThreeView), {
  ssr: false,
  loading: () => <Loading />,
});
const StyleView = dynamic(() => import("@/ui/style/StyleView").then((m) => m.StyleView), {
  ssr: false,
  loading: () => <Loading />,
});
const MoodboardStrip = dynamic(
  () => import("@/ui/photos/MoodboardStrip").then((m) => m.MoodboardStrip),
  { ssr: false },
);
const PhotosView = dynamic(() => import("@/ui/photos/PhotosView").then((m) => m.PhotosView), {
  ssr: false,
  loading: () => <Loading />,
});

function Loading() {
  const { t } = useI18n();
  return (
    <p className="view-loading muted" role="status">
      {t("common.loading")}
    </p>
  );
}

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export type SidebarTab = "props" | "catalog" | "overview";

export function Workspace({
  initial,
  prepare,
  persist,
}: {
  initial: Project;
  prepare?: (p: Project) => Project | null;
  /** Save to storage. Without it the workspace is a demo that keeps nothing. */
  persist?: (p: Project) => Promise<void>;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { settings: app } = useSettings();
  const [state, dispatch] = useReducer(editorReducer, initial, initialEditorState);
  const [menu, setMenu] = useState<{ target: ContextTarget; at: Point } | null>(null);
  const [help, setHelp] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<SidebarTab>("props");
  const [dialog, setDialog] = useState<"import" | "export" | "custom" | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [isMac, setIsMac] = useState(false);
  const [status, setStatus] = useState<SaveStatus>(
    persist ? { kind: "saved", at: new Date() } : { kind: "local" },
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const captures = useRef(new Map<string, Capture>());
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const project = state.history.present;
  const floor = getFloor(project);
  const version = getActiveVersion(project);
  const { settings } = project;

  useEffect(() => {
    // navigator is only available after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
    const next = prepare?.(initial);
    if (next) dispatch({ type: "load", project: next });
  }, [initial, prepare]);

  // ------------------------------------------------------------ autosave
  const saved = useRef(project);
  const saveNow = useCallback(async () => {
    if (!persist) return;
    const current = stateRef.current.history.present;
    if (current === saved.current) return;
    const stamped = { ...current, updatedAt: new Date().toISOString() };
    setStatus({ kind: "saving" });
    try {
      await persist(stamped);
      saved.current = current;
      setStatus({ kind: "saved", at: new Date() });
      const n = countChange(current.id);
      if (shouldRemind(n, app.backupEvery))
        toast(t("save.backupReminder", { count: n }), "warning");
    } catch {
      setStatus({ kind: "error" });
    }
  }, [persist, app.backupEvery, toast, t]);

  useEffect(() => {
    if (!persist || project === saved.current) return;
    // Mark dirty right away; the save itself is debounced.
    setStatus({ kind: "dirty" });
    if (!app.autosave) return;
    const id = setTimeout(() => void saveNow(), 700);
    return () => clearTimeout(id);
  }, [project, persist, app.autosave, saveNow]);

  // Warn before closing with unsaved changes.
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (persist && stateRef.current.history.present !== saved.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [persist]);

  // ---------------------------------------------------------- derived data
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
  const pieces = useMemo(
    () => cutWalls(walls, version.openings, false, version.demolitions),
    [walls, version.openings, version.demolitions],
  );
  const bounds = useMemo(
    () => boundingRect(walls.map((w) => w.rect)) ?? { x: 0, y: 0, w: 500, d: 400 },
    [walls],
  );
  const below = floorBelow(project, floor.id);
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

  const apply = useCallback(
    (update: (p: Project) => Project, select?: Id[]) => dispatch({ type: "apply", update, select }),
    [],
  );

  /** Make stacked items stand on furniture and wall items hang on walls. */
  const settle = useCallback(
    (ids: readonly Id[]) => {
      const p = stateRef.current.history.present;
      const v = getActiveVersion(p);
      const surfaceOf = (i: Item) => {
        const e = resolveEntry(i, p.customItems);
        return e?.surface !== undefined ? e.surface * i.h : undefined;
      };
      const patches = new Map<Id, Partial<Item>>();
      for (const id of ids) {
        const item = v.items.find((i) => i.id === id);
        if (!item || item.mount === "floor") continue;
        patches.set(id, settleItem(item, v.items, walls, surfaceOf));
      }
      if (patches.size)
        apply((q) => [...patches].reduce((acc, [id, patch]) => updateItems(acc, [id], patch), q));
    },
    [walls, apply],
  );

  const addEntry = useCallback(
    (entry: CatalogEntry, at?: Point) => {
      let point = at;
      if (!point) {
        const r = canvasRef.current?.getBoundingClientRect();
        point = screenToWorld(stateRef.current.camera, {
          x: (r?.width ?? 400) / 2,
          y: (r?.height ?? 300) / 2,
        });
      }
      const item = createItem(entry, {
        at: { x: Math.round(point.x), y: Math.round(point.y) },
        locale,
      });
      apply((p) => addItem(p, item), [item.id]);
      settle([item.id]);
      if (stateRef.current.view !== "plan" && stateRef.current.view !== "3d")
        dispatch({ type: "view", view: "plan" });
    },
    [apply, settle, locale],
  );

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
        dispatch({ type: "pickWall", wall: null });
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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }
      if (isTyping(e.target) || document.querySelector("dialog[open]")) return;
      // The 3D walk mode handles its own keys.
      if (stateRef.current.view === "3d" && (e.target as HTMLElement)?.closest?.(".three-wrap"))
        return;
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
  }, [isMac, runAction, saveNow]);

  const closeMenu = useCallback(() => setMenu(null), []);

  function menuEntries(target: ContextTarget): MenuEntry[] {
    if (target.kind === "room") {
      const room = version.rooms.find((r) => r.id === target.id);
      if (!room) return [];
      return [
        { label: t("room.edit"), onSelect: () => dispatch({ type: "pickRoom", room: room.id }) },
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
    if (target.kind === "wall") {
      return [
        {
          label: t("wall.edit"),
          onSelect: () =>
            dispatch({ type: "pickWall", wall: { wallId: target.id, side: target.side ?? "a" } }),
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

  const ctx = useMemo(
    () => ({
      state,
      dispatch: dispatch as (a: EditorAction) => void,
      project,
      version,
      floor,
      walls,
      pieces,
      issues,
      apply,
      settle,
      registerCapture: (name: string, fn: Capture | null) => {
        if (fn) captures.current.set(name, fn);
        else captures.current.delete(name);
      },
      capture: (name: string) => captures.current.get(name),
    }),
    [state, project, version, floor, walls, pieces, issues, apply, settle],
  );

  const showSidebar = state.view === "plan" || state.view === "3d";

  return (
    <WorkspaceContext.Provider value={ctx}>
      <div className="editor" data-view={state.view}>
        <a href="#main-view" className="skip-link">
          {t("nav.skip")}
        </a>
        <TopBar
          project={project}
          apply={apply}
          view={state.view}
          onView={(view) => dispatch({ type: "view", view })}
          status={status}
          {...(persist && !app.autosave ? { onSave: () => void saveNow() } : {})}
          onImport={() => setDialog("import")}
          onExport={() => setDialog("export")}
          onHelp={() => setHelp(true)}
          moodboardOpen={state.moodboardOpen}
          {...(showSidebar
            ? { onMoodboard: () => dispatch({ type: "toggle", key: "moodboardOpen" }) }
            : {})}
        />
        {state.view === "plan" && (
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
                camera: zoomAt(
                  state.camera,
                  { x: (r?.width ?? 0) / 2, y: (r?.height ?? 0) / 2 },
                  f,
                ),
              });
            }}
            onFit={() => setFitSignal((n) => n + 1)}
            showGrid={state.showGrid}
            onToggleGrid={() => dispatch({ type: "toggle", key: "showGrid" })}
            snap={settings.snapToGrid}
            onToggleSnap={() =>
              apply((p) => ({
                ...p,
                settings: { ...p.settings, snapToGrid: !p.settings.snapToGrid },
              }))
            }
            gridSize={settings.gridSize}
            onGridSize={(gridSize) =>
              apply((p) => ({ ...p, settings: { ...p.settings, gridSize } }))
            }
            unit={settings.unit}
            onUnit={(unit) => apply((p) => ({ ...p, settings: { ...p.settings, unit } }))}
            onHelp={() => setHelp(true)}
            panelOpen={panelOpen}
            onTogglePanel={() => setPanelOpen((o) => !o)}
            ghost={state.ghost}
            hasBelow={!!below}
            onToggleGhost={() => dispatch({ type: "toggle", key: "ghost" })}
          />
        )}
        <main className={`editor-main${showSidebar ? "" : " no-sidebar"}`} id="main-view">
          {state.view === "plan" && (
            <div
              ref={canvasRef}
              id="plan"
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
                below={state.ghost ? below : undefined}
                onContextMenu={(target, at) => setMenu({ target, at })}
                onDropEntry={(entry, at) => addEntry(entry, at)}
                settle={settle}
              />
              {menu && (
                <ContextMenu at={menu.at} entries={menuEntries(menu.target)} onClose={closeMenu} />
              )}
              {version.rooms.length === 0 && (
                <EmptyPlanTip
                  onImport={() => setDialog("import")}
                  onDraw={() => dispatch({ type: "tool", tool: "room-rect" })}
                />
              )}
            </div>
          )}
          {state.view === "3d" && (
            <ThreeView panelOpen={panelOpen} onTogglePanel={() => setPanelOpen((o) => !o)} />
          )}
          {state.view === "style" && <StyleView />}
          {state.view === "photos" && <PhotosView />}
          {showSidebar && state.moodboardOpen && (
            <MoodboardStrip onClose={() => dispatch({ type: "toggle", key: "moodboardOpen" })} />
          )}
          {showSidebar && (
            <SidePanel
              project={project}
              version={version}
              selection={state.selection}
              issues={issues}
              showLabels={state.showLabels}
              dispatch={dispatch}
              open={panelOpen}
              tab={tab}
              onTab={setTab}
              wallPick={state.wall}
              roomPick={state.room}
              openingPick={state.opening}
              fixturePick={state.fixture}
              walls={walls}
              catalog={
                <CatalogPanel
                  onAdd={(e) => addEntry(e)}
                  custom={project.customItems}
                  onBuildCustom={() => setDialog("custom")}
                  showLife={settings.showLife}
                />
              }
            />
          )}
        </main>
        {persist && <Onboarding />}
        <ShortcutsDialog open={help} onClose={() => setHelp(false)} isMac={isMac} />
        {dialog === "export" && <ExportDialog onClose={() => setDialog(null)} />}
        {dialog === "import" && <ImportDialog onClose={() => setDialog(null)} />}
        {dialog === "custom" && (
          <CustomBuilder onClose={() => setDialog(null)} onPlace={(e) => addEntry(e)} />
        )}
      </div>
    </WorkspaceContext.Provider>
  );
}
