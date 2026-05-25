"use client";

import { useMemo, useState } from "react";
import type { BacktestPoint, BacktestRun, TurnoverPoint } from "@/lib/backtest-data";

export function RunRow({ run }: { run: BacktestRun }) {
  const [expanded, setExpanded] = useState(false);
  const sparkPath = useMemo(() => {
    const series = run.series?.monthly_returns_net ?? [];
    if (series.length === 0) return null;
    // Cumulative compounding without an outer `let` — React 19's
    // react-hooks lint rule flags re-assigned outer variables inside
    // map callbacks. Pushing into a const array within useMemo is
    // render-deterministic and lint-clean.
    // Series payload may be raw `number[]` (current edge function shape)
    // or `{as_of, ret}[]` (older shape); coerce both to a numeric return.
    const pts: number[] = [];
    for (const p of series) {
      const ret = typeof p === "number" ? p : p.ret;
      const prev = pts.length === 0 ? 1 : pts[pts.length - 1];
      pts.push(prev * (1 + ret));
    }
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const w = 200;
    const h = 28;
    const range = max - min || 1;
    const stride = pts.length > 1 ? w / (pts.length - 1) : 0;
    return pts
      .map((v, i) => {
        const x = i * stride;
        const y = h - ((v - min) / range) * h;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");
  }, [run.series]);

  const s = run.summary;
  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        background: "var(--surface-1)",
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "12px 16px",
          background: "transparent",
          border: 0,
          cursor: "pointer",
          color: "var(--text-1)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        <Meta run={run} />
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <Stat label="Total return" value={pct(s.total_return)} accent={signColor(s.total_return)} />
          <Stat label="Sharpe" value={num(s.sharpe, 2)} />
          <Stat label="Max DD" value={pct(s.max_drawdown)} accent="var(--danger)" />
          <Stat label="Hit rate" value={pct(s.hit_rate)} />
          <Stat label="Avg turnover" value={pct(s.avg_turnover)} />
          <Stat label="Rebalances" value={num(s.rebalance_count, 0)} />
          <div style={{ flex: 1 }} />
          {sparkPath && (
            <svg width={200} height={28} style={{ display: "block", flexShrink: 0 }}>
              <path d={sparkPath} fill="none" stroke="var(--accent)" strokeWidth={1.25} />
            </svg>
          )}
        </div>
      </button>

      {expanded && run.series && (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "12px 16px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            fontSize: 12,
            color: "var(--text-2)",
          }}
        >
          <SeriesGrid
            label="Monthly returns (net)"
            series={zipMonthLabels(run.start_date, run.series.monthly_returns_net)}
            format={(v) => pct(v) + ""}
            signColor
          />
          <SeriesGrid
            label="Turnover"
            series={zipMonthLabels(run.start_date, run.series.turnover)}
            format={(v) => pct(v) + ""}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Walk forward from `start_date` one month at a time and pair each step
 * with the corresponding numeric series value. The edge function stores
 * series as `number[]` (not `{as_of, ret}[]` like the TS type implies),
 * so labels MUST be derived here — and Date.setMonth(getMonth()+1) is the
 * only path that rolls the year correctly on December → January.
 * Prior bug: slicing a typed-but-undefined `as_of` produced "—" labels
 * and the year never rolled (THS-101 item 6).
 */
function zipMonthLabels(
  startDate: string,
  values: ReadonlyArray<BacktestPoint | TurnoverPoint>,
): Array<{ as_of: string; value: number }> {
  // Parse start_date as UTC midnight so DST shifts don't bump months around.
  const d = new Date(`${startDate}T00:00:00Z`);
  const out: Array<{ as_of: string; value: number }> = [];
  for (let i = 0; i < values.length; i++) {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const v = values[i];
    let num: number;
    if (typeof v === "number") {
      num = v;
    } else if ("ret" in v) {
      num = v.ret;
    } else {
      num = v.turnover;
    }
    out.push({ as_of: `${yyyy}-${mm}-01`, value: num });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 78 }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-3)",
          textTransform: "uppercase",
          letterSpacing: ".06em",
          fontFamily: "var(--m)",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 14, fontFamily: "var(--m)", color: accent ?? "var(--text-1)" }}>{value}</span>
    </div>
  );
}

function SeriesGrid({
  label,
  series,
  format,
  signColor: useSignColor = false,
}: {
  label: string;
  series: Array<{ as_of: string; value: number }>;
  format: (v: number) => string;
  signColor?: boolean;
}) {
  return (
    <section>
      <div
        style={{
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: ".08em",
          color: "var(--text-3)",
          fontFamily: "var(--m)",
          marginBottom: 6,
        }}
      >
        {label} · {series.length} pts
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
          gap: "4px 12px",
          fontFamily: "var(--m)",
          fontSize: 11,
        }}
      >
        {series.map((p) => (
          <div key={p.as_of} style={{ display: "flex", justifyContent: "space-between", gap: 6 }}>
            <span style={{ color: "var(--text-3)" }}>{p.as_of.slice(0, 7)}</span>
            <span style={{ color: useSignColor ? signColor(p.value) : "var(--text-1)" }}>{format(p.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Meta({ run }: { run: BacktestRun }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        fontSize: 11,
        color: "var(--text-3)",
        textTransform: "uppercase",
        letterSpacing: ".06em",
        fontFamily: "var(--m)",
      }}
    >
      <span>{run.ran_at.slice(0, 10)}</span>
      <span>·</span>
      <span>{run.start_date} → {run.end_date}</span>
      <span>·</span>
      <span>N={run.params.top_n}</span>
      <span>·</span>
      <span>{run.params.cost_bps}bps</span>
      {run.note && (
        <>
          <span>·</span>
          <span style={{ color: "var(--text-2)", textTransform: "none", letterSpacing: 0 }}>{run.note}</span>
        </>
      )}
    </div>
  );
}

function pct(v: number | null): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const sign = v > 0 ? "+" : "";
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function num(v: number | null, dp = 2): string {
  if (v == null || !Number.isFinite(v)) return "—";
  return v.toFixed(dp);
}

function signColor(v: number | null): string {
  if (v == null) return "var(--text-1)";
  if (v > 0) return "var(--success)";
  if (v < 0) return "var(--danger)";
  return "var(--text-1)";
}
