import Anthropic from "@anthropic-ai/sdk";
import { estimateCost } from "@/core/ai/floorplan";

/**
 * Talking to Claude, straight from the browser with the user's own API key.
 * There is no backend: the key stays in this browser (settings in
 * localStorage) and only travels in the x-api-key header to Anthropic.
 * Never log the key, the client or the request options.
 */

export type ClaudeInput =
  | { kind: "image"; mediaType: "image/jpeg" | "image/png" | "image/webp"; data: string }
  | { kind: "pdf"; data: string };

export interface ClaudeProgress {
  /** Characters of answer received so far. */
  chars: number;
  /** Latest thinking summary, if the model shared one. */
  thinking?: string;
}

export interface ClaudeResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  /** Dollars, if the model is in the price list. */
  cost?: number;
  /** True when the answer was cut off at max_tokens. */
  truncated: boolean;
}

export type ClaudeErrorKind =
  "key" | "rate" | "overloaded" | "refused" | "network" | "aborted" | "other";

export class ClaudeError extends Error {
  constructor(
    readonly kind: ClaudeErrorKind,
    message: string,
  ) {
    super(message);
  }
}

function client(apiKey: string) {
  // The SDK refuses to run in a browser unless told so, because a key in a
  // web page is normally the site's key. Here it is the user's own key, typed
  // into their own browser, which is exactly the case this flag is for.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 2 });
}

function toBlock(input: ClaudeInput): Anthropic.Beta.BetaContentBlockParam {
  return input.kind === "pdf"
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: input.data },
      }
    : { type: "image", source: { type: "base64", media_type: input.mediaType, data: input.data } };
}

function classify(err: unknown, signal?: AbortSignal): ClaudeError {
  if (signal?.aborted || err instanceof Anthropic.APIUserAbortError)
    return new ClaudeError("aborted", "Aborted");
  if (
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError
  )
    return new ClaudeError("key", err.message);
  if (err instanceof Anthropic.RateLimitError) return new ClaudeError("rate", err.message);
  if (err instanceof Anthropic.InternalServerError)
    return new ClaudeError("overloaded", err.message);
  if (err instanceof Anthropic.APIConnectionError) return new ClaudeError("network", err.message);
  if (err instanceof ClaudeError) return err;
  if (err instanceof Anthropic.APIError) return new ClaudeError("other", err.message);
  return new ClaudeError("other", err instanceof Error ? err.message : String(err));
}

export interface AskOptions {
  apiKey: string;
  model: string;
  system: string;
  /** Files first, then the text, per Anthropic's advice for documents. */
  inputs: ClaudeInput[];
  text: string;
  /** Earlier turns, for a repair round. */
  history?: Anthropic.Beta.BetaMessageParam[];
  signal?: AbortSignal;
  onProgress?: (p: ClaudeProgress) => void;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}

/** One streamed request. Resolves with the answer text, or throws ClaudeError. */
export async function askClaude(
  opts: AskOptions,
): Promise<ClaudeResult & { messages: Anthropic.Beta.BetaMessageParam[] }> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...(opts.history ?? []),
    { role: "user", content: [...opts.inputs.map(toBlock), { type: "text", text: opts.text }] },
  ];
  try {
    const stream = client(opts.apiKey).beta.messages.stream(
      {
        model: opts.model,
        max_tokens: opts.maxTokens ?? 32000,
        system: opts.system,
        thinking: { type: "adaptive", display: "summarized" },
        output_config: { effort: opts.effort ?? "high" },
        // If a safety check declines, the API retries on a suitable model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages,
      },
      { signal: opts.signal },
    );
    let chars = 0;
    let thinking = "";
    stream.on("text", (delta) => {
      chars += delta.length;
      opts.onProgress?.({ chars, thinking: thinking || undefined });
    });
    stream.on("thinking", (delta) => {
      thinking = (thinking + delta).slice(-400);
      opts.onProgress?.({ chars, thinking });
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") throw new ClaudeError("refused", "Refused");
    const text = message.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const inputTokens = message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0);
    const outputTokens = message.usage.output_tokens;
    return {
      text,
      model: message.model,
      inputTokens,
      outputTokens,
      cost: estimateCost(message.model, inputTokens, outputTokens),
      truncated: message.stop_reason === "max_tokens",
      // Keep the whole assistant turn (thinking blocks included) for a repair round.
      messages: [...messages, { role: "assistant", content: message.content }],
    };
  } catch (err) {
    throw classify(err, opts.signal);
  }
}

/** Cheap call to check that a key works (settings page). */
export async function testKey(apiKey: string, model: string): Promise<true | ClaudeError> {
  try {
    await client(apiKey).models.retrieve(model);
    return true;
  } catch (err) {
    return classify(err);
  }
}

export { fileToBase64, shrinkImage } from "@/ui/images";
