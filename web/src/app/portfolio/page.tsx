import { getPortfolioSnapshot, getUniverseChoices } from "@/lib/portfolio-data";
import { AggregateBar } from "./AggregateBar";
import { PositionsTable } from "./PositionsTable";
import { PortfolioAddDrawer } from "./PortfolioAddDrawer";
import { PortfolioRailRegister } from "@/components/rails/PortfolioRailRegister";
import { PageHeader } from "@/components/primitives/PageHeader";

/**
 * Revalidate every 5 minutes so current prices refresh without the
 * operator forcing a hard reload. Each manual edit also calls
 * revalidatePath('/portfolio') from the server action.
 */
export const revalidate = 300;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  // ?edit=<TICKER> pre-selects that ticker in the add/edit form and
  // hydrates its fields from the existing portfolio_positions row.
  const params = await searchParams;
  const editTicker = params.edit ? params.edit.toUpperCase() : null;
  const [snap, choices] = await Promise.all([
    getPortfolioSnapshot(),
    getUniverseChoices(),
  ]);
  const taken = snap.positions.map((p) => p.ticker);
  const heldPrefill = snap.positions.map((p) => ({
    ticker: p.ticker,
    shares: p.shares,
    cost_basis: p.cost_basis,
    opened_at: p.opened_at,
    notes: p.notes,
  }));
  const railData = {
    reserveActual: snap.reserve_actual,
    reserveTarget: snap.settings.target_reserve,
    totalCapital: snap.settings.total_capital,
    positionTriggerCount: snap.position_triggers.length,
    positionTriggerDetail:
      snap.position_triggers.length === 0
        ? "No held position is down ≥7% from cost basis."
        : snap.position_triggers.map((t) => `${t.ticker} ${(t.pct_drawdown * 100).toFixed(1)}%`).join(" · "),
    marketTriggers: snap.market_triggers,
    asOf: snap.spy_as_of,
    empty: snap.empty,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <PortfolioRailRegister data={railData} />
      <PageHeader
        title="Portfolio"
        subtitle="Live tracking · single book · manual cost-basis entry"
        action={
          <PortfolioAddDrawer
            choices={choices}
            envConfigured={snap.envConfigured}
            takenTickers={taken}
            heldPrefill={heldPrefill}
            initialTicker={editTicker}
          />
        }
        meta={[
          { label: "positions", value: snap.positions.length },
          { label: "as_of", value: snap.spy_as_of ?? "—" },
          { label: "price chain", value: "FMP daily close · refreshes 5 min" },
        ]}
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px 40px",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <AggregateBar snap={snap} />

        {/*
          NAV chart deliberately lives ONLY on /dashboard. /portfolio's job
          is the positions book (add/edit/close); duplicating the chart here
          made the two pages read too similar AND pushed the positions table
          below the fold on standard viewports (Terry feedback 2026-05-19).
          AggregateBar still carries the 30D delta + sparkline in column 2 —
          enough at-a-glance trend signal for a positions-management surface.
          Dashboard owns the range-selectable drill-down.

          Positions table now claims the full canvas height — no inner
          scroll-trap, no fold cutoff. The outer overflow:auto on the
          parent flex column handles scroll naturally.
        */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            minWidth: 0,
            overflowX: "auto",
          }}
        >
          <PositionsTable positions={snap.positions} totalDeployed={snap.total_deployed} />
        </div>
      </div>
    </div>
  );
}
