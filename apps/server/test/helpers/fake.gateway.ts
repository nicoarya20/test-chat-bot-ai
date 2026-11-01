import type { ChatModelGateway, ModelCallInput, ModelCallResult } from "../../src/chat/openrouter.gateway";

/** Scriptable stand-in for the OpenRouter gateway; records every call. */
export class FakeGateway implements ChatModelGateway {
  calls: ModelCallInput[] = [];
  next: Partial<ModelCallResult> & { deltas?: string[]; error?: Error } = {};

  async stream(input: ModelCallInput, onText: (delta: string) => void): Promise<ModelCallResult> {
    this.calls.push(structuredClone(input));
    const { deltas = ["Halo", " dunia"], error, ...rest } = this.next;
    if (error) throw error;
    for (const d of deltas) onText(d);
    return {
      text: deltas.join(""),
      finishReason: rest.finishReason ?? "stop",
      usage: rest.usage ?? { inputTokens: 100, outputTokens: 50, cacheCreationTokens: 0, cacheReadTokens: 0 },
    };
  }
}
