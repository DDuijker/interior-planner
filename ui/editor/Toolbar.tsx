"use client";

import Link from "next/link";
import { UNITS, type Unit } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { IconButton } from "@/ui/components/Button";
import type { Tool } from "./state";

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
}) {
  const { t } = useI18n();
  return (
    <header className="editor-bar">
      <Link href="/" className="editor-brand display">
        {t("app.name")}
      </Link>
      <div role="toolbar" aria-label={t("editor.toolbar")} className="editor-tools">
        <div className="tool-group">
          <IconButton
            icon="select"
            label={t("editor.tool.select")}
            pressed={tool === "select"}
            onClick={() => onTool("select")}
          />
          <IconButton
            icon="hand"
            label={t("editor.tool.pan")}
            pressed={tool === "pan"}
            onClick={() => onTool("pan")}
          />
          <IconButton
            icon="ruler"
            label={t("editor.tool.measure")}
            pressed={tool === "measure"}
            onClick={() => onTool("measure")}
          />
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
    </header>
  );
}
