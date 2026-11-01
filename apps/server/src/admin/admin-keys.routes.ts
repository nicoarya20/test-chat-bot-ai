import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import type { AppEnv } from "../http/app.types";
import { encryptSecret, lastFour } from "../keys/key.cipher";
import { activateKey, createKey, deleteKey, listKeys } from "../keys/keys.repository";

const API_KEY_MIN_LENGTH = 20;
const idParam = z.object({ id: z.string().uuid() });
const createBody = z.object({
  label: z.string().trim().min(1).max(100),
  apiKey: z.string().trim().min(API_KEY_MIN_LENGTH).max(500),
});

/** Admin management of Anthropic API keys; secrets are write-only. */
export function adminKeyRoutes(db: Database, encryptionKey: string) {
  return new Hono<AppEnv>()
    .get("/", async (c) => c.json({ items: await listKeys(db) }))
    .post("/", zValidator("json", createBody), async (c) => {
      const { label, apiKey } = c.req.valid("json");
      const key = await createKey(db, {
        label, ciphertext: encryptSecret(apiKey, encryptionKey), last4: lastFour(apiKey),
        createdBy: c.get("currentUser").id,
      });
      return c.json({ key }, 201);
    })
    .post("/:id/activate", zValidator("param", idParam), async (c) => {
      const ok = await activateKey(db, c.req.valid("param").id);
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    })
    .delete("/:id", zValidator("param", idParam), async (c) => {
      const ok = await deleteKey(db, c.req.valid("param").id);
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    });
}
