"use client";

import { useState } from "react";
import { formatLength, parseLength } from "@/core/measure/units";
import type { Unit } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { TextField } from "@/ui/components/TextField";

/** Text input for a length in the user's unit. Commits on Enter or blur. */
export function LengthField({
  label,
  value,
  unit,
  onCommit,
  min = 1,
}: {
  label: string;
  value: number;
  unit: Unit;
  onCommit: (cm: number) => void;
  min?: number;
}) {
  const { t } = useI18n();
  const shown = formatLength(value, unit);
  const [draft, setDraft] = useState<string | null>(null);
  const parsed = draft === null ? value : parseLength(draft, unit);
  const invalid = parsed === null || parsed < min;

  function commit() {
    if (draft === null) return;
    if (!invalid && parsed !== null) onCommit(Math.round(parsed * 10) / 10);
    setDraft(null);
  }

  return (
    <TextField
      label={label}
      value={draft ?? shown}
      inputMode="decimal"
      error={draft !== null && invalid ? t("editor.invalidLength") : undefined}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") setDraft(null);
      }}
    />
  );
}
