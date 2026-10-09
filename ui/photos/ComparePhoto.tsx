"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import type { Photo } from "@/core/model/types";
import { photoStandpoint } from "@/core/photos/photos";
import { useI18n } from "@/i18n/I18nProvider";
import { Modal } from "@/ui/components/Modal";
import { useWorkspace } from "@/ui/workspace/context";
import { PhotoImg } from "./PhotoThumb";

const ThreeView = dynamic(() => import("@/three/ThreeView").then((m) => m.ThreeView), {
  ssr: false,
});

/** The photo next to the 3D render from the same standpoint (E13-74). */
export function ComparePhoto({ photo, onClose }: { photo: Photo; onClose: () => void }) {
  const { t } = useI18n();
  const { version, walls } = useWorkspace();
  const standpoint = useMemo(
    () => (photo.link ? photoStandpoint(photo.link, version.rooms, walls) : undefined),
    [photo.link, version.rooms, walls],
  );
  return (
    <Modal open onClose={onClose} title={t("photos.compareTitle", { name: photo.name })}>
      <div className="photo-compare">
        <figure>
          <PhotoImg photo={photo} className="photo-compare-img" />
          <figcaption className="small muted">{t("photos.compareNow")}</figcaption>
        </figure>
        <figure className="photo-compare-3d">
          <ThreeView panelOpen={false} onTogglePanel={() => {}} standpoint={standpoint} />
          <figcaption className="small muted">{t("photos.compareModel")}</figcaption>
        </figure>
      </div>
    </Modal>
  );
}
