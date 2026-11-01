import { useState, type KeyboardEvent } from "react";
import { useElementWidth } from "../../hooks/useElementWidth";
import type { DailyUsagePoint } from "../../lib/api.types";
import { formatDayLabel, niceTicks } from "../../lib/chart.scale";
import { formatTokens } from "../../lib/quota.format";
import { UsageTable } from "./UsageTable";

const HEIGHT = 220;
const PAD = { top: 12, right: 8, bottom: 24, left: 52 };
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;
const SERIES = [
  { key: "inputTokens", label: "Input", color: "var(--series-input)" },
  { key: "outputTokens", label: "Output", color: "var(--series-output)" },
] as const;

/** Bar path with rounded top corners and a square base. */
function barPath(x: number, y: number, w: number, h: number, rounded: boolean): string {
  const r = rounded ? Math.min(RADIUS, w / 2, h) : 0;
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Stacked daily input/output token columns with hover/keyboard tooltip and a table view. */
export function DailyUsageChart({ data }: { data: DailyUsagePoint[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const ticks = niceTicks(Math.max(0, ...data.map((d) => d.totalTokens)));
  const yMax = ticks.at(-1) ?? 1;
  const plotW = Math.max(0, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const band = data.length ? plotW / data.length : 0;
  const barW = Math.max(2, Math.min(MAX_BAR, band - GAP));
  const y = (v: number) => PAD.top + plotH * (1 - v / yMax);
  const baseline = PAD.top + plotH;
  const center = (i: number) => PAD.left + i * band + band / 2;
  const labelIdx = [...new Set([0, Math.floor((data.length - 1) / 2), data.length - 1])];
  const point = active !== null ? data[active] : null;

  function onKey(event: KeyboardEvent<SVGSVGElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    setActive((i) => Math.min(data.length - 1, Math.max(0, (i ?? data.length) + step)));
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />{s.label}
          </span>
        ))}
        <button type="button" onClick={() => setShowTable((v) => !v)} className="ml-auto underline-offset-2 hover:text-ink hover:underline">
          {showTable ? "Lihat grafik" : "Lihat tabel"}
        </button>
      </div>
      {showTable ? <UsageTable data={data} /> : (
        <div ref={ref} className="relative">
          {width > 0 && (
            <svg width={width} height={HEIGHT} tabIndex={0} onKeyDown={onKey} onBlur={() => setActive(null)}
              role="img" aria-label={`Pemakaian token harian, ${data.length} hari. Gunakan panah kiri/kanan untuk melihat tiap hari.`}
              className="block outline-none focus-visible:ring-2 focus-visible:ring-accent/40 rounded-lg">
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
                  <text x={PAD.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular-nums">{formatTokens(t)}</text>
                </g>
              ))}
              {data.map((d, i) => {
                const x = center(i) - barW / 2;
                const hIn = baseline - y(d.inputTokens);
                const hOut = baseline - y(d.outputTokens);
                const outTop = baseline - hIn - (hIn > 0 && hOut > 0 ? GAP : 0) - hOut;
                const dim = active !== null && active !== i;
                return (
                  <g key={d.date} opacity={dim ? 0.45 : 1}>
                    {hIn > 0 && <path d={barPath(x, baseline - hIn, barW, hIn, hOut <= 0)} fill="var(--series-input)" />}
                    {hOut > 0 && <path d={barPath(x, outTop, barW, hOut, true)} fill="var(--series-output)" />}
                    <rect x={PAD.left + i * band} y={PAD.top} width={band} height={plotH} fill="transparent"
                      onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)} />
                  </g>
                );
              })}
              {labelIdx.map((i) => data[i] && (
                <text key={i} x={center(i)} y={HEIGHT - 6} className="fill-muted text-[11px]"
                  textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}>{formatDayLabel(data[i]!.date)}</text>
              ))}
            </svg>
          )}
          {point && active !== null && (
            <div role="status" className="pointer-events-none absolute top-0 z-10 w-44 rounded-xl border border-line bg-surface p-3 text-xs shadow-lg"
              style={{ left: Math.min(Math.max(center(active) - 88, 0), Math.max(0, width - 176)) }}>
              <div className="mb-1 text-muted">{formatDayLabel(point.date)}</div>
              <div className="mb-2 text-base font-semibold text-ink">{point.totalTokens.toLocaleString("id-ID")} token</div>
              {SERIES.map((s) => (
                <div key={s.key} className="flex items-center gap-2">
                  <span className="inline-block h-0.5 w-3 rounded" style={{ background: s.color }} />
                  <span className="font-medium text-ink tabular-nums">{point[s.key].toLocaleString("id-ID")}</span>
                  <span className="text-muted">{s.label}</span>
                </div>
              ))}
              <div className="mt-1 text-muted">{point.requests} permintaan</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
