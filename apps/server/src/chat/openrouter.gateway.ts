import { log } from "../logging/logger";
import { createSseParser } from "./sse.parser";

export const REASONING_EFFORTS = ["low", "medium", "high"] as const;
export type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ModelCallInput {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatTurn[];
  maxTokens: number;
  /** Omitted = don't send `reasoning` (not every model accepts it). */
  reasoningEffort?: ReasoningEffort;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface ModelCallResult {
  text: string;
  /** OpenRouter finish_reason: stop | length | content_filter | tool_calls | error | null */
  finishReason: string | null;
  usage: ModelUsage;
}

/** Streams one model reply, reporting text deltas, and resolves with the final result. */
export interface ChatModelGateway {
  stream(input: ModelCallInput, onText: (delta: string) => void): Promise<ModelCallResult>;
}

/** Non-2xx or in-stream error from OpenRouter; `status` follows its HTTP error codes. */
export class UpstreamError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "UpstreamError";
  }
}

interface StreamChunk {
  error?: { code?: number | string; message?: string };
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

// Rough chars-per-token ratio, used only if OpenRouter omits the usage chunk.
const CHARS_PER_TOKEN_ESTIMATE = 4;

export interface OpenRouterConfig {
  baseUrl: string;
  timeoutMs: number;
  fetchFn?: typeof fetch;
}

async function readError(response: Response): Promise<UpstreamError> {
  const body = (await response.json().catch(() => null)) as StreamChunk | null;
  const message = body?.error?.message ?? response.statusText;
  return new UpstreamError(response.status, `OpenRouter ${response.status}: ${message}`);
}

/** OpenRouter Chat Completions gateway (SSE streaming, usage from the final chunk). */
export function createOpenRouterGateway(config: OpenRouterConfig): ChatModelGateway {
  const fetchFn = config.fetchFn ?? fetch;

  return {
    async stream(input, onText) {
      const messages = [
        ...(input.system ? [{ role: "system" as const, content: input.system }] : []),
        ...input.messages,
      ];
      const response = await fetchFn(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${input.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: input.model,
          messages,
          stream: true,
          max_tokens: input.maxTokens,
          usage: { include: true },
          ...(input.reasoningEffort ? { reasoning: { effort: input.reasoningEffort, exclude: true } } : {}),
        }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      if (!response.ok || !response.body) throw await readError(response);

      const push = createSseParser();
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";
      let finishReason: string | null = null;
      let usage: StreamChunk["usage"] | undefined;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        for (const message of push(value)) {
          if (message.data === "[DONE]") continue;
          const chunk = JSON.parse(message.data) as StreamChunk;
          if (chunk.error) {
            const status = typeof chunk.error.code === "number" ? chunk.error.code : 502;
            throw new UpstreamError(status, `OpenRouter stream error: ${chunk.error.message ?? "unknown"}`);
          }
          const choice = chunk.choices?.[0];
          const delta = choice?.delta?.content;
          if (delta) { text += delta; onText(delta); }
          if (choice?.finish_reason) finishReason = choice.finish_reason;
          if (chunk.usage) usage = chunk.usage;
        }
      }

      if (!usage) {
        log.warn("openrouter usage missing; estimating", { model: input.model });
        const promptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
        usage = {
          prompt_tokens: Math.ceil(promptChars / CHARS_PER_TOKEN_ESTIMATE),
          completion_tokens: Math.ceil(text.length / CHARS_PER_TOKEN_ESTIMATE),
        };
      }
      return {
        text,
        finishReason,
        usage: {
          inputTokens: usage.prompt_tokens ?? 0,
          outputTokens: usage.completion_tokens ?? 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
      };
    },
  };
}
