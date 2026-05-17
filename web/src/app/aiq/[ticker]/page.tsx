import Link from "next/link";
import { getAiqContext } from "@/lib/aiq-data";
import { AiqEditor } from "./AiqEditor";
import { AiqHistory } from "./AiqHistory";
import { LayerChip } from "@/components/universe/LayerChip";
import { AiqRailRegister } from "@/components/rails/AiqRailRegister";
import type { AiqHistoryRailRow } from "@/components/rails/AiqHistoryRail";

interface Params {
  ticker: string;
}

export default async function AiqEditorPage({ params }: { params: Promise<Params> }) {
  const { ticker } = await params;
  const tickerUpper = ticker.toUpperCase();
  const ctx = await getAiqContext(tickerUpper);

  if (!ctx.seed) {
    return (
      <div style={{ flex: 1, padding: 32, color: "var(--text-2)" }}>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>{tickerUpper} not in universe</h1>
        <p style={{ color: "var(--text-3)", fontSize: 13 }}>
          AIQ scoring is only available for active universe names.{" "}
          <Link href="/universe" style={{ color: "var(--accent)" }}>
            Back to Universe
          </Link>
        </p>
      </div>
    );
  }

  const railRows: AiqHistoryRailRow[] = ctx.history.map((r, i) => {
    const older = ctx.history[i + 1];
    const delta = older ? r.total - older.total : null;
    return { scored_at: r.scored_at, total: r.total, delta, notes: r.notes };
  });
  const railData = {
    ticker: ctx.seed.ticker,
    rows: railRows,
    envConfigured: ctx.envConfigured,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <AiqRailRegister data={railData} />
      <div
        style={{
          padding: "18px 28px 14px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: "-.014em",
                color: "var(--text-1)",
                fontFamily: "var(--m)",
              }}
            >
              {ctx.seed.ticker}
            </h1>
            <span style={{ fontSize: 13.5, color: "var(--text-2)" }}>{ctx.seed.name}</span>
            <span style={{ marginLeft: 6 }}>
              <LayerChip layer={ctx.seed.layer} label={ctx.seed.layer_label} />
            </span>
          </div>
          {/* spec §5.6 meta line — "Last scored {date} · {total}/100" */}
          {ctx.latest ? (
            <div style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--m)", fontVariantNumeric: "tabular-nums" }}>
              Last scored <span style={{ color: "var(--text-1)" }}>{ctx.latest.scored_at}</span>
              <span style={{ color: "var(--text-3)" }}> · </span>
              <span style={{ color: "var(--text-1)" }}>{ctx.latest.total}</span>
              <span style={{ color: "var(--text-3)" }}>/100</span>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>
              Not yet scored
            </div>
          )}
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>
            AIQ rubric editor — six dimensions, 0…20 / 0…15. Save creates a new versioned row (UPSERT on same day).
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <Link
          href={`/universe/${ctx.seed.ticker}`}
          className="lin-hov"
          style={{
            fontSize: 11.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            textDecoration: "none",
            padding: "4px 8px",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          ↗ Detail
        </Link>
      </div>

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "20px 28px 32px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 320px",
          gap: 20,
          alignItems: "start",
        }}
      >
        <AiqEditor ticker={ctx.seed.ticker} latest={ctx.latest} envConfigured={ctx.envConfigured} />
        <AiqHistory history={ctx.history} envConfigured={ctx.envConfigured} />
      </div>
    </div>
  );
}
