import type { UsageTotals } from "../../lib/api.types";
import { USAGE_TEXT } from "../../lib/copy";
import { formatTokens } from "../../lib/quota.format";

const PERIODS = ["today", "week", "month"] as const;

/** Today / this week / this month token totals as headline tiles. */
export function StatTiles({ totals }: { totals: UsageTotals }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {PERIODS.map((p) => (
        <div key={p} className="rounded-2xl border border-line bg-surface p-4">
          <div className="text-xs text-muted">{USAGE_TEXT.periods[p]}</div>
          <div className="mt-1 font-serif text-3xl tabular-nums" title={`${totals[p].totalTokens.toLocaleString("id-ID")} token`}>
            {formatTokens(totals[p].totalTokens)}
          </div>
          <div className="mt-1 text-xs text-muted">{totals[p].requests.toLocaleString("id-ID")} {USAGE_TEXT.requests}</div>
        </div>
      ))}
    </div>
  );
}
