import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import type { AppEnv } from "../http/app.types";
import { replaceAllowedModels } from "./allowed-models.repository";
import type { ModelCatalog } from "./model.catalog";
import { getModelChoices } from "./model.choices";

export const ALLOWED_MODELS_MAX = 50;
const allowedBody = z.object({ models: z.array(z.string().trim().min(1).max(200)).max(ALLOWED_MODELS_MAX) });

/** GET /models — models the signed-in user may pick for a conversation. */
export function userModelRoutes(db: Database, catalog: ModelCatalog) {
  return new Hono<AppEnv>().get("/", async (c) => {
    const choices = await getModelChoices(db, catalog);
    return c.json({ models: choices.usable, defaultModel: choices.defaultModel });
  });
}

/** Admin view of every free model plus the user allowlist; only free models can be allowed. */
export function adminModelRoutes(db: Database, catalog: ModelCatalog) {
  return new Hono<AppEnv>()
    .get("/", async (c) => {
      const { free, allowed, defaultModel } = await getModelChoices(db, catalog);
      return c.json({ free, allowed, defaultModel });
    })
    .put("/allowed", zValidator("json", allowedBody), async (c) => {
      const { models } = c.req.valid("json");
      const { freeIds } = await getModelChoices(db, catalog);
      const notFree = models.filter((m) => !freeIds.has(m));
      if (notFree.length > 0) return c.json({ error: "model_not_free", models: notFree }, 400);
      const allowed = await replaceAllowedModels(db, models, c.get("currentUser").id);
      return c.json({ allowed });
    });
}
