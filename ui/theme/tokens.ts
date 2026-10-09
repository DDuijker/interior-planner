/**
 * Design tokens. This file is the single source: `themeCss()` turns it into
 * CSS custom properties and the contrast test checks the colour pairs.
 */

export const palette = {
  cream: "#F5F1E8",
  panel: "#FBF9F4",
  line: "#DDD6C6",
  ink: "#2A2620",
  inkMuted: "#6A6357",
  sageLight: "#87A08C",
  sageDark: "#4D6857",
  sageTint: "#E3EAE2",
  olive: "#A9A58B",
  brass: "#B08D57",
  wood: "#4A3526",
  warn: "#A23B2C",
  warnBg: "#F0C9C1",
  /** Darker red for text on warnBg: #A23B2C only reaches 4.3:1 there. */
  warnText: "#8E3022",
  white: "#FFFFFF",
  // Dark theme
  night: "#1E1B17",
  nightPanel: "#28241F",
  nightLine: "#433D34",
  nightInk: "#F2EDE3",
  nightInkMuted: "#B9B0A1",
  nightSage: "#9DB5A2",
  nightSageTint: "#2F3A32",
  nightWarn: "#F2A99C",
  nightWarnBg: "#4A2620",
} as const;

export type ThemeName = "light" | "dark";

export const colors = {
  light: {
    bg: palette.cream,
    panel: palette.panel,
    line: palette.line,
    text: palette.ink,
    textMuted: palette.inkMuted,
    accent: palette.sageDark,
    accentContrast: palette.white,
    accentSoft: palette.sageTint,
    accentLight: palette.sageLight,
    olive: palette.olive,
    brass: palette.brass,
    wood: palette.wood,
    warn: palette.warn,
    warnBg: palette.warnBg,
    warnText: palette.warnText,
    focus: palette.sageDark,
    planFloor: "#FFFFFF",
    planWall: palette.ink,
  },
  dark: {
    bg: palette.night,
    panel: palette.nightPanel,
    line: palette.nightLine,
    text: palette.nightInk,
    textMuted: palette.nightInkMuted,
    accent: palette.nightSage,
    accentContrast: palette.night,
    accentSoft: palette.nightSageTint,
    accentLight: palette.sageLight,
    olive: palette.olive,
    brass: palette.brass,
    wood: "#8A6A52",
    warn: palette.nightWarn,
    warnBg: palette.nightWarnBg,
    warnText: palette.nightWarn,
    focus: palette.nightSage,
    planFloor: "#2F2B25",
    planWall: palette.nightInk,
  },
} as const satisfies Record<ThemeName, Record<string, string>>;

export type ColorToken = keyof (typeof colors)["light"];

/** Text/background pairs that must reach WCAG AA (4.5:1). */
export const contrastPairs: readonly [fg: ColorToken, bg: ColorToken][] = [
  ["text", "bg"],
  ["text", "panel"],
  ["textMuted", "bg"],
  ["textMuted", "panel"],
  ["accentContrast", "accent"],
  ["accent", "bg"],
  ["accent", "panel"],
  ["text", "accentSoft"],
  ["warnText", "warnBg"],
  ["warn", "panel"],
  ["warn", "bg"],
];

export const space = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "24px",
  6: "32px",
  7: "48px",
} as const;
export const radius = { sm: "4px", md: "8px", lg: "14px", pill: "999px" } as const;
export const fontSize = {
  xs: "12px",
  sm: "14px",
  md: "16px",
  lg: "20px",
  xl: "28px",
  xxl: "40px",
} as const;
export const shadow = {
  sm: "0 1px 2px rgb(42 38 32 / 0.08)",
  md: "0 6px 20px rgb(42 38 32 / 0.12)",
} as const;
/** Minimum size of anything you can tap. */
export const touchTarget = "44px";

function kebab(s: string): string {
  return s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

function vars(record: Record<string, string>, prefix: string): string {
  return Object.entries(record)
    .map(([k, v]) => `--${prefix}${kebab(k)}:${v};`)
    .join("");
}

/** CSS for both themes. Dark follows the OS unless `data-theme` is set. */
export function themeCss(): string {
  const shared =
    vars(space as unknown as Record<string, string>, "space-") +
    vars(radius, "radius-") +
    vars(fontSize, "font-") +
    vars(shadow, "shadow-") +
    `--touch:${touchTarget};`;
  const light = vars(colors.light, "c-");
  const dark = vars(colors.dark, "c-");
  return [
    `:root{${shared}${light}color-scheme:light;}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${dark}color-scheme:dark;}}`,
    `:root[data-theme="dark"]{${dark}color-scheme:dark;}`,
  ].join("\n");
}
