/**
 * Pure type / constant module for the regime panel (THS-56). Safe to
 * import from client components — does not pull in the server-only
 * Supabase client. Matching fetcher: `regime-data.ts`.
 *
 * Mirrors the gate / multiplier table in
 * `supabase/functions/_shared/composite.ts` (single source of truth for the
 * algorithm side; this constant is the UI projection). Keep in sync.
 */

export type GaugeKey = "naaim" | "aaii_3wk_spread" | "fear_greed";

export const GAUGES: ReadonlyArray<{
  key: GaugeKey;
  label: string;
  threshold: number;
  /** Algorithmic plausible range, used to scale the gauge bar. */
  range: [number, number];
  /** Short description rendered under the gauge title. */
  blurb: string;
}> = [
  {
    key: "naaim",
    label: "NAAIM Exposure",
    threshold: 90,
    range: [0, 200],
    blurb: "Active-manager equity exposure index. Gate hits at > 90.",
  },
  {
    key: "aaii_3wk_spread",
    label: "AAII 3-wk Spread",
    threshold: 30,
    range: [-60, 60],
    blurb: "Retail bull − bear spread, three-week average. Gate hits at > 30.",
  },
  {
    key: "fear_greed",
    label: "CNN Fear & Greed",
    threshold: 80,
    range: [0, 100],
    blurb: "Multi-factor sentiment 0…100. Gate hits at > 80.",
  },
];

export const MULTIPLIER_BY_GATES: Record<0 | 1 | 2 | 3, number> = {
  0: 1.0,
  1: 0.95,
  2: 0.9,
  3: 0.85,
};

/**
 * Canonical per-gauge display formatter. Used by hero card, right rail,
 * trend-chart right-edge labels, and any future "closest gate" callout
 * so the same number renders identically everywhere.
 *
 * - NAAIM: 1 decimal (range 0-200, single percent precision is enough)
 * - AAII : 1 decimal with explicit sign (bull-bear spread, sign matters)
 * - F&G  : integer (0-100 index, fractional values mislead users)
 */
export function fmtGaugeValue(n: number, key: GaugeKey): string {
  if (key === "naaim") return n.toFixed(1);
  if (key === "aaii_3wk_spread") return (n > 0 ? "+" : "") + n.toFixed(1);
  return n.toFixed(0);
}

/**
 * Distance from a gauge's current value to its threshold. Negative if
 * the gauge has already fired (value > threshold). Used by the
 * "closest gate" callout to surface "X pts to gate" when within ~10
 * pts of crossing.
 */
export function distanceToGate(value: number | null, threshold: number): number | null {
  if (value == null) return null;
  return threshold - value;
}

export interface ClosestGate {
  key: GaugeKey;
  label: string;
  value: number;
  threshold: number;
  ptsToGate: number;
  /** Multiplier that would apply if one more gate fires. */
  nextMultiplier: number;
}

/**
 * Pick the non-fired gauge closest to its threshold, if any are within
 * `withinPts`. Returns null when:
 *   - all gauges already fired (the multiplier already reflects them)
 *   - all non-fired gauges are further than withinPts (no signal worth surfacing)
 *
 * `currentGates` is the gates-hit count at snapshot time; `nextMultiplier`
 * is min(currentGates+1, 3) → MULTIPLIER_BY_GATES.
 */
export function pickClosestGate(
  latest: MacroGaugeRow | null,
  currentGates: number,
  withinPts: number = 10,
): ClosestGate | null {
  if (latest == null) return null;
  let best: ClosestGate | null = null;
  for (const g of GAUGES) {
    const v = latest[g.key];
    if (v == null) continue;
    const dist = g.threshold - v;
    if (dist <= 0) continue;            // already fired
    if (dist > withinPts) continue;     // too far to flag
    if (best == null || dist < best.ptsToGate) {
      const nextGates = Math.min(currentGates + 1, 3) as 0 | 1 | 2 | 3;
      best = {
        key: g.key,
        label: g.label,
        value: v,
        threshold: g.threshold,
        ptsToGate: dist,
        nextMultiplier: MULTIPLIER_BY_GATES[nextGates],
      };
    }
  }
  return best;
}

export interface MacroGaugeRow {
  as_of: string;
  naaim: number | null;
  aaii_3wk_spread: number | null;
  fear_greed: number | null;
}

export interface ThresholdHistory {
  /** Total rows in the 52-week window where this gauge crossed its threshold. */
  hits: number;
  /** Most recent crossing as_of (or null if never in the window). */
  last_hit_at: string | null;
}

/**
 * Single change in the gate-count between two consecutive weekly rows.
 * Drives spec §5.5 "last 5 gate-state changes" list.
 */
export interface GateChange {
  as_of: string;
  /** Which gauge caused the change in that week (first one to flip is recorded). */
  cause: GaugeKey;
  /** Cause display label, e.g. "NAAIM crossed 90" / "F&G dropped <80". */
  cause_label: string;
  prior_gates: number;
  current_gates: number;
  prior_multiplier: number;
  current_multiplier: number;
}

export interface RegimeSnapshot {
  history: MacroGaugeRow[];
  latest: MacroGaugeRow | null;
  gates_hit: number;
  multiplier: number;
  /** Per-gauge threshold-crossing summaries, used for hover detail. */
  threshold_history: Record<GaugeKey, ThresholdHistory>;
  /** Most-recent-first chronicle of gate-count changes across the 52w window. */
  gate_changes: GateChange[];
  synthetic: boolean;
  envConfigured: boolean;
}
