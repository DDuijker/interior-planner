"use client";

import type { Photo } from "@/core/model/types";
import { usePhotoUrl } from "./usePhotoUrl";

/** A stored photo as an <img>, with a quiet placeholder while it loads. */
export function PhotoImg({
  photo,
  className,
  alt,
}: {
  photo: Photo;
  className?: string;
  alt?: string;
}) {
  const url = usePhotoUrl(photo.id);
  if (!url)
    return (
      <span
        className={`photo-placeholder ${className ?? ""}`}
        style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
        aria-hidden="true"
      />
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt ?? photo.name} className={className} draggable={false} />;
}
