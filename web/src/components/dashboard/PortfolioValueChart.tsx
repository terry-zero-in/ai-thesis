"use client";

/**
 * PortfolioValueChart — NAV history card.
 *
 * Demo-data removal 2026-05-21 (Terry directive: personal tool, blank is
 * OK). The synthesize()-driven fixture walk that drew a fake NAV chart
 * from current value + cost basis is gone. Until a real
 * portfolio_nav_daily source wires up, this renders an honest empty
 * card with messaging about what's pending.
 *
 * When NAV history wires up: accept a `history: { date: string; nav:
 * number }[]` prop and re-introduce the SVG chart canvas. Prior canvas
 * implementation (with crosshair, hi/lo annotations, range picker,
 * tooltip) lives in git history at 3ed7d06.
 */

export function PortfolioValueChart({
  empty,
}: {
  currentValue?: number;
  costBasis?: number;
  empty: boolean;
  compact?: boolean;
}) {
  const message = empty
    ? "No positions yet — NAV history populates once your book is tracked."
    : "NAV history populates after the first daily price ingestion fires.";

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 6,
        padding: "16px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
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
        NAV history
      </span>
      <div
        style={{
          width: "100%",
          height: 280,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-4)",
          fontSize: 12,
          fontFamily: "var(--m)",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        {message}
      </div>
    </div>
  );
}
