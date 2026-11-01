import { sql } from "drizzle-orm";
import { createDb, type Database } from "../../src/db/client";
import { user } from "../../src/db/schema";

let cached: ReturnType<typeof createDb> | null = null;

/** Shared connection to TEST_DATABASE_URL. */
export function testDb(): Database {
  if (!cached) cached = createDb(process.env.TEST_DATABASE_URL!);
  return cached.db;
}

/** Empties every table and restores default settings. */
export async function resetDb(): Promise<void> {
  const db = testDb();
  await db.execute(sql`TRUNCATE allowed_models, usage_logs, messages, conversations, provider_keys, session, account, verification, "user" CASCADE`);
  await db.execute(sql`UPDATE app_settings SET model = 'nvidia/nemotron-3-ultra-550b-a55b:free', system_prompt = '',
    default_session_token_limit = 50000, default_weekly_token_limit = 500000 WHERE id = 1`);
}

let counter = 0;

/** Inserts a user; defaults to an approved regular user. */
export async function createUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  counter += 1;
  const [row] = await testDb().insert(user).values({
    id: `user-${counter}-${Date.now()}`,
    name: `Test User ${counter}`, // test-only
    email: `user${counter}-${Date.now()}@example.test`, // test-only
    status: "approved",
    ...overrides,
  }).returning();
  return row!;
}
