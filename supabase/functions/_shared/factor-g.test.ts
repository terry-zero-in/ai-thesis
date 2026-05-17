import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aiSegmentSignal,
  capexEfficiency,
  computeGForCohort,
  ntmGrowth,
  type GInputs,
  type Layer,
} from "./factor-g.ts";

const baseInputs: Omit<GInputs, "ticker" | "layer"> = {
  ttmRevenue: null,
  ttmCapex: null,
  ttmOperatingIncome: null,
  ttmRdExpense: null,
  ttmRevenue_lag1y: null,
  ttmCapex_lag1y: null,
  ntmRevenue: null,
  aiRevenue_current: null,
  aiRevenue_lag1y: null,
};
const inp = (ticker: string, layer: Layer, over: Partial<GInputs>): GInputs => ({
  ...baseInputs,
  ticker,
  layer,
  ...over,
});

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ─── NTM growth ─────────────────────────────────────────────────────────────

test("ntmGrowth: golden path", () => {
  approx(ntmGrowth(inp("X", 1, { ntmRevenue: 1200, ttmRevenue: 1000 }))!, 0.20);
});

test("ntmGrowth: zero or negative TTM revenue → null", () => {
  assert.equal(ntmGrowth(inp("X", 1, { ntmRevenue: 1200, ttmRevenue: 0 })), null);
  assert.equal(ntmGrowth(inp("X", 1, { ntmRevenue: 1200, ttmRevenue: -100 })), null);
});

test("ntmGrowth: missing inputs → null", () => {
  assert.equal(ntmGrowth(inp("X", 1, { ntmRevenue: null, ttmRevenue: 1000 })), null);
  assert.equal(ntmGrowth(inp("X", 1, { ntmRevenue: 1200, ttmRevenue: null })), null);
});

// ─── Layer-specific AI segment ──────────────────────────────────────────────

test("aiSegment L1: prefers override YoY when available", () => {
  const v = aiSegmentSignal(inp("NVDA", 1, {
    aiRevenue_current: 39100,
    aiRevenue_lag1y: 22500,
    ttmRevenue: 130000, ttmRevenue_lag1y: 80000, // fallback shouldn't be used
  }));
  approx(v!, (39100 - 22500) / 22500);
});

test("aiSegment L1: falls back to overall revenue YoY when override missing", () => {
  const v = aiSegmentSignal(inp("X", 1, {
    aiRevenue_current: null,
    aiRevenue_lag1y: null,
    ttmRevenue: 130000, ttmRevenue_lag1y: 100000,
  }));
  approx(v!, 0.30);
});

test("aiSegment L2: ΔTTM revenue / ΔTTM capex", () => {
  const v = aiSegmentSignal(inp("GOOGL", 2, {
    ttmRevenue: 360000, ttmRevenue_lag1y: 300000,
    ttmCapex: 180000, ttmCapex_lag1y: 100000,
  }));
  // (360k - 300k) / (180k - 100k) = 60k / 80k = 0.75
  approx(v!, 0.75);
});

test("aiSegment L2: zero ΔCapex → null", () => {
  assert.equal(
    aiSegmentSignal(inp("X", 2, {
      ttmRevenue: 100, ttmRevenue_lag1y: 80,
      ttmCapex: 50, ttmCapex_lag1y: 50,
    })),
    null,
  );
});

test("aiSegment L3: AI ARR / opex when override present", () => {
  const v = aiSegmentSignal(inp("PLTR", 3, {
    aiRevenue_current: 2000,
    ttmRevenue: 3000, ttmOperatingIncome: 600, // opex = 2400
  }));
  approx(v!, 2000 / 2400);
});

test("aiSegment L3: falls back to revenue / opex when no override", () => {
  const v = aiSegmentSignal(inp("X", 3, {
    aiRevenue_current: null,
    ttmRevenue: 3000, ttmOperatingIncome: 600,
  }));
  approx(v!, 3000 / 2400);
});

test("aiSegment L3: negative or zero opex → null", () => {
  assert.equal(
    aiSegmentSignal(inp("X", 3, {
      ttmRevenue: 500, ttmOperatingIncome: 600, // opex would be -100
    })),
    null,
  );
});

