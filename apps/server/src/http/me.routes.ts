import { Hono } from "hono";
import type { Database } from "../db/client";
import { getQuotaStatus, type QuotaConfig } from "../quota/quota.service";
import type { AppEnv } from "./app.types";

/** GET /me — current user and, for approved users, their quota status. */
export function meRoutes(db: Database, quota: QuotaConfig) {
  return new Hono<AppEnv>().get("/", async (c) => {
    const current = c.get("currentUser");
    const quotaStatus = current.status === "approved" ? await getQuotaStatus(db, current.id, quota) : null;
    return c.json({ user: current, quota: quotaStatus });
  });
}
