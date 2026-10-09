"use client";

import { useRef, useState } from "react";
import { resolveEntry } from "@/catalog";
import type { LayoutIssue } from "@/core/collision/collision";
import { roomArea } from "@/core/editor/rooms";
import { formatArea, formatLength } from "@/core/measure/units";
import {
  addOpening,
  duplicateItems,
  groupItems,
  removeItems,
  removeRoom,
  rotateItems,
  setLayerState,
  setWallOverride,
  ungroupItems,
  updateActiveVersion,
  updateItems,
  updateRoom,
} from "@/core/model/actions";
import { newId } from "@/core/model/ids";
import {
  LAYERS,
  ROOM_TYPES,
  type Id,
  type Item,
  type Project,
  type RoomType,
  type Version,
  type Wall,
} from "@/core/model/types";
import { placeOnWall } from "@/core/openings/openings";
import { resolveWallFinish } from "@/core/style/style";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Button, IconButton } from "@/ui/components/Button";
import { ColorPicker } from "@/ui/components/ColorPicker";
import { Modal } from "@/ui/components/Modal";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { WallFinishEditor } from "@/ui/style/FinishEditors";
import { usePalettes } from "@/ui/style/palettes";
import { putPhoto } from "@/ui/storage/db";
import { LengthField } from "./LengthField";
import { ROOM_TINTS } from "./roomColors";
import type { EditorAction, WallPick } from "./state";

export type SidebarTab = "props" | "catalog" | "overview";

