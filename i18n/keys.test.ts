import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/catalog";
import { ELEMENT_TYPES } from "@/core/ai/interior";
import { SHORTCUT_ACTIONS } from "@/core/editor/shortcuts";
import {
  CARDINALS,
  FIXTURE_TYPES,
  FLOOR_FINISH_KINDS,
  LAYERS,
  ROOM_TYPES,
  UNITS,
  WALL_FINISH_KINDS,
} from "@/core/model/types";
import { MODELS } from "@/ui/settings/settings";
import { messages } from "./translate";

/**
 * Keys built at runtime (t(`room.${type}`)) escape the type check, so check
 * here that every value of the enums behind them has a translation.
 */
const DYNAMIC: [string, readonly string[]][] = [
  ["room", ROOM_TYPES],
  ["fixture", FIXTURE_TYPES],
  ["wallKind", WALL_FINISH_KINDS],
  ["floorKind", FLOOR_FINISH_KINDS],
  ["layer", LAYERS],
  ["unit", UNITS],
  ["cardinal", CARDINALS],
  ["photos.facing", CARDINALS],
  ["photos.ai.el", ELEMENT_TYPES],
  ["category", CATEGORIES],
  ["shortcut", SHORTCUT_ACTIONS],
  ["settings.model", MODELS],
  ["settings.quality", ["auto", "low", "medium", "high"]],
  ["ai.error", ["key", "rate", "overloaded", "refused", "network", "other"]],
  ["photos.filter", ["moodboard", "inspiration", "current"]],
  ["photos.empty", ["moodboard", "inspiration", "current"]],
  ["view", ["plan", "3d", "style", "photos"]],
];

describe("dynamic message keys", () => {
  for (const [prefix, values] of DYNAMIC) {
    it(`${prefix}.*`, () => {
      const missing = values
        .map((v) => `${prefix}.${v}`)
        .filter((k) => !(k in messages.nl) || !(k in messages.en));
      expect(missing).toEqual([]);
    });
  }
});
