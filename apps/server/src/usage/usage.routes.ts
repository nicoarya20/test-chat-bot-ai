import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { Database } from "../db/client";
import type { AppEnv } from "../http/app.types";
import { requireApproved } from "../http/session.middleware";
import { getQuotaStatus, type QuotaConfig } from "../quota/quota.service";
import { getDailyUsage, getTopUsers, getUsageByModel, getUsageTotals } from "./usage.repository";

export const USAGE_MAX_DAYS = 90;
const DEFAULT_DAYS = 30;
const rangeQuery = z.object({ days: z.coerce.number().int().min(1).max(USAGE_MAX_DAYS).default(DEFAULT_DAYS) });

/** GET /me/usage — the signed-in user's own token usage and quota. */
export function meUsageRoutes(db: Database, quota: QuotaConfig) {
  return new Hono<AppEnv>().get("/", requireApproved, zValidator("query", rangeQuery), async (c) => {
    const { days } = c.req.valid("query");
    const userId = c.get("currentUser").id;
    const q = { userId, days, tzOffsetMinutes: quota.tzOffsetMinutes };
    const [quotaStatus, totals, daily, byModel] = await Promise.all([
      getQuotaStatus(db, userId, quota), getUsageTotals(db, q), getDailyUsage(db, q), getUsageByModel(db, q),
    ]);
    return c.json({ days, quota: quotaStatus, totals, daily, byModel });
  });
}

/** GET /admin/usage — token usage across all users. */
export function adminUsageRoutes(db: Database, quota: QuotaConfig) {
  return new Hono<AppEnv>().get("/", zValidator("query", rangeQuery), async (c) => {
    const { days } = c.req.valid("query");
    const q = { days, tzOffsetMinutes: quota.tzOffsetMinutes };
    const [totals, daily, byModel, topUsers] = await Promise.all([
      getUsageTotals(db, q), getDailyUsage(db, q), getUsageByModel(db, q), getTopUsers(db, q),
    ]);
    return c.json({ days, totals, daily, byModel, topUsers });
  });
}
