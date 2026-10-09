"use client";

import { useRef, useState } from "react";
import { z } from "zod";
import { customEntry, type CatalogEntry } from "@/catalog";
import { customItemSchema } from "@/core/model/schema";
import { newId } from "@/core/model/ids";
import { PART_MATERIALS, type CustomItemDef, type Part } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Button, IconButton } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { downloadText } from "@/ui/download";
import { TopView } from "@/ui/catalog/PartsSvg";
import { useWorkspace } from "./context";

type Preset = "block" | "cylinder" | "plate" | "leg";

const PRESETS: Record<Preset, (def: CustomItemDef) => Part> = {
  block: (d) => ({ shape: "box", x: 0, y: 0, z: 0, w: d.w, d: d.d, h: d.h / 2, material: "main" }),
  cylinder: (d) => ({
    shape: "cylinder",
    x: 0,
    y: 0,
    z: 0,
    w: Math.min(d.w, d.d),
    d: Math.min(d.w, d.d),
    h: d.h,
    material: "main",
  }),
  plate: (d) => ({ shape: "box", x: 0, y: 0, z: d.h - 3, w: d.w, d: d.d, h: 3, material: "wood" }),
  leg: (d) => ({
    shape: "cylinder",
    x: -d.w / 2 + 4,
    y: -d.d / 2 + 4,
    z: 0,
    w: 4,
    d: 4,
    h: d.h - 3,
    material: "metal",
  }),
};

const START: CustomItemDef = {
  id: "",
  name: "",
  w: 100,
  d: 50,
  h: 75,
  layer: "furniture",
  mount: "floor",
  parts: [],
};

