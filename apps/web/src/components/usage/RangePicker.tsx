import { USAGE_RANGES, type UsageRange } from "../../hooks/useUsage";

/** Segmented control choosing the usage day range. */
export function RangePicker({ value, onChange }: { value: UsageRange; onChange: (days: UsageRange) => void }) {
  return (
    <div role="radiogroup" aria-label="Rentang waktu" className="inline-flex rounded-lg border border-line p-0.5 text-sm">
      {USAGE_RANGES.map((days) => (
        <button key={days} type="button" role="radio" aria-checked={value === days} onClick={() => onChange(days)}
          className={`rounded-md px-3 py-1 ${value === days ? "bg-bubble text-ink" : "text-muted hover:text-ink"}`}>
          {days} hari
        </button>
      ))}
    </div>
  );
}
