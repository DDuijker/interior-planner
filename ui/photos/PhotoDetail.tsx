"use client";

import { useEffect, useState } from "react";
import { CARDINALS, type Cardinal, type Photo } from "@/core/model/types";
import { paletteFromPixels, pickColor } from "@/core/photos/palette";
import {
  cardinalDeg,
  cleanSourceUrl,
  isPinterest,
  removePhoto,
  roomWalls,
  setMoodboard,
  updatePhoto,
  wallDirection,
} from "@/core/photos/photos";
import { useI18n } from "@/i18n/I18nProvider";
import { Button, IconButton } from "@/ui/components/Button";
import { TextField } from "@/ui/components/TextField";
import { useToast } from "@/ui/components/Toast";
import { imagePixels } from "@/ui/images";
import { deletePhoto, getPhoto } from "@/ui/storage/db";
import { addToPalette } from "@/ui/style/palettes";
import { useWorkspace } from "@/ui/workspace/context";
import { ComparePhoto } from "./ComparePhoto";
import { InteriorAi } from "./PhotoAi";
import { PhotoImg } from "./PhotoThumb";

type Pixels = { data: Uint8ClampedArray; width: number; height: number };

export function PhotoDetail({ photo }: { photo: Photo }) {
  const { t } = useI18n();
  const toast = useToast();
  const { project, version, floor, walls, apply, dispatch } = useWorkspace();
  const [pixels, setPixels] = useState<Pixels | null>(null);
  const [dropper, setDropper] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [source, setSource] = useState(photo.sourceUrl ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [compare, setCompare] = useState(false);
  const [analyse, setAnalyse] = useState(false);

  useEffect(() => {
    let alive = true;
    void getPhoto(photo.id).then(async (blob) => {
      if (!blob || !alive) return;
      const px = await imagePixels(blob, 480);
      if (alive) setPixels(px);
    });
    return () => {
      alive = false;
    };
  }, [photo.id]);

  const set = (patch: Partial<Omit<Photo, "id">>) => apply((p) => updatePhoto(p, photo.id, patch));
  const onBoard = version.moodboard.includes(photo.id);
  const link = photo.link;
  const linkedHere = link?.floorId === floor.id;
  const room = linkedHere ? version.rooms.find((r) => r.id === link?.roomId) : undefined;
  const sides = room ? roomWalls(walls, room.id) : undefined;
  const facing: Cardinal | "" =
    room && link?.wallId ? (wallDirection(walls, room.id, link.wallId) ?? "") : "";

  function keepColor(color: string) {
    setPicked(color);
    addToPalette(t("photos.pickedPalette"), color);
    void navigator.clipboard?.writeText(color).catch(() => {});
    toast(t("photos.colorPicked", { color }), "success");
  }

  function setFacing(side: Cardinal | "") {
    if (!room) return;
    const part = side && sides ? sides[side][0] : undefined;
    set({
      link: {
        floorId: floor.id,
        roomId: room.id,
        ...(part
          ? { wallId: part.wall.id, side: part.side, dir: cardinalDeg(side as Cardinal) }
          : {}),
      },
    });
  }

  async function refreshPalette() {
    const blob = await getPhoto(photo.id);
    if (!blob) return;
    const px = await imagePixels(blob, 160);
    set({ palette: paletteFromPixels(px.data, 6, Date.now() % 1000) });
  }

  return (
    <div className="stack photo-detail">
      <div className={`photo-stage ${dropper ? "is-dropper" : ""}`}>
        <PhotoImg photo={photo} className="photo-large" />
        {dropper && pixels && (
          <button
            type="button"
            className="photo-dropper-hit"
            aria-label={t("photos.dropperHit")}
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const x = ((e.clientX - r.left) / r.width) * pixels.width;
              const y = ((e.clientY - r.top) / r.height) * pixels.height;
              keepColor(pickColor(pixels.data, pixels.width, x, y));
            }}
          />
        )}
      </div>

      <div className="row">
        <Button icon="eyedropper" aria-pressed={dropper} onClick={() => setDropper((d) => !d)}>
          {dropper ? t("photos.dropperOn") : t("photos.dropper")}
        </Button>
        {picked && (
          <span className="row small">
            <span className="swatch-dot big" style={{ background: picked }} aria-hidden="true" />
            <code>{picked}</code>
          </span>
        )}
      </div>

      {photo.palette && (
        <div className="stack">
          <span className="field-label">{t("photos.palette")}</span>
          <div className="palette-row">
            {photo.palette.map((c) => (
              <button
                key={c}
                type="button"
                className="swatch-dot big"
                style={{ background: c }}
                aria-label={t("photos.useColor", { color: c })}
                title={c}
                onClick={() => keepColor(c)}
              />
            ))}
            <IconButton
              icon="sparkle"
              label={t("photos.newPalette")}
              onClick={() => void refreshPalette()}
            />
          </div>
        </div>
      )}

      <TextField
        label={t("common.name")}
        defaultValue={photo.name}
        onBlur={(e) => e.target.value.trim() && set({ name: e.target.value.trim() })}
      />
      <label className="field">
        <span className="field-label">{t("photos.kind")}</span>
        <select
          className="input"
          value={photo.kind}
          onChange={(e) => set({ kind: e.target.value as Photo["kind"] })}
        >
          <option value="inspiration">{t("photos.kind.inspiration")}</option>
          <option value="current">{t("photos.kind.current")}</option>
        </select>
      </label>
      <label className="field">
        <span className="field-label">{t("photos.note")}</span>
        <textarea
          className="input"
          rows={2}
          defaultValue={photo.note ?? ""}
          onBlur={(e) => set({ note: e.target.value.trim() || undefined })}
        />
      </label>
      <div className="stack">
        <TextField
          label={t("photos.source")}
          placeholder="https://pinterest.com/pin/…"
          value={source}
          inputMode="url"
          onChange={(e) => setSource(e.target.value)}
          onBlur={() => {
            const url = cleanSourceUrl(source);
            if (source.trim() && !url) return toast(t("photos.badUrl"), "warning");
            setSource(url ?? "");
            set({ sourceUrl: url });
          }}
        />
        {photo.sourceUrl && (
          <a href={photo.sourceUrl} target="_blank" rel="noreferrer noopener" className="small">
            {isPinterest(photo.sourceUrl) ? t("photos.openPin") : t("photos.openSource")}
          </a>
        )}
        <p className="muted small">{t("photos.sourceHint")}</p>
      </div>

      <label className="check">
        <input
          type="checkbox"
          checked={onBoard}
          onChange={(e) =>
            apply((p) =>
              setMoodboard(
                p,
                version.id,
                e.target.checked
                  ? [...version.moodboard, photo.id]
                  : version.moodboard.filter((id) => id !== photo.id),
              ),
            )
          }
        />
        {t("photos.onBoard", { design: version.name })}
      </label>

      <fieldset className="stack photo-link">
        <legend className="field-label">{t("photos.link")}</legend>
        {link && !linkedHere && (
          <p className="muted small">
            {t("photos.linkedElsewhere", {
              floor: project.floors.find((f) => f.id === link.floorId)?.name ?? "?",
            })}
          </p>
        )}
        <label className="field">
          <span className="field-label">{t("photos.room")}</span>
          <select
            className="input"
            value={room?.id ?? ""}
            onChange={(e) =>
              set({
                link: e.target.value ? { floorId: floor.id, roomId: e.target.value } : undefined,
              })
            }
          >
            <option value="">{t("photos.noRoom")}</option>
            {version.rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name || t(`room.${r.type}`)}
              </option>
            ))}
          </select>
        </label>
        {room && (
          <label className="field">
            <span className="field-label">{t("photos.facing")}</span>
            <select
              className="input"
              value={facing}
              onChange={(e) => setFacing(e.target.value as Cardinal | "")}
            >
              <option value="">{t("photos.facingUnknown")}</option>
              {CARDINALS.filter((c) => sides?.[c].length).map((c) => (
                <option key={c} value={c}>
                  {t(`photos.facing.${c}`)}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="row">
          {linkedHere && room && (
            <>
              <Button icon="cube" onClick={() => setCompare(true)}>
                {t("photos.compare")}
              </Button>
              <Button
                icon="home"
                onClick={() => dispatch({ type: "openPhoto", photo: photo.id, view: "plan" })}
              >
                {t("photos.showOnPlan")}
              </Button>
            </>
          )}
        </div>
      </fieldset>

      {photo.kind === "current" && (
        <div className="stack">
          <Button icon="sparkle" disabled={!room} onClick={() => setAnalyse(true)}>
            {t("photos.analyse")}
          </Button>
          {!room && <p className="muted small">{t("photos.analyseNeedsRoom")}</p>}
        </div>
      )}

      <div className="row">
        <Button
          variant="ghost"
          icon="download"
          onClick={async () => {
            const blob = await getPhoto(photo.id);
            if (!blob) return;
            const { downloadBlob } = await import("@/ui/download");
            downloadBlob(blob, `${photo.name}.jpg`);
          }}
        >
          {t("workspace.export")}
        </Button>
        {confirmDelete ? (
          <>
            <Button
              variant="danger"
              onClick={() => {
                apply((p) => removePhoto(p, photo.id));
                void deletePhoto(photo.id);
                dispatch({ type: "openPhoto", photo: null });
              }}
            >
              {t("photos.deleteConfirm")}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t("common.cancel")}
            </Button>
          </>
        ) : (
          <Button variant="ghost" icon="trash" onClick={() => setConfirmDelete(true)}>
            {t("common.delete")}
          </Button>
        )}
      </div>

      {compare && room && <ComparePhoto photo={photo} onClose={() => setCompare(false)} />}
      {analyse && room && <InteriorAi room={room} onClose={() => setAnalyse(false)} />}
    </div>
  );
}
