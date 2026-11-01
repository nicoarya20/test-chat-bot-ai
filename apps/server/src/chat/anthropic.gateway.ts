import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlock, BetaMessageParam, BetaStopReason,
} from "@anthropic-ai/sdk/resources/beta/messages";
import type { EFFORT_LEVELS } from "../config/env";

/** Models an admin may pick; all accept adaptive thinking and output_config.effort. */
export const SUPPORTED_MODELS = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
  "claude-fable-5-1",
] as const;
export type SupportedModel = (typeof SUPPORTED_MODELS)[number];

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set<string>(["claude-opus-5-5", "claude-sonnet-5-5", "claude-fable-5-1"]);
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export interface ModelCallInput {
  apiKey: string;
  model: string;
  system: string;
  messages: BetaMessageParam[];
  maxTokens: number;
  effort: (typeof EFFORT_LEVELS)[number];
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface ModelCallResult {
  content: BetaContentBlock[];
  text: string;
  stopReason: BetaStopReason | null;
  usage: ModelUsage;
}

/** Streams one model reply, reporting text deltas, and resolves with the final message. */
export interface ChatModelGateway {
  stream(input: ModelCallInput, onText: (delta: string) => void): Promise<ModelCallResult>;
}

/** Concatenates the text blocks of a reply for display. */
export function extractText(content: BetaContentBlock[]): string {
  return content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
}

/** Gateway backed by the official Anthropic SDK (beta namespace for fallbacks). */
export class AnthropicGateway implements ChatModelGateway {
  async stream(input: ModelCallInput, onText: (delta: string) => void): Promise<ModelCallResult> {
    const client = new Anthropic({ apiKey: input.apiKey });
    const useFallback = FALLBACK_MODELS.has(input.model);
    const stream = client.beta.messages.stream({
      model: input.model,
      max_tokens: input.maxTokens,
      // Thinking left unset: these models run adaptive thinking by default.
      output_config: { effort: input.effort },
      // Auto-cache the growing conversation prefix across turns.
      cache_control: { type: "ephemeral" },
      ...(input.system ? { system: input.system } : {}),
      messages: input.messages,
      ...(useFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
    });
    stream.on("text", onText);
    const message = await stream.finalMessage();
    return {
      content: message.content,
      text: extractText(message.content),
      stopReason: message.stop_reason,
      usage: {
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        cacheCreationTokens: message.usage.cache_creation_input_tokens ?? 0,
        cacheReadTokens: message.usage.cache_read_input_tokens ?? 0,
      },
    };
  }
}
