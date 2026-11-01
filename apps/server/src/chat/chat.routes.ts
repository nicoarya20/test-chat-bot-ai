import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import type { AppEnv } from "../http/app.types";
import { log } from "../logging/logger";
import { ChatError } from "./chat.errors";
import type { ChatService } from "./chat.service";

export const MESSAGE_MAX_LENGTH = 100_000;
// Keeps the connection alive while the model thinks before its first token.
const KEEPALIVE_MS = 15_000;
const idParam = z.object({ id: z.string().uuid() });
const sendBody = z.object({ text: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH) });

/** POST /:id/messages — streams the reply as SSE events: delta, done, error. */
export function chatRoutes(chat: ChatService) {
  return new Hono<AppEnv>().post("/:id/messages", zValidator("param", idParam), zValidator("json", sendBody), (c) => {
    const userId = c.get("currentUser").id;
    const conversationId = c.req.valid("param").id;
    const { text } = c.req.valid("json");

    return streamSSE(c, async (stream) => {
      // Writes are chained to keep order; the reply keeps generating (and is
      // saved) even if the client disconnects, so failed writes are only logged.
      let queue = Promise.resolve();
      const send = (event: string, data: unknown) => {
        queue = queue
          .then(() => (stream.aborted ? undefined : stream.writeSSE({ event, data: JSON.stringify(data) })))
          .catch((error: unknown) => {
            log.debug("sse write failed", { conversationId, reason: error instanceof Error ? error.message : String(error) });
          });
      };
      const keepalive = setInterval(() => send("ping", {}), KEEPALIVE_MS);
      try {
        const result = await chat.sendMessage({
          userId, conversationId, text, onText: (delta) => send("delta", { text: delta }),
        });
        send("done", { messageId: result.assistantMessageId, finishReason: result.finishReason, quota: result.quota });
      } catch (error) {
        if (error instanceof ChatError) {
          send("error", { code: error.code, details: error.details ?? null });
        } else {
          log.error("unexpected chat failure", {
            userId, conversationId, reason: error instanceof Error ? error.message : String(error),
          });
          send("error", { code: "upstream_error", details: null });
        }
      } finally {
        clearInterval(keepalive);
        await queue;
      }
    });
  });
}
