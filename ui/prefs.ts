/** Tiny wrapper around localStorage that never throws (private mode, SSR). */
export function readPref(key: string): string | null {
  try {
    return globalThis.localStorage?.getItem(`maison.${key}`) ?? null;
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(`maison.${key}`, value);
  } catch {
    // Storage unavailable: preference just won't persist.
  }
}
