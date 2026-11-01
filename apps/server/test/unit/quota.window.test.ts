import { describe, expect, it } from "bun:test";
import {
  evaluateQuota, nextWeekReset, replyTokenBudget, sessionWindow, weekStart,
} from "../../src/quota/quota.window";

const WIB = 420; // UTC+7

describe("weekStart (WIB)", () => {
  it("returns Monday 00:00 WIB for a Wednesday afternoon", () => {
    // Wed 2026-11-04 15:00 WIB = 08:00Z
    const start = weekStart(new Date("2026-11-04T08:00:00Z"), WIB);
    // Mon 2026-11-02 00:00 WIB = Sun 2026-11-01 17:00Z
    expect(start.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });

  it("treats Monday 00:00 WIB exactly as the start of a new week", () => {
    const start = weekStart(new Date("2026-11-01T17:00:00Z"), WIB);
    expect(start.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });

  it("keeps Sunday 23:59 WIB in the previous week", () => {
    const start = weekStart(new Date("2026-11-01T16:59:00Z"), WIB);
    expect(start.toISOString()).toBe("2026-10-25T17:00:00.000Z");
  });

  it("uses the local date, not the UTC date, near midnight", () => {
    // Mon 2026-11-02 03:00 WIB is still Sunday in UTC
    const start = weekStart(new Date("2026-11-01T20:00:00Z"), WIB);
    expect(start.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });

  it("puts the next reset seven days later", () => {
    expect(nextWeekReset(new Date("2026-11-04T08:00:00Z"), WIB).toISOString()).toBe("2026-11-08T17:00:00.000Z");
  });
});

describe("sessionWindow", () => {
  const start = new Date("2026-11-02T02:00:00Z");

  it("is inactive when no window was opened", () => {
    expect(sessionWindow(null, new Date(), 5)).toEqual({ active: false, startedAt: null, resetAt: null });
  });

  it("is active within five hours and reports reset time", () => {
    const w = sessionWindow(start, new Date("2026-11-02T06:59:59Z"), 5);
    expect(w.active).toBe(true);
    expect(w.resetAt?.toISOString()).toBe("2026-11-02T07:00:00.000Z");
  });

  it("expires exactly at five hours", () => {
    expect(sessionWindow(start, new Date("2026-11-02T07:00:00Z"), 5).active).toBe(false);
  });
});

describe("evaluateQuota", () => {
  const base = {
    sessionLimit: 1000, weeklyLimit: 5000, sessionUsed: 0, weeklyUsed: 0,
    sessionResetAt: new Date("2026-11-02T07:00:00Z"), weeklyResetAt: new Date("2026-11-08T17:00:00Z"),
  };

  it("allows when both limits have room", () => {
    const d = evaluateQuota({ ...base, sessionUsed: 400, weeklyUsed: 400 });
    expect(d).toMatchObject({ allowed: true, blockedBy: null, sessionRemaining: 600, weeklyRemaining: 4600 });
  });

  it("blocks on the session limit with the session reset time", () => {
    const d = evaluateQuota({ ...base, sessionUsed: 1000, weeklyUsed: 1000 });
    expect(d).toMatchObject({ allowed: false, blockedBy: "session", resetAt: base.sessionResetAt });
  });

  it("blocks on the weekly limit even if the session window has room", () => {
    const d = evaluateQuota({ ...base, sessionUsed: 0, weeklyUsed: 5000 });
    expect(d).toMatchObject({ allowed: false, blockedBy: "weekly", resetAt: base.weeklyResetAt });
  });

  it("prefers weekly when both are exhausted, and clamps overage to zero", () => {
    const d = evaluateQuota({ ...base, sessionUsed: 1200, weeklyUsed: 5300 });
    expect(d).toMatchObject({ blockedBy: "weekly", sessionRemaining: 0, weeklyRemaining: 0 });
  });
});

describe("replyTokenBudget", () => {
  it("uses the remaining quota when between min and max", () => {
    expect(replyTokenBudget(10_000, 4096, 64_000)).toBe(10_000);
  });
  it("raises to the floor so a reply can finish", () => {
    expect(replyTokenBudget(100, 4096, 64_000)).toBe(4096);
  });
  it("caps at the maximum", () => {
    expect(replyTokenBudget(1_000_000, 4096, 64_000)).toBe(64_000);
  });
});
