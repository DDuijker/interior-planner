import type { Unit } from "../model/types";

/** Centimetres per unit. Everything is stored in cm. */
export const CM_PER: Record<Unit, number> = { cm: 1, mm: 0.1, in: 2.54, ft: 30.48 };

export function toUnit(cm: number, unit: Unit): number {
  return cm / CM_PER[unit];
}

export function fromUnit(value: number, unit: Unit): number {
  return value * CM_PER[unit];
}

function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f + 0; // + 0 avoids -0
}

const DEFAULT_DECIMALS: Record<Unit, number> = { cm: 0, mm: 0, in: 1, ft: 2 };

/**
 * Format a length for display. Feet are shown as feet and inches (5' 3"),
 * rounded to the nearest inch.
 */
export function formatLength(cm: number, unit: Unit, decimals = DEFAULT_DECIMALS[unit]): string {
  if (unit === "ft") {
    const totalInches = Math.round(Math.abs(toUnit(cm, "in")));
    const sign = cm < 0 && totalInches > 0 ? "-" : "";
    const feet = Math.floor(totalInches / 12);
    const inches = totalInches % 12;
    return `${sign}${feet}' ${inches}"`;
  }
  const value = round(toUnit(cm, unit), decimals);
  const suffix = unit === "in" ? '"' : ` ${unit}`;
  return `${value.toFixed(decimals)}${suffix}`;
}

/** Format an area given in cm² as m² (metric) or sq ft (imperial). */
export function formatArea(cm2: number, unit: Unit): string {
  if (unit === "in" || unit === "ft") return `${round(cm2 / (30.48 * 30.48), 0)} sq ft`;
  return `${round(cm2 / 10000, 1).toFixed(1)} m²`;
}

/**
 * Parse user input into cm. Accepts plain numbers in the current unit and
 * explicit units: "240", "2,4 m", "90cm", "35 mm", "12\"", "5'", "5' 3\"", "5ft 3in".
 * Returns null for anything it cannot read.
 */
export function parseLength(input: string, unit: Unit): number | null {
  const s = input.trim().toLowerCase().replace(",", ".");
  if (s === "") return null;
  const num = "(-?\\d+(?:\\.\\d+)?)";
  const feetInches = new RegExp(
    `^${num}\\s*(?:'|ft|feet)\\s*(?:${num}\\s*(?:"|in|inch|inches)?)?$`,
  ).exec(s);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = feetInches[2] ? Number(feetInches[2]) : 0;
    return fromUnit(feet, "ft") + Math.sign(feet || 1) * fromUnit(inches, "in");
  }
  const m = new RegExp(`^${num}\\s*(mm|cm|m|"|in|inch|inches)?$`).exec(s);
  if (!m) return null;
  const value = Number(m[1]);
  switch (m[2]) {
    case undefined:
      return fromUnit(value, unit);
    case "mm":
      return value / 10;
    case "cm":
      return value;
    case "m":
      return value * 100;
    default:
      return fromUnit(value, "in");
  }
}

/** Step for arrow keys and spinners in the given unit, in cm. */
export function unitStep(unit: Unit): number {
  return unit === "mm" ? 0.1 : unit === "cm" ? 1 : CM_PER.in;
}
