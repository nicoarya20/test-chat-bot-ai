/** Percentage of a limit used, clamped to 0–100 (a zero limit counts as full). */
export function usedPercent(used: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((used / limit) * 100)));
}

/** Formats a reset instant for display: time only if today, otherwise weekday + time. */
export function formatResetAt(iso: string | null, now: Date = new Date(), locale = "id-ID"): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  const time = at.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const sameDay = at.toDateString() === now.toDateString();
  if (sameDay) return time;
  const day = at.toLocaleDateString(locale, { weekday: "long" });
  return `${day} ${time}`;
}

/** Compact token count, e.g. 1500 → "1,5 rb", 2_000_000 → "2 jt". */
export function formatTokens(value: number, locale = "id-ID"): string {
  return new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
