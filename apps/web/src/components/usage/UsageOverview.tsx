import type { ReactNode } from "react";
import type { DailyUsagePoint, ModelUsage, UsageTotals } from "../../lib/api.types";
import { USAGE_TEXT } from "../../lib/copy";
import { Card, Notice } from "../ui";
import { DailyUsageChart } from "./DailyUsageChart";
import { ModelBreakdown } from "./ModelBreakdown";
import { StatTiles } from "./StatTiles";

interface OverviewData { totals: UsageTotals; daily: DailyUsagePoint[]; byModel: ModelUsage[] }

/** Shared dashboard body: tiles, daily chart and per-model breakdown, plus optional extra cards. */
export function UsageOverview({ data, loading, error, before, after }: {
  data: OverviewData | null; loading: boolean; error: string | null; before?: ReactNode; after?: ReactNode;
}) {
  if (error && !data) return <Notice tone="error">{USAGE_TEXT.loadFailed}</Notice>;
  if (!data) return <p className="text-sm text-muted">Memuat…</p>;
  const hasUsage = data.daily.some((d) => d.totalTokens > 0);
  return (
    <div aria-busy={loading} className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      {error && <Notice tone="error">{USAGE_TEXT.loadFailed}</Notice>}
      <StatTiles totals={data.totals} />
      {before}
      <Card title={USAGE_TEXT.daily}>
        {hasUsage ? <DailyUsageChart data={data.daily} /> : <p className="text-sm text-muted">{USAGE_TEXT.empty}</p>}
      </Card>
      <Card title={USAGE_TEXT.byModel}><ModelBreakdown rows={data.byModel} /></Card>
      {after}
    </div>
  );
}
