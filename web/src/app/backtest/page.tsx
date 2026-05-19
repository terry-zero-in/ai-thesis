import { getBacktestSnapshot } from "@/lib/backtest-data";
import { RunRow } from "./RunRow";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";

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
      <NoRail />
      <PageHeader
        title="Backtest"
        subtitle={`${snap.rows.length} run${snap.rows.length === 1 ? "" : "s"} · operator-invoked`}
      />

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
