import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import type { Database } from "../db/client";
import { user } from "../db/schema";
import type { AppEnv, ResolveUserId } from "./app.types";

/** Loads the signed-in user from the DB (fresh role/status each request) or returns 401. */
export function requireUser(db: Database, resolveUserId: ResolveUserId) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const userId = await resolveUserId(c.req.raw.headers);
    if (!userId) return c.json({ error: "unauthenticated" }, 401);
    const [row] = await db.select({
      id: user.id, name: user.name, email: user.email, image: user.image, role: user.role, status: user.status,
    }).from(user).where(eq(user.id, userId));
    if (!row) return c.json({ error: "unauthenticated" }, 401);
    c.set("currentUser", row);
    await next();
  });
}

/** Allows only approved accounts. */
export const requireApproved = createMiddleware<AppEnv>(async (c, next) => {
  const status = c.get("currentUser").status;
  if (status !== "approved") return c.json({ error: "not_approved", status }, 403);
  await next();
});

/** Allows only approved admins. */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const current = c.get("currentUser");
  if (current.role !== "admin" || current.status !== "approved") return c.json({ error: "forbidden" }, 403);
  await next();
});
