import { describe, expect, it } from "bun:test";
import { createSseParser } from "../src/lib/sse.parser";

describe("createSseParser", () => {
  it("parses complete events", () => {
    const push = createSseParser();
    expect(push('event: delta\ndata: {"text":"hi"}\n\n')).toEqual([{ event: "delta", data: '{"text":"hi"}' }]);
  });

  it("buffers events split across chunks", () => {
    const push = createSseParser();
    expect(push("event: del")).toEqual([]);
    expect(push('ta\ndata: {"a"')).toEqual([]);
    expect(push(":1}\n\nevent: done\ndata: {}\n\n")).toEqual([
      { event: "delta", data: '{"a":1}' },
      { event: "done", data: "{}" },
    ]);
  });

  it("normalizes CRLF line endings", () => {
    const push = createSseParser();
    expect(push("event: ping\r\ndata: {}\r\n\r\n")).toEqual([{ event: "ping", data: "{}" }]);
  });

  it("defaults the event name and joins multi-line data", () => {
    const push = createSseParser();
    expect(push("data: a\ndata: b\n\n")).toEqual([{ event: "message", data: "a\nb" }]);
  });

  it("ignores blocks without data", () => {
    const push = createSseParser();
    expect(push(": comment\n\n")).toEqual([]);
  });
});
