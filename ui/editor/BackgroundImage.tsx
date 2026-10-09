"use client";

import { useEffect, useState } from "react";
import type { Background } from "@/core/model/types";
import { usePhotoUrl } from "@/ui/photos/usePhotoUrl";

/** Image under the plan, at its scale (cm per image pixel). */
export function BackgroundImage({ bg }: { bg: Background }) {
  const url = usePhotoUrl(bg.photoId);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!url) return;
    const img = new Image();
    img.onload = () => setSize({ w: img.naturalWidth, h: img.naturalHeight });
    img.src = url;
  }, [url]);

  if (!url || !size) return null;
  return (
    <image
      href={url}
      x={bg.x}
      y={bg.y}
      width={size.w * bg.scale}
      height={size.h * bg.scale}
      opacity={bg.opacity}
      transform={bg.rotation ? `rotate(${bg.rotation} ${bg.x} ${bg.y})` : undefined}
      preserveAspectRatio="none"
      className="plan-background"
      aria-hidden="true"
    />
  );
}
