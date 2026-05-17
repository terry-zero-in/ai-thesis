// Unit tests for buildConsensusRow. Run:
//   node --test --experimental-strip-types supabase/functions/_shared/consensus.test.ts

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildConsensusRow,
  type FmpAnalystEstimateRow,
  type FmpPriceTargetConsensus,
  type FmpRatingRow,
} from "./fmp.ts";

test("picks the next fiscal year > today as FY1 and the one after as FY2", () => {
  const estimates: FmpAnalystEstimateRow[] = [
    { date: "2025-12-31", symbol: "NVDA", estimatedEpsAvg: 5.0, estimatedRevenueAvg: 100, numberAnalystsEstimatedEps: 40 },
    { date: "2026-12-31", symbol: "NVDA", estimatedEpsAvg: 6.5, estimatedRevenueAvg: 130, numberAnalystsEstimatedEps: 38 },
    { date: "2027-12-31", symbol: "NVDA", estimatedEpsAvg: 8.0, estimatedRevenueAvg: 165, numberAnalystsEstimatedEps: 35 },
  ];
  const target: FmpPriceTargetConsensus = { symbol: "NVDA", targetConsensus: 175 };
  const rating: FmpRatingRow = { symbol: "NVDA", ratingScore: 5 }; // FMP 5 = strong buy

  const row = buildConsensusRow("NVDA", "2026-05-15", estimates, target, rating);

  assert.equal(row.fy1_eps, 6.5);
  assert.equal(row.fy2_eps, 8.0);
  assert.equal(row.ntm_eps, 6.5);              // FY1 simplification
  assert.equal(row.ntm_revenue, 130);
  assert.equal(row.num_analysts, 38);
  assert.equal(row.rating_avg, 1);             // 6 - 5 = 1 (spec: 1 strong buy)
  assert.equal(row.target_price, 175);
});

test("returns null for missing target and missing rating", () => {
  const estimates: FmpAnalystEstimateRow[] = [
    { date: "2026-12-31", symbol: "X", estimatedEpsAvg: 1.0 },
  ];
  const row = buildConsensusRow("X", "2026-05-15", estimates, null, null);
  assert.equal(row.fy1_eps, 1.0);
  assert.equal(row.target_price, null);
  assert.equal(row.rating_avg, null);
});

test("falls back to targetMedian when targetConsensus missing", () => {
  const row = buildConsensusRow(
    "X",
    "2026-05-15",
    [{ date: "2026-12-31", symbol: "X" }],
    { symbol: "X", targetMedian: 100 },
    null,
  );
  assert.equal(row.target_price, 100);
});

test("rating score: falls back through ratingScore -> overallScore -> rating", () => {
  const est: FmpAnalystEstimateRow[] = [{ date: "2026-12-31", symbol: "X", estimatedEpsAvg: 1 }];

  // Only ratingScore present (legacy /api/v3 shape)
  let row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X", ratingScore: 4 });
  assert.equal(row.rating_avg, 2, "ratingScore=4 -> 6-4=2");

  // Only overallScore present (possible /stable/ratings-snapshot shape)
  row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X", overallScore: 3 });
  assert.equal(row.rating_avg, 3, "overallScore=3 -> 6-3=3");

  // Only `rating` present (third candidate)
  row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X", rating: 5 });
  assert.equal(row.rating_avg, 1, "rating=5 -> 6-5=1");

  // ratingScore wins when multiple are present
  row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X", ratingScore: 2, overallScore: 4 });
  assert.equal(row.rating_avg, 4, "ratingScore takes precedence -> 6-2=4");
});

test("rating score: out-of-band values fall back to null", () => {
  const est: FmpAnalystEstimateRow[] = [{ date: "2026-12-31", symbol: "X", estimatedEpsAvg: 1 }];

  // Score outside the 1..5 sanity band -> null (defensive: new endpoint may
  // return a percent or letter we can't interpret yet).
  let row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X", ratingScore: 75 });
  assert.equal(row.rating_avg, null);

  row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X", ratingScore: 0 });
  assert.equal(row.rating_avg, null);

  row = buildConsensusRow("X", "2026-05-15", est, null, { symbol: "X" });
  assert.equal(row.rating_avg, null);
});

test("ignores past fiscal-year estimates", () => {
  const estimates: FmpAnalystEstimateRow[] = [
    { date: "2024-12-31", symbol: "X", estimatedEpsAvg: 3.0 }, // past
    { date: "2025-12-31", symbol: "X", estimatedEpsAvg: 4.0 }, // past
    { date: "2026-12-31", symbol: "X", estimatedEpsAvg: 5.0 }, // future
  ];
  const row = buildConsensusRow("X", "2026-01-01", estimates, null, null);
  // 2026-12-31 is the only future estimate -> FY1; no FY2 -> null
  assert.equal(row.fy1_eps, 5.0);
  assert.equal(row.fy2_eps, null);
});
