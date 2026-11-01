import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import type { AppEnv } from "../http/app.types";
import { pageQuery } from "../http/pagination";
import {
  createConversation, deleteConversation, getConversation, listConversations, listMessages, renameConversation,
} from "./conversations.repository";

export const TITLE_MAX_LENGTH = 80;
const idParam = z.object({ id: z.string().uuid() });
const titleBody = z.object({ title: z.string().trim().min(1).max(500) });
const MESSAGE_PAGE_MAX = 200;
const messagePageQuery = pageQuery.extend({
  limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_MAX).default(MESSAGE_PAGE_MAX),
});

/** Conversation CRUD for the signed-in user. */
export function conversationRoutes(db: Database) {
  return new Hono<AppEnv>()
    .get("/", zValidator("query", pageQuery), async (c) => {
      const items = await listConversations(db, c.get("currentUser").id, c.req.valid("query"));
      return c.json({ items });
    })
    .post("/", zValidator("json", titleBody), async (c) => {
      const conversation = await createConversation(db, {
        userId: c.get("currentUser").id,
        title: c.req.valid("json").title.slice(0, TITLE_MAX_LENGTH),
      });
      return c.json({ id: conversation.id, title: conversation.title, updatedAt: conversation.updatedAt }, 201);
    })
    .get("/:id/messages", zValidator("param", idParam), zValidator("query", messagePageQuery), async (c) => {
      const { id } = c.req.valid("param");
      const conversation = await getConversation(db, c.get("currentUser").id, id);
      if (!conversation) return c.json({ error: "not_found" }, 404);
      const items = await listMessages(db, id, c.req.valid("query"));
      return c.json({ conversation: { id, title: conversation.title }, items });
    })
    .patch("/:id", zValidator("param", idParam), zValidator("json", titleBody), async (c) => {
      const ok = await renameConversation(db, c.get("currentUser").id, c.req.valid("param").id,
        c.req.valid("json").title.slice(0, TITLE_MAX_LENGTH));
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    })
    .delete("/:id", zValidator("param", idParam), async (c) => {
      const ok = await deleteConversation(db, c.get("currentUser").id, c.req.valid("param").id);
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    });
}
