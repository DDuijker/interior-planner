"use client";

import type { LayoutIssue } from "@/core/collision/collision";
import { roomArea } from "@/core/editor/rooms";
import { formatArea, formatLength } from "@/core/measure/units";
import {
  duplicateItems,
  groupItems,
  removeItems,
  rotateItems,
  setLayerState,
  ungroupItems,
  updateItems,
  updateRoom,
} from "@/core/model/actions";
import {
  LAYERS,
  ROOM_TYPES,
  type Id,
  type Item,
  type Project,
  type Version,
} from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Button, IconButton } from "@/ui/components/Button";
import { ColorPicker } from "@/ui/components/ColorPicker";
import { TextField } from "@/ui/components/TextField";
import { LengthField } from "./LengthField";
import { ROOM_TINTS } from "./roomColors";
import type { EditorAction } from "./state";

export function SidePanel({
  project,
  version,
  selection,
  issues,
  showLabels,
  dispatch,
  open,
}: {
  project: Project;
  version: Version;
  selection: Id[];
  issues: LayoutIssue[];
  showLabels: boolean;
  dispatch: (a: EditorAction) => void;
  open: boolean;
}) {
  const { t } = useI18n();
  const unit = project.settings.unit;
  const selected = version.items.filter((i) => selection.includes(i.id));
  const single = selected.length === 1 ? selected[0] : undefined;
  const apply = (update: (p: Project) => Project, select?: Id[]) =>
    dispatch({ type: "apply", update, select });
  const nameOf = (id: Id) =>
    version.items.find((i) => i.id === id)?.name ??
    version.fixtures.find((f) => f.id === id)?.type ??
    t("editor.wall");

  return (
    <aside
      id="editor-panel"
      className={`editor-panel${open ? " is-open" : ""}`}
      aria-label={t("editor.properties")}
    >
      <section className="panel-section">
        <h2 className="panel-title">{t("editor.properties")}</h2>
        <p className="muted" aria-live="polite">
          {selected.length
            ? t("editor.selection.count", { count: selected.length })
            : t("editor.selection.none")}
        </p>
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
        {single && <ItemProperties key={single.id} item={single} unit={unit} apply={apply} />}
      </section>

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
              <span className="room-name">{room.name || t(`room.${room.type}`)}</span>
              <span className="muted">{formatArea(roomArea(room), unit)}</span>
              <Button
                variant="ghost"
                onClick={() =>
                  apply((p) => updateRoom(p, room.id, { labelHidden: !room.labelHidden }))
                }
              >
                {room.labelHidden ? t("editor.showLabel") : t("editor.hideLabel")}
              </Button>
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
    </aside>
  );
}

function ItemProperties({
  item,
  unit,
  apply,
}: {
  item: Item;
  unit: Project["settings"]["unit"];
  apply: (update: (p: Project) => Project) => void;
}) {
  const { t } = useI18n();
  const set = (patch: Partial<Item>) => apply((p) => updateItems(p, [item.id], patch));
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
          onCommit={(w) => set({ w })}
        />
        <LengthField
          label={t("editor.depth")}
          value={item.d}
          unit={unit}
          onCommit={(d) => set({ d })}
        />
        <LengthField
          label={t("editor.height")}
          value={item.h}
          unit={unit}
          onCommit={(h) => set({ h })}
        />
      </div>
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
      <ColorPicker value={item.color ?? "#F5F1E8"} onChange={(color) => set({ color })} />
      <Button
        variant="ghost"
        icon={item.locked ? "unlock" : "lock"}
        onClick={() => set({ locked: !item.locked })}
      >
        {item.locked ? t("editor.unlock") : t("editor.lock")}
      </Button>
    </div>
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
