import { and, eq, gte, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { timestamptz } from "../db/sql.timestamp";
import { usageLogs, user } from "../db/schema";
import { getSettings } from "../settings/settings.repository";
import {
  evaluateQuota, nextWeekReset, sessionWindow, weekStart, type QuotaDecision,
} from "./quota.window";

export interface QuotaConfig {
  tzOffsetMinutes: number;
  sessionWindowHours: number;
}

export interface QuotaStatus extends QuotaDecision {
  sessionLimit: number;
  weeklyLimit: number;
  sessionUsed: number;
  weeklyUsed: number;
  sessionResetAt: Date | null;
  weeklyResetAt: Date;
}

/** Computes a user's current 5-hour and weekly usage against their limits. */
export async function getQuotaStatus(
  db: Database, userId: string, config: QuotaConfig, now: Date = new Date(),
): Promise<QuotaStatus> {
  const [row] = await db.select({
    sessionTokenLimit: user.sessionTokenLimit,
    weeklyTokenLimit: user.weeklyTokenLimit,
    sessionWindowStartedAt: user.sessionWindowStartedAt,
  }).from(user).where(eq(user.id, userId));
  if (!row) throw new Error(`Cannot compute quota: user ${userId} not found`);

  const settings = await getSettings(db);
  const window = sessionWindow(row.sessionWindowStartedAt, now, config.sessionWindowHours);
  const weekFrom = weekStart(now, config.tzOffsetMinutes);
  // A 5-hour window may straddle the Monday reset, so scan from the earlier bound.
  const scanFrom = window.startedAt && window.startedAt < weekFrom ? window.startedAt : weekFrom;
  const sessionFilter = window.startedAt
    ? sql`coalesce(sum(${usageLogs.totalTokens}) filter (where ${usageLogs.createdAt} >= ${timestamptz(window.startedAt)}), 0)::int`
    : sql`0`;

  const [usage] = await db.select({
    weeklyUsed: sql<number>`coalesce(sum(${usageLogs.totalTokens}) filter (where ${usageLogs.createdAt} >= ${timestamptz(weekFrom)}), 0)::int`,
    sessionUsed: sql<number>`${sessionFilter}`,
  }).from(usageLogs).where(and(eq(usageLogs.userId, userId), gte(usageLogs.createdAt, scanFrom)));

  const sessionLimit = row.sessionTokenLimit ?? settings.defaultSessionTokenLimit;
  const weeklyLimit = row.weeklyTokenLimit ?? settings.defaultWeeklyTokenLimit;
  const sessionUsed = Number(usage?.sessionUsed ?? 0);
  const weeklyUsed = Number(usage?.weeklyUsed ?? 0);
  const weeklyResetAt = nextWeekReset(now, config.tzOffsetMinutes);
  const decision = evaluateQuota({
    sessionLimit, weeklyLimit, sessionUsed, weeklyUsed, sessionResetAt: window.resetAt, weeklyResetAt,
  });
  return { ...decision, sessionLimit, weeklyLimit, sessionUsed, weeklyUsed, sessionResetAt: window.resetAt, weeklyResetAt };
}

/** Opens a new 5-hour window starting now if none is active. */
export async function ensureSessionWindow(
  db: Database, userId: string, config: QuotaConfig, now: Date = new Date(),
): Promise<void> {
  const [row] = await db.select({ startedAt: user.sessionWindowStartedAt }).from(user).where(eq(user.id, userId));
  if (!row) throw new Error(`Cannot open session window: user ${userId} not found`);
  if (sessionWindow(row.startedAt, now, config.sessionWindowHours).active) return;
  await db.update(user).set({ sessionWindowStartedAt: now }).where(eq(user.id, userId));
}

export interface UsageRecord {
  userId: string;
  conversationId: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/** Persists the token usage of one model call; all token kinds count toward quota. */
export async function recordUsage(db: Database, usage: UsageRecord): Promise<void> {
  const totalTokens = usage.inputTokens + usage.outputTokens + usage.cacheCreationTokens + usage.cacheReadTokens;
  await db.insert(usageLogs).values({ ...usage, totalTokens });
}
