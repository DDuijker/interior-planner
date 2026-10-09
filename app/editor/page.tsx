"use client";

import { useMemo } from "react";
import { addItem } from "@/core/model/actions";
import type { Project } from "@/core/model/types";
import { sampleApartment } from "@/core/samples/apartment";
import { Editor } from "@/ui/editor/Editor";

/**
 * `?stress=150` adds that many chairs for performance checks (E03-12).
 * Projects and import come later (E07, E10); for now the sample plan opens.
 */
function withStress(project: Project): Project | null {
  const n = Number(new URLSearchParams(window.location.search).get("stress"));
  if (!Number.isFinite(n) || n <= 0) return null;
  let p = project;
  for (let i = 0; i < Math.min(n, 1000); i++) {
    p = addItem(p, {
      id: `stress-${i}`,
      catalogId: "chair",
      name: "Stoel",
      x: 20 + (i % 25) * 30,
      y: 20 + Math.floor(i / 25) * 30,
      w: 25,
      d: 25,
      h: 80,
      rotation: (i * 15) % 360,
      shape: i % 3 === 0 ? "round" : "rect",
      layer: "furniture",
      mount: "floor",
      elevation: 0,
    });
  }
  return p;
}

export default function EditorPage() {
  const project = useMemo(() => sampleApartment(), []);
  return <Editor initial={project} prepare={withStress} />;
}
