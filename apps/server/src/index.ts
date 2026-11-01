import { createApp } from "./app";
import { createAuth } from "./auth/auth";
import { AnthropicGateway } from "./chat/anthropic.gateway";
import { createChatService } from "./chat/chat.service";
import { loadEnv } from "./config/env";
import { createDb } from "./db/client";
import { log } from "./logging/logger";

// Bun's maximum; SSE replies can idle while the model thinks (keepalive pings help too).
const IDLE_TIMEOUT_SECONDS = 255;

const env = loadEnv();
const { db } = createDb(env.DATABASE_URL);
const auth = createAuth(db, env);
const quota = { tzOffsetMinutes: env.QUOTA_TZ_OFFSET_MINUTES, sessionWindowHours: env.SESSION_WINDOW_HOURS };

const chat = createChatService(db, new AnthropicGateway(), {
  encryptionKey: env.KEY_ENCRYPTION_KEY,
  quota,
  minOutputTokens: env.CHAT_MIN_OUTPUT_TOKENS,
  maxOutputTokens: env.CHAT_MAX_OUTPUT_TOKENS,
  effort: env.CHAT_EFFORT,
});

const app = createApp({
  db, chat, quota, encryptionKey: env.KEY_ENCRYPTION_KEY,
  authHandler: (request) => auth.handler(request),
  resolveUserId: async (headers) => (await auth.api.getSession({ headers }))?.user.id ?? null,
});

Bun.serve({ port: env.PORT, fetch: app.fetch, idleTimeout: IDLE_TIMEOUT_SECONDS });
log.info("server started", { port: env.PORT });
