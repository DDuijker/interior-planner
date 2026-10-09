"use client";

import { UNITS, type Unit } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { IconButton } from "@/ui/components/Button";
import type { IconName } from "@/ui/icons";
import type { Tool } from "./state";

const NAV_TOOLS: [Tool, IconName][] = [
  ["select", "select"],
  ["pan", "hand"],
  ["measure", "ruler"],
];

const DRAW_TOOLS: [Tool, IconName][] = [
  ["room-rect", "room"],
  ["room-l", "floors"],
  ["room-poly", "polygon"],
  ["wall", "wall"],
  ["stairs", "stairs"],
];

const OPENING_TOOLS: [Tool, IconName][] = [
  ["door", "door"],
  ["window", "window"],
  ["passage", "hammer"],
];

export function Toolbar({
  tool,
  onTool,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onZoom,
  onFit,
  showGrid,
  onToggleGrid,
  snap,
  onToggleSnap,
  gridSize,
  onGridSize,
  unit,
  onUnit,
  onHelp,
  panelOpen,
  onTogglePanel,
  ghost,
  hasBelow,
  onToggleGhost,
}: {
  tool: Tool;
  onTool: (t: Tool) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onZoom: (factor: number) => void;
  onFit: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snap: boolean;
  onToggleSnap: () => void;
  gridSize: number;
  onGridSize: (n: number) => void;
  unit: Unit;
  onUnit: (u: Unit) => void;
  onHelp: () => void;
  panelOpen: boolean;
  onTogglePanel: () => void;
  ghost: boolean;
  hasBelow: boolean;
  onToggleGhost: () => void;
}) {
  const { t } = useI18n();
  const toolButton = ([id, icon]: [Tool, IconName]) => (
    <IconButton
      key={id}
      icon={icon}
      label={t(`editor.tool.${id}` as MessageKey)}
      pressed={tool === id}
      onClick={() => onTool(tool === id ? "select" : id)}
    />
  );
  return (
    <div className="editor-bar">
      <div role="toolbar" aria-label={t("editor.toolbar")} className="editor-tools">
        <div className="tool-group">{NAV_TOOLS.map(toolButton)}</div>
        <div className="tool-group" aria-label={t("editor.draw")}>
          {DRAW_TOOLS.map(toolButton)}
        </div>
        <div className="tool-group" aria-label={t("editor.openings")}>
          {OPENING_TOOLS.map(toolButton)}
        </div>
        <div className="tool-group">
          <IconButton icon="undo" label={t("editor.undo")} disabled={!canUndo} onClick={onUndo} />
          <IconButton icon="redo" label={t("editor.redo")} disabled={!canRedo} onClick={onRedo} />
        </div>
        <div className="tool-group">
          <IconButton icon="minus" label={t("editor.zoomOut")} onClick={() => onZoom(1 / 1.25)} />
          <IconButton icon="plus" label={t("editor.zoomIn")} onClick={() => onZoom(1.25)} />
          <IconButton icon="fit" label={t("editor.zoomFit")} onClick={onFit} />
        </div>
        <div className="tool-group tool-group-settings">
          <label className="check">
            <input type="checkbox" checked={showGrid} onChange={onToggleGrid} />
            {t("editor.grid")}
          </label>
          <label className="check">
            <input type="checkbox" checked={snap} onChange={onToggleSnap} />
            {t("editor.snap")}
          </label>
          {hasBelow && (
            <label className="check">
              <input type="checkbox" checked={ghost} onChange={onToggleGhost} />
              {t("editor.ghost")}
            </label>
          )}
          <label className="inline-select">
            <span className="sr-only">{t("editor.gridSize")}</span>
            <select
              className="input"
              value={gridSize}
              onChange={(e) => onGridSize(Number(e.target.value))}
            >
              {[1, 5, 10, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} cm
                </option>
              ))}
            </select>
          </label>
          <label className="inline-select">
            <span className="sr-only">{t("settings.unit")}</span>
            <select className="input" value={unit} onChange={(e) => onUnit(e.target.value as Unit)}>
              {UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="tool-group">
          <IconButton icon="keyboard" label={t("editor.shortcuts.open")} onClick={onHelp} />
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
    </div>
  );
}
