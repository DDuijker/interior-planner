"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FLOORPLAN_SYSTEM,
  floorplanUserText,
  parseFloorplanAnswer,
  repairText,
  roomSize,
  scaleFactor,
  scalePlan,
  typicalFloorplanCost,
  type FloorplanResult,
} from "@/core/ai/floorplan";
import { formatLength, parseLength } from "@/core/measure/units";
import { newId } from "@/core/model/ids";
import { planCodeToFloors, type PlanCode } from "@/core/plancode/plancode";
import { useI18n } from "@/i18n/I18nProvider";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { useSettings } from "@/ui/settings/settings";
import { putPhoto } from "@/ui/storage/db";
import { useApplyFloors } from "@/ui/workspace/ImportDialog";
import { useWorkspace } from "@/ui/workspace/context";
import {
  askClaude,
  ClaudeError,
  fileToBase64,
  shrinkImage,
  type ClaudeInput,
  type ClaudeProgress,
} from "./claude";

const MAX_PDF = 20 * 1024 * 1024;

type Picked = { file: File; preview?: string; isPdf: boolean };
type Done = Extract<FloorplanResult, { ok: true }> & {
  cost?: number;
  /** The image as sent, to lay under the plan. Not for PDFs. */
  scan?: { blob: Blob; width: number; height: number };
};

type Step =
  | { kind: "pick" }
  | { kind: "running"; progress: ClaudeProgress; repairing: boolean }
  | { kind: "review"; result: Done }
  | { kind: "error"; message: string };

