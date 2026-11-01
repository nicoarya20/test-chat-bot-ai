import { useState } from "react";
import { QuotaMeters } from "../components/usage/QuotaMeters";
import { RangePicker } from "../components/usage/RangePicker";
import { UsageOverview } from "../components/usage/UsageOverview";
import { Card } from "../components/ui";
import { useUsage, type UsageRange } from "../hooks/useUsage";
import type { MyUsageResponse } from "../lib/api.types";
import { USAGE_TEXT } from "../lib/copy";

/** The signed-in user's own token usage: quota meters, totals, daily chart and per-model split. */
export function UsagePage() {
  const [days, setDays] = useState<UsageRange>(30);
  const { data, loading, error } = useUsage<MyUsageResponse>("/me/usage", days);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="font-serif text-3xl">{USAGE_TEXT.title}</h1>
          <RangePicker value={days} onChange={setDays} />
        </div>
        <UsageOverview data={data} loading={loading} error={error}
          before={data && <Card title={USAGE_TEXT.quota}><QuotaMeters quota={data.quota} /></Card>} />
      </div>
    </div>
  );
}
