/** Favourite and recently used catalog entries, stored locally (E08-46). */
const FAV = "maison.favorites";
const RECENT = "maison.recent";
const MAX_RECENT = 12;

function read(key: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function write(key: string, ids: string[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function getFavorites(): string[] {
  return read(FAV);
}

export function toggleFavorite(id: string): string[] {
  const now = getFavorites();
  const next = now.includes(id) ? now.filter((x) => x !== id) : [id, ...now];
  write(FAV, next);
  return next;
}

export function getRecent(): string[] {
  return read(RECENT);
}

export function addRecent(id: string): string[] {
  const next = [id, ...getRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
  write(RECENT, next);
  return next;
}
