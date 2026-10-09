"use client";

import { useEffect, useState } from "react";
import { getPhoto } from "@/ui/storage/db";

/** Object URL for a stored photo; revoked when no longer used. */
export function usePhotoUrl(id: string | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let made: string | null = null;
    void getPhoto(id)
      .then((blob) => {
        if (!alive || !blob) return;
        made = URL.createObjectURL(blob);
        setUrl(made);
      })
      .catch(() => setUrl(null));
    return () => {
      alive = false;
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  return url;
}
