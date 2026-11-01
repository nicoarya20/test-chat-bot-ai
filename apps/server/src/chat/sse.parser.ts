// Mirrors apps/web/src/lib/sse.parser.ts (separate packages, no shared lib yet).
export interface SseMessage {
  event: string;
  data: string;
}

/**
 * Incremental SSE parser: feed raw text chunks, get complete messages back.
 * Handles events split across chunks and CRLF line endings.
 */
export function createSseParser() {
  let buffer = "";
  return function push(chunk: string): SseMessage[] {
    buffer += chunk.replace(/\r\n/g, "\n");
    const messages: SseMessage[] = [];
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (data.length > 0) messages.push({ event, data: data.join("\n") });
      boundary = buffer.indexOf("\n\n");
    }
    return messages;
  };
}
