import { describe, expect, it } from "bun:test";
import { lastLocalDays, localDateKey, localDayStart, localMonthStart } from "../../src/usage/usage.period";

const WIB = 420;

describe("usage periods (WIB)", () => {
  it("finds local midnight even when the UTC date differs", () => {
    // 2026-11-02 03:00 WIB = 2026-11-01 20:00Z
    expect(localDayStart(new Date("2026-11-01T20:00:00Z"), WIB).toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });

  it("finds the first of the local month", () => {
    // 2026-12-01 02:00 WIB is still November in UTC
    expect(localMonthStart(new Date("2026-11-30T19:00:00Z"), WIB).toISOString()).toBe("2026-11-30T17:00:00.000Z");
  });

  it("keys instants by local date", () => {
    expect(localDateKey(new Date("2026-11-01T16:59:00Z"), WIB)).toBe("2026-11-01");
    expect(localDateKey(new Date("2026-11-01T17:00:00Z"), WIB)).toBe("2026-11-02");
  });

  it("lists the last N local days ending today, oldest first", () => {
    const { keys, from } = lastLocalDays(new Date("2026-11-04T08:00:00Z"), 3, WIB);
    expect(keys).toEqual(["2026-11-02", "2026-11-03", "2026-11-04"]);
    expect(from.toISOString()).toBe("2026-11-01T17:00:00.000Z");
  });
});
