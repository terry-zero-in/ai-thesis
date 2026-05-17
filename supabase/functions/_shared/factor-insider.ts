// THS-61 (E5.4) — Insider Form-4 cluster override detection.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Fix 4 sentiment
// asymmetric override.
//
//   BUY override (+5)  : 3+ insiders, ≥$1M each, last 90 days
//   SELL override (-3) : 3+ insiders, ≥$5M each, last 60 days,
//                        excluding 10b5-1 (pre-planned) sales
//
// v1 LIMITATION: the ingestor doesn't parse SEC Form-4 footnote links
// to determine 10b5-1 status, so `is_10b5_1` is often null (undetermined)
// and some 10b5-1 sales may leak through the SELL cluster. The 3-insider
// + $5M-each + 60-day threshold filters most routine 10b5-1 noise on its
// own. Parked for v1 — see docs/HANDOFF.md item 1.
//
// Pure module — no DB / SDK imports. Node-runnable tests in factor-insider.test.ts.

export interface InsiderFiling {
  ticker: string;
  transaction_date: string;        // ISO YYYY-MM-DD
  insider_name: string;
  /**
   * SEC transaction code. P = open-market purchase, S = open-market sale,
   * M = exercise, F = tax withholding, etc. Only P (buy) and S (sell) feed
   * cluster detection — exercises and tax withholdings are noise.
   */
  transaction_code: string;
  acquired_disposed: "A" | "D" | null;
  shares: number | null;
  price_per_share: number | null;
  transaction_value: number | null;  // shares * price when available
  /** null = undetermined (conservative). true = 10b5-1 pre-planned sale (exclude). */
  is_10b5_1: boolean | null;
}

export type ClusterKind = "BUY" | "SELL" | null;

export interface ClusterResult {
  kind: ClusterKind;
  /** +5 / -3 / 0 per spec. */
  override: number;
  /** Distinct insider count contributing to the override. */
  insiders: number;
  /** Aggregate $ across the contributing transactions. */
  total_value: number;
  /** Inclusive window endpoints. */
  window_start: string;
  window_end: string;
}

// Spec constants — exported for documentation visibility.
export const BUY_INSIDER_MIN = 3;
export const BUY_VALUE_MIN = 1_000_000;
export const BUY_WINDOW_DAYS = 90;
export const BUY_OVERRIDE = 5;

export const SELL_INSIDER_MIN = 3;
export const SELL_VALUE_MIN = 5_000_000;
export const SELL_WINDOW_DAYS = 60;
export const SELL_OVERRIDE = -3;

/**
 * Detect cluster override for a single ticker.
 *
 * BUY check fires first when both qualify; this is intentional —
 * insider buys are rarer and more informative than sells (most sells
 * are diversification, comp, or 10b5-1; buys are committed capital).
 * If both fire, the algorithm wants the bullish signal to win.
 *
 * Returns `{kind: null, override: 0}` when no cluster qualifies.
 */
export function detectClusterOverride(
  filings: ReadonlyArray<InsiderFiling>,
  asOfIso: string,
): ClusterResult {
  const buyCutoff = isoDateMinusDays(asOfIso, BUY_WINDOW_DAYS);
  const sellCutoff = isoDateMinusDays(asOfIso, SELL_WINDOW_DAYS);

  // BUY side: code 'P', last 90 days. "≥$1M each" is interpreted as
  // per-insider aggregate (clusters of small buys still count when total
  // conviction is committed). 10b5-1 doesn't apply to opportunistic buys.
  const buyCandidates = filings.filter(
    (f) =>
      f.transaction_code === "P" &&
      isWithinWindow(f.transaction_date, buyCutoff, asOfIso),
  );
  const buy = qualifyingInsiders(buyCandidates, BUY_VALUE_MIN);
  if (buy.insiders >= BUY_INSIDER_MIN) {
    return {
      kind: "BUY",
      override: BUY_OVERRIDE,
      insiders: buy.insiders,
      total_value: buy.total_value,
      window_start: buyCutoff,
      window_end: asOfIso,
    };
  }

  // SELL side: code 'S', last 60 days, per-insider aggregate ≥ $5M.
  // Exclude 10b5-1 = true; null is conservatively included (we couldn't
  // determine, so we don't suppress).
  const sellCandidates = filings.filter(
    (f) =>
      f.transaction_code === "S" &&
      f.is_10b5_1 !== true &&
      isWithinWindow(f.transaction_date, sellCutoff, asOfIso),
  );
  const sell = qualifyingInsiders(sellCandidates, SELL_VALUE_MIN);
  if (sell.insiders >= SELL_INSIDER_MIN) {
    return {
      kind: "SELL",
      override: SELL_OVERRIDE,
      insiders: sell.insiders,
      total_value: sell.total_value,
      window_start: sellCutoff,
      window_end: asOfIso,
    };
  }

  return {
    kind: null,
    override: 0,
    insiders: 0,
    total_value: 0,
    window_start: sellCutoff,
    window_end: asOfIso,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function qualifyingValue(f: InsiderFiling): number {
  if (f.transaction_value != null && Number.isFinite(f.transaction_value)) {
    return Math.abs(f.transaction_value);
  }
  if (
    f.shares != null &&
    f.price_per_share != null &&
    Number.isFinite(f.shares) &&
    Number.isFinite(f.price_per_share)
  ) {
    return Math.abs(f.shares * f.price_per_share);
  }
  return 0;
}

/**
 * Group transactions by insider, sum value per insider, and count those
 * whose aggregate value meets the per-insider threshold. Total_value
 * sums only the contributing insiders' aggregates.
 *
 * "≥$1M each" reads as per-insider conviction, not per-trade — three
 * 400K buys by one insider in a week sum to $1.2M and contribute toward
 * the cluster. Matches the standard insider-clustering literature.
 */
function qualifyingInsiders(
  filings: ReadonlyArray<InsiderFiling>,
  perInsiderMin: number,
): { insiders: number; total_value: number } {
  const byInsider = new Map<string, number>();
  for (const f of filings) {
    const v = qualifyingValue(f);
    byInsider.set(f.insider_name, (byInsider.get(f.insider_name) ?? 0) + v);
  }
  let count = 0;
  let total = 0;
  for (const [, v] of byInsider) {
    if (v >= perInsiderMin) {
      count += 1;
      total += v;
    }
  }
  return { insiders: count, total_value: total };
}

function isWithinWindow(transactionDate: string, cutoff: string, asOf: string): boolean {
  return transactionDate >= cutoff && transactionDate <= asOf;
}

function isoDateMinusDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
