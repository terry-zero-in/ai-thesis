// Unit tests for the revisions delta math. Run:
//   node --test --experimental-strip-types supabase/functions/_shared/revisions.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import { computeRevisionDeltas, type SnapshotPoint } from "./revisions.ts";

const today: SnapshotPoint = { as_of: "2026-05-15", fy1_eps: 11.0 };

test("computes 30d and 90d deltas from prior snapshots", () => {
  const history: SnapshotPoint[] = [
    { as_of: "2026-04-15", fy1_eps: 10.0 }, // exactly 30 days ago
    { as_of: "2026-02-14", fy1_eps: 9.0 },  // ~90 days ago
  ];
  const r = computeRevisionDeltas(today, history);
  // (11 - 10) / 10 * 100 = 10
  assert.equal(r.fy1_eps_30d_pct_change, 10);
  // (11 - 9) / 9 * 100 ≈ 22.222
  assert.ok(r.fy1_eps_90d_pct_change !== null);
  assert.ok(Math.abs((r.fy1_eps_90d_pct_change as number) - 22.222) < 0.01);
});

test("uses most recent snapshot at or before the cutoff (handles weekends)", () => {
  // 30d cutoff = 2026-04-15. Snapshot is from 2026-04-14, still picked.
  const history: SnapshotPoint[] = [
    { as_of: "2026-04-14", fy1_eps: 10.0 },
    { as_of: "2026-04-16", fy1_eps: 10.5 }, // newer than cutoff — must be ignored
  ];
  const r = computeRevisionDeltas(today, history);
  assert.equal(r.fy1_eps_30d_pct_change, 10);
});

test("returns null when there's no history far enough back", () => {
  const history: SnapshotPoint[] = [
    { as_of: "2026-05-14", fy1_eps: 10.9 }, // 1 day ago
  ];
  const r = computeRevisionDeltas(today, history);
  assert.equal(r.fy1_eps_30d_pct_change, null);
  assert.equal(r.fy1_eps_90d_pct_change, null);
});

test("returns null when a value is missing or zero", () => {
  const history: SnapshotPoint[] = [
    { as_of: "2026-04-15", fy1_eps: 0 },
    { as_of: "2026-02-14", fy1_eps: null },
  ];
  const r = computeRevisionDeltas(today, history);
  assert.equal(r.fy1_eps_30d_pct_change, null);
  assert.equal(r.fy1_eps_90d_pct_change, null);
});

test("handles negative prior EPS via Math.abs in the denominator", () => {
  // EPS can flip from loss to profit. (-5 -> 5) is a 200% improvement, not -200%.
  const today2: SnapshotPoint = { as_of: "2026-05-15", fy1_eps: 5 };
  const history: SnapshotPoint[] = [{ as_of: "2026-04-15", fy1_eps: -5 }];
  const r = computeRevisionDeltas(today2, history);
  assert.equal(r.fy1_eps_30d_pct_change, 200);
});