test("aiSegment L4: override AI revenue / TTM capex", () => {
  const v = aiSegmentSignal(inp("VST", 4, {
    aiRevenue_current: 1500,
    ttmCapex: 6000,
  }));
  approx(v!, 0.25);
});

test("aiSegment L4: fallback to overall revenue / capex when no override", () => {
  const v = aiSegmentSignal(inp("X", 4, {
    aiRevenue_current: null,
    ttmRevenue: 20000, ttmCapex: 8000,
  }));
  approx(v!, 2.5);
});

test("aiSegment L5: AI ARR / (R&D + capex)", () => {
  const v = aiSegmentSignal(inp("INTU", 5, {
    aiRevenue_current: 1000,
    ttmRdExpense: 3000, ttmCapex: 1000,
  }));
  approx(v!, 1000 / 4000);
});

test("aiSegment L5: fallback to revenue when no override", () => {
  const v = aiSegmentSignal(inp("X", 5, {
    aiRevenue_current: null,
    ttmRevenue: 5000, ttmRdExpense: 1500, ttmCapex: 500,
  }));
  approx(v!, 5000 / 2000);
});

test("aiSegment L5: zero or null denominator → null", () => {
  assert.equal(
    aiSegmentSignal(inp("X", 5, {
      aiRevenue_current: 1000, ttmRdExpense: 0, ttmCapex: 0,
    })),
    null,
  );
  assert.equal(
    aiSegmentSignal(inp("X", 5, {
      aiRevenue_current: 1000, ttmRdExpense: null, ttmCapex: 1000,
    })),
    null,
  );
});

// ─── Layer-specific capex efficiency ────────────────────────────────────────

test("capexEfficiency L1: revenue / capex", () => {
  approx(capexEfficiency(inp("X", 1, { ttmRevenue: 5000, ttmCapex: 1000 }))!, 5.0);
});

test("capexEfficiency L2: ΔTTM revenue / ΔTTM capex", () => {
  const v = capexEfficiency(inp("X", 2, {
    ttmRevenue: 360000, ttmRevenue_lag1y: 300000,
    ttmCapex: 180000, ttmCapex_lag1y: 100000,
  }));
  approx(v!, 0.75);
});

test("capexEfficiency L3: capital-light = 1 - capex/revenue", () => {
  approx(capexEfficiency(inp("X", 3, { ttmRevenue: 1000, ttmCapex: 50 }))!, 0.95);
});

test("capexEfficiency L3: negative result allowed (high-capex L3)", () => {
  const v = capexEfficiency(inp("X", 3, { ttmRevenue: 100, ttmCapex: 150 }));
  approx(v!, -0.5);
});

test("capexEfficiency L4: revenue / capex (same shape as L1)", () => {
  approx(capexEfficiency(inp("X", 4, { ttmRevenue: 8000, ttmCapex: 2000 }))!, 4.0);
});

test("capexEfficiency L5: revenue / (R&D + capex)", () => {
  approx(
    capexEfficiency(inp("X", 5, { ttmRevenue: 4000, ttmRdExpense: 800, ttmCapex: 200 }))!,
    4.0,
  );
});

test("capexEfficiency: zero capex → null (L1/L4)", () => {
  assert.equal(capexEfficiency(inp("X", 1, { ttmRevenue: 100, ttmCapex: 0 })), null);
  assert.equal(capexEfficiency(inp("X", 4, { ttmRevenue: 100, ttmCapex: 0 })), null);
});

// ─── End-to-end cohort assembly ─────────────────────────────────────────────

test("computeGForCohort: rejects mixed layers", () => {
  const a = inp("A", 1, { ttmRevenue: 100, ttmCapex: 10, ntmRevenue: 120 });
  const b = inp("B", 2, { ttmRevenue: 100, ttmCapex: 10, ntmRevenue: 120 });
  assert.throws(() => computeGForCohort([a, b]), /layer/);
});

test("computeGForCohort: empty input → empty output", () => {
  assert.deepEqual(computeGForCohort([]), []);
});

