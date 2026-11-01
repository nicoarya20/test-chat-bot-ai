import type { DailyUsagePoint } from "../../lib/api.types";
import { formatDayLabel } from "../../lib/chart.scale";

/** Accessible table view of the daily usage series (newest first). */
export function UsageTable({ data }: { data: DailyUsagePoint[] }) {
  const rows = [...data].reverse();
  return (
    <div className="max-h-72 overflow-y-auto rounded-lg border border-line">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-surface text-xs text-muted">
          <tr><th className="p-2 text-left">Tanggal</th><th className="p-2 text-right">Input</th><th className="p-2 text-right">Output</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Permintaan</th></tr>
        </thead>
        <tbody className="tabular-nums">
          {rows.map((d) => (
            <tr key={d.date} className="border-t border-line">
              <td className="p-2">{formatDayLabel(d.date)}</td>
              <td className="p-2 text-right">{d.inputTokens.toLocaleString("id-ID")}</td>
              <td className="p-2 text-right">{d.outputTokens.toLocaleString("id-ID")}</td>
              <td className="p-2 text-right font-medium">{d.totalTokens.toLocaleString("id-ID")}</td>
              <td className="p-2 text-right">{d.requests}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
