import { getPortfolioSnapshot, getUniverseChoices } from "@/lib/portfolio-data";
import { AggregateBar } from "./AggregateBar";
import { PositionsTable } from "./PositionsTable";
import { AddPositionForm } from "./AddPositionForm";
import { ReservePanel } from "./ReservePanel";

/**
 * Revalidate every 5 minutes so current prices refresh without the
 * operator forcing a hard reload. Each manual edit also calls
 * revalidatePath('/portfolio') from the server action.
 */
export const revalidate = 300;

export default async function PortfolioPage() {
  const snap = await getPortfolioSnapshot();
  const choices = getUniverseChoices();
  const taken = snap.positions.map((p) => p.ticker);

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
          Portfolio
        </h1>
        <span style={{ fontSize: 12.5, color: "var(--text-3)" }}>
          Live deployment · single book · manual cost-basis entry
        </span>
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
