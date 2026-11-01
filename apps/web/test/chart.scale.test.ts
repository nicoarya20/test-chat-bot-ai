import { describe, expect, it } from "bun:test";
import { formatDayLabel, meterTone, niceTicks } from "../src/lib/chart.scale";

describe("niceTicks", () => {
  it("rounds the max up to a clean step", () => {
    expect(niceTicks(950)).toEqual([0, 250, 500, 750, 1000]);
    expect(niceTicks(43_000)).toEqual([0, 20_000, 40_000, 60_000]);
  });
  it("handles exact multiples without an extra empty tick", () => {
    expect(niceTicks(1000)).toEqual([0, 250, 500, 750, 1000]);
  });
  it("returns a minimal axis for empty data", () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe("formatDayLabel", () => {
  it("formats the calendar date without timezone drift", () => {
    expect(formatDayLabel("2026-11-04")).toMatch(/^4 Nov/);
  });
});

describe("meterTone", () => {
  it("escalates at 80% and 100%", () => {
    expect(meterTone(79)).toBe("ok");
    expect(meterTone(80)).toBe("warning");
    expect(meterTone(100)).toBe("full");
  });
});
