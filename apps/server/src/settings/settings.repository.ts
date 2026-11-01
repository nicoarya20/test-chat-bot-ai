import { eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { appSettings } from "../db/schema";

export type AppSettings = typeof appSettings.$inferSelect;
export type SettingsPatch = Partial<Pick<AppSettings,
  "model" | "systemPrompt" | "defaultSessionTokenLimit" | "defaultWeeklyTokenLimit">>;

const SETTINGS_ID = 1;

/** Reads the singleton settings row (seeded by the initial migration). */
export async function getSettings(db: Database): Promise<AppSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.id, SETTINGS_ID));
  if (!row) throw new Error("app_settings row is missing; run database migrations");
  return row;
}

/** Applies a partial update to the settings row and returns the new values. */
export async function updateSettings(db: Database, patch: SettingsPatch): Promise<AppSettings> {
  const [row] = await db
    .update(appSettings)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(appSettings.id, SETTINGS_ID))
    .returning();
  if (!row) throw new Error("app_settings row is missing; run database migrations");
  return row;
}
