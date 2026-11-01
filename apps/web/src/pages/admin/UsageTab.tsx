import { useState } from "react";
import { Card } from "../../components/ui";
import { RangePicker } from "../../components/usage/RangePicker";
import { TopUsersTable } from "../../components/usage/TopUsersTable";
import { UsageOverview } from "../../components/usage/UsageOverview";
import { useUsage, type UsageRange } from "../../hooks/useUsage";
import type { AdminUsageResponse } from "../../lib/api.types";
import { USAGE_TEXT } from "../../lib/copy";

/** Workspace-wide token usage with the top users in the selected range. */
export function UsageTab() {
  const [days, setDays] = useState<UsageRange>(30);
  const { data, loading, error } = useUsage<AdminUsageResponse>("/admin/usage", days);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl">{USAGE_TEXT.adminTitle}</h2>
        <RangePicker value={days} onChange={setDays} />
      </div>
      <UsageOverview data={data} loading={loading} error={error}
        after={data && <Card title={USAGE_TEXT.topUsers}><TopUsersTable rows={data.topUsers} /></Card>} />
    </div>
  );
}
