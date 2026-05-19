"use client";

import { useMemo, useRef, useState } from "react";

/**
 * PortfolioValueChart — instrument-grade chart for the /dashboard surface.
 *
 * v2 (this rewrite) follows the Claude Design "AI Thesis — Dashboard.html"
 * reference pattern Terry surfaced 2026-05-19 — a Bloomberg/Mercury-class
 * NAV chart with the full instrumentation kit: Y-axis tick labels (right-
 * anchored $X.Xk format, 5 ticks), X-axis date labels (5 evenly-spaced),
 * subtle horizontal grid lines, area fill under the NAV line, HIGH/LOW
 * canvas annotations with dot markers, dashed cost-basis horizontal
 * reference line, and a footer summary strip (30d high · 30d low · max
 * drawdown). Hover surfaces a crosshair + dot + tooltip card with NAV +
 * delta-from-cost-basis.
 *
 * v1 used LineChart primitive + overlay divs. v2 ditches that for a
 * single custom SVG so all elements (grid, axes, line, ref-line, dots,
 * area) share one coordinate space. LineChart primitive stays for the
 * lighter consumers (Sparkline, NameScoreChart, PortfolioHeroChart).
 *
 * Synthesize() rewritten to walk cost-basis → currentValue across the
 * range with bounded noise — gives the chart a real "bought at X, today
 * at Y" shape instead of pure noise around currentValue. Anchored
 * endpoints: start = costBasis, end = currentValue.
 *
 * NOTE: SPY-normalized series referenced in the source mock is NOT
 * included here — we don't have SPY-series data wired through yet. When
 * the SPY time-series lands, add it as a second dashed line per the
 * mock's --quiet stroke pattern.
 */
type RangeKey = "1D" | "5D" | "1M" | "6M" | "YTD" | "1Y" | "All";

const RANGES: { key: RangeKey; days: number; label: string }[] = [
  { key: "1D", days: 1, label: "1D" },
  { key: "5D", days: 5, label: "5D" },
  { key: "1M", days: 30, label: "1M" },
  { key: "6M", days: 180, label: "6M" },
  { key: "YTD", days: 138, label: "YTD" },
  { key: "1Y", days: 365, label: "1Y" },
  { key: "All", days: 730, label: "All" },
];

const CHART_H = 280;
const VIEW_W = 1200;
const VIEW_H = 280;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 30;
const INNER_W = VIEW_W - PAD_L - PAD_R;
const INNER_H = VIEW_H - PAD_T - PAD_B;

