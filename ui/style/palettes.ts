"use client";

import { useSyncExternalStore } from "react";
import { QUICK_PALETTE, type Palette } from "@/core/style/style";

/** User palettes in localStorage (E09-47). The first one is always Maison. */
const KEY = "maison.palettes";
const listeners = new Set<() => void>();
let cache: Palette[] | null = null;

function load(): Palette[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(raw)
      ? raw.filter((p): p is Palette => typeof p?.name === "string" && Array.isArray(p?.colors))
      : [];
  } catch {
    cache = [];
  }
  return cache;
}

function save(next: Palette[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

const EMPTY: Palette[] = [];

export function useUserPalettes(): Palette[] {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

/** Swatches for colour pickers: the house palette plus all user palettes. */
export function usePalettes(): string[] {
  const user = useUserPalettes();
  return [
    ...new Set([
      ...QUICK_PALETTE.colors,
      "#E3EAE2",
      "#FBF9F4",
      "#2A2620",
      ...user.flatMap((p) => p.colors),
    ]),
  ].slice(0, 24);
}

export function addPalette(p: Palette) {
  save([...load(), p]);
}

export function updatePalette(index: number, p: Palette) {
  save(load().map((x, i) => (i === index ? p : x)));
}

export function removePalette(index: number) {
  save(load().filter((_, i) => i !== index));
}
