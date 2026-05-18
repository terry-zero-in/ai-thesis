import { getFixturePortfolioSnapshot, getPortfolioSnapshot, getUniverseChoices } from "@/lib/portfolio-data";
import { AggregateBar } from "./AggregateBar";
import { PositionsTable } from "./PositionsTable";
import { AddPositionForm } from "./AddPositionForm";
import { PortfolioRailRegister } from "@/components/rails/PortfolioRailRegister";

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
          Portfolio
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          Live deployment · single book · manual cost-basis entry
        </span>
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
        <div style={{ flex: 1 }} />
        {snap.spy_as_of && (
          <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--m)" }}>
            Prices as of {snap.spy_as_of}
          </span>
        )}
      </header>

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
          Two-column layout: positions table (left, fluid) + add/edit form
          (right, fixed 320px). The container queries via `.portfolio-grid`
          + media query in globals.css fall back to a stacked single-column
          on viewports where the 10-column positions table can't fit
          alongside the form — prevents the form from overlapping the
          rightmost table columns (edit/close action cell) on mid-width
          screens.
        */}
        <div className="portfolio-grid">
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

          <div className="portfolio-form-col">
            {/*
              Reserve & Triggers lives in the right rail only — it's the
              persistent operating-state context (every page), not a
              canvas-primary surface. AddPositionForm carries its own header.
            */}
            <AddPositionForm
              choices={choices}
              envConfigured={snap.envConfigured}
              takenTickers={taken}
              heldPrefill={heldPrefill}
              initialTicker={editTicker}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
