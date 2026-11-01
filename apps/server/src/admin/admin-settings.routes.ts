import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { SUPPORTED_MODELS } from "../chat/anthropic.gateway";
import type { Database } from "../db/client";
import type { AppEnv } from "../http/app.types";
import { getSettings, updateSettings } from "../settings/settings.repository";
import { TOKEN_LIMIT_MAX } from "./admin-users.routes";

export const SYSTEM_PROMPT_MAX_LENGTH = 20_000;
const limit = z.number().int().min(0).max(TOKEN_LIMIT_MAX);
const settingsBody = z.object({
  model: z.enum(SUPPORTED_MODELS).optional(),
  systemPrompt: z.string().max(SYSTEM_PROMPT_MAX_LENGTH).optional(),
  defaultSessionTokenLimit: limit.optional(),
  defaultWeeklyTokenLimit: limit.optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "No fields to update" });

/** Admin chat settings. Model/system prompt apply to new conversations only. */
export function adminSettingsRoutes(db: Database) {
  return new Hono<AppEnv>()
    .get("/", async (c) => c.json({ settings: await getSettings(db), supportedModels: SUPPORTED_MODELS }))
    .put("/", zValidator("json", settingsBody), async (c) => {
      return c.json({ settings: await updateSettings(db, c.req.valid("json")) });
    });
}
