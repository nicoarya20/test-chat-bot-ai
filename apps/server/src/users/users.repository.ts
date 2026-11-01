import { desc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { timestamptz } from "../db/sql.timestamp";
import { usageLogs, user, type UserRole, type UserStatus } from "../db/schema";
import { weekStart } from "../quota/quota.window";
import type { QuotaConfig } from "../quota/quota.service";

export interface AdminUserRow {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: UserRole;
  status: UserStatus;
  sessionTokenLimit: number | null;
  weeklyTokenLimit: number | null;
  sessionUsed: number;
  weeklyUsed: number;
  createdAt: Date;
}

export interface ListUsersQuery {
  status?: UserStatus;
  limit: number;
  offset: number;
}

/** Lists users with their current session/weekly usage in a single aggregate query. */
export async function listUsersWithUsage(
  db: Database, query: ListUsersQuery, config: QuotaConfig, now: Date = new Date(),
): Promise<{ users: AdminUserRow[]; total: number }> {
  const weekFrom = timestamptz(weekStart(now, config.tzOffsetMinutes));
  const nowTs = timestamptz(now);
  const windowEnd = sql`${user.sessionWindowStartedAt} + (${config.sessionWindowHours} * interval '1 hour')`;
  const where = query.status ? eq(user.status, query.status) : undefined;

  const rows = await db.select({
    id: user.id, name: user.name, email: user.email, image: user.image,
    role: user.role, status: user.status,
    sessionTokenLimit: user.sessionTokenLimit, weeklyTokenLimit: user.weeklyTokenLimit,
    createdAt: user.createdAt,
    weeklyUsed: sql<number>`coalesce(sum(${usageLogs.totalTokens}) filter (where ${usageLogs.createdAt} >= ${weekFrom}), 0)::int`,
    sessionUsed: sql<number>`coalesce(sum(${usageLogs.totalTokens}) filter (where ${nowTs} < ${windowEnd} and ${usageLogs.createdAt} >= ${user.sessionWindowStartedAt}), 0)::int`,
  })
    .from(user)
    .leftJoin(usageLogs, sql`${usageLogs.userId} = ${user.id} and ${usageLogs.createdAt} >= least(${weekFrom}, coalesce(${user.sessionWindowStartedAt}, ${weekFrom}))`)
    .where(where)
    .groupBy(user.id)
    .orderBy(desc(user.createdAt))
    .limit(query.limit)
    .offset(query.offset);

  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(user).where(where);
  return {
    users: rows.map((r) => ({ ...r, sessionUsed: Number(r.sessionUsed), weeklyUsed: Number(r.weeklyUsed) })),
    total: Number(count?.total ?? 0),
  };
}

export interface UserPatch {
  status?: UserStatus;
  role?: UserRole;
  sessionTokenLimit?: number | null;
  weeklyTokenLimit?: number | null;
}

/** Updates admin-controlled user fields; returns false if the user does not exist. */
export async function updateUser(db: Database, id: string, patch: UserPatch): Promise<boolean> {
  const rows = await db.update(user).set({ ...patch, updatedAt: new Date() })
    .where(eq(user.id, id)).returning({ id: user.id });
  return rows.length > 0;
}
