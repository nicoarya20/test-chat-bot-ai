import type { ModelUsage } from "../../lib/api.types";
import { USAGE_TEXT } from "../../lib/copy";
import { formatTokens } from "../../lib/quota.format";

/** Token totals per model slug, largest first, with a share bar. */
export function ModelBreakdown({ rows }: { rows: ModelUsage[] }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{USAGE_TEXT.empty}</p>;
  const max = Math.max(...rows.map((r) => r.totalTokens), 1);
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.model}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-mono text-xs" title={r.model}>{r.model}</span>
            <span className="shrink-0 tabular-nums text-muted">
              <strong className="font-medium text-ink">{formatTokens(r.totalTokens)}</strong> · {r.requests} {USAGE_TEXT.requests}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-bubble">
            <div className="h-full rounded-full bg-series-input" style={{ width: `${(r.totalTokens / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
