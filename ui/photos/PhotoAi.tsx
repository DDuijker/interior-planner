"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { getEntry } from "@/catalog";
import {
  applyInteriorProposal,
  INTERIOR_SYSTEM,
  interiorProposalSchema,
  interiorUserText,
  proposalKeys,
  type InteriorProposal,
} from "@/core/ai/interior";
import {
  applyMoodboardProposal,
  moodboardProposalSchema,
  moodboardSystem,
  moodboardUserText,
  type MoodboardProposal,
} from "@/core/ai/moodboard";
import { formatLength } from "@/core/measure/units";
import { setActiveVersion } from "@/core/model/actions";
import type { Cardinal, Photo, Room, WallFinish, FloorFinish } from "@/core/model/types";
import { mergePalettes } from "@/core/photos/palette";
import { roomWalls, wallDirection } from "@/core/photos/photos";
import { useI18n } from "@/i18n/I18nProvider";
import type { MessageKey } from "@/i18n/translate";
import { Button } from "@/ui/components/Button";
import { Modal } from "@/ui/components/Modal";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { fileToBase64, shrinkImage } from "@/ui/images";
import { useSettings } from "@/ui/settings/settings";
import { getPhoto } from "@/ui/storage/db";
import { addPalette } from "@/ui/style/palettes";
import { useWorkspace } from "@/ui/workspace/context";
import type { ClaudeInput } from "@/ui/ai/claude";
import { PhotoImg } from "./PhotoThumb";

type Run<T> =
  | { kind: "idle" }
  | { kind: "running"; chars: number; repairing: boolean }
  | { kind: "done"; value: T; cost?: number }
  | { kind: "error"; message: string };

/** Shared state machine: consent per photo, progress, cancel, schema check. */
function useAiRun<S extends z.ZodType>(schema: S) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [run, setRun] = useState<Run<z.infer<S>>>({ kind: "idle" });
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  async function start(photos: readonly Photo[], system: string, text: string) {
    const controller = new AbortController();
    abort.current = controller;
    setRun({ kind: "running", chars: 0, repairing: false });
    try {
      const inputs: ClaudeInput[] = [];
      for (const p of photos) {
        const blob = await getPhoto(p.id);
        if (!blob) continue;
        const small = await shrinkImage(blob, 1568);
        inputs.push({
          kind: "image",
          mediaType: "image/jpeg",
          data: await fileToBase64(small.blob),
        });
      }
      const { askJson } = await import("@/ui/ai/askJson");
      const r = await askJson({
        apiKey: settings.apiKey,
        model: settings.model,
        system,
        inputs,
        text,
        schema,
        signal: controller.signal,
        onProgress: (p) => setRun({ kind: "running", chars: p.chars, repairing: p.repairing }),
      });
      setRun({ kind: "done", value: r.value, cost: r.cost });
    } catch (err) {
      const { ClaudeError, AiAnswerError } = await import("@/ui/ai/askJson");
      if (err instanceof ClaudeError && err.kind === "aborted") setRun({ kind: "idle" });
      else if (err instanceof ClaudeError)
        setRun({ kind: "error", message: t(`ai.error.${err.kind}` as MessageKey) });
      else if (err instanceof AiAnswerError)
        setRun({
          kind: "error",
          message: t("photos.aiInvalid", { errors: err.message.slice(0, 200) }),
        });
      else setRun({ kind: "error", message: t("ai.error.other") });
    } finally {
      abort.current = null;
    }
  }

  return {
    run,
    start,
    cancel: () => abort.current?.abort(),
    reset: () => setRun({ kind: "idle" }),
    hasKey: !!settings.apiKey,
  };
}

