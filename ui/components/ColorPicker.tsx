"use client";

import { useId, useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

const HEX = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_SWATCHES = [
  "#F5F1E8",
  "#E3EAE2",
  "#87A08C",
  "#4D6857",
  "#A9A58B",
  "#B08D57",
  "#4A3526",
  "#2A2620",
];

/** Swatch palette (radio group) plus a free hex input and native picker. */
export function ColorPicker({
  value,
  onChange,
  label,
  swatches = DEFAULT_SWATCHES,
}: {
  value: string;
  onChange: (hex: string) => void;
  label?: string;
  swatches?: string[];
}) {
  const { t } = useI18n();
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  if (synced !== value) {
    setSynced(value);
    setDraft(value);
  }
  const invalid = !HEX.test(draft);

  return (
    <fieldset className="color-picker">
      <legend className="field-label">{label ?? t("color.label")}</legend>
      <div role="radiogroup" aria-label={label ?? t("color.label")} className="swatches">
        {swatches.map((hex) => {
          const checked = hex.toLowerCase() === value.toLowerCase();
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={hex}
              className="swatch"
              style={{ background: hex }}
              onClick={() => onChange(hex)}
            />
          );
        })}
      </div>
      <div className="color-custom">
        <label htmlFor={`${id}-native`} className="sr-only">
          {t("color.custom")}
        </label>
        <input
          id={`${id}-native`}
          type="color"
          className="color-native"
          value={HEX.test(value) ? value : "#000000"}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
        />
        <label htmlFor={`${id}-hex`} className="sr-only">
          {t("color.hex")}
        </label>
        <input
          id={`${id}-hex`}
          className="input input-hex"
          value={draft}
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : undefined}
          onChange={(e) => {
            const next = e.target.value.trim();
            setDraft(next);
            if (HEX.test(next)) onChange(next.toUpperCase());
          }}
        />
      </div>
      {invalid && (
        <p id={`${id}-err`} className="field-error">
          {t("color.invalid")}
        </p>
      )}
    </fieldset>
  );
}
