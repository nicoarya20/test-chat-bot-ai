import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import { USER_ROLES, USER_STATUSES } from "../db/schema";
import type { AppEnv } from "../http/app.types";
import { pageQuery } from "../http/pagination";
import type { QuotaConfig } from "../quota/quota.service";
import { listUsersWithUsage, updateUser } from "../users/users.repository";

export const TOKEN_LIMIT_MAX = 1_000_000_000;
const tokenLimit = z.number().int().min(0).max(TOKEN_LIMIT_MAX).nullable();
const listQuery = pageQuery.extend({ status: z.enum(USER_STATUSES).optional() });
const patchBody = z.object({
  status: z.enum(USER_STATUSES).optional(),
  role: z.enum(USER_ROLES).optional(),
  sessionTokenLimit: tokenLimit.optional(),
  weeklyTokenLimit: tokenLimit.optional(),
}).refine((b) => Object.keys(b).length > 0, { message: "No fields to update" });

/** Admin user management: list with usage, approve/reject, set role and limits. */
export function adminUserRoutes(db: Database, quota: QuotaConfig) {
  return new Hono<AppEnv>()
    .get("/", zValidator("query", listQuery), async (c) => {
      const result = await listUsersWithUsage(db, c.req.valid("query"), quota);
      return c.json(result);
    })
    .patch("/:id", zValidator("json", patchBody), async (c) => {
      const id = c.req.param("id");
      const patch = c.req.valid("json");
      const changesOwnAccess = patch.role !== undefined || patch.status !== undefined;
      if (id === c.get("currentUser").id && changesOwnAccess) {
        return c.json({ error: "cannot_change_own_access" }, 400);
      }
      const ok = await updateUser(db, id, patch);
      return ok ? c.json({ ok: true }) : c.json({ error: "not_found" }, 404);
    });
}
