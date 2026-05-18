import { getFixturePortfolioSnapshot, getPortfolioSnapshot, getUniverseChoices } from "@/lib/portfolio-data";
import { AggregateBar } from "./AggregateBar";
import { PositionsTable } from "./PositionsTable";
import { AddPositionForm } from "./AddPositionForm";
import { ReservePanel } from "./ReservePanel";
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
  searchParams: Promise<{ seed?: string }>;
}) {
  // ?seed=fixture-positions populates a 12-position demo book for /lambo
  // review (lambo §2.4 #1). Empty fixture mode otherwise.
  const params = await searchParams;
  const demo = params.seed === "fixture-positions";
  const snap = demo ? getFixturePortfolioSnapshot() : await getPortfolioSnapshot();
  const choices = getUniverseChoices();
  const taken = snap.positions.map((p) => p.ticker);
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 300px",
            gap: 32,
            alignItems: "start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <PositionsTable positions={snap.positions} totalDeployed={snap.total_deployed} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "sticky", top: 0 }}>
            <ReservePanel snap={snap} />
            {/* AddPositionForm provides its own header (toggles Add/Update). */}
            <AddPositionForm choices={choices} envConfigured={snap.envConfigured} takenTickers={taken} />
          </div>
        </div>
      </div>
    </div>
  );
}