test("computeGForCohort: superior-on-every-signal ticker ranks highest", () => {
  // L1 cohort, three names. STRONG beats AVG beats WEAK on NTM growth +
  // AI YoY + capex efficiency. Expect monotone ranking.
  const strong = inp("STRONG", 1, {
    ttmRevenue: 100000, ttmCapex: 8000,
    ttmRevenue_lag1y: 70000,
    aiRevenue_current: 60000, aiRevenue_lag1y: 35000,
    ntmRevenue: 140000,
  });
  const avg = inp("AVG", 1, {
    ttmRevenue: 50000, ttmCapex: 8000,
    ttmRevenue_lag1y: 40000,
    aiRevenue_current: 20000, aiRevenue_lag1y: 14000,
    ntmRevenue: 60000,
  });
  const weak = inp("WEAK", 1, {
    ttmRevenue: 30000, ttmCapex: 15000,
    ttmRevenue_lag1y: 28000,
    aiRevenue_current: 5000, aiRevenue_lag1y: 4500,
    ntmRevenue: 32000,
  });
  const results = computeGForCohort([strong, avg, weak]);
  const byTicker = Object.fromEntries(results.map((r) => [r.ticker, r]));

  for (const r of results) {
    assert.ok(r.gScore !== null && r.gScore >= 0 && r.gScore <= 100, `${r.ticker} gScore in 0..100`);
  }
  assert.ok(byTicker["STRONG"].gScore! > byTicker["AVG"].gScore!);
  assert.ok(byTicker["AVG"].gScore! > byTicker["WEAK"].gScore!);
});

test("computeGForCohort: identical cohort all score 50", () => {
  const tmpl = {
    ttmRevenue: 1000, ttmCapex: 200,
    ttmRevenue_lag1y: 800, ttmCapex_lag1y: 100,
    aiRevenue_current: 400, aiRevenue_lag1y: 250,
    ntmRevenue: 1200,
  };
  const r = computeGForCohort([
    inp("A", 2, tmpl),
    inp("B", 2, tmpl),
    inp("C", 2, tmpl),
  ]);
  for (const x of r) assert.equal(x.gScore, 50);
});

test("computeGForCohort: single-ticker cohort returns 50", () => {
  const only = inp("SOLO", 4, {
    ttmRevenue: 5000, ttmCapex: 1000,
    aiRevenue_current: 800,
    ntmRevenue: 6500,
  });
  const r = computeGForCohort([only])[0];
  assert.equal(r.gScore, 50);
});

test("computeGForCohort: ticker with no override falls back gracefully", () => {
  // T1 has override; T2 doesn't. Both should still score (L1 falls back to
  // overall revenue YoY when override missing).
  const t1 = inp("T1", 1, {
    ttmRevenue: 100, ttmCapex: 20,
    ttmRevenue_lag1y: 80,
    aiRevenue_current: 70, aiRevenue_lag1y: 40,
    ntmRevenue: 130,
  });
  const t2 = inp("T2", 1, {
    ttmRevenue: 90, ttmCapex: 25,
    ttmRevenue_lag1y: 70,
    aiRevenue_current: null, aiRevenue_lag1y: null,
    ntmRevenue: 110,
  });
  const r = computeGForCohort([t1, t2]);
  for (const x of r) assert.ok(x.gScore !== null && Number.isFinite(x.gScore));
  // T1 used override (75% YoY); T2 used overall (28.6% YoY). T1's AI signal
  // is much stronger so it should outscore on that pillar.
  const byTicker = Object.fromEntries(r.map((x) => [x.ticker, x]));
  assert.ok(byTicker["T1"].signals.aiSegment! > byTicker["T2"].signals.aiSegment!);
});

test("computeGForCohort: ticker with all null signals → gScore null", () => {
  // Empty inputs (no fundamentals, no consensus, no override).
  const empty = inp("EMPTY", 1, {});
  const populated = inp("REAL", 1, {
    ttmRevenue: 100, ttmCapex: 20, ttmRevenue_lag1y: 80, ntmRevenue: 120,
  });
  const r = computeGForCohort([empty, populated]);
  const byTicker = Object.fromEntries(r.map((x) => [x.ticker, x]));
  assert.equal(byTicker["EMPTY"].gScore, null);
  assert.ok(byTicker["REAL"].gScore !== null);
});