export function SidePanel({
  project,
  version,
  selection,
  issues,
  showLabels,
  dispatch,
  open,
  tab,
  onTab,
  wallPick,
  roomPick,
  walls,
  catalog,
}: {
  project: Project;
  version: Version;
  selection: Id[];
  issues: readonly LayoutIssue[];
  showLabels: boolean;
  dispatch: (a: EditorAction) => void;
  open: boolean;
  tab: SidebarTab;
  onTab: (t: SidebarTab) => void;
  wallPick: WallPick | null;
  roomPick: Id | null;
  walls: readonly Wall[];
  catalog: React.ReactNode;
}) {
  const { t } = useI18n();
  const tabs: SidebarTab[] = ["props", "catalog", "overview"];
  return (
    <aside
      id="editor-panel"
      className={`editor-panel${open ? " is-open" : ""}`}
      aria-label={t("editor.properties")}
    >
      <div role="tablist" aria-label={t("editor.panel")} className="panel-tabs">
        {tabs.map((id) => (
          <button
            key={id}
            role="tab"
            type="button"
            className="tab"
            aria-selected={tab === id}
            id={`panel-tab-${id}`}
            aria-controls={`panel-${id}`}
            onClick={() => onTab(id)}
          >
            {t(`panel.${id}` as MessageKey)}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`panel-${tab}`}
        aria-labelledby={`panel-tab-${tab}`}
        className="panel-body"
      >
        {tab === "props" && (
          <PropsTab
            project={project}
            version={version}
            selection={selection}
            dispatch={dispatch}
            wallPick={wallPick}
            roomPick={roomPick}
            walls={walls}
          />
        )}
        {tab === "catalog" && catalog}
        {tab === "overview" && (
          <OverviewTab
            project={project}
            version={version}
            selection={selection}
            issues={issues}
            showLabels={showLabels}
            dispatch={dispatch}
          />
        )}
      </div>
    </aside>
  );
}

function PropsTab({
  project,
  version,
  selection,
  dispatch,
  wallPick,
  roomPick,
  walls,
}: {
  project: Project;
  version: Version;
  selection: Id[];
  dispatch: (a: EditorAction) => void;
  wallPick: WallPick | null;
  roomPick: Id | null;
  walls: readonly Wall[];
}) {
  const { t } = useI18n();
  const apply = (update: (p: Project) => Project, select?: Id[]) =>
    dispatch({ type: "apply", update, select });
  const selected = version.items.filter((i) => selection.includes(i.id));
  const single = selected.length === 1 ? selected[0] : undefined;
  const wall = wallPick ? walls.find((w) => w.id === wallPick.wallId) : undefined;
  const room = roomPick ? version.rooms.find((r) => r.id === roomPick) : undefined;

  if (wall && wallPick)
    return (
      <WallPanel
        project={project}
        version={version}
        wall={wall}
        side={wallPick.side}
        dispatch={dispatch}
      />
    );
  if (room)
    return <RoomPanel project={project} roomId={room.id} version={version} dispatch={dispatch} />;

  return (
    <section className="panel-section">
      <p className="muted" aria-live="polite">
        {selected.length
          ? t("editor.selection.count", { count: selected.length })
          : t("editor.selection.none")}
      </p>
      {!selected.length && <p className="muted small">{t("panel.hint")}</p>}
      {selected.length > 0 && (
        <div className="row">
          <IconButton
            icon="rotateLeft"
            label={t("editor.rotateLeft")}
            onClick={() => apply((p) => rotateItems(p, selection, -15))}
          />
          <IconButton
            icon="rotateRight"
            label={t("editor.rotateRight")}
            onClick={() => apply((p) => rotateItems(p, selection, 15))}
          />
          <IconButton
            icon="copy"
            label={t("editor.duplicate")}
            onClick={() => {
              const r = duplicateItems(project, selection);
              apply(() => r.project, r.ids);
            }}
          />
          <IconButton
            icon="trash"
            label={t("editor.delete")}
            onClick={() => apply((p) => removeItems(p, selection), [])}
          />
          {selected.length > 1 &&
            !selected.every((i) => i.groupId && i.groupId === selected[0]!.groupId) && (
              <IconButton
                icon="group"
                label={t("editor.group")}
                onClick={() => apply((p) => groupItems(p, selection).project)}
              />
            )}
          {selected.some((i) => i.groupId) && (
            <Button
              variant="ghost"
              onClick={() =>
                apply((p) =>
                  [...new Set(selected.map((i) => i.groupId).filter(Boolean))].reduce(
                    (q, g) => ungroupItems(q, g!),
                    p,
                  ),
                )
              }
            >
              {t("editor.ungroup")}
            </Button>
          )}
        </div>
      )}
      {single && <ItemProperties key={single.id} item={single} project={project} apply={apply} />}
    </section>
  );
}

function ItemProperties({
  item,
  project,
  apply,
}: {
  item: Item;
  project: Project;
  apply: (update: (p: Project) => Project) => void;
}) {
  const { t } = useI18n();
  const swatches = usePalettes();
  const unit = project.settings.unit;
  const entry = resolveEntry(item, project.customItems);
  const set = (patch: Partial<Item>) => apply((p) => updateItems(p, [item.id], patch));
  const clamp = (k: "w" | "d" | "h", v: number) =>
    entry ? Math.min(entry.max[k], Math.max(entry.min[k], v)) : v;
  return (
    <div className="props-grid">
      <TextField
        label={t("editor.name")}
        defaultValue={item.name}
        onBlur={(e) => e.target.value !== item.name && set({ name: e.target.value })}
      />
      <div className="props-row">
        <LengthField
          label={t("editor.width")}
          value={item.w}
          unit={unit}
          onCommit={(w) => set({ w: clamp("w", w) })}
        />
        <LengthField
          label={t("editor.depth")}
          value={item.d}
          unit={unit}
          onCommit={(d) => set({ d: clamp("d", d) })}
        />
        <LengthField
          label={t("editor.height")}
          value={item.h}
          unit={unit}
          onCommit={(h) => set({ h: clamp("h", h) })}
        />
      </div>
      {item.mount !== "floor" && (
        <LengthField
          label={t("editor.elevation")}
          value={item.elevation}
          unit={unit}
          min={0}
          onCommit={(elevation) => set({ elevation })}
        />
      )}
      {typeof entry?.params?.seats === "number" && (
        <TextField
          label={t("editor.seats")}
          type="number"
          min={1}
          max={6}
          value={Number(item.params?.seats ?? entry.params.seats)}
          onChange={(e) =>
            set({
              params: {
                ...item.params,
                seats: Math.max(1, Math.min(6, Number(e.target.value) || 1)),
              },
            })
          }
        />
      )}
      <TextField
        label={t("editor.rotation")}
        type="number"
        suffix="°"
        value={Math.round(item.rotation)}
        step={15}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v)) set({ rotation: ((v % 360) + 360) % 360 });
        }}
      />
      <ColorPicker
        label={t("editor.colorMain")}
        value={item.color ?? entry?.colors.main ?? "#F5F1E8"}
        swatches={entry?.palette ?? swatches}
        onChange={(color) => set({ color })}
      />
      <ColorPicker
        label={t("editor.colorSecond")}
        value={item.color2 ?? entry?.colors.second ?? "#E9E2D3"}
        swatches={entry?.palette ?? swatches}
        onChange={(color2) => set({ color2 })}
      />
      {item.light && (
        <fieldset className="stack">
          <legend className="field-label">{t("light.title")}</legend>
          <label className="check">
            <input
              type="checkbox"
              checked={item.light.on}
              onChange={(e) => set({ light: { ...item.light!, on: e.target.checked } })}
            />
            {t("light.on")}
          </label>
          <label className="field">
            <span className="field-label">{t("light.brightness")}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={item.light.intensity}
              onChange={(e) =>
                set({ light: { ...item.light!, intensity: Number(e.target.value) } })
              }
            />
          </label>
          <ColorPicker
            label={t("light.color")}
            value={item.light.color}
            swatches={["#FFE2B8", "#FFD9A0", "#FFF4D6", "#FFFFFF", "#DCE9EC"]}
            onChange={(color) => set({ light: { ...item.light!, color } })}
          />
        </fieldset>
      )}
      <TextField
        label={t("editor.price")}
        inputMode="decimal"
        suffix="€"
        defaultValue={item.price ?? ""}
        onBlur={(e) => {
          const v = e.target.value.trim().replace(",", ".");
          set({ price: v === "" ? undefined : Math.max(0, Number(v)) || undefined });
        }}
      />
      <Button
        variant="ghost"
        icon={item.locked ? "unlock" : "lock"}
        onClick={() => set({ locked: !item.locked })}
      >
        {item.locked ? t("editor.unlock") : t("editor.lock")}
      </Button>
      <p className="muted small">
        {formatLength(item.w, unit)} x {formatLength(item.d, unit)} x {formatLength(item.h, unit)}
      </p>
    </div>
  );
}

