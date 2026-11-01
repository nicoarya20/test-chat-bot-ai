import { Hono } from "hono";
import { adminKeyRoutes } from "./admin/admin-keys.routes";
import { adminSettingsRoutes } from "./admin/admin-settings.routes";
import { adminUserRoutes } from "./admin/admin-users.routes";
import { chatRoutes } from "./chat/chat.routes";
import type { ChatService } from "./chat/chat.service";
import { conversationRoutes } from "./chat/conversations.routes";
import type { Database } from "./db/client";
import type { AppEnv, ResolveUserId } from "./http/app.types";
import { meRoutes } from "./http/me.routes";
import { requireAdmin, requireApproved, requireUser } from "./http/session.middleware";
import { log } from "./logging/logger";
import { CatalogUnavailableError, type ModelCatalog } from "./models/model.catalog";
import { adminModelRoutes, userModelRoutes } from "./models/models.routes";
import { adminUsageRoutes, meUsageRoutes } from "./usage/usage.routes";
import type { QuotaConfig } from "./quota/quota.service";

export interface AppDeps {
  db: Database;
  chat: ChatService;
  catalog: ModelCatalog;
  quota: QuotaConfig;
  encryptionKey: string;
  resolveUserId: ResolveUserId;
  /** Better Auth request handler mounted at /api/auth/*. */
  authHandler: (request: Request) => Promise<Response>;
}

/** Builds the HTTP app; all dependencies are injected so tests can fake auth and the model. */
export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>().basePath("/api");

  app.on(["GET", "POST"], "/auth/*", (c) => deps.authHandler(c.req.raw));
  app.get("/health", (c) => c.json({ ok: true }));

  const authed = requireUser(deps.db, deps.resolveUserId);
  app.use("/me/*", authed);
  app.use("/conversations/*", authed, requireApproved);
  app.use("/models/*", authed, requireApproved);
  app.use("/admin/*", authed, requireAdmin);

  app.route("/me/usage", meUsageRoutes(deps.db, deps.quota));
  app.route("/me", meRoutes(deps.db, deps.quota));
  app.route("/models", userModelRoutes(deps.db, deps.catalog));
  app.route("/conversations", conversationRoutes(deps.db, deps.catalog));
  app.route("/conversations", chatRoutes(deps.chat));
  app.route("/admin/users", adminUserRoutes(deps.db, deps.quota));
  app.route("/admin/settings", adminSettingsRoutes(deps.db, deps.catalog));
  app.route("/admin/keys", adminKeyRoutes(deps.db, deps.encryptionKey));
  app.route("/admin/models", adminModelRoutes(deps.db, deps.catalog));
  app.route("/admin/usage", adminUsageRoutes(deps.db, deps.quota));

  app.onError((error, c) => {
    if (error instanceof CatalogUnavailableError) {
      log.warn("model catalog unavailable", { path: c.req.path, reason: error.message });
      return c.json({ error: "catalog_unavailable" }, 503);
    }
    log.error("unhandled request error", { path: c.req.path, reason: error.message });
    return c.json({ error: "internal_error" }, 500);
  });
  return app;
}