/** Read a floor plan photo or PDF with Claude (E07-32) and review it (E07-33). */
export function AiImport({ onDone }: { onDone: () => void }) {
  const { t, locale } = useI18n();
  const { settings, loaded } = useSettings();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [floors, setFloors] = useState<"auto" | number>("auto");
  const [hint, setHint] = useState("");
  const [consent, setConsent] = useState(false);
  const [step, setStep] = useState<Step>({ kind: "pick" });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    const url = picked?.preview;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [picked]);

  if (loaded && !settings.apiKey) return <NoKey />;

  function pick(file: File | undefined) {
    if (!file) return;
    const isPdf = file.type === "application/pdf";
    if (!isPdf && !file.type.startsWith("image/")) {
      setStep({ kind: "error", message: t("ai.badFile") });
      return;
    }
    if (isPdf && file.size > MAX_PDF) {
      setStep({ kind: "error", message: t("ai.pdfTooBig") });
      return;
    }
    setPicked({ file, isPdf, preview: isPdf ? undefined : URL.createObjectURL(file) });
    setConsent(false);
    setStep({ kind: "pick" });
  }

  async function run() {
    if (!picked) return;
    const controller = new AbortController();
    abort.current = controller;
    setStep({ kind: "running", progress: { chars: 0 }, repairing: false });
    try {
      let input: ClaudeInput;
      let scan: Done["scan"];
      if (picked.isPdf) {
        input = { kind: "pdf", data: await fileToBase64(picked.file) };
      } else {
        scan = await shrinkImage(picked.file, 1568);
        input = { kind: "image", mediaType: "image/jpeg", data: await fileToBase64(scan.blob) };
      }
      const common = {
        apiKey: settings.apiKey,
        model: settings.model,
        system: FLOORPLAN_SYSTEM,
        signal: controller.signal,
      };
      let answer = await askClaude({
        ...common,
        inputs: [input],
        text: floorplanUserText({ floors, hint, locale }),
        onProgress: (progress) => setStep({ kind: "running", progress, repairing: false }),
      });
      let cost = answer.cost ?? 0;
      let parsed = parseFloorplanAnswer(answer.text);
      if (!parsed.ok) {
        // One repair round: send the validation errors back.
        answer = await askClaude({
          ...common,
          inputs: [],
          history: answer.messages,
          text: repairText(parsed.errors),
          effort: "medium",
          onProgress: (progress) => setStep({ kind: "running", progress, repairing: true }),
        });
        cost += answer.cost ?? 0;
        parsed = parseFloorplanAnswer(answer.text);
      }
      if (!parsed.ok) {
        setStep({
          kind: "error",
          message: t("ai.invalid", {
            errors: parsed.errors
              .slice(0, 3)
              .map((e) => `${e.path} ${e.message}`)
              .join("; "),
          }),
        });
        return;
      }
      setStep({ kind: "review", result: { ...parsed, cost, scan } });
    } catch (err) {
      const kind = err instanceof ClaudeError ? err.kind : "other";
      if (kind === "aborted") setStep({ kind: "pick" });
      else setStep({ kind: "error", message: t(`ai.error.${kind}`) });
    } finally {
      abort.current = null;
    }
  }

  if (step.kind === "review")
    return <Review result={step.result} onBack={() => setStep({ kind: "pick" })} onDone={onDone} />;

  const cost = typicalFloorplanCost(settings.model);
  const running = step.kind === "running";

  return (
    <div className="stack ai-import">
      <p className="muted">{t("ai.intro")}</p>
      <DropZone onFile={pick} disabled={running}>
        {picked?.preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={picked.preview} alt={t("ai.previewAlt")} className="ai-preview" />
        ) : picked ? (
          <span>{picked.file.name}</span>
        ) : (
          <span>{t("ai.drop")}</span>
        )}
      </DropZone>

      <div className="row wrap">
        <label className="field">
          <span className="field-label">{t("ai.floors")}</span>
          <select
            className="input"
            value={String(floors)}
            disabled={running}
            onChange={(e) => setFloors(e.target.value === "auto" ? "auto" : Number(e.target.value))}
          >
            <option value="auto">{t("ai.floors.auto")}</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <TextField
          label={t("ai.hint")}
          placeholder={t("ai.hintPlaceholder")}
          value={hint}
          disabled={running}
          onChange={(e) => setHint(e.target.value)}
        />
      </div>

      <div className="notice">
        <p className="small">
          {t("ai.privacy")}{" "}
          {cost !== undefined && t("ai.cost", { cost: cost.toFixed(2), model: settings.model })}
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={consent}
            disabled={!picked || running}
            onChange={(e) => setConsent(e.target.checked)}
          />
          {t("ai.consent")}
        </label>
      </div>

      <div role="status" aria-live="polite">
        {step.kind === "running" && (
          <div className="stack">
            <progress aria-label={t("ai.reading")} />
            <p className="small">
              {step.repairing ? t("ai.repairing") : t("ai.reading")}{" "}
              {step.progress.chars > 0 && t("ai.received", { count: step.progress.chars })}
            </p>
            {step.progress.thinking && (
              <p className="muted small ai-thinking">{step.progress.thinking}</p>
            )}
          </div>
        )}
        {step.kind === "error" && (
          <p className="error-text">
            <strong>{t("ai.failed")}</strong> {step.message}
          </p>
        )}
      </div>

      <div className="row">
        {running ? (
          <Button onClick={() => abort.current?.abort()}>{t("common.cancel")}</Button>
        ) : (
          <Button
            variant="primary"
            icon="sparkle"
            disabled={!picked || !consent}
            onClick={() => void run()}
          >
            {t("ai.start")}
          </Button>
        )}
      </div>
    </div>
  );
}

function NoKey() {
  const { t } = useI18n();
  return (
    <div className="stack">
      <p>{t("ai.noKey")}</p>
      <p className="muted small">{t("ai.noKeyAlt")}</p>
      <p>
        <Link className="btn btn-primary" href="/settings/#claude">
          {t("ai.toSettings")}
        </Link>
      </p>
    </div>
  );
}

