import { getBacktestSnapshot } from "@/lib/backtest-data";
import { RunRow } from "./RunRow";

/**
 * Revalidate every 30 min. Backtest runs are operator-invoked
 * (not on cron), so a long ISR window is fine — fresh data only
 * shows up after run-backtest is invoked anyway.
 */
export const revalidate = 1800;

export default async function BacktestPage() {
  const snap = await getBacktestSnapshot();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header
        style={{
          padding: "18px 28px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: "-.014em",
            color: "var(--text-1)",
            fontFamily: "var(--m)",
          }}
        >
          Backtest
        </h1>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>
          {snap.rows.length} run{snap.rows.length === 1 ? "" : "s"} · operator-invoked
          {snap.synthetic ? " · fixture mode" : ""}
        </span>
      </header>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "16px 28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {snap.rows.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-3)", paddingTop: 24 }}>
            No backtest runs yet. Invoke <code>run-backtest</code> to seed this page.
          </div>
        ) : (
          snap.rows.map((r) => <RunRow key={r.id} run={r} />)
        )}
      </div>
    </div>
  );
}
