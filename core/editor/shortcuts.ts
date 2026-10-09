/**
 * Keyboard shortcuts as data, so they can be shown in the help dialog and
 * made configurable later. "Mod" is Cmd on macOS and Ctrl elsewhere.
 */
export const SHORTCUT_ACTIONS = [
  "undo",
  "redo",
  "duplicate",
  "delete",
  "group",
  "ungroup",
  "selectAll",
  "deselect",
  "rotate",
  "measure",
  "help",
  "zoomFit",
] as const;
export type ShortcutAction = (typeof SHORTCUT_ACTIONS)[number];

export type Keymap = Record<ShortcutAction, readonly string[]>;

export const DEFAULT_KEYMAP: Keymap = {
  undo: ["Mod+z"],
  redo: ["Mod+Shift+z", "Mod+y"],
  duplicate: ["Mod+d"],
  delete: ["Delete", "Backspace"],
  group: ["Mod+g"],
  ungroup: ["Mod+Shift+g"],
  selectAll: ["Mod+a"],
  deselect: ["Escape"],
  rotate: ["r"],
  measure: ["m"],
  help: ["?", "Shift+?"],
  zoomFit: ["0"],
};

export interface KeyLike {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

function parse(combo: string) {
  const parts = combo.split("+");
  const key = parts.pop()!.toLowerCase();
  const mods = new Set(parts.map((p) => p.toLowerCase()));
  return { key, mod: mods.has("mod"), shift: mods.has("shift"), alt: mods.has("alt") };
}

export function matchesCombo(e: KeyLike, combo: string, isMac: boolean): boolean {
  const c = parse(combo);
  const mod = isMac ? e.metaKey : e.ctrlKey;
  const otherMod = isMac ? e.ctrlKey : e.metaKey;
  if (otherMod || c.mod !== mod || c.alt !== e.altKey) return false;
  // "?" needs Shift on most layouts; accept both unless Shift is explicit.
  if (c.shift !== e.shiftKey && !(c.key === "?" && !c.shift)) return false;
  return e.key.toLowerCase() === c.key;
}

export function matchShortcut(
  e: KeyLike,
  keymap: Keymap = DEFAULT_KEYMAP,
  isMac = false,
): ShortcutAction | null {
  for (const action of SHORTCUT_ACTIONS) {
    if (keymap[action].some((combo) => matchesCombo(e, combo, isMac))) return action;
  }
  return null;
}

/** Human-readable combo: "Ctrl+Shift+Z" or "⌘⇧Z". */
export function formatCombo(combo: string, isMac = false): string {
  const c = parse(combo);
  const key = c.key.length === 1 ? c.key.toUpperCase() : c.key[0]!.toUpperCase() + c.key.slice(1);
  if (isMac) return `${c.mod ? "⌘" : ""}${c.alt ? "⌥" : ""}${c.shift ? "⇧" : ""}${key}`;
  return [c.mod && "Ctrl", c.alt && "Alt", c.shift && "Shift", key].filter(Boolean).join("+");
}
