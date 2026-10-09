import type { z } from "zod";
import { parseAiJson, repairJsonText, type AiIssue } from "@/core/ai/json";
import { askClaude, ClaudeError, type ClaudeInput, type ClaudeProgress } from "./claude";

export class AiAnswerError extends Error {
  constructor(readonly issues: AiIssue[]) {
    super(issues.map((i) => `${i.path} ${i.message}`).join("; "));
  }
}

/**
 * Ask Claude for JSON that matches a schema. One repair round when the
 * first answer does not validate; after that the answer is rejected.
 */
export async function askJson<S extends z.ZodType>(opts: {
  apiKey: string;
  model: string;
  system: string;
  inputs: ClaudeInput[];
  text: string;
  schema: S;
  signal?: AbortSignal;
  onProgress?: (p: ClaudeProgress & { repairing: boolean }) => void;
}): Promise<{ value: z.infer<S>; cost?: number }> {
  const common = {
    apiKey: opts.apiKey,
    model: opts.model,
    system: opts.system,
    signal: opts.signal,
  };
  const first = await askClaude({
    ...common,
    inputs: opts.inputs,
    text: opts.text,
    onProgress: (p) => opts.onProgress?.({ ...p, repairing: false }),
  });
  let parsed = parseAiJson(first.text, opts.schema);
  let cost = first.cost;
  if (!parsed.ok) {
    const second = await askClaude({
      ...common,
      inputs: [],
      history: first.messages,
      text: repairJsonText(parsed.errors),
      effort: "medium",
      onProgress: (p) => opts.onProgress?.({ ...p, repairing: true }),
    });
    cost = cost !== undefined && second.cost !== undefined ? cost + second.cost : undefined;
    parsed = parseAiJson(second.text, opts.schema);
  }
  if (!parsed.ok) throw new AiAnswerError(parsed.errors);
  return { value: parsed.value, cost };
}

export { ClaudeError };
