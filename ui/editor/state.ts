import {
  begin,
  cancel,
  commit,
  createHistory,
  push,
  redo,
  reset,
  undo,
  type History,
} from "@/core/history/history";
import { expandToGroups, getActiveVersion } from "@/core/model/actions";
import type { Id, Project } from "@/core/model/types";
import type { Camera } from "@/core/editor/camera";

export type Tool =
  | "select"
  | "pan"
  | "measure"
  | "room-rect"
  | "room-l"
  | "room-poly"
  | "wall"
  | "door"
  | "window"
  | "passage"
  | "scale-ref";

export type View = "plan" | "3d" | "style" | "photos";

/** A wall side picked in 2D or 3D (E09-50, E06-29). */
export interface WallPick {
  wallId: Id;
  side: "a" | "b";
}

export interface EditorState {
  history: History<Project>;
  selection: Id[];
  tool: Tool;
  camera: Camera;
  showGrid: boolean;
  showLabels: boolean;
  showMinimap: boolean;
  view: View;
  wall: WallPick | null;
  room: Id | null;
  /** Selected door, window or passage. */
  opening: Id | null;
  /** Show the floor below as a ghost in 2D. */
  ghost: boolean;
}

export type EditorAction =
  | { type: "apply"; update: (p: Project) => Project; select?: Id[] }
  | { type: "begin" }
  | { type: "commit" }
  | { type: "cancel" }
  | { type: "undo" }
  | { type: "redo" }
  | { type: "select"; ids: Id[]; additive?: boolean }
  | { type: "tool"; tool: Tool }
  | { type: "camera"; camera: Camera }
  | { type: "toggle"; key: "showGrid" | "showLabels" | "showMinimap" | "ghost" }
  | { type: "view"; view: View }
  | { type: "pickWall"; wall: WallPick | null }
  | { type: "pickRoom"; room: Id | null }
  | { type: "pickOpening"; opening: Id | null }
  | { type: "load"; project: Project };

export function initialEditorState(project: Project): EditorState {
  return {
    history: createHistory(project),
    selection: [],
    tool: "select",
    camera: { x: -100, y: -100, scale: 1 },
    showGrid: true,
    showLabels: true,
    showMinimap: true,
    view: "plan",
    wall: null,
    room: null,
    opening: null,
    ghost: true,
  };
}

/** Drop ids that no longer exist (after undo, delete, switching versions). */
function pruneSelection(project: Project, ids: Id[]): Id[] {
  const items = getActiveVersion(project).items;
  const known = new Set(items.map((i) => i.id));
  const kept = ids.filter((id) => known.has(id));
  return kept.length === ids.length ? ids : kept;
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case "apply": {
      const next = action.update(state.history.present);
      const history = push(state.history, next);
      const selection = pruneSelection(next, action.select ?? state.selection);
      if (history === state.history && selection === state.selection) return state;
      return { ...state, history, selection };
    }
    case "begin":
      return { ...state, history: begin(state.history) };
    case "commit":
      return { ...state, history: commit(state.history) };
    case "cancel": {
      const history = cancel(state.history);
      return { ...state, history, selection: pruneSelection(history.present, state.selection) };
    }
    case "undo":
    case "redo": {
      const history = action.type === "undo" ? undo(state.history) : redo(state.history);
      return { ...state, history, selection: pruneSelection(history.present, state.selection) };
    }
    case "select": {
      const items = getActiveVersion(state.history.present).items;
      const ids = expandToGroups(items, action.ids);
      if (!action.additive) {
        if (!ids.length) return { ...state, selection: ids };
        return { ...state, selection: ids, wall: null, room: null, opening: null };
      }
      // Shift-click toggles: remove if everything is already selected.
      const current = new Set(state.selection);
      const allIn = ids.length > 0 && ids.every((id) => current.has(id));
      for (const id of ids) {
        if (allIn) current.delete(id);
        else current.add(id);
      }
      return { ...state, selection: items.filter((i) => current.has(i.id)).map((i) => i.id) };
    }
    case "tool":
      return { ...state, tool: action.tool };
    case "camera":
      return { ...state, camera: action.camera };
    case "toggle":
      return { ...state, [action.key]: !state[action.key] };
    case "view":
      return { ...state, view: action.view };
    case "pickWall":
      return {
        ...state,
        wall: action.wall,
        room: null,
        opening: null,
        selection: action.wall ? [] : state.selection,
      };
    case "pickRoom":
      return {
        ...state,
        room: action.room,
        wall: null,
        opening: null,
        selection: action.room ? [] : state.selection,
      };
    case "pickOpening":
      return {
        ...state,
        opening: action.opening,
        wall: null,
        room: null,
        selection: action.opening ? [] : state.selection,
      };
    case "load":
      return { ...state, history: reset(state.history, action.project), selection: [] };
  }
}
