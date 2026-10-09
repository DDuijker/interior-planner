import type { Id } from "./types";

/** Short random id with a readable prefix, e.g. "room_3f9a1c2b7d". */
export function newId(prefix: string): Id {
  const raw = globalThis.crypto.randomUUID().replace(/-/g, "");
  return `${prefix}_${raw.slice(0, 10)}`;
}