export function PortfolioValueChart({
  currentValue,
  costBasis,
  empty,
  synthetic,
}: {
  currentValue: number;
  costBasis: number;
  empty: boolean;
  synthetic: boolean;
}) {
  const [range, setRange] = useState<RangeKey>("1M");
  const days = RANGES.find((r) => r.key === range)?.days ?? 30;

  const series = useMemo(
    () => synthesize(currentValue, costBasis, days, empty),
    [currentValue, costBasis, days, empty],
  );
  const data = series.values;
  const dates = series.dates;

  const sinceOpenPl = empty ? 0 : currentValue - data[0];
  const sinceOpenPct = data[0] > 0 ? (sinceOpenPl / data[0]) * 100 : 0;
  const sinceOpenPos = sinceOpenPl >= 0;

  const vsCostPl = empty ? 0 : currentValue - costBasis;
  const vsCostPct = costBasis > 0 ? (vsCostPl / costBasis) * 100 : 0;
  const vsCostPos = vsCostPl >= 0;

  // High / low / max-drawdown
  const stats = useMemo(() => computeStats(data, dates), [data, dates]);

  return (
    <div
      style={{
        // Linear gradient: --surface (#0B0C12) at the top → #07080E at the
        // bottom (each RGB stepped down 4). Whisper-subtle — just enough
        // depth to give the chart panel weight without breaking continuity
        // with the rest of the dashboard chrome.
        background: "linear-gradient(180deg, var(--surface) 0%, #07080E 100%)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "16px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              color: "var(--text-3)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              fontWeight: 500,
            }}
          >
            Portfolio · NAV
          </span>
          <Headline value={currentValue} empty={empty} />
          {!empty && (
            <div
              style={{
                fontFamily: "var(--m)",
                fontSize: 12.5,
                color: "var(--text-2)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1.5,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "baseline",
                gap: 12,
              }}
            >
              <span style={{ color: sinceOpenPos ? "var(--success)" : "var(--danger)" }}>
                {sinceOpenPos ? "+" : "−"}${Math.abs(sinceOpenPl).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
              </span>
              <span style={{ color: sinceOpenPos ? "var(--success)" : "var(--danger)" }}>
                ({sinceOpenPos ? "+" : "−"}{Math.abs(sinceOpenPct).toFixed(2)}%)
              </span>
              <span style={{ color: "var(--text-3)" }}>since open</span>
              <span style={{ color: "var(--text-4)" }}>·</span>
              <KeyVal k="vs cost" sign={vsCostPos ? "+" : "−"} value={`$${Math.abs(vsCostPl).toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`} pct={`${vsCostPos ? "+" : "−"}${Math.abs(vsCostPct).toFixed(2)}%`} positive={vsCostPos} />
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <RangePicker value={range} onChange={setRange} />
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: CHART_H, position: "relative" }}>
        {empty ? (
          <ChartEmpty />
        ) : (
          <ChartCanvas data={data} dates={dates} costBasis={costBasis} stats={stats} />
        )}
      </div>

      {/* Footer summary */}
      {!empty && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 14,
            fontFamily: "var(--m)",
            fontSize: 10.5,
            color: "var(--text-4)",
            letterSpacing: ".02em",
            paddingTop: 2,
          }}
        >
          <Legend swatch="solid" color="var(--accent)" label="NAV" />
          <Legend swatch="dashed" color="var(--text-3)" label="Cost basis" />
          <Sep />
          <span>
            30d high <Mono>${stats.high.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Mono>{" "}
            <Quiet>({fmtShortDate(stats.high.date)})</Quiet>
          </span>
          <Sep />
          <span>
            30d low <Mono>${stats.low.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}</Mono>{" "}
            <Quiet>({fmtShortDate(stats.low.date)})</Quiet>
          </span>
          <Sep />
          <span>
            max drawdown{" "}
            <span style={{ color: "var(--danger)" }}>
              {stats.maxDrawdownPct === 0 ? "—" : `−${stats.maxDrawdownPct.toFixed(2)}%`}
            </span>
          </span>
        </div>
      )}

      {/* Provenance */}
      {!empty && synthetic && (
        <div
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-4)",
            letterSpacing: ".04em",
            paddingTop: 4,
          }}
        >
          Fixture · deterministic walk from cost basis → current value · SPY-normalized overlay
          lands when SPY time-series wires up
        </div>
      )}
    </div>
  );
}

/* ----------------- headline ----------------- */

function Headline({ value, empty }: { value: number; empty: boolean }) {
  if (empty) {
    return (
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 44,
          fontWeight: 500,
          color: "var(--text-4)",
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1,
          letterSpacing: "-.025em",
          marginTop: 2,
        }}
      >
        —
      </span>
    );
  }
  // Split into whole + decimal so .XX renders dimmer per mock pattern.
  const whole = Math.floor(Math.abs(value)).toLocaleString("en-US");
  const cents = (Math.abs(value) % 1).toFixed(2).slice(1); // ".41"
  const sign = value < 0 ? "−" : "";
  return (
    <span
      style={{
        fontFamily: "var(--m)",
        fontSize: 44,
        fontWeight: 500,
        color: "var(--text-1)",
        fontVariantNumeric: "tabular-nums",
        lineHeight: 1,
        letterSpacing: "-.025em",
        marginTop: 2,
      }}
    >
      {sign}${whole}
      <span style={{ color: "var(--text-3)", fontWeight: 400 }}>{cents}</span>
    </span>
  );
}

function KeyVal({
  k,
  sign,
  value,
  pct,
  positive,
}: {
  k: string;
  sign: string;
  value: string;
  pct: string;
  positive: boolean;
}) {
  const color = positive ? "var(--success)" : "var(--danger)";
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-4)",
          letterSpacing: ".14em",
          textTransform: "uppercase",
        }}
      >
        {k}
      </span>
      <span style={{ color }}>
        {sign}{value.replace("$-", "$").replace("$−", "$")}
      </span>
      <span style={{ color, fontSize: 11.5 }}>({pct})</span>
    </span>
  );
}

