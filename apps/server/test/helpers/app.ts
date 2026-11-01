import { randomBytes } from "node:crypto";
import { createApp } from "../../src/app";
import { createChatService } from "../../src/chat/chat.service";
import { FakeGateway } from "./fake.gateway";
import { testDb } from "./db";

export const TEST_USER_HEADER = "x-test-user";
export const testQuota = { tzOffsetMinutes: 420, sessionWindowHours: 5 };
export const testEncryptionKey = randomBytes(32).toString("base64"); // test-only

/** App wired to the test DB, a fake model and header-based auth. */
export function buildTestApp() {
  const db = testDb();
  const gateway = new FakeGateway();
  const chat = createChatService(db, gateway, {
    encryptionKey: testEncryptionKey, quota: testQuota,
    minOutputTokens: 4096, maxOutputTokens: 64000, reasoningEffort: "low",
  });
  const app = createApp({
    db, chat, quota: testQuota, encryptionKey: testEncryptionKey,
    resolveUserId: async (headers) => headers.get(TEST_USER_HEADER),
    authHandler: async () => new Response("auth stub", { status: 200 }),
  });

  function request(path: string, userId: string | null, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (userId) headers.set(TEST_USER_HEADER, userId);
    if (init.body) headers.set("content-type", "application/json");
    return app.request(`/api${path}`, { ...init, headers });
  }
  return { app, db, gateway, request };
}

// any: test-only parsed JSON; each assertion checks the fields it needs.
export interface SseEvent { event: string; data: any }

/** Parses an SSE response body into events (ignores keepalive pings). */
export async function readSse(response: Response): Promise<SseEvent[]> {
  const raw = await response.text();
  return raw.split("\n\n").filter(Boolean).flatMap((chunk) => {
    const event = /^event: (.*)$/m.exec(chunk)?.[1];
    const data = /^data: (.*)$/m.exec(chunk)?.[1];
    if (!event || data === undefined || event === "ping") return [];
    return [{ event, data: JSON.parse(data) }];
  });
}