/** Pick which photos may be sent: nothing goes without a tick (E13-75). */
function ConsentList({
  photos,
  chosen,
  onChange,
  disabled,
}: {
  photos: readonly Photo[];
  chosen: ReadonlySet<string>;
  onChange: (next: Set<string>) => void;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  return (
    <fieldset className="stack">
      <legend className="field-label">{t("photos.consentTitle")}</legend>
      <ul className="consent-list">
        {photos.map((p) => (
          <li key={p.id}>
            <label className="check">
              <input
                type="checkbox"
                checked={chosen.has(p.id)}
                disabled={disabled}
                onChange={(e) => {
                  const next = new Set(chosen);
                  if (e.target.checked) next.add(p.id);
                  else next.delete(p.id);
                  onChange(next);
                }}
              />
              <PhotoImg photo={p} className="consent-thumb" alt="" />
              {t("photos.consentOne", { name: p.name })}
            </label>
          </li>
        ))}
      </ul>
      <p className="muted small">{t("photos.consentHint")}</p>
    </fieldset>
  );
}

function RunStatus<T>({ run, onCancel }: { run: Run<T>; onCancel: () => void }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite">
      {run.kind === "running" && (
        <div className="stack">
          <progress aria-label={t("photos.aiWorking")} />
          <p className="small">
            {run.repairing ? t("ai.repairing") : t("photos.aiWorking")}{" "}
            {run.chars > 0 && t("ai.received", { count: run.chars })}
          </p>
          <Button onClick={onCancel}>{t("common.cancel")}</Button>
        </div>
      )}
      {run.kind === "error" && (
        <p className="error-text">
          <strong>{t("ai.failed")}</strong> {run.message}
        </p>
      )}
    </div>
  );
}

function NeedKey({ extra }: { extra?: string }) {
  const { t } = useI18n();
  return (
    <div className="stack">
      <p>{t("ai.noKey")}</p>
      {extra && <p className="muted small">{extra}</p>}
      <p>
        <Link className="btn btn-primary" href="/settings/#claude">
          {t("ai.toSettings")}
        </Link>
      </p>
    </div>
  );
}

function Swatch({ color }: { color?: string }) {
  if (!color) return null;
  return (
    <span className="row small">
      <span className="swatch-dot" style={{ background: color }} aria-hidden="true" />
      <code>{color}</code>
    </span>
  );
}

function useFinishLabel() {
  const { t } = useI18n();
  return {
    wall: (f: WallFinish) => t(`wallKind.${f.kind}` as MessageKey),
    floor: (f: FloorFinish) => t(`floorKind.${f.kind}` as MessageKey),
  };
}

// ------------------------------------------------------------- current interior

