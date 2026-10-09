import { z } from "zod";
import { ENTRIES, getEntry } from "@/catalog";
import { createDesign, getFloor } from "@/core/model/actions";
import { colorSchema, floorFinishSchema, wallFinishSchema } from "@/core/model/schema";
import {
  FLOOR_FINISH_KINDS,
  PANEL_STYLES,
  WALL_FINISH_KINDS,
  WALLPAPER_PATTERNS,
  type Id,
  type Project,
} from "@/core/model/types";
import { getPreset, STYLE_PRESETS } from "@/core/style/style";
import { produce } from "immer";

/**
 * Style from the moodboard (E13-76), pure part. Claude looks at the
 * inspiration photos and proposes a preset, finishes, a palette and generic
 * catalogue furniture. Applied to a new design only, never to the current
 * situation.
 */

export const moodboardProposalSchema = z.object({
  name: z.string().min(1).max(60),
  presetId: z
    .string()
    .refine((id) => !!getPreset(id), { message: "Unknown preset id" })
    .optional(),
  palette: z.array(colorSchema).min(3).max(8),
  wall: wallFinishSchema,
  floor: floorFinishSchema,
  ceiling: colorSchema,
  accent: colorSchema,
  furniture: z
    .array(
      z.object({
        id: z.string().refine((id) => !!getEntry(id), { message: "Unknown catalogue id" }),
        color: colorSchema.optional(),
        why: z.string().max(200).optional(),
      }),
    )
    .max(12)
    .default([]),
  summary: z.string().max(600).default(""),
});
export type MoodboardProposal = z.infer<typeof moodboardProposalSchema>;

/** The system prompt, with the presets and the catalogue to choose from. */
export function moodboardSystem(): string {
  const presets = STYLE_PRESETS.map((p) => `${p.id} (${p.name.en})`).join(", ");
  const catalogue = ENTRIES.map((e) => `${e.id}: ${e.name.en}`).join("; ");
  return `You are an interior stylist. You look at a moodboard (inspiration photos, often from Pinterest) and describe the style so an interior planner can apply it to a room design.

Answer with one JSON object and nothing else:
{
  "name": short name for the style, in the user's language,
  "presetId"?: the closest preset id, from: ${presets},
  "palette": 5 to 8 "#RRGGBB" colours that carry the look, most important first,
  "wall": { "kind": one of ${JSON.stringify(WALL_FINISH_KINDS.filter((k) => k !== "current"))}, "color": "#RRGGBB", "color2"?: "#RRGGBB", "height"?: cm, "pattern"?: one of ${JSON.stringify(WALLPAPER_PATTERNS)}, "panel"?: one of ${JSON.stringify(PANEL_STYLES)} },
  "floor": { "kind": one of ${JSON.stringify(FLOOR_FINISH_KINDS.filter((k) => k !== "current"))}, "color": "#RRGGBB", "color2"?: "#RRGGBB", "plankWidth"?: cm, "tileSize"?: cm },
  "ceiling": "#RRGGBB",
  "accent": "#RRGGBB",
  "furniture": [ { "id": catalogue id, "color"?: "#RRGGBB", "why"?: short reason } ] (at most 12, generic pieces from the catalogue below that fit the look),
  "summary": two or three sentences on the look, in the user's language
}

Catalogue (id: name): ${catalogue}

Use only ids from the lists. Colours are real material colours, not the tint of the photo.`;
}

export function moodboardUserText(
  notes: readonly string[],
  room: string | undefined,
  locale: "nl" | "en",
): string {
  return [
    "Here is my moodboard.",
    room ? `I want to apply it to: ${room}.` : "",
    ...notes.filter(Boolean).map((n, i) => `Note on photo ${i + 1}: ${n}`),
    `Write name and summary in ${locale === "nl" ? "Dutch" : "English"}.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Create a new design on the floor with the proposed style. Returns the
 * project with the design active, and the design's id.
 */
export function applyMoodboardProposal(
  project: Project,
  floorId: Id,
  proposal: MoodboardProposal,
  designName: string,
): { project: Project; designId: Id } {
  let next = createDesign(project, floorId, designName);
  const designId = getFloor(next, floorId).activeVersionId;
  const preset = proposal.presetId ? getPreset(proposal.presetId) : undefined;
  next = produce(next, (d) => {
    const floor = d.floors.find((f) => f.id === floorId)!;
    const v = floor.designs.find((x) => x.id === designId)!;
    v.style = {
      ...v.style,
      ...(preset ? structuredClone(preset.style) : {}),
      name: proposal.name,
      presetId: preset?.id,
      wall: proposal.wall,
      floor: proposal.floor,
      ceiling: proposal.ceiling,
      accent: proposal.accent,
    };
    if (!preset) delete v.style.presetId;
    // The moodboard's look is for the whole floor: clear room-level styles.
    for (const r of v.rooms) delete r.style;
    v.wallOverrides = {};
  });
  return { project: next, designId };
}
