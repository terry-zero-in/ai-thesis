import type { PortfolioSnapshot, MarketTrigger } from "@/lib/portfolio-types";

/**
 * Reserve tracker + market trigger alerts. Server-rendered alongside the
 * positions table so the trigger state matches the page snapshot exactly.
 */
export function ReservePanel({ snap }: { snap: PortfolioSnapshot }) {
  const { settings, reserve_actual, market_triggers, position_triggers } = snap;
  const reservePct = settings.total_capital > 0 ? reserve_actual / settings.total_capital : 0;
  const targetPct = settings.total_capital > 0 ? settings.target_reserve / settings.total_capital : 0;
  const onTarget = reserve_actual >= settings.target_reserve;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <section style={cardStyle()}>
        <Header label="Reserve" />
        <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontFamily: "var(--m)",
                fontSize: 22,
                fontWeight: 600,
                color: onTarget ? "var(--text-1)" : "var(--danger)",
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {fmtUsd(reserve_actual)}
            </span>
            <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
              of {fmtUsd(settings.total_capital)}
            </span>
          </div>
          <div style={{ height: 4, background: "rgba(255,255,255,.04)", borderRadius: 2, overflow: "hidden", position: "relative" }}>
            <div
              style={{
                width: `${Math.max(0, Math.min(100, reservePct * 100))}%`,
                height: "100%",
                background: onTarget ? "var(--accent)" : "var(--danger)",
                opacity: 0.7,
              }}
            />
            <div
              title={`Target reserve: ${fmtUsd(settings.target_reserve)}`}
              style={{
                position: "absolute",
                left: `${Math.max(0, Math.min(100, targetPct * 100))}%`,
                top: -2,
                width: 1,
                height: 8,
                background: "var(--text-2)",
                opacity: 0.6,
              }}
            />
          </div>
          <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
            Target {fmtUsd(settings.target_reserve)} ({(targetPct * 100).toFixed(0)}%).{" "}
            {onTarget
              ? "On target."
              : `Over-deployed by ${fmtUsd(settings.target_reserve - reserve_actual)}.`}
          </div>
        </div>
      </section>

      <section style={cardStyle()}>
        <Header label="Triggers" />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <TriggerRow
            label="Position drawdown > 7%"
            fired={position_triggers.length > 0}
            detail={
              position_triggers.length === 0
                ? "No held position is down ≥7% from cost basis."
                : position_triggers
                    .map((t) => `${t.ticker} ${(t.pct_drawdown * 100).toFixed(1)}%`)
                    .join(" · ")
            }
          />
          {market_triggers.map((t) => (
            <MarketTriggerRow key={t.kind} t={t} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MarketTriggerRow({ t }: { t: MarketTrigger }) {
  const label = t.kind === "spy_daily_drop" ? "SPY single-day drop ≥ 5%" : "VIX > 25 for 3+ days";
  return <TriggerRow label={label} fired={t.fired} detail={t.detail} />;
}

function TriggerRow({
  label,
  fired,
  detail,
}: {
  label: string;
  fired: boolean;
  detail: string;
}) {
  return (
    <div
      style={{
        padding: "10px 14px",
        borderTop: "1px solid var(--border-subtle)",
        background: fired ? "rgba(251,113,133,.05)" : undefined,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: fired ? "var(--danger)" : "rgba(255,255,255,.15)",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 12, color: "var(--text-1)", fontFamily: "var(--m)" }}>{label}</span>
        <div style={{ flex: 1 }} />
        <span
          style={{
            fontSize: 9.5,
            fontFamily: "var(--m)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
            color: fired ? "var(--danger)" : "var(--text-3)",
          }}
        >
          {fired ? "fired" : "clear"}
        </span>
      </div>
      <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>{detail}</div>
    </div>
  );
}

function Header({ label }: { label: string }) {
  return (
    <div
      style={{
        padding: "11px 14px",
        fontSize: 11,
        fontFamily: "var(--m)",
        fontWeight: 500,
        color: "var(--text-3)",
        letterSpacing: ".06em",
        textTransform: "uppercase",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      {label}
    </div>
  );
}

function cardStyle(): React.CSSProperties {
  return {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    overflow: "hidden",
  };
}

function fmtUsd(n: number): string {
  const sign = n < 0 ? "-" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${sign}$${body}`;
}