/** Analyse photos of one room and propose finishes and elements (E13-75). */
export function InteriorAi({ room, onClose }: { room: Room; onClose: () => void }) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { project, version, floor, walls, apply } = useWorkspace();
  const { run, start, cancel, reset, hasKey } = useAiRun(interiorProposalSchema);
  const label = useFinishLabel();
  const roomPhotos = useMemo(
    () =>
      project.photos.filter(
        (p) => p.kind === "current" && p.link?.floorId === floor.id && p.link.roomId === room.id,
      ),
    [project.photos, floor.id, room.id],
  );
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [ticked, setTicked] = useState<Set<string> | null>(null);
  const unit = project.settings.unit;

  function begin() {
    const send = roomPhotos.filter((p) => chosen.has(p.id));
    const sides = roomWalls(walls, room.id);
    const lengths: Partial<Record<Cardinal, number>> = {};
    for (const c of ["N", "E", "S", "W"] as const) {
      const total = sides[c].reduce((s, { wall }) => s + Math.max(wall.rect.w, wall.rect.d), 0);
      if (total) lengths[c] = total;
    }
    const xs =
      room.shape.kind === "rects"
        ? room.shape.rects.flatMap((r) => [r.x, r.x + r.w])
        : room.shape.points.map((p) => p.x);
    const ys =
      room.shape.kind === "rects"
        ? room.shape.rects.flatMap((r) => [r.y, r.y + r.d])
        : room.shape.points.map((p) => p.y);
    const text = interiorUserText(
      {
        name: room.name || t(`room.${room.type}` as MessageKey),
        w: Math.max(...xs) - Math.min(...xs),
        d: Math.max(...ys) - Math.min(...ys),
        floorHeight: floor.height,
        sides: lengths,
      },
      send.map((p) => ({
        facing: p.link?.wallId ? wallDirection(walls, room.id, p.link.wallId) : undefined,
        note: p.note,
      })),
      locale,
    );
    setTicked(null);
    void start(send, INTERIOR_SYSTEM, text);
  }

  const proposal = run.kind === "done" ? run.value : undefined;
  const keys = proposal ? proposalKeys(proposal) : [];
  const on = ticked ?? new Set(keys);

  function describe(key: string, p: InteriorProposal) {
    if (key === "wall" && p.wall) return [t("photos.ai.walls"), label.wall(p.wall), p.wall.color];
    if (key === "floor" && p.floor) return [t("style.floor"), label.floor(p.floor), p.floor.color];
    if (key === "ceiling") return [t("styleView.ceiling"), "", p.ceiling];
    if (key === "height" && p.ceilingHeight)
      return [t("photos.ai.height"), formatLength(p.ceilingHeight, unit), undefined];
    if (key.startsWith("side:")) {
      const side = key.slice(5) as Cardinal;
      const w = p.walls.find((x) => x.side === side)!;
      return [t(`photos.facing.${side}` as MessageKey), label.wall(w.finish), w.finish.color];
    }
    const el = p.elements[Number(key.slice(3))]!;
    return [
      t(`photos.ai.el.${el.type}` as MessageKey),
      `${t(`photos.facing.${el.side}` as MessageKey)}${el.width ? `, ${formatLength(el.width, unit)}` : ""}${el.note ? ` (${el.note})` : ""}`,
      undefined,
    ];
  }

  return (
    <Modal open onClose={onClose} title={t("photos.analyseTitle", { room: room.name })}>
      {!hasKey ? (
        <NeedKey extra={t("photos.noKeyInterior")} />
      ) : proposal ? (
        <div className="stack">
          <p className="muted small">{t("photos.ai.review")}</p>
          {version.kind !== "current" && (
            <p className="notice notice-warn small">
              {t("photos.ai.notCurrent")}{" "}
              <Button
                variant="ghost"
                onClick={() => apply((p) => setActiveVersion(p, floor.id, floor.current.id))}
              >
                {t("photos.ai.toCurrent")}
              </Button>
            </p>
          )}
          <ul className="stack proposal-list">
            {keys.map((key) => {
              const [what, detail, color] = describe(key, proposal);
              return (
                <li key={key}>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={on.has(key)}
                      onChange={(e) => {
                        const next = new Set(on);
                        if (e.target.checked) next.add(key);
                        else next.delete(key);
                        setTicked(next);
                      }}
                    />
                    <strong>{what}</strong> {detail} <Swatch color={color} />
                  </label>
                </li>
              );
            })}
          </ul>
          {proposal.elements.some((e) => e.type === "radiator") && (
            <p className="muted small">
              {t("photos.ai.radiators", {
                count: proposal.elements.filter((e) => e.type === "radiator").length,
              })}
            </p>
          )}
          {proposal.notes.length > 0 && (
            <ul className="notice small">
              {proposal.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
          {run.kind === "done" && run.cost !== undefined && (
            <p className="muted small">{t("ai.spent", { cost: run.cost.toFixed(3) })}</p>
          )}
          <div className="row">
            <Button
              variant="primary"
              disabled={version.kind !== "current" || on.size === 0}
              onClick={() => {
                apply((p) => applyInteriorProposal(p, room.id, walls, proposal, on));
                toast(t("photos.ai.applied", { count: on.size }), "success");
                onClose();
              }}
            >
              {t("photos.ai.apply", { count: on.size })}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {t("ai.again")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="stack">
          <p className="small">{t("photos.analyseIntro")}</p>
          {roomPhotos.length === 0 ? (
            <p className="muted">{t("photos.analyseNoPhotos")}</p>
          ) : (
            <ConsentList
              photos={roomPhotos}
              chosen={chosen}
              onChange={setChosen}
              disabled={run.kind === "running"}
            />
          )}
          <p className="muted small">{t("ai.privacy")}</p>
          <RunStatus run={run} onCancel={cancel} />
          {run.kind !== "running" && (
            <Button variant="primary" icon="sparkle" disabled={chosen.size === 0} onClick={begin}>
              {t("photos.analyseStart", { count: chosen.size })}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------- moodboard style

/** Derive a style from the moodboard and apply it to a new design (E13-76). */
export function MoodboardStyleAi({
  photos,
  onClose,
}: {
  photos: readonly Photo[];
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const toast = useToast();
  const { floor, apply } = useWorkspace();
  const { run, start, cancel, reset, hasKey } = useAiRun(moodboardProposalSchema);
  const label = useFinishLabel();
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [designName, setDesignName] = useState("");
  const palette = mergePalettes(photos.map((p) => p.palette ?? []).filter((p) => p.length));

  const proposal: MoodboardProposal | undefined = run.kind === "done" ? run.value : undefined;

  return (
    <Modal open onClose={onClose} title={t("photos.aiStyle")}>
      {!hasKey ? (
        <div className="stack">
          {palette.length > 0 && (
            <div className="palette-row" aria-label={t("photos.boardPalette")}>
              {palette.map((c) => (
                <span key={c} className="swatch-dot big" style={{ background: c }} title={c} />
              ))}
            </div>
          )}
          <NeedKey extra={t("photos.noKeyStyle")} />
        </div>
      ) : proposal ? (
        <div className="stack">
          <h3 className="display">{proposal.name}</h3>
          {proposal.summary && <p>{proposal.summary}</p>}
          <div className="palette-row" aria-label={t("styleView.palette")}>
            {proposal.palette.map((c) => (
              <span key={c} className="swatch-dot big" style={{ background: c }} title={c} />
            ))}
          </div>
          <ul className="stack small">
            <li>
              <strong>{t("photos.ai.walls")}</strong> {label.wall(proposal.wall)}{" "}
              <Swatch color={proposal.wall.color} />
            </li>
            <li>
              <strong>{t("style.floor")}</strong> {label.floor(proposal.floor)}{" "}
              <Swatch color={proposal.floor.color} />
            </li>
            <li>
              <strong>{t("styleView.ceiling")}</strong> <Swatch color={proposal.ceiling} />
            </li>
          </ul>
          {proposal.furniture.length > 0 && (
            <div className="stack">
              <span className="field-label">{t("photos.ai.furniture")}</span>
              <ul className="small">
                {proposal.furniture.map((f) => (
                  <li key={f.id}>
                    {getEntry(f.id)?.name[locale] ?? f.id}
                    {f.why ? <span className="muted"> ({f.why})</span> : null}
                  </li>
                ))}
              </ul>
              <p className="muted small">{t("photos.ai.furnitureHint")}</p>
            </div>
          )}
          {run.kind === "done" && run.cost !== undefined && (
            <p className="muted small">{t("ai.spent", { cost: run.cost.toFixed(3) })}</p>
          )}
          <TextField
            label={t("photos.ai.designName")}
            value={designName}
            placeholder={proposal.name}
            onChange={(e) => setDesignName(e.target.value)}
          />
          <div className="row">
            <Button
              variant="primary"
              onClick={() => {
                apply(
                  (p) =>
                    applyMoodboardProposal(
                      p,
                      floor.id,
                      proposal,
                      designName.trim() || proposal.name,
                    ).project,
                );
                toast(t("photos.ai.designMade"), "success");
                onClose();
              }}
            >
              {t("photos.ai.newDesign")}
            </Button>
            <Button
              onClick={() => {
                addPalette({ name: proposal.name, colors: proposal.palette });
                toast(t("photos.paletteSaved"), "success");
              }}
            >
              {t("photos.savePalette")}
            </Button>
            <Button variant="ghost" onClick={reset}>
              {t("ai.again")}
            </Button>
          </div>
          <p className="muted small">{t("photos.ai.neverCurrent")}</p>
        </div>
      ) : (
        <div className="stack">
          <p className="small">{t("photos.aiStyleIntro")}</p>
          <ConsentList
            photos={photos}
            chosen={chosen}
            onChange={setChosen}
            disabled={run.kind === "running"}
          />
          <p className="muted small">{t("ai.privacy")}</p>
          <RunStatus run={run} onCancel={cancel} />
          {run.kind !== "running" && (
            <Button
              variant="primary"
              icon="sparkle"
              disabled={chosen.size === 0}
              onClick={() =>
                void start(
                  photos.filter((p) => chosen.has(p.id)),
                  moodboardSystem(),
                  moodboardUserText(
                    photos.filter((p) => chosen.has(p.id)).map((p) => p.note ?? ""),
                    undefined,
                    locale,
                  ),
                )
              }
            >
              {t("photos.analyseStart", { count: chosen.size })}
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}
