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
    range: [-40, 60],
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
