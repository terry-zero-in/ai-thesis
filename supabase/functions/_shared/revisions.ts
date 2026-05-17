// Pure helpers for the revisions delta calculation. Given today's FY1 EPS
// consensus and a history of prior snapshots, find the snapshots closest to
// (but not after) `today - 30d` and `today - 90d` and compute the percent
// change. Returning null when there's not enough history or the comparison
// would divide by zero.

export interface SnapshotPoint {
  as_of: string;             // ISO YYYY-MM-DD
  fy1_eps: number | null;
}

export interface RevisionDeltas {
  fy1_eps_30d_pct_change: number | null;
  fy1_eps_90d_pct_change: number | null;
}

const DAY = 24 * 60 * 60 * 1000;

function daysBefore(iso: string, days: number): string {
  const ts = Date.parse(iso + "T00:00:00Z");
  const target = new Date(ts - days * DAY);
  return target.toISOString().slice(0, 10);
}

function pickAtOrBefore(history: SnapshotPoint[], cutoff: string): SnapshotPoint | undefined {
  // Most recent snapshot with as_of <= cutoff. History is not assumed sorted.
  let best: SnapshotPoint | undefined;
  for (const s of history) {
    if (s.as_of > cutoff) continue;
    if (!best || s.as_of > best.as_of) best = s;
  }
  return best;
}

function pctChange(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null) return null;
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function computeRevisionDeltas(
  today: SnapshotPoint,
  history: SnapshotPoint[],
): RevisionDeltas {
  const cutoff30 = daysBefore(today.as_of, 30);
  const cutoff90 = daysBefore(today.as_of, 90);
  const past30 = pickAtOrBefore(history, cutoff30);
  const past90 = pickAtOrBefore(history, cutoff90);
  return {
    fy1_eps_30d_pct_change: pctChange(today.fy1_eps, past30?.fy1_eps ?? null),
    fy1_eps_90d_pct_change: pctChange(today.fy1_eps, past90?.fy1_eps ?? null),
  };
}
