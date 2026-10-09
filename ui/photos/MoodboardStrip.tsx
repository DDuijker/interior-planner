"use client";

import type { Photo } from "@/core/model/types";
import { useI18n } from "@/i18n/I18nProvider";
import { IconButton } from "@/ui/components/Button";
import { useWorkspace } from "@/ui/workspace/context";
import { PhotoImg } from "./PhotoThumb";

/** The moodboard next to 2D and 3D (E13-72). */
export function MoodboardStrip({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const { project, version, dispatch } = useWorkspace();
  const byId = new Map(project.photos.map((p) => [p.id, p]));
  const photos = version.moodboard.map((id) => byId.get(id)).filter((p): p is Photo => !!p);
  return (
    <aside className="moodboard-strip" aria-label={t("moodboard.title", { design: version.name })}>
      <div className="row moodboard-strip-head">
        <h2 className="panel-title">{t("moodboard.title", { design: version.name })}</h2>
        <IconButton icon="close" label={t("common.close")} onClick={onClose} />
      </div>
      {photos.length === 0 ? (
        <p className="muted small">{t("moodboard.empty")}</p>
      ) : (
        <ul className="moodboard-strip-list">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="moodboard-strip-item"
                onClick={() => dispatch({ type: "openPhoto", photo: p.id, view: "photos" })}
                aria-label={t("moodboard.open", { name: p.name })}
              >
                <PhotoImg photo={p} alt="" />
                {p.palette && (
                  <span className="palette-row" aria-hidden="true">
                    {p.palette.slice(0, 5).map((c) => (
                      <span key={c} className="swatch-dot" style={{ background: c }} />
                    ))}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