/** File picker that also takes drag-and-drop and paste. */
export function DropZone({
  onFile,
  disabled,
  accept = "image/*,application/pdf",
  children,
}: {
  onFile: (f: File | undefined) => void;
  disabled?: boolean;
  accept?: string;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      className={`drop-zone ${over ? "is-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!disabled) onFile(e.dataTransfer.files[0]);
      }}
      onPaste={(e) => {
        const file = [...e.clipboardData.files][0];
        if (file && !disabled) onFile(file);
      }}
    >
      {children}
      <Button icon="upload" disabled={disabled} onClick={() => input.current?.click()}>
        {t("ai.choose")}
      </Button>
      <input
        ref={input}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={t("ai.choose")}
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** Review step: notes, room sizes, scale from one known length, then import. */
function Review({
  result,
  onBack,
  onDone,
}: {
  result: Done;
  onBack: () => void;
  onDone: () => void;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const { project } = useWorkspace();
  const unit = project.settings.unit;
  const applyFloors = useApplyFloors();
  const [plans, setPlans] = useState<PlanCode[]>(result.plans);
  const [factor, setFactor] = useState(1);
  const [refRoom, setRefRoom] = useState("0.0");
  const [real, setReal] = useState("");
  const [p, r] = refRoom.split(".").map(Number) as [number, number];
  const ref = plans[p]?.rooms[r];
  const refSize = ref ? roomSize(ref) : undefined;

  function rescale() {
    const value = parseLength(real, unit);
    const f = refSize && value ? scaleFactor(refSize.w, value) : undefined;
    if (!f) return toast(t("ai.scaleBad"), "warning");
    setPlans((ps) => ps.map((plan) => scalePlan(plan, f)));
    setFactor((x) => x * f);
    setReal("");
    toast(t("ai.scaled", { percent: Math.round((f - 1) * 1000) / 10 }), "success");
  }

  async function run(mode: "replace" | "append") {
    const floors = planCodeToFloors(plans);
    const first = floors[0];
    // Lay the original under the first floor, to check and trace (E07-33).
    if (first && result.scan) {
      const id = newId("bg");
      await putPhoto(id, result.scan.blob);
      // Claude's estimate of the image scale, corrected by the user's rescale.
      const cmPerPx = (result.image?.cmPerPx ?? 1) * factor;
      first.current.background = {
        photoId: id,
        x: -(result.image?.originX ?? 0) * cmPerPx,
        y: -(result.image?.originY ?? 0) * cmPerPx,
        scale: cmPerPx,
        rotation: 0,
        opacity: 0.45,
        keep: false,
      };
    }
    applyFloors(floors, mode);
    toast(t("ai.imported", { count: floors.length }), "success");
    onDone();
  }

  return (
    <div className="stack ai-review">
      <h3 className="panel-title">{t("ai.reviewTitle")}</h3>
      {result.cost !== undefined && (
        <p className="muted small">{t("ai.spent", { cost: result.cost.toFixed(3) })}</p>
      )}
      {result.notes.length > 0 && (
        <ul className="notice small">
          {result.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      )}
      {plans.map((plan, pi) => (
        <section key={pi} className="stack">
          <h4>{plan.name}</h4>
          <ul className="ai-rooms small">
            {plan.rooms.map((room, ri) => {
              const s = roomSize(room);
              return (
                <li key={ri}>
                  {room.name} <span className="muted">({t(`room.${room.type}`)})</span>{" "}
                  {formatLength(s.w, unit)} × {formatLength(s.d, unit)}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <details className="panel-section" open>
        <summary className="panel-title">{t("ai.scaleTitle")}</summary>
        <p className="muted small">{t("ai.scaleHint")}</p>
        <form
          className="row wrap"
          onSubmit={(e) => {
            e.preventDefault();
            rescale();
          }}
        >
          <label className="field">
            <span className="field-label">{t("ai.scaleRoom")}</span>
            <select className="input" value={refRoom} onChange={(e) => setRefRoom(e.target.value)}>
              {plans.flatMap((plan, pi) =>
                plan.rooms.map((room, ri) => (
                  <option key={`${pi}.${ri}`} value={`${pi}.${ri}`}>
                    {plans.length > 1 ? `${plan.name}: ` : ""}
                    {room.name} ({formatLength(roomSize(room).w, unit)})
                  </option>
                )),
              )}
            </select>
          </label>
          <TextField
            label={t("ai.scaleReal")}
            value={real}
            inputMode="decimal"
            onChange={(e) => setReal(e.target.value)}
          />
          <Button type="submit">{t("ai.scaleApply")}</Button>
        </form>
      </details>

      {result.warnings.length > 0 && (
        <p className="muted small">{t("import.warnings", { count: result.warnings.length })}</p>
      )}
      <p className="muted small">{t("ai.afterImport")}</p>
      <div className="row wrap">
        <Button variant="primary" onClick={() => void run("replace")}>
          {t("import.replace")}
        </Button>
        <Button onClick={() => void run("append")}>{t("import.append")}</Button>
        <Button variant="ghost" onClick={onBack}>
          {t("ai.again")}
        </Button>
      </div>
    </div>
  );
}