function num(v: string, fallback: number) {
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

/** Side view (front): x horizontal, z up. */
function FrontView({ def }: { def: CustomItemDef }) {
  const m = Math.max(def.w, def.h) * 0.08;
  return (
    <svg
      viewBox={`${-def.w / 2 - m} ${-def.h - m} ${def.w + 2 * m} ${def.h + 2 * m}`}
      className="builder-view"
      aria-hidden="true"
    >
      <line
        x1={-def.w / 2 - m}
        x2={def.w / 2 + m}
        y1={0}
        y2={0}
        stroke="var(--c-line)"
        strokeWidth={def.w / 100}
      />
      {[...def.parts]
        .sort((a, b) => b.y - a.y)
        .map((p, i) => (
          <rect
            key={i}
            x={p.x - p.w / 2}
            y={-(p.z + p.h)}
            width={p.w}
            height={p.h}
            rx={p.shape === "box" ? 0 : Math.min(p.w, p.h) / 4}
            fill="var(--c-accent-soft)"
            stroke="var(--c-text)"
            strokeWidth={def.w / 150}
          />
        ))}
    </svg>
  );
}

export function CustomBuilder({
  onClose,
  onPlace,
}: {
  onClose: () => void;
  onPlace: (e: CatalogEntry) => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { project, apply } = useWorkspace();
  const [def, setDef] = useState<CustomItemDef>({
    ...START,
    id: newId("custom"),
    name: t("builder.defaultName"),
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const setPart = (i: number, patch: Partial<Part>) =>
    setDef((d) => ({ ...d, parts: d.parts.map((p, k) => (k === i ? { ...p, ...patch } : p)) }));
  const valid = customItemSchema.safeParse(def).success;

  function save(place: boolean) {
    if (!valid) return;
    apply((p) => ({ ...p, customItems: [...p.customItems.filter((c) => c.id !== def.id), def] }));
    if (place) onPlace(customEntry(def));
    onClose();
  }

  async function importFile(file: File) {
    try {
      const parsed = z.array(customItemSchema).safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error();
      apply((p) => ({
        ...p,
        customItems: [
          ...p.customItems.filter((c) => !parsed.data.some((n) => n.id === c.id)),
          ...parsed.data,
        ],
      }));
      toast(t("builder.imported", { count: parsed.data.length }), "success");
    } catch {
      toast(t("builder.importFailed"), "warning");
    }
  }

  return (
    <Modal open onClose={onClose} title={t("catalog.buildOwn")}>
      <div className="builder">
        <div className="builder-form">
          <TextField
            label={t("common.name")}
            value={def.name}
            onChange={(e) => setDef({ ...def, name: e.target.value })}
          />
          <div className="props-row">
            {(["w", "d", "h"] as const).map((k) => (
              <TextField
                key={k}
                label={t(k === "w" ? "editor.width" : k === "d" ? "editor.depth" : "editor.height")}
                inputMode="decimal"
                suffix="cm"
                value={def[k]}
                onChange={(e) => setDef({ ...def, [k]: Math.max(1, num(e.target.value, def[k])) })}
              />
            ))}
          </div>
          <label className="field">
            <span className="field-label">{t("builder.mount")}</span>
            <select
              className="input"
              value={def.mount}
              onChange={(e) => setDef({ ...def, mount: e.target.value as CustomItemDef["mount"] })}
            >
              <option value="floor">{t("builder.mount.floor")}</option>
              <option value="stack">{t("builder.mount.stack")}</option>
              <option value="wall">{t("builder.mount.wall")}</option>
            </select>
          </label>
          <div className="row" role="group" aria-label={t("builder.addPart")}>
            {(Object.keys(PRESETS) as Preset[]).map((k) => (
              <Button
                key={k}
                icon="plus"
                onClick={() => setDef((d) => ({ ...d, parts: [...d.parts, PRESETS[k](d)] }))}
              >
                {t(`builder.preset.${k}` as MessageKey)}
              </Button>
            ))}
          </div>
          <ol className="part-list">
            {def.parts.map((p, i) => (
              <li key={i} className="part-row">
                <fieldset>
                  <legend>{t("builder.part", { n: i + 1 })}</legend>
                  <div className="part-grid">
                    {(["x", "y", "z", "w", "d", "h"] as const).map((k) => (
                      <TextField
                        key={k}
                        label={k.toUpperCase()}
                        inputMode="decimal"
                        value={Math.round(p[k] * 10) / 10}
                        onChange={(e) => setPart(i, { [k]: num(e.target.value, p[k]) })}
                      />
                    ))}
                    <label className="field">
                      <span className="field-label">{t("builder.material")}</span>
                      <select
                        className="input"
                        value={p.material}
                        onChange={(e) =>
                          setPart(i, { material: e.target.value as Part["material"] })
                        }
                      >
                        {PART_MATERIALS.map((m) => (
                          <option key={m} value={m}>
                            {t(`material.${m}` as MessageKey)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </fieldset>
                <IconButton
                  icon="trash"
                  label={t("builder.removePart", { n: i + 1 })}
                  onClick={() =>
                    setDef((d) => ({ ...d, parts: d.parts.filter((_, k) => k !== i) }))
                  }
                />
              </li>
            ))}
          </ol>
        </div>
        <div className="builder-preview" aria-label={t("builder.preview")}>
          <svg
            viewBox={`${-def.w / 2 - 10} ${-def.d / 2 - 10} ${def.w + 20} ${def.d + 20}`}
            className="builder-view"
            aria-hidden="true"
          >
            <rect
              x={-def.w / 2}
              y={-def.d / 2}
              width={def.w}
              height={def.d}
              fill="none"
              stroke="var(--c-line)"
              strokeDasharray="4 3"
              strokeWidth={def.w / 150}
            />
            <g stroke="var(--c-text)">
              <TopView parts={def.parts} item={{}} strokeWidth={def.w / 150} />
            </g>
          </svg>
          <FrontView def={def} />
        </div>
      </div>
      <div className="row modal-footer">
        <Button onClick={() => fileRef.current?.click()} icon="upload">
          {t("builder.import")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          aria-label={t("builder.import")}
          onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])}
        />
        <Button
          icon="download"
          disabled={!project.customItems.length}
          onClick={() =>
            downloadText(JSON.stringify(project.customItems, null, 2), "eigen-meubels.json")
          }
        >
          {t("builder.export")}
        </Button>
        <Button disabled={!valid} onClick={() => save(false)}>
          {t("common.save")}
        </Button>
        <Button variant="primary" disabled={!valid} onClick={() => save(true)}>
          {t("builder.saveAndPlace")}
        </Button>
      </div>
    </Modal>
  );
}
