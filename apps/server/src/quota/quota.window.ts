const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const DAYS_PER_WEEK = 7;

export type QuotaScope = "session" | "weekly";

/** Start of the quota week: Monday 00:00 in the given UTC offset, returned as a UTC Date. */
export function weekStart(now: Date, offsetMinutes: number): Date {
  const local = new Date(now.getTime() + offsetMinutes * MINUTE_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % DAYS_PER_WEEK;
  const localMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(localMidnight - daysSinceMonday * DAY_MS - offsetMinutes * MINUTE_MS);
}

/** Next weekly reset instant (the following Monday 00:00 local). */
export function nextWeekReset(now: Date, offsetMinutes: number): Date {
  return new Date(weekStart(now, offsetMinutes).getTime() + DAYS_PER_WEEK * DAY_MS);
}

export interface SessionWindow {
  active: boolean;
  startedAt: Date | null;
  resetAt: Date | null;
}

/** Resolves the 5-hour window; it is active only while now < startedAt + windowHours. */
export function sessionWindow(startedAt: Date | null, now: Date, windowHours: number): SessionWindow {
  if (!startedAt) return { active: false, startedAt: null, resetAt: null };
  const resetAt = new Date(startedAt.getTime() + windowHours * HOUR_MS);
  if (now >= resetAt) return { active: false, startedAt: null, resetAt: null };
  return { active: true, startedAt, resetAt };
}

export interface QuotaInput {
  sessionLimit: number;
  weeklyLimit: number;
  sessionUsed: number;
  weeklyUsed: number;
  sessionResetAt: Date | null;
  weeklyResetAt: Date;
}

export interface QuotaDecision {
  allowed: boolean;
  blockedBy: QuotaScope | null;
  resetAt: Date | null;
  sessionRemaining: number;
  weeklyRemaining: number;
}

/** Decides whether a new message may be sent; the weekly cap wins when both are exhausted. */
export function evaluateQuota(input: QuotaInput): QuotaDecision {
  const sessionRemaining = Math.max(0, input.sessionLimit - input.sessionUsed);
  const weeklyRemaining = Math.max(0, input.weeklyLimit - input.weeklyUsed);
  if (weeklyRemaining === 0) {
    return { allowed: false, blockedBy: "weekly", resetAt: input.weeklyResetAt, sessionRemaining, weeklyRemaining };
  }
  if (sessionRemaining === 0) {
    return { allowed: false, blockedBy: "session", resetAt: input.sessionResetAt, sessionRemaining, weeklyRemaining };
  }
  return { allowed: true, blockedBy: null, resetAt: null, sessionRemaining, weeklyRemaining };
}

/** max_tokens for a reply: remaining quota clamped to [min, max] so replies can finish. */
export function replyTokenBudget(remaining: number, minTokens: number, maxTokens: number): number {
  return Math.min(maxTokens, Math.max(minTokens, remaining));
}
