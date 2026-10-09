import type { z } from "zod";
import { extractJson } from "./floorplan";

export interface AiIssue {
  path: string;
  message: string;
}

export type AiParse<T> = { ok: true; value: T } | { ok: false; errors: AiIssue[] };

/**
 * Read a JSON answer from Claude and validate it with a schema. Anything
 * that does not fit is an error with a path, never silently accepted.
 */
export function parseAiJson<S extends z.ZodType>(text: string, schema: S): AiParse<z.infer<S>> {
  const json = extractJson(text);
  if (!json) return { ok: false, errors: [{ path: "", message: "The answer contains no JSON" }] };
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (err) {
    return {
      ok: false,
      errors: [{ path: "", message: err instanceof Error ? err.message : "Invalid JSON" }],
    };
  }
  const result = schema.safeParse(value);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    };
  }
  return { ok: true, value: result.data };
}

/** Message asking Claude to fix an answer that did not validate. */
export function repairJsonText(errors: readonly AiIssue[]): string {
  const list = errors
    .slice(0, 20)
    .map((e) => `- ${e.path || "(root)"}: ${e.message}`)
    .join("\n");
  return `The JSON did not validate:\n${list}\nReturn the corrected JSON object, same shape, nothing else.`;
}
