"use client";

import { newId } from "@/core/model/ids";
import type { Photo } from "@/core/model/types";
import { paletteFromPixels } from "@/core/photos/palette";
import { imagePixels, shrinkImage } from "@/ui/images";
import { putPhoto } from "@/ui/storage/db";

/** Longest side of a stored photo (E13-71). */
export const MAX_PHOTO = 2000;

/**
 * Store a picture: downsized to 2000 px, re-encoded (which drops EXIF such as
 * the GPS location), saved in IndexedDB. Returns the metadata to put in the
 * project. Nothing goes online.
 */
export async function storePhoto(
  file: Blob & { name?: string },
  kind: Photo["kind"],
  extra: Partial<Photo> = {},
): Promise<Photo> {
  const { blob, width, height } = await shrinkImage(file, MAX_PHOTO, "image/jpeg", 0.85);
  const id = newId("photo");
  await putPhoto(id, blob);
  let palette: string[] | undefined;
  try {
    const px = await imagePixels(blob, 160);
    palette = paletteFromPixels(px.data, 6);
  } catch {
    // A palette is a nicety; the photo is stored either way.
  }
  return {
    id,
    kind,
    name: (file.name ?? "").replace(/\.[a-z0-9]+$/i, "") || kind,
    width,
    height,
    createdAt: new Date().toISOString(),
    ...(palette ? { palette } : {}),
    ...extra,
  };
}

/** Image files from a drop or paste, in order. */
export function imageFiles(list: FileList | readonly File[] | null | undefined): File[] {
  return [...(list ?? [])].filter((f) => f.type.startsWith("image/"));
}

/**
 * A link dropped from another tab (e.g. a Pinterest pin) comes as text. We
 * keep it as the source, never fetch it.
 */
export function droppedUrl(data: DataTransfer | null): string | undefined {
  const text = data?.getData("text/uri-list") || data?.getData("text/plain") || "";
  const first = text.split(/\r?\n/).find((l) => l && !l.startsWith("#"));
  return first && /^https?:\/\//i.test(first) ? first.trim() : undefined;
}
