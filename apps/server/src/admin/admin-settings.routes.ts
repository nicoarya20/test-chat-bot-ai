import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import { DEFAULT_MODEL } from "../db/schema";
import type { AppEnv } from "../http/app.types";
import { getSettings, updateSettings } from "../settings/settings.repository";
import { TOKEN_LIMIT_MAX } from "./admin-users.routes";

export const SYSTEM_PROMPT_MAX_LENGTH = 20_000;
// OpenRouter slug: "<provider>/<model>" with an optional ":variant" (e.g. ":free").
export const MODEL_SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*(:[a-z0-9._-]+)?$/i;
const limit = z.number().int().min(0).max(TOKEN_LIMIT_MAX);
const settingsBody = z.object({
  model: z.string().trim().max(200).regex(MODEL_SLUG_PATTERN, "Expected an OpenRouter model slug").optional(),
  systemPrompt: z.string().max(SYSTEM_PROMPT_MAX_LENGTH).optional(),
  defaultSessionTokenLimit: limit.optional(),
  defaultWeeklyTokenLimit: limit.optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "No fields to update" });

/** Admin chat settings; model and system prompt apply from the next message on. */
export function adminSettingsRoutes(db: Database) {
  return new Hono<AppEnv>()
    .get("/", async (c) => c.json({ settings: await getSettings(db), defaultModel: DEFAULT_MODEL }))
    .put("/", zValidator("json", settingsBody), async (c) => {
      return c.json({ settings: await updateSettings(db, c.req.valid("json")) });
    });
}
