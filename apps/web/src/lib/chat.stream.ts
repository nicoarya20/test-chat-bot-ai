import type { ChatErrorPayload, QuotaStatus } from "./api.types";
import { createSseParser } from "./sse.parser";

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone: (result: { messageId: string; quota: QuotaStatus; model: string; fellBack: boolean }) => void;
  onError: (error: ChatErrorPayload) => void;
}

/** Sends a message and dispatches the SSE reply (delta/done/error) to the handlers. */
export async function streamMessage(conversationId: string, text: string, handlers: StreamHandlers): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch {
    // fetch only rejects on network failure; surfaced to the user as a network error.
    handlers.onError({ code: "network", details: null });
    return;
  }
  if (!response.ok || !response.body) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    handlers.onError({ code: body?.error ?? `http_${response.status}`, details: null });
    return;
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  const push = createSseParser();
  let finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    for (const message of push(value)) {
      const data = JSON.parse(message.data);
      if (message.event === "delta") handlers.onDelta(data.text);
      else if (message.event === "done") { finished = true; handlers.onDone(data); }
      else if (message.event === "error") { finished = true; handlers.onError(data); }
    }
  }
  if (!finished) handlers.onError({ code: "network", details: null });
}