/** One wall: finish per side, demolish, breakthrough, load-bearing (E09-50, E06-29). */
function WallPanel({
  project,
  version,
  wall,
  side,
  dispatch,
}: {
  project: Project;
  version: Version;
  wall: Wall;
  side: "a" | "b";
  dispatch: (a: EditorAction) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const [confirm, setConfirm] = useState<null | "demolish" | "passage">(null);
  const [width, setWidth] = useState(100);
  const apply = (update: (p: Project) => Project) => dispatch({ type: "apply", update });
  const override = version.wallOverrides[wall.id]?.[side];
  const finish = resolveWallFinish(version, wall, side);
  const bearing = !!version.wallFlags[wall.id]?.bearing;
  const roomName = (id?: Id) =>
    id ? (version.rooms.find((r) => r.id === id)?.name ?? "") : t("wall.outside");
  const horizontal = wall.rect.w >= wall.rect.d;
  const sideName = (s: "a" | "b") =>
    `${t(horizontal ? (s === "a" ? "side.north" : "side.south") : s === "a" ? "side.west" : "side.east")}: ${roomName(wall.rooms[s])}`;

  function demolish() {
    apply((p) => updateActiveVersion(p, (v) => void v.demolitions.push({ ...wall.rect })));
    dispatch({ type: "pickWall", wall: null });
    toast(t("wall.demolished"), "success");
  }

  function breakthrough() {
    const length = horizontal ? wall.rect.w : wall.rect.d;
    const w = Math.min(width, length);
    const centre = horizontal
      ? { x: wall.rect.x + wall.rect.w / 2, y: 0 }
      : { x: 0, y: wall.rect.y + wall.rect.d / 2 };
    const passage = placeOnWall(
      {
        id: newId("pass"),
        kind: "passage" as const,
        x: 0,
        y: 0,
        w,
        dir: horizontal ? ("h" as const) : ("v" as const),
        height: 211,
      },
      wall,
      {
        x: horizontal ? centre.x : wall.rect.x + wall.rect.w / 2,
        y: horizontal ? wall.rect.y + wall.rect.d / 2 : centre.y,
      },
    );
    apply((p) => addOpening(p, passage));
    toast(t("wall.passageAdded"), "success");
  }

  return (
    <section className="panel-section stack" aria-label={t("wall.title")}>
      <h2 className="panel-title">{t("wall.title")}</h2>
      <p className="muted small">
        {t(`wallKindName.${wall.kind}` as MessageKey)} ·{" "}
        {formatLength(Math.max(wall.rect.w, wall.rect.d), project.settings.unit)}
      </p>
      <div role="radiogroup" aria-label={t("wall.side")} className="chips">
        {(["a", "b"] as const).map((s) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={side === s}
            className="chip"
            onClick={() => dispatch({ type: "pickWall", wall: { wallId: wall.id, side: s } })}
          >
            {sideName(s)}
          </button>
        ))}
      </div>
      <WallFinishEditor
        value={finish}
        unit={project.settings.unit}
        wallHeight={wall.height}
        onChange={(f) => apply((p) => setWallOverride(p, wall.id, side, f))}
      />
      <Button
        variant="ghost"
        disabled={!override}
        onClick={() => apply((p) => setWallOverride(p, wall.id, side, undefined))}
      >
        {t("wall.reset")}
      </Button>
      <hr />
      <h3 className="panel-subtitle">{t("wall.renovate")}</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={bearing}
          onChange={(e) =>
            apply((p) =>
              updateActiveVersion(
                p,
                (v) => void (v.wallFlags[wall.id] = { bearing: e.target.checked }),
              ),
            )
          }
        />
        {t("wall.bearing")}
      </label>
      {bearing && (
        <p className="notice notice-warn small" role="note">
          {t("wall.bearingNote")}
        </p>
      )}
      <LengthField
        label={t("wall.passageWidth")}
        value={width}
        unit={project.settings.unit}
        min={40}
        onCommit={setWidth}
      />
      <div className="row">
        <Button icon="door" onClick={() => (bearing ? setConfirm("passage") : breakthrough())}>
          {t("wall.passage")}
        </Button>
        <Button
          variant="danger"
          icon="hammer"
          disabled={wall.kind === "exterior"}
          onClick={() => (bearing ? setConfirm("demolish") : demolish())}
        >
          {t("wall.demolish")}
        </Button>
      </div>
      {wall.kind === "exterior" && <p className="muted small">{t("wall.noDemolishExterior")}</p>}
      <Modal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title={t("wall.bearingTitle")}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t("common.cancel")}</Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm === "demolish") demolish();
                else breakthrough();
                setConfirm(null);
              }}
            >
              {t("wall.bearingContinue")}
            </Button>
          </>
        }
      >
        <p>{t("wall.bearingWarning")}</p>
      </Modal>
    </section>
  );
}

