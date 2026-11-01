import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import type { AppEnv } from "../http/app.types";
import { pageQuery } from "../http/pagination";
import type { ModelCatalog } from "../models/model.catalog";
import { getModelChoices } from "../models/model.choices";
import {
  createConversation, deleteConversation, getConversation, listConversations, listMessages, updateConversation,
} from "./conversations.repository";

export const TITLE_MAX_LENGTH = 80;
const idParam = z.object({ id: z.string().uuid() });
const title = z.string().trim().min(1).max(500);
// null = follow the admin default model.
const model = z.string().trim().min(1).max(200).nullable();
const createBody = z.object({ title, model: model.optional() });
const patchBody = z.object({ title: title.optional(), model: model.optional() })
  .refine((b) => b.title !== undefined || b.model !== undefined, { message: "No fields to update" });
const MESSAGE_PAGE_MAX = 200;
const messagePageQuery = pageQuery.extend({
  limit: z.coerce.number().int().min(1).max(MESSAGE_PAGE_MAX).default(MESSAGE_PAGE_MAX),
});

/** Conversation CRUD for the signed-in user; a chosen model must be one the user may pick. */
export function conversationRoutes(db: Database, catalog: ModelCatalog) {
  async function isSelectable(slug: string | null | undefined): Promise<boolean> {
    if (slug === null || slug === undefined) return true;
    const { usable } = await getModelChoices(db, catalog);
    return usable.some((m) => m.id === slug);
  }

  return new Hono<AppEnv>()
    .get("/", zValidator("query", pageQuery), async (c) => {
      const items = await listConversations(db, c.get("currentUser").id, c.req.valid("query"));
      return c.json({ items });
    })
    .post("/", zValidator("json", createBody), async (c) => {
      const body = c.req.valid("json");
      if (!(await isSelectable(body.model))) return c.json({ error: "model_not_allowed" }, 400);
      const conversation = await createConversation(db, {
        userId: c.get("currentUser").id, title: body.title.slice(0, TITLE_MAX_LENGTH), model: body.model ?? null,
      });
      return c.json({ id: conversation.id, title: conversation.title, model: conversation.model, updatedAt: conversation.updatedAt }, 201);
    })
    .get("/:id/messages", zValidator("param", idParam), zValidator("query", messagePageQuery), async (c) => {
      const { id } = c.req.valid("param");
      const conversation = await getConversation(db, c.get("currentUser").id, id);
      if (!conversation) return c.json({ error: "not_found" }, 404);
      const items = await listMessages(db, id, c.req.valid("query"));
      return c.json({ conversation: { id, title: conversation.title, model: conversation.model }, items });
    })
    .patch("/:id", zValidator("param", idParam), zValidator("json", patchBody), async (c) => {
      const body = c.req.valid("json");
      if (!(await isSelectable(body.model))) return c.json({ error: "model_not_allowed" }, 400);
      const ok = await updateConversation(db, c.get("currentUser").id, c.req.valid("param").id, {
        ...(body.title !== undefined && { title: body.title.slice(0, TITLE_MAX_LENGTH) }),
        ...(body.model !== undefined && { model: body.model }),
      });
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    })
    .delete("/:id", zValidator("param", idParam), async (c) => {
      const ok = await deleteConversation(db, c.get("currentUser").id, c.req.valid("param").id);
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    });
}