/* ----------------- range picker ----------------- */

function RangePicker({ value, onChange }: { value: RangeKey; onChange: (k: RangeKey) => void }) {
  return (
    <div
      style={{
        display: "flex",
        gap: 2,
        background: "var(--canvas)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 4,
        padding: 2,
      }}
    >
      {RANGES.map((r) => {
        const active = r.key === value;
        return (
          <button
            key={r.key}
            onClick={() => onChange(r.key)}
            style={{
              fontSize: 10.5,
              fontFamily: "var(--m)",
              fontWeight: active ? 600 : 400,
              color: active ? "var(--text-1)" : "var(--text-3)",
              background: active ? "var(--elevated)" : "transparent",
              border: "none",
              padding: "3px 8px",
              borderRadius: 3,
              cursor: "pointer",
              letterSpacing: ".02em",
              transition: "background var(--dur-instant) var(--ease-out)",
            }}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------- chart canvas (custom SVG) ----------------- */

type Stats = {
  high: { value: number; date: Date; idx: number };
  low: { value: number; date: Date; idx: number };
  maxDrawdownPct: number;
};

function computeStats(values: number[], dates: Date[]): Stats {
  let hiIdx = 0;
  let loIdx = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[hiIdx]) hiIdx = i;
    if (values[i] < values[loIdx]) loIdx = i;
  }
  // Max drawdown: largest peak-to-trough decline
  let peak = values[0];
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? (peak - v) / peak : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return {
    high: { value: values[hiIdx], date: dates[hiIdx], idx: hiIdx },
    low: { value: values[loIdx], date: dates[loIdx], idx: loIdx },
    maxDrawdownPct: maxDd * 100,
  };
}

function ChartCanvas({
  data,
  dates,
  costBasis,
  stats,
}: {
  data: number[];
  dates: Date[];
  costBasis: number;
  stats: Stats;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ idx: number } | null>(null);

  // Y-axis range — include cost basis in the bounds so the reference line
  // always renders inside the chart.
  const yMinRaw = Math.min(...data, costBasis);
  const yMaxRaw = Math.max(...data, costBasis);
  const yPad = (yMaxRaw - yMinRaw) * 0.18 || yMaxRaw * 0.05;
  const yMin = yMinRaw - yPad;
  const yMax = yMaxRaw + yPad / 2;

  const xAt = (i: number) => PAD_L + (data.length <= 1 ? 0 : i / (data.length - 1)) * INNER_W;
  const yAt = (v: number) => PAD_T + (1 - (v - yMin) / (yMax - yMin)) * INNER_H;

  // Y-axis ticks (5 evenly spaced)
  const tickCount = 4;
  const ticks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(yMin + (yMax - yMin) * (i / tickCount));
  }

  // X-axis labels (5 evenly spaced indices)
  const xLabelIdxs = [0, Math.round((data.length - 1) * 0.25), Math.round((data.length - 1) * 0.5), Math.round((data.length - 1) * 0.75), data.length - 1];

  // NAV path
  const navPath = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)},${yAt(v).toFixed(2)}`)
    .join(" ");
  const navArea =
    navPath +
    ` L${xAt(data.length - 1).toFixed(2)},${(PAD_T + INNER_H).toFixed(2)}` +
    ` L${xAt(0).toFixed(2)},${(PAD_T + INNER_H).toFixed(2)} Z`;

  // Cost basis horizontal line
  const cbY = yAt(costBasis);

  // Hover handler
  function handleMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xPx = e.clientX - rect.left;
    const ratio = (xPx / rect.width) * VIEW_W;
    const usable = (ratio - PAD_L) / INNER_W;
    if (usable < 0 || usable > 1) {
      setHover(null);
      return;
    }
    const i = Math.max(0, Math.min(data.length - 1, Math.round(usable * (data.length - 1))));
    setHover({ idx: i });
  }

  const hoverIdx = hover?.idx ?? null;
  const hoverXPct = hoverIdx != null ? (xAt(hoverIdx) / VIEW_W) * 100 : 0;
  const hoverYPct = hoverIdx != null ? (yAt(data[hoverIdx]) / VIEW_H) * 100 : 0;

  // HIGH/LOW annotation positions (HTML overlay so text isn't clipped)
  const hiXPct = (xAt(stats.high.idx) / VIEW_W) * 100;
  const hiYPct = (yAt(stats.high.value) / VIEW_H) * 100;
  const loXPct = (xAt(stats.low.idx) / VIEW_W) * 100;
  const loYPct = (yAt(stats.low.value) / VIEW_H) * 100;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
      style={{ position: "relative", width: "100%", height: "100%", cursor: "crosshair" }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <linearGradient id="nav-fill-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.32" />
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.06" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid lines + Y-axis tick labels */}
        {ticks.map((t, i) => {
          const y = yAt(t);
          return (
            <g key={i}>
              <line
                x1={PAD_L}
                y1={y}
                x2={VIEW_W - PAD_R}
                y2={y}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
              <text
                x={PAD_L - 8}
                y={y + 3}
                textAnchor="end"
                fill="var(--text-4)"
                fontFamily="var(--m)"
                fontSize={10}
                letterSpacing="0.5"
              >
                ${(t / 1000).toFixed(1)}k
              </text>
            </g>
          );
        })}

        {/* Cost basis dashed reference line */}
        <line
          x1={PAD_L}
          y1={cbY}
          x2={VIEW_W - PAD_R}
          y2={cbY}
          stroke="var(--text-3)"
          strokeWidth={1.2}
          strokeDasharray="4 4"
          opacity={0.6}
        />

        {/* NAV area fill */}
        <path d={navArea} fill="url(#nav-fill-grad)" />

        {/* NAV line */}
        <path
          d={navPath}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={1.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* HIGH marker dot */}
        <circle
          cx={xAt(stats.high.idx)}
          cy={yAt(stats.high.value)}
          r={3.5}
          fill="var(--success)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
        {/* LOW marker dot */}
        <circle
          cx={xAt(stats.low.idx)}
          cy={yAt(stats.low.value)}
          r={3.5}
          fill="var(--danger)"
          stroke="var(--surface)"
          strokeWidth={2}
        />
      </svg>

      {/* HIGH label (HTML overlay so it doesn't scale with SVG aspect) */}
      <div
        style={{
          position: "absolute",
          left: `${hiXPct}%`,
          top: `${hiYPct}%`,
          transform: hiXPct > 70 ? "translate(-110%, -160%)" : "translate(12px, -160%)",
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-3)",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        HIGH ${stats.high.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </div>
      {/* LOW label */}
      <div
        style={{
          position: "absolute",
          left: `${loXPct}%`,
          top: `${loYPct}%`,
          transform: loXPct > 70 ? "translate(-110%, 50%)" : "translate(12px, 50%)",
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-3)",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          pointerEvents: "none",
        }}
      >
        LOW ${stats.low.value.toLocaleString("en-US", { maximumFractionDigits: 0 })}
      </div>

      {/* Crosshair + hover */}
      {hoverIdx != null && (
        <>
          <div
            style={{
              position: "absolute",
              left: `${hoverXPct}%`,
              top: 0,
              bottom: `${(PAD_B / VIEW_H) * 100}%`,
              width: 1,
              borderLeft: "1px dashed rgba(255,255,255,0.22)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${hoverXPct}%`,
              top: `${hoverYPct}%`,
              width: 8,
              height: 8,
              marginLeft: -4,
              marginTop: -4,
              borderRadius: "50%",
              background: "var(--accent)",
              boxShadow: "0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent)",
              pointerEvents: "none",
            }}
          />
          <HoverTooltip
            value={data[hoverIdx]}
            date={dates[hoverIdx]}
            costBasis={costBasis}
            containerXPct={hoverXPct}
          />
        </>
      )}

      {/* X-axis date labels (HTML overlay below the chart canvas) */}
      <div
        style={{
          position: "absolute",
          left: `${(PAD_L / VIEW_W) * 100}%`,
          right: `${(PAD_R / VIEW_W) * 100}%`,
          bottom: 4,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-4)",
          letterSpacing: "0.05em",
          pointerEvents: "none",
        }}
      >
        {xLabelIdxs.map((i, k) => (
          <span key={k}>
            {k === xLabelIdxs.length - 1 ? "TODAY" : fmtShortDate(dates[i]).toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}

function HoverTooltip({
  value,
  date,
  costBasis,
  containerXPct,
}: {
  value: number;
  date: Date;
  costBasis: number;
  containerXPct: number;
}) {
  const delta = value - costBasis;
  const pct = costBasis > 0 ? (delta / costBasis) * 100 : 0;
  const pos = delta >= 0;
  const leftEdge = containerXPct < 12;
  const rightEdge = containerXPct > 88;
  const transform = leftEdge
    ? "translateX(6px)"
    : rightEdge
      ? "translateX(calc(-100% - 6px))"
      : "translateX(-50%)";
  return (
    <div
      style={{
        position: "absolute",
        left: `${containerXPct}%`,
        top: 6,
        transform,
        background: "var(--elevated)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 3,
        minWidth: 140,
        pointerEvents: "none",
        whiteSpace: "nowrap",
        boxShadow: "0 4px 14px rgba(0,0,0,.4)",
        zIndex: 4,
      }}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10,
          color: "var(--text-4)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        {fmtLongDate(date)}
      </span>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--m)", fontSize: 10.5, color: "var(--text-4)", letterSpacing: "0.05em" }}>NAV</span>
        <span style={{ fontFamily: "var(--m)", fontSize: 12, color: "var(--text-1)", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
          ${value.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
        <span style={{ fontFamily: "var(--m)", fontSize: 10.5, color: "var(--text-4)", letterSpacing: "0.05em" }}>vs cost</span>
        <span style={{ fontFamily: "var(--m)", fontSize: 11.5, color: pos ? "var(--success)" : "var(--danger)", fontVariantNumeric: "tabular-nums" }}>
          {pos ? "+" : "−"}${Math.abs(delta).toLocaleString("en-US", { maximumFractionDigits: 0 })} · {pos ? "+" : "−"}{Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

/* ----------------- footer helpers ----------------- */

function Legend({ swatch, color, label }: { swatch: "solid" | "dashed"; color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "var(--text-3)" }}>
      <span
        style={{
          width: 12,
          height: 2,
          background:
            swatch === "solid"
              ? color
              : `repeating-linear-gradient(to right, ${color} 0 4px, transparent 4px 7px)`,
        }}
      />
      {label}
    </span>
  );
}

function Sep() {
  return <span style={{ color: "var(--text-4)" }}>·</span>;
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{children}</span>
  );
}

function Quiet({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "var(--text-4)" }}>{children}</span>;
}

function ChartEmpty() {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text-4)",
        fontSize: 12,
        fontFamily: "var(--m)",
      }}
    >
      No positions yet — chart renders once your book has history.
    </div>
  );
}