function RoomPanel({
  project,
  roomId,
  version,
  dispatch,
}: {
  project: Project;
  roomId: Id;
  version: Version;
  dispatch: (a: EditorAction) => void;
}) {
  const { t } = useI18n();
  const room = version.rooms.find((r) => r.id === roomId)!;
  const apply = (update: (p: Project) => Project) => dispatch({ type: "apply", update });
  return (
    <section className="panel-section stack" aria-label={t("room.title")}>
      <h2 className="panel-title">{t("room.title")}</h2>
      <TextField
        key={room.id}
        label={t("common.name")}
        defaultValue={room.name}
        onBlur={(e) => apply((p) => updateRoom(p, room.id, { name: e.target.value }))}
      />
      <label className="field">
        <span className="field-label">{t("room.type")}</span>
        <select
          className="input"
          value={room.type}
          onChange={(e) =>
            apply((p) => updateRoom(p, room.id, { type: e.target.value as RoomType }))
          }
        >
          {ROOM_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`room.${type}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      <p className="muted">{formatArea(roomArea(room), project.settings.unit)}</p>
      <p className="muted small">{t("room.editHint")}</p>
      <div className="row">
        <Button icon="palette" onClick={() => dispatch({ type: "view", view: "style" })}>
          {t("room.style")}
        </Button>
        <Button
          variant="ghost"
          onClick={() => apply((p) => updateRoom(p, room.id, { labelHidden: !room.labelHidden }))}
        >
          {room.labelHidden ? t("editor.showLabel") : t("editor.hideLabel")}
        </Button>
        <Button
          variant="danger"
          icon="trash"
          onClick={() => {
            apply((p) => removeRoom(p, room.id));
            dispatch({ type: "pickRoom", room: null });
          }}
        >
          {t("room.delete")}
        </Button>
      </div>
    </section>
  );
}

function OverviewTab({
  project,
  version,
  selection,
  issues,
  showLabels,
  dispatch,
}: {
  project: Project;
  version: Version;
  selection: Id[];
  issues: readonly LayoutIssue[];
  showLabels: boolean;
  dispatch: (a: EditorAction) => void;
}) {
  const { t } = useI18n();
  const unit = project.settings.unit;
  const apply = (update: (p: Project) => Project) => dispatch({ type: "apply", update });
  const nameOf = (id: Id) =>
    version.items.find((i) => i.id === id)?.name ??
    version.fixtures.find((f) => f.id === id)?.type ??
    t("editor.wall");
  return (
    <>
      <details className="panel-section" open>
        <summary className="panel-title">{t("editor.warnings", { count: issues.length })}</summary>
        <LengthField
          label={t("editor.clearance")}
          value={project.settings.clearance}
          unit={unit}
          min={0}
          onCommit={(clearance) => apply((p) => ({ ...p, settings: { ...p.settings, clearance } }))}
        />
        {issues.length === 0 ? (
          <p className="muted">{t("editor.noWarnings")}</p>
        ) : (
          <ul className="warnings">
            {issues.slice(0, 50).map((issue, i) => (
              <li key={i} className={`warning warning-${issue.type}`}>
                <span className="warning-tag">{t(`warningTag.${issue.type}` as MessageKey)}</span>
                <button
                  type="button"
                  className="link-button"
                  onClick={() => dispatch({ type: "select", ids: [issue.ids[0]] })}
                >
                  {issueText(issue, nameOf, (cm) => formatLength(cm, unit), t)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="panel-section">
        <summary className="panel-title">{t("editor.objects")}</summary>
        <ul className="object-list">
          {version.items
            .filter((i) => project.settings.layers[i.layer].visible)
            .map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="object-button"
                  aria-pressed={selection.includes(item.id)}
                  onClick={(e) =>
                    dispatch({ type: "select", ids: [item.id], additive: e.shiftKey })
                  }
                >
                  {item.name}
                </button>
              </li>
            ))}
        </ul>
      </details>

      <details className="panel-section">
        <summary className="panel-title">{t("editor.layers")}</summary>
        <label className="check">
          <input
            type="checkbox"
            checked={project.settings.showLife}
            onChange={(e) =>
              apply((p) => ({ ...p, settings: { ...p.settings, showLife: e.target.checked } }))
            }
          />
          {t("editor.showLife")}
        </label>
        <ul className="layer-list">
          {LAYERS.map((layer) => {
            const state = project.settings.layers[layer];
            const name = t(`layer.${layer}`);
            return (
              <li key={layer} className="layer-row">
                <span>{name}</span>
                <IconButton
                  icon={state.visible ? "eye" : "eyeOff"}
                  label={t(state.visible ? "editor.layer.hide" : "editor.layer.show", {
                    layer: name,
                  })}
                  pressed={!state.visible}
                  onClick={() => apply((p) => setLayerState(p, layer, { visible: !state.visible }))}
                />
                <IconButton
                  icon={state.locked ? "lock" : "unlock"}
                  label={t(state.locked ? "editor.layer.unlock" : "editor.layer.lock", {
                    layer: name,
                  })}
                  pressed={state.locked}
                  onClick={() => apply((p) => setLayerState(p, layer, { locked: !state.locked }))}
                />
              </li>
            );
          })}
        </ul>
      </details>

      <details className="panel-section">
        <summary className="panel-title">{t("editor.rooms")}</summary>
        <label className="check">
          <input
            type="checkbox"
            checked={showLabels}
            onChange={() => dispatch({ type: "toggle", key: "showLabels" })}
          />
          {t("editor.labels")}
        </label>
        <ul className="room-list">
          {version.rooms.map((room) => (
            <li key={room.id} className="room-row">
              <span
                className="swatch-dot"
                style={{ background: ROOM_TINTS[room.type] }}
                aria-hidden="true"
              />
              <button
                type="button"
                className="link-button room-name"
                onClick={() => dispatch({ type: "pickRoom", room: room.id })}
              >
                {room.name || t(`room.${room.type}`)}
              </button>
              <span className="muted">{formatArea(roomArea(room), unit)}</span>
            </li>
          ))}
        </ul>
        <h3 className="panel-subtitle">{t("editor.legend")}</h3>
        <ul className="legend">
          {ROOM_TYPES.filter((type) => version.rooms.some((r) => r.type === type)).map((type) => (
            <li key={type}>
              <span
                className="swatch-dot"
                style={{ background: ROOM_TINTS[type] }}
                aria-hidden="true"
              />
              {t(`room.${type}`)}
            </li>
          ))}
        </ul>
      </details>

      <BackgroundSection project={project} version={version} dispatch={dispatch} />
    </>
  );
}

/** Image under the plan to trace over (E06-30). */
function BackgroundSection({
  project,
  version,
  dispatch,
}: {
  project: Project;
  version: Version;
  dispatch: (a: EditorAction) => void;
}) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const bg = version.background;
  const apply = (update: (p: Project) => Project) => dispatch({ type: "apply", update });
  const setBg = (patch: Partial<NonNullable<Version["background"]>> | null) =>
    apply((p) =>
      updateActiveVersion(p, (v) => {
        if (patch === null) delete v.background;
        else if (v.background) Object.assign(v.background, patch);
      }),
    );

  async function upload(file: File) {
    const id = newId("bg");
    const bitmap = await createImageBitmap(file);
    await putPhoto(id, file);
    // Start at 1 cm per pixel, centred on the plan origin.
    apply((p) =>
      updateActiveVersion(
        p,
        (v) =>
          void (v.background = {
            photoId: id,
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            opacity: 0.5,
            keep: false,
          }),
      ),
    );
    bitmap.close();
  }

  return (
    <details className="panel-section">
      <summary className="panel-title">{t("bg.title")}</summary>
      <p className="muted small">{t("bg.hint")}</p>
      <div className="row">
        <Button icon="image" onClick={() => fileRef.current?.click()}>
          {bg ? t("bg.replace") : t("bg.upload")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label={t("bg.upload")}
          onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
        />
        {bg && (
          <Button variant="ghost" onClick={() => setBg(null)}>
            {t("common.remove")}
          </Button>
        )}
      </div>
      {bg && (
        <div className="stack">
          <label className="field">
            <span className="field-label">{t("bg.opacity")}</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={bg.opacity}
              onChange={(e) => setBg({ opacity: Number(e.target.value) })}
            />
          </label>
          <Button icon="ruler" onClick={() => dispatch({ type: "tool", tool: "scale-ref" })}>
            {t("bg.scale")}
          </Button>
          <div className="props-row">
            <LengthField
              label="X"
              value={bg.x}
              unit={project.settings.unit}
              min={-100000}
              onCommit={(x) => setBg({ x })}
            />
            <LengthField
              label="Y"
              value={bg.y}
              unit={project.settings.unit}
              min={-100000}
              onCommit={(y) => setBg({ y })}
            />
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={bg.keep}
              onChange={(e) => setBg({ keep: e.target.checked })}
            />
            {t("bg.keep")}
          </label>
        </div>
      )}
    </details>
  );
}

function issueText(
  issue: LayoutIssue,
  name: (id: Id) => string,
  len: (cm: number) => string,
  t: (k: MessageKey, p?: Record<string, string | number>) => string,
): string {
  const [a, b] = issue.ids;
  switch (issue.type) {
    case "overlap":
      return t("warning.overlap", { a: name(a), b: name(b) });
    case "wall":
      return t("warning.wall", { a: name(a) });
    case "door":
      return t("warning.door", { a: name(a) });
    case "clearance":
      return t("warning.clearance", { a: name(a), b: name(b), gap: len(issue.gap ?? 0) });
  }
}
