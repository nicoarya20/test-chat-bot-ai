import { sql, type SQL } from "drizzle-orm";

/** Binds a Date inside raw sql`` fragments (postgres.js cannot infer Date params there). */
export function timestamptz(date: Date): SQL {
  return sql`${date.toISOString()}::timestamptz`;
}
