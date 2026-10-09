"use client";

import { useRef, useState } from "react";
import type { Photo } from "@/core/model/types";
import { mergePalettes } from "@/core/photos/palette";
import { addPhoto, cleanSourceUrl, reorder, setMoodboard } from "@/core/photos/photos";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "@/ui/components/Button";
import { useToast } from "@/ui/components/Toast";
import { addPalette } from "@/ui/style/palettes";
import { useWorkspace } from "@/ui/workspace/context";
import { droppedUrl, imageFiles, storePhoto } from "./library";
import { MoodboardStyleAi } from "./PhotoAi";
import { PhotoDetail } from "./PhotoDetail";
import { PhotoImg } from "./PhotoThumb";

type Filter = "moodboard" | "inspiration" | "current";

/** Photo library, moodboard and palettes (E13-71 to 76). */
export function PhotosView() {
  const { t } = useI18n();
  const toast = useToast();
  const { project, version, state, dispatch, apply } = useWorkspace();
  const [filter, setFilter] = useState<Filter>("moodboard");
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [aiStyle, setAiStyle] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);

  const byId = new Map(project.photos.map((p) => [p.id, p]));
  const moodboard = version.moodboard.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
  const shown =
    filter === "moodboard" ? moodboard : project.photos.filter((p) => p.kind === filter);
  const selected = state.photo ? byId.get(state.photo) : undefined;
  const kind: Photo["kind"] = filter === "current" ? "current" : "inspiration";

  async function add(files: File[], sourceUrl?: string) {
    if (!files.length) return;
    setBusy(true);
    try {
      let last: Photo | undefined;
      for (const file of files) {
        const photo = await storePhoto(file, kind, {
          ...(sourceUrl ? { sourceUrl: cleanSourceUrl(sourceUrl) } : {}),
        });
        apply((p) => addPhoto(p, photo, kind === "inspiration" ? version.id : undefined));
        last = photo;
      }
      if (last) dispatch({ type: "openPhoto", photo: last.id });
      toast(t("photos.added", { count: files.length }), "success");
    } catch {
      toast(t("photos.addFailed"), "warning");
    } finally {
      setBusy(false);
    }
  }

  function move(from: number, to: number) {
    apply((p) =>
      setMoodboard(
        p,
        version.id,
        reorder(
          moodboard.map((m) => m.id),
          from,
          to,
        ),
      ),
    );
  }

  const boardPalette = mergePalettes(moodboard.map((p) => p.palette ?? []).filter((p) => p.length));

  return (
    <div
      className={`photos-view ${over ? "is-over" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setOver(true);
        }
      }}
      onDragLeave={(e) => e.currentTarget === e.target && setOver(false)}
      onDrop={(e) => {
        const files = imageFiles(e.dataTransfer.files);
        if (!files.length) return;
        e.preventDefault();
        setOver(false);
        void add(files, droppedUrl(e.dataTransfer));
      }}
      onPaste={(e) => {
        const files = imageFiles(e.clipboardData.files);
        if (files.length) void add(files, droppedUrl(e.clipboardData));
      }}
    >
      <section className="photos-library" aria-label={t("photos.library")}>
        <div className="row photos-head">
          <div role="tablist" aria-label={t("photos.library")} className="panel-tabs">
            {(["moodboard", "inspiration", "current"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                className="tab"
                onClick={() => setFilter(f)}
              >
                {t(`photos.filter.${f}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="photos-add" tabIndex={0} aria-label={t("photos.pasteHere")}>
          <p className="small muted">
            {filter === "current" ? t("photos.addCurrentHint") : t("photos.addInspirationHint")}
          </p>
          <div className="row">
            <Button icon="upload" disabled={busy} onClick={() => fileRef.current?.click()}>
              {t("photos.choose")}
            </Button>
            <Button icon="camera" disabled={busy} onClick={() => cameraRef.current?.click()}>
              {t("photos.camera")}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-label={t("photos.choose")}
            onChange={(e) => {
              void add(imageFiles(e.target.files));
              e.target.value = "";
            }}
          />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            aria-label={t("photos.camera")}
            onChange={(e) => {
              void add(imageFiles(e.target.files));
              e.target.value = "";
            }}
          />
          {busy && (
            <p role="status" className="small">
              {t("photos.saving")}
            </p>
          )}
        </div>

        {filter === "moodboard" && moodboard.length > 0 && (
          <div className="stack moodboard-tools">
            {boardPalette.length > 0 && (
              <div className="row">
                <span className="small">{t("photos.boardPalette")}</span>
                <span className="palette-row" aria-hidden="true">
                  {boardPalette.map((c) => (
                    <span key={c} className="swatch-dot big" style={{ background: c }} title={c} />
                  ))}
                </span>
                <Button
                  variant="ghost"
                  onClick={() => {
                    addPalette({ name: t("photos.boardPaletteName"), colors: boardPalette });
                    toast(t("photos.paletteSaved"), "success");
                  }}
                >
                  {t("photos.savePalette")}
                </Button>
              </div>
            )}
            <Button icon="sparkle" onClick={() => setAiStyle(true)}>
              {t("photos.aiStyle")}
            </Button>
          </div>
        )}

        {shown.length === 0 ? (
          <p className="muted empty-tip">{t(`photos.empty.${filter}`)}</p>
        ) : (
          <ul className="photo-grid" aria-label={t(`photos.filter.${filter}`)}>
            {shown.map((photo, i) => (
              <li
                key={photo.id}
                className="photo-cell"
                draggable={filter === "moodboard"}
                onDragStart={() => (dragFrom.current = i)}
                onDragOver={(e) =>
                  filter === "moodboard" && dragFrom.current !== null && e.preventDefault()
                }
                onDrop={(e) => {
                  if (filter !== "moodboard" || dragFrom.current === null) return;
                  e.preventDefault();
                  e.stopPropagation();
                  move(dragFrom.current, i);
                  dragFrom.current = null;
                }}
              >
                <button
                  type="button"
                  className="photo-tile"
                  aria-pressed={state.photo === photo.id}
                  onClick={() => dispatch({ type: "openPhoto", photo: photo.id })}
                >
                  <PhotoImg photo={photo} className="photo-tile-img" alt="" />
                  <span className="photo-tile-name">{photo.name}</span>
                </button>
                {filter === "moodboard" && (
                  <span className="row photo-order">
                    <IconButton
                      icon="left"
                      label={t("photos.moveEarlier", { name: photo.name })}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                    />
                    <IconButton
                      icon="right"
                      label={t("photos.moveLater", { name: photo.name })}
                      disabled={i === shown.length - 1}
                      onClick={() => move(i, i + 1)}
                    />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="photos-detail" aria-label={t("photos.detail")}>
        {selected ? (
          <PhotoDetail key={selected.id} photo={selected} />
        ) : (
          <p className="muted empty-tip">{t("photos.pick")}</p>
        )}
      </section>

      {aiStyle && <MoodboardStyleAi photos={moodboard} onClose={() => setAiStyle(false)} />}
    </div>
  );
}
