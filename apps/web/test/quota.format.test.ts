import { describe, expect, it } from "bun:test";
import { formatResetAt, formatTokens, usedPercent } from "../src/lib/quota.format";

describe("usedPercent", () => {
  it("rounds and clamps", () => {
    expect(usedPercent(333, 1000)).toBe(33);
    expect(usedPercent(1500, 1000)).toBe(100);
    expect(usedPercent(-5, 1000)).toBe(0);
  });
  it("treats a zero limit as fully used", () => {
    expect(usedPercent(0, 0)).toBe(100);
  });
});

describe("formatResetAt", () => {
  const now = new Date(2026, 10, 4, 10, 0); // local time, test-only

  it("returns null without a reset time", () => {
    expect(formatResetAt(null, now)).toBeNull();
  });
  it("shows only the time when the reset is today", () => {
    const out = formatResetAt(new Date(2026, 10, 4, 14, 30).toISOString(), now)!;
    expect(out).toMatch(/14[.:]30/);
    expect(out).not.toMatch(/Rabu/);
  });
  it("includes the weekday for later days", () => {
    expect(formatResetAt(new Date(2026, 10, 9, 0, 0).toISOString(), now)).toMatch(/^Senin/);
  });
});

describe("formatTokens", () => {
  it("formats compactly", () => {
    expect(formatTokens(950)).toBe("950");
    expect(formatTokens(2_000_000)).toMatch(/^2\s?jt$/);
  });
});
