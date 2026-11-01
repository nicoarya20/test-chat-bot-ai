const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

/** Local midnight (in the given UTC offset) of `now`, as a UTC Date. */
export function localDayStart(now: Date, offsetMinutes: number): Date {
  const local = new Date(now.getTime() + offsetMinutes * MINUTE_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  return new Date(midnight - offsetMinutes * MINUTE_MS);
}

/** First day of the local month at 00:00, as a UTC Date. */
export function localMonthStart(now: Date, offsetMinutes: number): Date {
  const local = new Date(now.getTime() + offsetMinutes * MINUTE_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - offsetMinutes * MINUTE_MS);
}

/** Local calendar date (YYYY-MM-DD) of an instant in the given UTC offset. */
export function localDateKey(instant: Date, offsetMinutes: number): string {
  return new Date(instant.getTime() + offsetMinutes * MINUTE_MS).toISOString().slice(0, 10);
}

/** The last `days` local dates ending today, oldest first, plus the UTC start of the first one. */
export function lastLocalDays(now: Date, days: number, offsetMinutes: number): { keys: string[]; from: Date } {
  const today = localDayStart(now, offsetMinutes);
  const from = new Date(today.getTime() - (days - 1) * DAY_MS);
  const keys = Array.from({ length: days }, (_, i) => localDateKey(new Date(from.getTime() + i * DAY_MS), offsetMinutes));
  return { keys, from };
}
