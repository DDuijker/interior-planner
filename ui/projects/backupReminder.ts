/** Count changes since the last download, per project (E10-58). */
const key = (id: string) => `maison.changes.${id}`;

export function countChange(id: string): number {
  try {
    const n = Number(localStorage.getItem(key(id)) ?? "0") + 1;
    localStorage.setItem(key(id), String(n));
    return n;
  } catch {
    return 0;
  }
}

export function resetChanges(id: string) {
  try {
    localStorage.setItem(key(id), "0");
  } catch {
    // ignore
  }
}

/** True exactly when the count reaches a multiple of `every`. */
export function shouldRemind(count: number, every: number): boolean {
  return every > 0 && count > 0 && count % every === 0;
}
