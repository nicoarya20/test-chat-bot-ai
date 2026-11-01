import { QUOTA_SCOPE_TEXT } from "../lib/copy";
import type { QuotaStatus } from "../lib/api.types";
import { formatResetAt, usedPercent } from "../lib/quota.format";

/** One-line usage summary under the composer, or a banner when the quota is spent. */
export function QuotaMeter({ quota }: { quota: QuotaStatus | null }) {
  if (!quota) return null;
  if (!quota.allowed && quota.blockedBy) {
    const reset = formatResetAt(quota.resetAt);
    return (
      <div role="status" className="rounded-xl border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm text-ink">
        Batas {QUOTA_SCOPE_TEXT[quota.blockedBy]} tercapai.{reset ? ` Bisa lanjut lagi ${reset}.` : ""}
      </div>
    );
  }
  const session = usedPercent(quota.sessionUsed, quota.sessionLimit);
  const weekly = usedPercent(quota.weeklyUsed, quota.weeklyLimit);
  const sessionReset = formatResetAt(quota.sessionResetAt);
  return (
    <p className="text-center text-xs text-muted">
      Sesi {session}% terpakai{sessionReset ? ` · reset ${sessionReset}` : ""} · Mingguan {weekly}%
    </p>
  );
}
