"use client";

import { createContext, useContext } from "react";
import type { LayoutIssue } from "@/core/collision/collision";
import type { Floor, Id, Project, Version, Wall } from "@/core/model/types";
import type { WallPiece } from "@/core/openings/openings";
import type { EditorAction, EditorState } from "@/ui/editor/state";

/** A view that can render itself to an image (3D for export, photos). */
export type Capture = (scale: number) => Promise<Blob | null>;

export interface WorkspaceValue {
  state: EditorState;
  dispatch: (a: EditorAction) => void;
  project: Project;
  version: Version;
  floor: Floor;
  walls: readonly Wall[];
  pieces: readonly WallPiece[];
  issues: readonly LayoutIssue[];
  apply: (update: (p: Project) => Project, select?: Id[]) => void;
  /** Re-place stacked and wall items after a move. */
  settle: (ids: readonly Id[]) => void;
  registerCapture: (name: string, fn: Capture | null) => void;
  capture: (name: string) => Capture | undefined;
}

export const WorkspaceContext = createContext<WorkspaceValue | null>(null);

export function useWorkspace(): WorkspaceValue {
  const v = useContext(WorkspaceContext);
  if (!v) throw new Error("useWorkspace must be used inside <Workspace>");
  return v;
}
