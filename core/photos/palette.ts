/**
 * Colour palette from a photo (E13-73), without AI: k-means on a sample of
 * the pixels. Pure and deterministic for a given seed, so it is testable.
 */

export type Rgb = [number, number, number];

export function toHex([r, g, b]: Rgb): string {
  const h = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`.toUpperCase();
}

export function fromHex(hex: string): Rgb {
  const v = parseInt(hex.replace("#", "").slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function dist2(a: Rgb, b: Rgb): number {
  // Weighted RGB distance ("redmean" approximation), closer to what we see.
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return (2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db;
}

/** Small seeded random generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Take up to `max` opaque pixels from RGBA data, evenly spread. Fully
 * transparent pixels are skipped.
 */
export function samplePixels(rgba: ArrayLike<number>, max = 4000): Rgb[] {
  const count = Math.floor(rgba.length / 4);
  const step = Math.max(1, Math.floor(count / max));
  const out: Rgb[] = [];
  for (let i = 0; i < count; i += step) {
    const o = i * 4;
    if ((rgba[o + 3] ?? 255) < 128) continue;
    out.push([rgba[o]!, rgba[o + 1]!, rgba[o + 2]!]);
  }
  return out;
}

export interface Swatch {
  color: string;
  /** Share of the sampled pixels, 0 to 1. */
  weight: number;
}

/**
 * k-means with k-means++ seeding. Returns up to k swatches, most common
 * first. Near-duplicates are merged so a palette of a white wall is not
 * five shades of white.
 */
export function kMeans(pixels: readonly Rgb[], k = 6, seed = 1, iterations = 12): Swatch[] {
  if (!pixels.length || k < 1) return [];
  const rand = random(seed);
  const centres: Rgb[] = [pixels[Math.floor(rand() * pixels.length)]!];
  const nearest = pixels.map((p) => dist2(p, centres[0]!));
  while (centres.length < Math.min(k, pixels.length)) {
    const total = nearest.reduce((s, d) => s + d, 0);
    if (total === 0) break;
    let pick = rand() * total;
    let index = 0;
    for (; index < nearest.length - 1; index++) {
      pick -= nearest[index]!;
      if (pick <= 0) break;
    }
    const c = pixels[index]!;
    centres.push([...c]);
    pixels.forEach((p, i) => (nearest[i] = Math.min(nearest[i]!, dist2(p, c))));
  }

  const assign = new Array<number>(pixels.length).fill(0);
  for (let it = 0; it < iterations; it++) {
    let moved = false;
    pixels.forEach((p, i) => {
      let best = 0;
      let bestD = Infinity;
      centres.forEach((c, j) => {
        const d = dist2(p, c);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      });
      if (assign[i] !== best) moved = true;
      assign[i] = best;
    });
    const sums = centres.map(() => [0, 0, 0, 0]);
    pixels.forEach((p, i) => {
      const s = sums[assign[i]!]!;
      s[0]! += p[0];
      s[1]! += p[1];
      s[2]! += p[2];
      s[3]! += 1;
    });
    sums.forEach((s, j) => {
      if (s[3]) centres[j] = [s[0]! / s[3], s[1]! / s[3], s[2]! / s[3]];
    });
    if (!moved && it > 0) break;
  }

  const counts = centres.map(() => 0);
  assign.forEach((j) => counts[j]!++);
  const swatches = centres
    .map((c, j) => ({ rgb: c, weight: counts[j]! / pixels.length }))
    .filter((s) => s.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // Merge near-duplicates into the more common one.
  const kept: { rgb: Rgb; weight: number }[] = [];
  for (const s of swatches) {
    const twin = kept.find((m) => dist2(m.rgb, s.rgb) < 900 * 9);
    if (twin) twin.weight += s.weight;
    else kept.push({ ...s });
  }
  return kept.map((s) => ({ color: toHex(s.rgb), weight: s.weight }));
}

/** Palette of 5-8 colours from RGBA pixel data. */
export function paletteFromPixels(rgba: ArrayLike<number>, size = 6, seed = 1): string[] {
  return kMeans(samplePixels(rgba), Math.max(5, Math.min(8, size)) + 2, seed)
    .slice(0, size)
    .map((s) => s.color);
}

/**
 * One palette for a whole moodboard: the photo palettes pooled, with each
 * photo counting equally.
 */
export function mergePalettes(palettes: readonly (readonly string[])[], size = 8): string[] {
  const pixels: Rgb[] = [];
  for (const p of palettes) {
    p.forEach((hex, i) => {
      // Earlier colours are more common in their photo: weight them more.
      const n = Math.max(1, p.length - i);
      for (let k = 0; k < n; k++) pixels.push(fromHex(hex));
    });
  }
  return kMeans(pixels, size, 7)
    .slice(0, size)
    .map((s) => s.color);
}

/** Colour at a pixel of RGBA data, averaged over a small square. */
export function pickColor(
  rgba: ArrayLike<number>,
  width: number,
  x: number,
  y: number,
  radius = 2,
): string {
  const height = Math.floor(rgba.length / 4 / width);
  let r = 0;
  let g = 0;
  let b = 0;
  let n = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const px = Math.round(x) + dx;
      const py = Math.round(y) + dy;
      if (px < 0 || py < 0 || px >= width || py >= height) continue;
      const o = (py * width + px) * 4;
      r += rgba[o]!;
      g += rgba[o + 1]!;
      b += rgba[o + 2]!;
      n++;
    }
  }
  return n ? toHex([r / n, g / n, b / n]) : "#000000";
}
