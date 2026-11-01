import { beforeEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import { usageLogs, user } from "../../src/db/schema";
import { ensureSessionWindow, getQuotaStatus, recordUsage } from "../../src/quota/quota.service";
import { updateSettings } from "../../src/settings/settings.repository";
import { createUser, resetDb, testDb } from "../helpers/db";

const cfg = { tzOffsetMinutes: 420, sessionWindowHours: 5 };
const db = testDb();

async function usageAt(userId: string, createdAt: Date, tokens: number) {
  await db.insert(usageLogs).values({
    userId, model: "m", inputTokens: tokens, outputTokens: 0, totalTokens: tokens, createdAt,
  });
}

describe("quota service", () => {
  beforeEach(resetDb);

  it("uses settings defaults when the user has no override", async () => {
    await updateSettings(db, { defaultSessionTokenLimit: 1000, defaultWeeklyTokenLimit: 9000 });
    const u = await createUser();
    const q = await getQuotaStatus(db, u.id, cfg);
    expect(q).toMatchObject({ sessionLimit: 1000, weeklyLimit: 9000, sessionUsed: 0, weeklyUsed: 0, allowed: true });
  });

  it("prefers per-user limits over defaults", async () => {
    const u = await createUser({ sessionTokenLimit: 10, weeklyTokenLimit: 20 });
    const q = await getQuotaStatus(db, u.id, cfg);
    expect(q).toMatchObject({ sessionLimit: 10, weeklyLimit: 20 });
  });

  it("counts all token kinds into total usage", async () => {
    const u = await createUser();
    await ensureSessionWindow(db, u.id, cfg);
    await recordUsage(db, { userId: u.id, conversationId: null, model: "m", inputTokens: 10, outputTokens: 20, cacheCreationTokens: 30, cacheReadTokens: 40 });
    const q = await getQuotaStatus(db, u.id, cfg);
    expect(q.sessionUsed).toBe(100);
    expect(q.weeklyUsed).toBe(100);
  });

  it("only counts usage inside the active 5-hour window toward the session", async () => {
    const now = new Date("2026-11-04T08:00:00Z"); // Wed, WIB 15:00
    const u = await createUser({ sessionWindowStartedAt: new Date("2026-11-04T06:00:00Z") });
    await usageAt(u.id, new Date("2026-11-04T05:00:00Z"), 300); // before window, same week
    await usageAt(u.id, new Date("2026-11-04T07:00:00Z"), 200); // inside window
    const q = await getQuotaStatus(db, u.id, cfg, now);
    expect(q.sessionUsed).toBe(200);
    expect(q.weeklyUsed).toBe(500);
    expect(q.sessionResetAt?.toISOString()).toBe("2026-11-04T11:00:00.000Z");
  });

  it("resets the session once the window has expired", async () => {
    const now = new Date("2026-11-04T12:00:00Z");
    const u = await createUser({ sessionWindowStartedAt: new Date("2026-11-04T06:00:00Z"), sessionTokenLimit: 100 });
    await usageAt(u.id, new Date("2026-11-04T07:00:00Z"), 500);
    const q = await getQuotaStatus(db, u.id, cfg, now);
    expect(q).toMatchObject({ sessionUsed: 0, sessionResetAt: null });
  });

  it("excludes last week's usage from the weekly total", async () => {
    const now = new Date("2026-11-04T08:00:00Z");
    const u = await createUser();
    await usageAt(u.id, new Date("2026-11-01T16:00:00Z"), 700); // Sun 23:00 WIB, previous week
    await usageAt(u.id, new Date("2026-11-02T01:00:00Z"), 100);
    const q = await getQuotaStatus(db, u.id, cfg, now);
    expect(q.weeklyUsed).toBe(100);
    expect(q.weeklyResetAt.toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });

  it("blocks with the weekly reset time once the weekly cap is spent", async () => {
    const u = await createUser({ weeklyTokenLimit: 100 });
    await ensureSessionWindow(db, u.id, cfg);
    await recordUsage(db, { userId: u.id, conversationId: null, model: "m", inputTokens: 100, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 });
    const q = await getQuotaStatus(db, u.id, cfg);
    expect(q).toMatchObject({ allowed: false, blockedBy: "weekly" });
  });

  it("opens a window once and keeps it while active", async () => {
    const u = await createUser();
    const t0 = new Date("2026-11-04T06:00:00Z");
    await ensureSessionWindow(db, u.id, cfg, t0);
    await ensureSessionWindow(db, u.id, cfg, new Date("2026-11-04T09:00:00Z"));
    const [row] = await db.select({ s: user.sessionWindowStartedAt }).from(user).where(eq(user.id, u.id));
    expect(row?.s?.toISOString()).toBe(t0.toISOString());
  });

  it("starts a fresh window after the previous one expired", async () => {
    const u = await createUser({ sessionWindowStartedAt: new Date("2026-11-04T00:00:00Z") });
    const later = new Date("2026-11-04T06:00:00Z");
    await ensureSessionWindow(db, u.id, cfg, later);
    const [row] = await db.select({ s: user.sessionWindowStartedAt }).from(user).where(eq(user.id, u.id));
    expect(row?.s?.toISOString()).toBe(later.toISOString());
  });
});
