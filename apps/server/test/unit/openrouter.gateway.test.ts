import { describe, expect, it } from "bun:test";
import { createOpenRouterGateway, UpstreamError, type ModelCallInput } from "../../src/chat/openrouter.gateway";

const BASE = "https://openrouter.test/api/v1"; // test-only
const input: ModelCallInput = {
  apiKey: "sk-or-test", model: "nvidia/nemotron-3-ultra-550b-a55b:free", system: "Be brief.", // test-only
  messages: [{ role: "user", content: "Hai" }], maxTokens: 4096,
};

function sse(...events: string[]): Response {
  const body = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      // Split each event mid-way to exercise chunk buffering.
      for (const e of events) {
        const half = Math.floor(e.length / 2);
        controller.enqueue(enc.encode(e.slice(0, half)));
        controller.enqueue(enc.encode(e.slice(half)));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}
const data = (obj: unknown) => `data: ${JSON.stringify(obj)}\n\n`;

function gatewayWith(response: Response | (() => Response)) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    return typeof response === "function" ? response() : response;
  }) as unknown as typeof fetch;
  return { gateway: createOpenRouterGateway({ baseUrl: BASE, timeoutMs: 5000, fetchFn }), requests };
}

describe("OpenRouter gateway", () => {
  it("sends an authenticated streaming chat completion with system first", async () => {
    const { gateway, requests } = gatewayWith(sse(data({ choices: [{ delta: { content: "x" }, finish_reason: "stop" }] }), "data: [DONE]\n\n"));
    await gateway.stream({ ...input, reasoningEffort: "medium" }, () => {});
    const { url, init } = requests[0]!;
    expect(url).toBe(`${BASE}/chat/completions`);
    expect(new Headers(init.headers).get("authorization")).toBe("Bearer sk-or-test");
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({
      model: input.model, stream: true, max_tokens: 4096, usage: { include: true },
      reasoning: { effort: "medium", exclude: true },
      messages: [{ role: "system", content: "Be brief." }, { role: "user", content: "Hai" }],
    });
  });

  it("omits system and reasoning when not set", async () => {
    const { gateway, requests } = gatewayWith(sse("data: [DONE]\n\n"));
    await gateway.stream({ ...input, system: "" }, () => {});
    const body = JSON.parse(String(requests[0]!.init.body));
    expect(body.messages).toEqual([{ role: "user", content: "Hai" }]);
    expect(body).not.toHaveProperty("reasoning");
  });

  it("streams content deltas, ignores keepalive comments, and reads final usage", async () => {
    const { gateway } = gatewayWith(sse(
      ": OPENROUTER PROCESSING\n\n",
      data({ choices: [{ delta: { role: "assistant", content: "" } }] }),
      data({ choices: [{ delta: { content: "Halo" } }] }),
      data({ choices: [{ delta: { reasoning: "hmm", content: null } }] }),
      data({ choices: [{ delta: { content: " dunia" }, finish_reason: "stop" }] }),
      data({ choices: [], usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 } }),
      "data: [DONE]\n\n",
    ));
    const deltas: string[] = [];
    const result = await gateway.stream(input, (d) => deltas.push(d));
    expect(deltas).toEqual(["Halo", " dunia"]);
    expect(result).toEqual({
      text: "Halo dunia", finishReason: "stop",
      usage: { inputTokens: 12, outputTokens: 34, cacheCreationTokens: 0, cacheReadTokens: 0 },
    });
  });

  it("estimates usage when the usage chunk is missing (never records zero)", async () => {
    const { gateway } = gatewayWith(sse(data({ choices: [{ delta: { content: "12345678" }, finish_reason: "stop" }] })));
    const result = await gateway.stream(input, () => {});
    expect(result.usage.outputTokens).toBe(2);
    expect(result.usage.inputTokens).toBeGreaterThan(0);
  });

  it("throws UpstreamError with the HTTP status on non-2xx", async () => {
    const { gateway } = gatewayWith(new Response(JSON.stringify({ error: { code: 402, message: "Insufficient credits" } }), { status: 402 }));
    const error = await gateway.stream(input, () => {}).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UpstreamError);
    expect(error).toMatchObject({ status: 402 });
    expect((error as Error).message).toContain("Insufficient credits");
  });

  it("throws UpstreamError on an in-stream error chunk", async () => {
    const { gateway } = gatewayWith(sse(
      data({ choices: [{ delta: { content: "par" } }] }),
      data({ error: { code: 502, message: "provider died" }, choices: [{ delta: { content: "" }, finish_reason: "error" }] }),
    ));
    const error = await gateway.stream(input, () => {}).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: "UpstreamError", status: 502 });
  });
});
