const NICE_STEPS = [1, 2, 2.5, 5, 10];

/** A clean axis maximum and evenly spaced ticks (0 … max) covering `value`. */
export function niceTicks(value: number, targetTicks = 4): number[] {
  if (value <= 0) return [0, 1];
  const rough = value / targetTicks;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = (NICE_STEPS.find((s) => s * magnitude >= rough) ?? 10) * magnitude;
  const max = Math.ceil(value / step) * step;
  return Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step);
}

/** "2026-11-04" → "4 Nov" (date keys are local calendar dates; format them as-is). */
export function formatDayLabel(dateKey: string, locale = "id-ID"): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(locale, { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Meter severity for a usage percentage. */
export function meterTone(percent: number): "ok" | "warning" | "full" {
  if (percent >= 100) return "full";
  if (percent >= 80) return "warning";
  return "ok";
}
