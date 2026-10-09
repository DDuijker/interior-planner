"use client";

import { useState } from "react";
import type { Id, Project } from "@/core/model/types";
import {
  applyLook,
  applyPreset,
  applySurprise,
  decodePalette,
  encodePalette,
  QUICK_PALETTE,
  removeLook,
  resolveRoomStyle,
  saveLook,
  setRoomStyle,
  setVersionStyle,
  STYLE_PRESETS,
  type Palette,
  type StylePreset,
} from "@/core/style/style";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "@/ui/components/Button";
import { ColorPicker } from "@/ui/components/ColorPicker";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { useWorkspace } from "@/ui/workspace/context";
import { ThreeView } from "@/three/ThreeView";
import { FloorFinishEditor, TrimEditor, WallFinishEditor } from "./FinishEditors";
import { addPalette, removePalette, updatePalette, usePalettes, useUserPalettes } from "./palettes";

/** Small picture of a preset: wall on top, floor below, trim line. */
export function PresetThumb({ preset }: { preset: StylePreset }) {
  const { wall, floor, trim, ceiling } = preset.style;
  const floorLines =
    floor.kind === "checker"
      ? Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={i * 10}
            y={40 + (i % 2) * 10}
            width={10}
            height={10}
            fill={floor.color2 ?? "#2A2620"}
          />
        ))
      : floor.kind === "herringbone" || floor.kind === "chevron"
        ? Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${i * 10} 60l5 -10l5 10`} fill="none" stroke="rgb(0 0 0 / .25)" />
          ))
        : Array.from({ length: 3 }, (_, i) => (
            <path key={i} d={`M0 ${44 + i * 6}H60`} stroke="rgb(0 0 0 / .18)" />
          ));
  return (
    <svg viewBox="0 0 60 60" className="preset-thumb" aria-hidden="true">
      <rect x="0" y="0" width="60" height="6" fill={ceiling} />
      <rect x="0" y="6" width="60" height="34" fill={wall.color ?? "#F4F1EA"} />
      {wall.kind === "panel" && (
        <rect
          x="0"
          y={40 - Math.min(34, ((wall.height ?? 260) / 260) * 34)}
          width="60"
          height={Math.min(34, ((wall.height ?? 260) / 260) * 34)}
          fill={wall.color2 ?? wall.color}
        />
      )}
      {wall.kind === "wallpaper" &&
        Array.from({ length: 6 }, (_, i) => (
          <rect
            key={i}
            x={i * 10 + 5}
            y={6}
            width={3}
            height={34}
            fill={wall.color2 ?? "#999"}
            opacity={0.6}
          />
        ))}
      <rect x="0" y="40" width="60" height="20" fill={floor.color ?? "#C9B8A0"} />
      {floorLines}
      <rect x="0" y="38" width="60" height="2" fill={trim.skirting.color ?? "#FBF9F4"} />
      <circle cx="50" cy="20" r="5" fill={preset.style.accent} />
    </svg>
  );
}

export function StyleView() {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { project, version, floor, apply } = useWorkspace();
  const [scope, setScope] = useState<"all" | Id>("all");
  const [furniture, setFurniture] = useState(false);
  const [paletteIndex, setPaletteIndex] = useState(-1);
  const [lookName, setLookName] = useState("");
  const [code, setCode] = useState("");
  const userPalettes = useUserPalettes();
  const swatches = usePalettes();
  const unit = project.settings.unit;
  const room = scope === "all" ? undefined : version.rooms.find((r) => r.id === scope);
  const style = room ? resolveRoomStyle(version, room) : { ...version.style };
  const presetPalettes: Palette[] = STYLE_PRESETS.map((p) => ({
    name: p.name[locale],
    colors: p.palette,
  }));
  const palettes: Palette[] = [QUICK_PALETTE, ...userPalettes, ...presetPalettes];
  const palette = palettes[paletteIndex + 1] ?? QUICK_PALETTE;

  const set = (patch: Parameters<typeof setRoomStyle>[2] & object) =>
    apply((p: Project) =>
      room ? setRoomStyle(p, room.id, patch) : setVersionStyle(p, patch as never),
    );

  return (
    <div className="style-view">
      <div className="style-preview">
        <ThreeView panelOpen={false} onTogglePanel={() => {}} />
      </div>
      <aside className="style-panel editor-panel is-open" aria-label={t("view.style")}>
        <section className="panel-section stack">
          <h2 className="panel-title">{t("styleView.scope")}</h2>
          <label className="field">
            <span className="field-label">{t("styleView.applyTo")}</span>
            <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
              <option value="all">{t("styleView.wholeFloor", { floor: floor.name })}</option>
              {version.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name || t(`room.${r.type}`)}
                </option>
              ))}
            </select>
          </label>
          {room && room.style && (
            <Button
              variant="ghost"
              onClick={() => apply((p) => setRoomStyle(p, room.id, undefined))}
            >
              {t("styleView.resetRoom")}
            </Button>
          )}
        </section>

        <details className="panel-section" open>
          <summary className="panel-title">{t("styleView.presets")}</summary>
          <label className="check">
            <input
              type="checkbox"
              checked={furniture}
              onChange={(e) => setFurniture(e.target.checked)}
            />
            {t("styleView.furnitureToo")}
          </label>
          <ul className="preset-grid">
            {STYLE_PRESETS.map((preset) => (
              <li key={preset.id}>
                <button
                  type="button"
                  className="preset-card"
                  aria-pressed={!room && version.style.presetId === preset.id}
                  onClick={() => {
                    apply((p) => applyPreset(p, preset.id, scope, furniture, locale));
                    toast(t("styleView.applied", { name: preset.name[locale] }), "success");
                  }}
                >
                  <PresetThumb preset={preset} />
                  <span>{preset.name[locale]}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>

        <details className="panel-section">
          <summary className="panel-title">{t("styleView.surprise")}</summary>
          <label className="field">
            <span className="field-label">{t("styleView.palette")}</span>
            <select
              className="input"
              value={paletteIndex}
              onChange={(e) => setPaletteIndex(Number(e.target.value))}
            >
              {palettes.map((p, i) => (
                <option key={`${p.name}-${i}`} value={i - 1}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="palette-row" aria-hidden="true">
            {palette.colors.map((c) => (
              <span key={c} className="swatch-dot big" style={{ background: c }} />
            ))}
          </div>
          <Button
            variant="primary"
            icon="sparkle"
            onClick={() =>
              apply((p) =>
                applySurprise(
                  p,
                  palette.colors,
                  Math.floor(Math.random() * 1e9),
                  scope,
                  t("styleView.surpriseName"),
                ),
              )
            }
          >
            {t("styleView.surpriseMe")}
          </Button>
        </details>

        <details className="panel-section">
          <summary className="panel-title">{t("styleView.walls")}</summary>
          <WallFinishEditor
            value={style.wall}
            unit={unit}
            wallHeight={floor.height}
            onChange={(wall) => set({ wall })}
          />
          <p className="muted small">{t("styleView.wallHint")}</p>
        </details>

        <details className="panel-section">
          <summary className="panel-title">{t("style.floor")}</summary>
          <FloorFinishEditor value={style.floor} unit={unit} onChange={(f) => set({ floor: f })} />
        </details>

        <details className="panel-section">
          <summary className="panel-title">{t("styleView.ceilingTrim")}</summary>
          <ColorPicker
            label={t("styleView.ceiling")}
            value={style.ceiling}
            swatches={swatches}
            onChange={(ceiling) => set({ ceiling })}
          />
          <TrimEditor
            value={{ ...version.style.trim, ...style.trim }}
            unit={unit}
            onChange={(trim) => set({ trim })}
          />
        </details>

        <details className="panel-section">
          <summary className="panel-title">{t("styleView.palettes")}</summary>
          <ul className="stack palette-list">
            {userPalettes.map((p, i) => (
              <li key={i} className="stack">
                <TextField
                  label={t("common.name")}
                  defaultValue={p.name}
                  onBlur={(e) => updatePalette(i, { ...p, name: e.target.value || p.name })}
                />
                <div className="palette-row">
                  {p.colors.map((c, k) => (
                    <button
                      key={k}
                      type="button"
                      className="swatch-dot big removable"
                      style={{ background: c }}
                      aria-label={t("styleView.removeColor", { color: c })}
                      onClick={() =>
                        updatePalette(i, { ...p, colors: p.colors.filter((_, j) => j !== k) })
                      }
                    />
                  ))}
                </div>
                <ColorPicker
                  label={t("styleView.addColor")}
                  value="#87A08C"
                  swatches={[]}
                  onChange={(c) =>
                    p.colors.length < 24 && updatePalette(i, { ...p, colors: [...p.colors, c] })
                  }
                />
                <div className="row">
                  <Button
                    icon="copy"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(encodePalette(p));
                      toast(t("styleView.codeCopied"), "success");
                    }}
                  >
                    {t("styleView.share")}
                  </Button>
                  <IconButton
                    icon="trash"
                    label={t("styleView.deletePalette", { name: p.name })}
                    onClick={() => removePalette(i)}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Button
            icon="plus"
            onClick={() =>
              addPalette({
                name: t("styleView.newPalette"),
                colors: [
                  ...new Set(
                    [
                      style.wall.color,
                      style.wall.color2,
                      style.floor.color,
                      style.ceiling,
                      version.style.accent,
                    ].filter((c): c is string => !!c),
                  ),
                ],
              })
            }
          >
            {t("styleView.paletteFromCurrent")}
          </Button>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const p = decodePalette(code);
              if (!p) return toast(t("styleView.badCode"), "warning");
              addPalette(p);
              setCode("");
              toast(t("styleView.paletteAdded", { name: p.name }), "success");
            }}
          >
            <TextField
              label={t("styleView.importCode")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="maison:…"
            />
            <Button type="submit">{t("common.add")}</Button>
          </form>
        </details>

        <details className="panel-section">
          <summary className="panel-title">{t("looks.title")}</summary>
          <p className="muted small">{t("looks.hint")}</p>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              const name =
                lookName.trim() || t("looks.defaultName", { n: project.looks.length + 1 });
              apply((p) => saveLook(p, name).project);
              setLookName("");
              toast(t("looks.saved", { name }), "success");
            }}
          >
            <TextField
              label={t("looks.name")}
              value={lookName}
              onChange={(e) => setLookName(e.target.value)}
            />
            <Button type="submit" variant="primary">
              {t("looks.save")}
            </Button>
          </form>
          <ul className="stack">
            {project.looks.map((l) => (
              <li key={l.id} className="row look-row">
                <span className="look-name">{l.name}</span>
                <Button onClick={() => apply((p) => applyLook(p, l.id))}>
                  {t("common.apply")}
                </Button>
                <IconButton
                  icon="trash"
                  label={t("looks.delete", { name: l.name })}
                  onClick={() => apply((p) => removeLook(p, l.id))}
                />
              </li>
            ))}
          </ul>
        </details>
      </aside>
    </div>
  );
}
