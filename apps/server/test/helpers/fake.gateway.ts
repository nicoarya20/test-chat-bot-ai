import type { BetaContentBlock } from "@anthropic-ai/sdk/resources/beta/messages";
import type { ChatModelGateway, ModelCallInput, ModelCallResult } from "../../src/chat/anthropic.gateway";

/** Scriptable stand-in for the Anthropic gateway; records every call. */
export class FakeGateway implements ChatModelGateway {
  calls: ModelCallInput[] = [];
  next: Partial<ModelCallResult> & { deltas?: string[]; error?: Error } = {};

  async stream(input: ModelCallInput, onText: (delta: string) => void): Promise<ModelCallResult> {
    this.calls.push(structuredClone(input));
    const { deltas = ["Halo", " dunia"], error, ...rest } = this.next;
    if (error) throw error;
    for (const d of deltas) onText(d);
    const text = deltas.join("");
    const content = rest.content ?? ([
      { type: "thinking", thinking: "", signature: "sig-test" },
      { type: "text", text, citations: null },
    ] as unknown as BetaContentBlock[]);
    return {
      content, text, stopReason: rest.stopReason ?? "end_turn",
      usage: rest.usage ?? { inputTokens: 100, outputTokens: 50, cacheCreationTokens: 0, cacheReadTokens: 0 },
    };
  }
}