/* ----------------- formatters ----------------- */

function fmtShortDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function fmtLongDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/* ----------------- synthesize ----------------- */

/**
 * Walk from cost basis (i=0) to currentValue (i=points-1) with bounded
 * noise. Honest fixture: chart starts where the user bought in, ends at
 * today's value. Cost-basis horizontal line will appear at the start
 * point. When currentValue < costBasis → downtrend (loss); when
 * currentValue > costBasis → uptrend (gain). No drift, no negative
 * compounding — endpoints are anchored.
 */
function synthesize(
  currentValue: number,
  costBasis: number,
  days: number,
  empty: boolean,
): { values: number[]; dates: Date[] } {
  const points = Math.max(2, Math.min(days, 730));
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dates: Date[] = [];
  for (let i = 0; i < points; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - (points - 1 - i));
    dates.push(d);
  }

  if (empty || currentValue <= 0) {
    return { values: Array(points).fill(0), dates };
  }

  const startValue = costBasis > 0 ? costBasis : currentValue;
  const noiseScale = Math.max(currentValue, startValue) * 0.012; // ±0.6%
  const values: number[] = [];
  let s = Math.floor(currentValue + startValue);
  for (let i = 0; i < points; i++) {
    const t = points === 1 ? 1 : i / (points - 1);
    const trend = startValue * (1 - t) + currentValue * t;
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = (s / 0x7fffffff - 0.5) * 2 * noiseScale;
    let v: number;
    if (i === 0) {
      v = startValue; // anchor start at cost basis
    } else if (i === points - 1) {
      v = currentValue; // anchor end at current value
    } else {
      v = trend + noise;
    }
    values.push(v);
  }
  return { values, dates };
}
