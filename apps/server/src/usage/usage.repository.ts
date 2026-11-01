import { and, desc, eq, gte, sql, type SQL } from "drizzle-orm";
import type { Database } from "../db/client";
import { timestamptz } from "../db/sql.timestamp";
import { usageLogs, user } from "../db/schema";
import { weekStart } from "../quota/quota.window";
import { lastLocalDays, localDayStart, localMonthStart } from "./usage.period";

export interface UsageQuery {
  /** Restrict to one user; omit for all users (admin view). */
  userId?: string;
  days: number;
  tzOffsetMinutes: number;
  now?: Date;
}

export interface PeriodTotal { totalTokens: number; requests: number }
export interface DailyPoint { date: string; inputTokens: number; outputTokens: number; totalTokens: number; requests: number }
export interface ModelUsage { model: string; inputTokens: number; outputTokens: number; totalTokens: number; requests: number }
export interface UserUsage { userId: string; name: string; email: string; totalTokens: number; requests: number }

// Breakdowns are bounded lists, not paginated: they summarize, they don't enumerate.
export const MODEL_BREAKDOWN_LIMIT = 20;
export const TOP_USERS_LIMIT = 10;

const sumInt = (column: SQL | typeof usageLogs.totalTokens) => sql<number>`coalesce(sum(${column}), 0)::int`;
const scopeFilter = (userId: string | undefined) => (userId ? eq(usageLogs.userId, userId) : undefined);

/** Token totals for today, this quota week and this month (local time), in one scan. */
export async function getUsageTotals(db: Database, q: UsageQuery) {
  const now = q.now ?? new Date();
  const today = localDayStart(now, q.tzOffsetMinutes);
  const week = weekStart(now, q.tzOffsetMinutes);
  const month = localMonthStart(now, q.tzOffsetMinutes);
  const earliest = [today, week, month].reduce((a, b) => (a < b ? a : b));
  const period = (from: Date) => ({
    totalTokens: sql<number>`coalesce(sum(${usageLogs.totalTokens}) filter (where ${usageLogs.createdAt} >= ${timestamptz(from)}), 0)::int`,
    requests: sql<number>`(count(*) filter (where ${usageLogs.createdAt} >= ${timestamptz(from)}))::int`,
  });
  const t = period(today), w = period(week), m = period(month);
  const [row] = await db.select({
    todayTokens: t.totalTokens, todayRequests: t.requests,
    weekTokens: w.totalTokens, weekRequests: w.requests,
    monthTokens: m.totalTokens, monthRequests: m.requests,
  }).from(usageLogs).where(and(scopeFilter(q.userId), gte(usageLogs.createdAt, earliest)));
  const n = (v: number | undefined) => Number(v ?? 0);
  return {
    today: { totalTokens: n(row?.todayTokens), requests: n(row?.todayRequests) },
    week: { totalTokens: n(row?.weekTokens), requests: n(row?.weekRequests) },
    month: { totalTokens: n(row?.monthTokens), requests: n(row?.monthRequests) },
  } satisfies Record<string, PeriodTotal>;
}

/** Per-local-day usage for the last `days` days, zero-filled and oldest first. */
export async function getDailyUsage(db: Database, q: UsageQuery): Promise<DailyPoint[]> {
  const { keys, from } = lastLocalDays(q.now ?? new Date(), q.days, q.tzOffsetMinutes);
  if (!Number.isInteger(q.tzOffsetMinutes)) throw new Error(`tzOffsetMinutes must be an integer, got ${q.tzOffsetMinutes}`);
  // Inlined as a literal (validated integer): with a bound param the SELECT and
  // GROUP BY expressions get different placeholders and Postgres rejects them.
  const offset = sql.raw(String(q.tzOffsetMinutes));
  const day = sql<string>`to_char((${usageLogs.createdAt} at time zone 'UTC') + (${offset} * interval '1 minute'), 'YYYY-MM-DD')`;
  const rows = await db.select({
    date: day,
    inputTokens: sumInt(sql`${usageLogs.inputTokens} + ${usageLogs.cacheCreationTokens} + ${usageLogs.cacheReadTokens}`),
    outputTokens: sumInt(sql`${usageLogs.outputTokens}`),
    totalTokens: sumInt(usageLogs.totalTokens),
    requests: sql<number>`count(*)::int`,
  }).from(usageLogs)
    .where(and(scopeFilter(q.userId), gte(usageLogs.createdAt, from)))
    .groupBy(day);
  const byDate = new Map(rows.map((r) => [r.date, r]));
  return keys.map((date) => {
    const r = byDate.get(date);
    return {
      date,
      inputTokens: Number(r?.inputTokens ?? 0), outputTokens: Number(r?.outputTokens ?? 0),
      totalTokens: Number(r?.totalTokens ?? 0), requests: Number(r?.requests ?? 0),
    };
  });
}

/** Usage per model over the range, largest first. */
export async function getUsageByModel(db: Database, q: UsageQuery): Promise<ModelUsage[]> {
  const { from } = lastLocalDays(q.now ?? new Date(), q.days, q.tzOffsetMinutes);
  const total = sumInt(usageLogs.totalTokens);
  const rows = await db.select({
    model: usageLogs.model,
    inputTokens: sumInt(sql`${usageLogs.inputTokens} + ${usageLogs.cacheCreationTokens} + ${usageLogs.cacheReadTokens}`),
    outputTokens: sumInt(sql`${usageLogs.outputTokens}`),
    totalTokens: total,
    requests: sql<number>`count(*)::int`,
  }).from(usageLogs)
    .where(and(scopeFilter(q.userId), gte(usageLogs.createdAt, from)))
    .groupBy(usageLogs.model).orderBy(desc(total)).limit(MODEL_BREAKDOWN_LIMIT);
  return rows.map((r) => ({ ...r, inputTokens: Number(r.inputTokens), outputTokens: Number(r.outputTokens), totalTokens: Number(r.totalTokens), requests: Number(r.requests) }));
}

/** Heaviest users over the range (admin view). */
export async function getTopUsers(db: Database, q: UsageQuery): Promise<UserUsage[]> {
  const { from } = lastLocalDays(q.now ?? new Date(), q.days, q.tzOffsetMinutes);
  const total = sumInt(usageLogs.totalTokens);
  const rows = await db.select({
    userId: user.id, name: user.name, email: user.email,
    totalTokens: total, requests: sql<number>`count(*)::int`,
  }).from(usageLogs)
    .innerJoin(user, eq(user.id, usageLogs.userId))
    .where(gte(usageLogs.createdAt, from))
    .groupBy(user.id).orderBy(desc(total)).limit(TOP_USERS_LIMIT);
  return rows.map((r) => ({ ...r, totalTokens: Number(r.totalTokens), requests: Number(r.requests) }));
}
