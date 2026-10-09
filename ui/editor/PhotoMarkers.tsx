"use client";

import { memo } from "react";
import type { Id, Photo, Room, Wall } from "@/core/model/types";
import { worldToScreen, type Camera } from "@/core/editor/camera";
import { dirVector, photoStandpoint } from "@/core/photos/photos";

/**
 * Camera icons in 2D where linked photos were taken, with a wedge showing
 * the viewing direction (E13-74). Drawing only: the controls are the HTML
 * buttons in PhotoMarkerButtons, because WebKit cannot focus SVG elements.
 */
export const PhotoMarkers = memo(function PhotoMarkers({
  photos,
  rooms,
  walls,
  px,
}: {
  photos: readonly Photo[];
  rooms: readonly Room[];
  walls: readonly Wall[];
  px: (screen: number) => number;
}) {
  return (
    <g className="plan-photos" aria-hidden="true">
      {photos.map((photo) => {
        const sp = photo.link ? photoStandpoint(photo.link, rooms, walls) : undefined;
        if (!sp) return null;
        const r = px(13);
        const len = px(46);
        const a = dirVector(sp.dir - 28);
        const b = dirVector(sp.dir + 28);
        const wedge = `M${sp.at.x} ${sp.at.y}L${sp.at.x + a.x * len} ${sp.at.y + a.y * len}A${len} ${len} 0 0 1 ${sp.at.x + b.x * len} ${sp.at.y + b.y * len}Z`;
        const s = px(1);
        return (
          <g key={photo.id} className="plan-photo" data-photo={photo.id}>
            <path d={wedge} className="plan-photo-wedge" />
            <circle
              cx={sp.at.x}
              cy={sp.at.y}
              r={r}
              className="plan-photo-dot"
              strokeWidth={px(2)}
            />
            <path
              d={`M${sp.at.x - 7 * s} ${sp.at.y - 3 * s}h3l1.5-2h5l1.5 2h3v8h-14z`}
              className="plan-photo-glyph"
              strokeWidth={px(1.5)}
            />
          </g>
        );
      })}
    </g>
  );
});

/**
 * Real buttons over the camera icons, positioned in screen pixels: keyboard
 * and screen-reader access in every browser, and a 44 px touch target.
 */
export function PhotoMarkerButtons({
  photos,
  rooms,
  walls,
  camera,
  label,
  onOpen,
}: {
  photos: readonly Photo[];
  rooms: readonly Room[];
  walls: readonly Wall[];
  camera: Camera;
  label: (photo: Photo) => string;
  onOpen: (id: Id) => void;
}) {
  return (
    <div className="plan-photo-buttons">
      {photos.map((photo) => {
        const sp = photo.link ? photoStandpoint(photo.link, rooms, walls) : undefined;
        if (!sp) return null;
        const at = worldToScreen(camera, sp.at);
        return (
          <button
            key={photo.id}
            type="button"
            className="plan-photo-btn"
            data-photo-button={photo.id}
            style={{ left: at.x, top: at.y }}
            aria-label={label(photo)}
            title={label(photo)}
            onClick={() => onOpen(photo.id)}
          />
        );
      })}
    </div>
  );
}
