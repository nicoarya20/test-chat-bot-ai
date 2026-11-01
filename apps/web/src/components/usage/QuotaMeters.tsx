import type { QuotaStatus } from "../../lib/api.types";
import { meterTone } from "../../lib/chart.scale";
import { QUOTA_SCOPE_TEXT } from "../../lib/copy";
import { formatResetAt, formatTokens, usedPercent } from "../../lib/quota.format";

const TONE_FILL = { ok: "bg-accent", warning: "bg-warning", full: "bg-danger" } as const;
const TONE_LABEL = { ok: "", warning: "Hampir habis", full: "Habis" } as const;

function Meter({ label, used, limit, resetAt }: { label: string; used: number; limit: number; resetAt: string | null }) {
  const percent = usedPercent(used, limit);
  const tone = meterTone(percent);
  const reset = formatResetAt(resetAt);
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium capitalize">{label}</span>
        <span className="tabular-nums text-muted">{formatTokens(used)} / {formatTokens(limit)} · {percent}%</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="h-2 overflow-hidden rounded-full bg-bubble">
        <div className={`h-full rounded-full ${TONE_FILL[tone]}`} style={{ width: `${percent}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted">
        <span>{TONE_LABEL[tone] && <strong className="font-medium text-ink">{TONE_LABEL[tone]}</strong>}</span>
        <span>{reset ? `Reset ${reset}` : "Mulai saat pesan berikutnya"}</span>
      </div>
    </div>
  );
}

/** Session (5-hour) and weekly quota meters with reset times. */
export function QuotaMeters({ quota }: { quota: QuotaStatus }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Meter label={QUOTA_SCOPE_TEXT.session} used={quota.sessionUsed} limit={quota.sessionLimit} resetAt={quota.sessionResetAt} />
      <Meter label={QUOTA_SCOPE_TEXT.weekly} used={quota.weeklyUsed} limit={quota.weeklyLimit} resetAt={quota.weeklyResetAt} />
    </div>
  );
}
