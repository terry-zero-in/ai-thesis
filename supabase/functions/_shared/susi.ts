// THS-60 — SUSI (Standardized Unusual Short Interest) helper.
//
// Spec: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Fix 4.
// SUSI = (current_SI − mean_24mo) / stdev_24mo
//
// Bi-monthly cadence (FINRA publishes around the 15th and end of month),
// so a 24-month baseline ≈ 48 observations. We use the PRIOR window
// (excluding the current observation) as the baseline so the z-score
// reflects deviation from history, not from a window that already
// includes the current value.
//
// Pure module — Node-runnable tests in susi.test.ts.

import { mean, stddev } from "./stats.ts";

export interface SiObservation {
  settlement_date: string;
  short_interest: number | null;
}

/**
 * Returns the SUSI z-score for the latest observation given the full
 * trailing history (newest first OR oldest first — we sort defensively).
 *
 * Returns null when:
 *   - latest observation is missing
 *   - prior window has < 6 finite observations (too small for stable stdev)
 *   - prior window stdev is 0 (all-equal — degenerate)
 */
export function computeSusi(history: ReadonlyArray<SiObservation>): number | null {
  if (history.length === 0) return null;

  // Defensive sort: newest first.
  const sorted = history.slice().sort((a, b) => (b.settlement_date < a.settlement_date ? -1 : 1));
  const latest = sorted[0];
  if (latest.short_interest == null || !Number.isFinite(latest.short_interest)) return null;

  // Trim to the 24-month window starting from the day before `latest`.
  const cutoffMs = new Date(latest.settlement_date).getTime() - 24 * 30 * 24 * 60 * 60 * 1000;
  const prior: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const r = sorted[i];
    if (r.short_interest == null || !Number.isFinite(r.short_interest)) continue;
    if (new Date(r.settlement_date).getTime() < cutoffMs) break;
    prior.push(r.short_interest);
  }

  if (prior.length < 6) return null;
  const s = stddev(prior);
  if (s === 0) return null;
  const m = mean(prior);
  if (!Number.isFinite(m)) return null;
  return (latest.short_interest - m) / s;
}
