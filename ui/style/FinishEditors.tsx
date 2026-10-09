"use client";

import {
  CORNICE_STYLES,
  FLOOR_FINISH_KINDS,
  PANEL_STYLES,
  SKIRTING_STYLES,
  WALL_FINISH_KINDS,
  WALLPAPER_PATTERNS,
  type FloorFinish,
  type Trim,
  type Unit,
  type WallFinish,
} from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { ColorPicker } from "@/ui/components/ColorPicker";
import { LengthField } from "@/ui/editor/LengthField";
import { usePalettes } from "./palettes";

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  prefix,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  prefix: string;
}) {
  const { t } = useI18n();
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {t(`${prefix}.${o}` as MessageKey)}
          </option>
        ))}
      </select>
    </label>
  );
}

export function WallFinishEditor({
  value,
  onChange,
  unit,
  wallHeight,
}: {
  value: WallFinish;
  onChange: (f: WallFinish) => void;
  unit: Unit;
  wallHeight: number;
}) {
  const { t } = useI18n();
  const swatches = usePalettes();
  return (
    <div className="stack">
      <Select
        label={t("style.wallFinish")}
        value={value.kind}
        options={WALL_FINISH_KINDS}
        prefix="wallKind"
        onChange={(kind) => onChange({ ...value, kind })}
      />
      {value.kind === "wallpaper" && (
        <Select
          label={t("style.pattern")}
          value={value.pattern ?? "stripe"}
          options={WALLPAPER_PATTERNS}
          prefix="pattern"
          onChange={(pattern) => onChange({ ...value, pattern })}
        />
      )}
      {value.kind === "panel" && (
        <>
          <Select
            label={t("style.panel")}
            value={value.panel ?? "shaker"}
            options={PANEL_STYLES}
            prefix="panel"
            onChange={(panel) => onChange({ ...value, panel })}
          />
          <LengthField
            label={t("style.panelHeight")}
            value={value.height ?? wallHeight}
            unit={unit}
            min={20}
            onCommit={(height) => onChange({ ...value, height: Math.min(height, wallHeight) })}
          />
        </>
      )}
      {value.kind !== "current" && (
        <ColorPicker
          label={value.kind === "panel" ? t("style.colorAbove") : t("color.label")}
          value={value.color ?? "#F5F1E8"}
          swatches={swatches}
          onChange={(color) => onChange({ ...value, color })}
        />
      )}
      {(value.kind === "panel" || value.kind === "wallpaper") && (
        <ColorPicker
          label={value.kind === "panel" ? t("style.colorPanel") : t("style.colorPattern")}
          value={value.color2 ?? "#87A08C"}
          swatches={swatches}
          onChange={(color2) => onChange({ ...value, color2 })}
        />
      )}
    </div>
  );
}

export function FloorFinishEditor({
  value,
  onChange,
  unit,
}: {
  value: FloorFinish;
  onChange: (f: FloorFinish) => void;
  unit: Unit;
}) {
  const { t } = useI18n();
  const swatches = usePalettes();
  const planks = ["planks", "herringbone", "chevron"].includes(value.kind);
  const tiles = ["tiles", "checker"].includes(value.kind);
  return (
    <div className="stack">
      <Select
        label={t("style.floor")}
        value={value.kind}
        options={FLOOR_FINISH_KINDS}
        prefix="floorKind"
        onChange={(kind) => onChange({ ...value, kind })}
      />
      {value.kind !== "current" && (
        <ColorPicker
          label={t("color.label")}
          value={value.color ?? "#B8916A"}
          swatches={[...swatches, "#B8916A", "#9C7A58", "#7E5C40", "#D7C3A3"]}
          onChange={(color) => onChange({ ...value, color })}
        />
      )}
      {(value.kind === "checker" || value.kind === "terrazzo") && (
        <ColorPicker
          label={t("style.color2")}
          value={value.color2 ?? "#2A2620"}
          swatches={swatches}
          onChange={(color2) => onChange({ ...value, color2 })}
        />
      )}
      {(planks || tiles) && (
        <ColorPicker
          label={t("style.joint")}
          value={value.jointColor ?? "#5A4636"}
          swatches={["#5A4636", "#2A2620", "#DDD6C6", "#FFFFFF"]}
          onChange={(jointColor) => onChange({ ...value, jointColor })}
        />
      )}
      {planks && (
        <LengthField
          label={t("style.plankWidth")}
          value={value.plankWidth ?? 14}
          unit={unit}
          min={4}
          onCommit={(plankWidth) => onChange({ ...value, plankWidth })}
        />
      )}
      {tiles && (
        <LengthField
          label={t("style.tileSize")}
          value={value.tileSize ?? 30}
          unit={unit}
          min={5}
          onCommit={(tileSize) => onChange({ ...value, tileSize })}
        />
      )}
    </div>
  );
}

export function TrimEditor({
  value,
  onChange,
  unit,
}: {
  value: Trim;
  onChange: (t: Trim) => void;
  unit: Unit;
}) {
  const { t } = useI18n();
  const swatches = usePalettes();
  return (
    <div className="stack">
      <Select
        label={t("style.skirting")}
        value={value.skirting.style}
        options={SKIRTING_STYLES}
        prefix="skirting"
        onChange={(style) => onChange({ ...value, skirting: { ...value.skirting, style } })}
      />
      {value.skirting.style !== "none" && (
        <LengthField
          label={t("style.skirtingHeight")}
          value={value.skirting.height}
          unit={unit}
          min={2}
          onCommit={(height) => onChange({ ...value, skirting: { ...value.skirting, height } })}
        />
      )}
      <ColorPicker
        label={t("style.skirtingColor")}
        value={value.skirting.color ?? "#FBF9F4"}
        swatches={swatches}
        onChange={(color) => onChange({ ...value, skirting: { ...value.skirting, color } })}
      />
      <Select
        label={t("style.cornice")}
        value={value.cornice}
        options={CORNICE_STYLES}
        prefix="cornice"
        onChange={(cornice) => onChange({ ...value, cornice })}
      />
      <label className="check">
        <input
          type="checkbox"
          checked={value.rosette}
          onChange={(e) => onChange({ ...value, rosette: e.target.checked })}
        />
        {t("style.rosette")}
      </label>
      <ColorPicker
        label={t("style.frames")}
        value={value.frameColor ?? "#FBF9F4"}
        swatches={swatches}
        onChange={(frameColor) => onChange({ ...value, frameColor })}
      />
    </div>
  );
}
