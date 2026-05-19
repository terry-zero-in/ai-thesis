import { getFixturePortfolioSnapshot, getPortfolioSnapshot, getUniverseChoices } from "@/lib/portfolio-data";
import { AggregateBar } from "./AggregateBar";
import { PositionsTable } from "./PositionsTable";
import { PortfolioAddDrawer } from "./PortfolioAddDrawer";
import { PortfolioRailRegister } from "@/components/rails/PortfolioRailRegister";
import { PageHeader } from "@/components/primitives/PageHeader";
import { PortfolioValueChart } from "@/components/dashboard/PortfolioValueChart";

/**
 * Revalidate every 5 minutes so current prices refresh without the
 * operator forcing a hard reload. Each manual edit also calls
 * revalidatePath('/portfolio') from the server action.
 */
export const revalidate = 300;

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ seed?: string; edit?: string }>;
}) {
  // ?seed=fixture-positions populates a 12-position demo book for /lambo
  // review (lambo §2.4 #1). Empty fixture mode otherwise.
  // ?edit=<TICKER> pre-selects that ticker in the add/edit form and
  // hydrates its fields from the existing portfolio_positions row.
  const params = await searchParams;
  const demo = params.seed === "fixture-positions";
  const editTicker = params.edit ? params.edit.toUpperCase() : null;
  const [snap, choices] = await Promise.all([
    demo ? Promise.resolve(getFixturePortfolioSnapshot()) : getPortfolioSnapshot(),
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
        subtitle={
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span>Live tracking · single book · manual cost-basis entry</span>
            {demo && (
              // Honest demo marker — spec §4.5 chip, --warning to signal
              // "synthetic data, not live." Clears with /portfolio (no seed).
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "var(--m)",
                  color: "var(--warning)",
                  background: "var(--warning-soft)",
                  border: "1px solid rgba(221,168,90,.30)",
                  padding: "1px 5px",
                  borderRadius: 3,
                  letterSpacing: ".05em",
                  textTransform: "uppercase",
                }}
                title="Synthetic 12-position book seeded via ?seed=fixture-positions for /lambo review."
              >
                Demo · fixture book
              </span>
            )}
          </span>
        }
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
          {
            label: "mode",
            value: (
              <span
                style={{
                  color: demo ? "var(--warning)" : "var(--success)",
                  fontWeight: 600,
                  letterSpacing: ".02em",
                }}
                title={
                  demo
                    ? "Demo: synthetic 12-position book seeded via ?seed=fixture-positions."
                    : "Live: cost-basis entries from public.portfolio_positions; market values from public.prices_raw."
                }
              >
                {demo ? "Demo" : "Live"}
              </span>
            ),
          },
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
          Full instrumented NAV chart (task #79). Same component the
          dashboard uses — range selector, grid, axes, HIGH/LOW dot
          markers, cost-basis dashed reference line, hover crosshair +
          tooltip. AggregateBar's 30D column carries the at-a-glance
          delta; this chart carries the range-selectable drill-down.
          Both surfaces deliberately overlap on the 30D window — calmer
          hero glance on top, drillable canvas below.
        */}
        <PortfolioValueChart
          currentValue={snap.total_market_value}
          costBasis={snap.total_deployed}
          empty={snap.empty}
          synthetic={snap.synthetic_prices}
          compact
        />

        {/*
          Positions table claims the full canvas width — the add/edit form
          was hoisted to the page-header PortfolioAddDrawer (above), which
          eliminated the form-vs-table crowding problem at the source. No
          responsive grid, no sticky form column, no 1600px breakpoint.
          Reserve & Triggers continues to live in the right rail.
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
