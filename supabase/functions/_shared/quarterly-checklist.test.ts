import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  AIQ_DRIFT_THRESHOLD,
  CAPEX_DELTA_THRESHOLD_PCT,
  HYPERSCALER_CORR_DELTA_THRESHOLD,
  buildQuarterlyChecklist,
  type AiqRubricSnap,
  type CapexSnap,
  type DepFlagRow,
  type Finding,
  type QuarterlyInputs,
} from "./quarterly-checklist.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInputs(overrides: Partial<QuarterlyInputs> = {}): QuarterlyInputs {
  return {
    as_of: "2026-05-15",
    window_start: "2026-02-15",
    newDepFlags: [],
    aiqByTicker: new Map(),
    hyperscalerReturns: { current: new Map(), prior: new Map() },
    hyperscalerCapex: [],
    is_annual_trigger: false,
    ...overrides,
  };
}

function find(findings: Finding[], check_id: string): Finding {
  const f = findings.find((f) => f.check_id === check_id);
  if (!f) throw new Error(`check ${check_id} missing`);
  return f;
}

function genReturns(n: number, seed: number, corrTo?: number[]): number[] {
  // Simple deterministic generator. If corrTo provided, blend with it.
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const noise = ((s / 0x7fffffff) - 0.5) * 0.04; // ±2% noise
    out.push(noise);
  }
  if (corrTo) {
    for (let i = 0; i < n; i++) {
      // Blend 70% with target, 30% noise → high correlation.
      out[i] = 0.7 * corrTo[i] + 0.3 * out[i];
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildQuarterlyChecklist", () => {
  it("empty inputs → all-clear findings (no annual trigger)", () => {
    const out = buildQuarterlyChecklist(baseInputs());
    assert.equal(out.length, 4); // 4 checks always emit; annual gated
    for (const f of out) {
      if (f.check_id === "consensus_capex") {
        // Always data_gap — column not in schema.
        assert.equal(f.severity, "data_gap");
      }
    }
    const usefulLife = find(out, "useful_life_policy");
    assert.equal(usefulLife.severity, "info");
    assert.match(usefulLife.summary, /No new useful-life/);
  });

  it("annual trigger adds 5th finding only when flag is true", () => {
    const without = buildQuarterlyChecklist(baseInputs({ is_annual_trigger: false }));
    const withTrig = buildQuarterlyChecklist(baseInputs({ is_annual_trigger: true }));
    assert.equal(without.length, 4);
    assert.equal(withTrig.length, 5);
    const annual = find(withTrig, "annual_walk_forward");
    assert.equal(annual.severity, "warn");
    assert.match(annual.detail, /THS-64/);
  });

  it("useful-life: dep-flag within window fires `high`", () => {
    const flags: DepFlagRow[] = [
      { ticker: "META", flagged_at: "2026-03-01", extension_years: 1.5, penalty_v: -7 },
      { ticker: "MSFT", flagged_at: "2026-04-15", extension_years: 1, penalty_v: -3 },
      // Out of window — must be ignored.
      { ticker: "AMZN", flagged_at: "2026-01-15", extension_years: 1, penalty_v: -2 },
    ];
    const out = buildQuarterlyChecklist(baseInputs({ newDepFlags: flags }));
    const f = find(out, "useful_life_policy");
    assert.equal(f.severity, "high");
    const tickers = (f.data as { tickers: string[] }).tickers;
    assert.deepEqual(tickers, ["META", "MSFT"]);
    assert.match(f.detail, /META/);
    assert.match(f.detail, /MSFT/);
    assert.doesNotMatch(f.detail, /AMZN/);
  });

  it("AIQ drift: |Δ| > 10 fires `warn`, |Δ| = 10 does not", () => {
    const aiq = new Map<string, AiqRubricSnap[]>();
    aiq.set("GOOGL", [
      { ticker: "GOOGL", scored_at: "2026-04-15", total: 75 },
      { ticker: "GOOGL", scored_at: "2026-01-15", total: 60 }, // Δ +15 → fires
    ]);
    aiq.set("NVDA", [
      { ticker: "NVDA", scored_at: "2026-04-15", total: 80 },
      { ticker: "NVDA", scored_at: "2026-01-15", total: 70 }, // Δ +10 → does NOT fire
    ]);
    aiq.set("ORCL", [
      { ticker: "ORCL", scored_at: "2026-04-15", total: 52 },
      { ticker: "ORCL", scored_at: "2026-01-15", total: 65 }, // Δ -13 → fires
    ]);
    const out = buildQuarterlyChecklist(baseInputs({ aiqByTicker: aiq }));
    const f = find(out, "aiq_drift");
    assert.equal(f.severity, "warn");
    const drifts = (f.data as { drifts: Array<{ ticker: string; delta: number }> }).drifts;
    assert.equal(drifts.length, 2);
    assert.deepEqual(
      drifts.map((d) => d.ticker).sort(),
      ["GOOGL", "ORCL"],
    );
    assert.equal(AIQ_DRIFT_THRESHOLD, 10);
  });

  it("AIQ drift: tickers with only one rubric snapshot are skipped", () => {
    const aiq = new Map<string, AiqRubricSnap[]>();
    aiq.set("PLTR", [{ ticker: "PLTR", scored_at: "2026-04-15", total: 50 }]);
    const out = buildQuarterlyChecklist(baseInputs({ aiqByTicker: aiq }));
    const f = find(out, "aiq_drift");
    assert.equal(f.severity, "info");
  });

  it("hyperscaler correlation: pair that moves > 0.20 fires `warn`", () => {
    // Build current window: MSFT/GOOGL highly correlated (corr ~0.95)
    // Prior window: independent (corr near 0)
    const msftCurrent = genReturns(90, 1);
    const googlCurrent = genReturns(90, 2, msftCurrent); // blended → high corr
    const msftPrior = genReturns(90, 99);
    const googlPrior = genReturns(90, 11); // independent
    const current = new Map<string, number[]>([
      ["MSFT", msftCurrent],
      ["GOOGL", googlCurrent],
    ]);
    const prior = new Map<string, number[]>([
      ["MSFT", msftPrior],
      ["GOOGL", googlPrior],
    ]);
    const out = buildQuarterlyChecklist(
      baseInputs({ hyperscalerReturns: { current, prior } }),
    );
    const f = find(out, "hyperscaler_correlation");
    assert.equal(f.severity, "warn");
    const moves = (f.data as { moves: Array<{ a: string; b: string; delta: number }> }).moves;
    assert.equal(moves.length, 1);
    assert.equal(moves[0].a, "GOOGL");
    assert.equal(moves[0].b, "MSFT");
    assert.ok(Math.abs(moves[0].delta) > HYPERSCALER_CORR_DELTA_THRESHOLD);
  });

  it("hyperscaler correlation: stable returns produce no finding", () => {
    // Same generator both windows → ~0 correlation in both, no move.
    const a1 = genReturns(90, 7);
    const a2 = genReturns(90, 7);
    const b1 = genReturns(90, 8);
    const b2 = genReturns(90, 8);
    const current = new Map([
      ["MSFT", a1],
      ["GOOGL", b1],
    ]);
    const prior = new Map([
      ["MSFT", a2],
      ["GOOGL", b2],
    ]);
    const out = buildQuarterlyChecklist(
      baseInputs({ hyperscalerReturns: { current, prior } }),
    );
    const f = find(out, "hyperscaler_correlation");
    assert.equal(f.severity, "info");
  });

  it("hyperscaler correlation: <2 tickers covered → data_gap", () => {
    const current = new Map([["MSFT", genReturns(90, 1)]]);
    const prior = new Map([["MSFT", genReturns(90, 2)]]);
    const out = buildQuarterlyChecklist(
      baseInputs({ hyperscalerReturns: { current, prior } }),
    );
    const f = find(out, "hyperscaler_correlation");
    assert.equal(f.severity, "data_gap");
  });

  it("consensus capex: always data_gap; surfaces observable TTM proxy", () => {
    const capex: CapexSnap[] = [
      { ticker: "MSFT", current_ttm_capex: 110, prior_ttm_capex: 100 }, // +10% (boundary, not flagged)
      { ticker: "GOOGL", current_ttm_capex: 130, prior_ttm_capex: 100 }, // +30% → flagged
      { ticker: "ORCL", current_ttm_capex: 80, prior_ttm_capex: 100 }, // -20% → flagged
      { ticker: "AMZN", current_ttm_capex: null, prior_ttm_capex: 100 }, // skipped
    ];
    const out = buildQuarterlyChecklist(baseInputs({ hyperscalerCapex: capex }));
    const f = find(out, "consensus_capex");
    assert.equal(f.severity, "data_gap");
    const flagged = (f.data as { flagged: Array<{ ticker: string }> }).flagged;
    assert.deepEqual(
      flagged.map((x) => x.ticker).sort(),
      ["GOOGL", "ORCL"],
    );
    assert.equal(CAPEX_DELTA_THRESHOLD_PCT, 10);
    assert.match(f.detail, /consensus table does not/);
  });

  it("consensus capex: no coverage → data_gap with stable summary", () => {
    const out = buildQuarterlyChecklist(baseInputs({ hyperscalerCapex: [] }));
    const f = find(out, "consensus_capex");
    assert.equal(f.severity, "data_gap");
    assert.match(f.summary, /not yet ingested/);
  });

  it("full canonical run combines all 5 checks correctly", () => {
    const flags: DepFlagRow[] = [
      { ticker: "META", flagged_at: "2026-03-01", extension_years: 1.5, penalty_v: -7 },
    ];
    const aiq = new Map<string, AiqRubricSnap[]>();
    aiq.set("GOOGL", [
      { ticker: "GOOGL", scored_at: "2026-04-15", total: 75 },
      { ticker: "GOOGL", scored_at: "2026-01-15", total: 60 },
    ]);
    const msftCur = genReturns(90, 1);
    const googlCur = genReturns(90, 2, msftCur);
    const msftPr = genReturns(90, 50);
    const googlPr = genReturns(90, 51);
    const out = buildQuarterlyChecklist(
      baseInputs({
        newDepFlags: flags,
        aiqByTicker: aiq,
        hyperscalerReturns: {
          current: new Map([["MSFT", msftCur], ["GOOGL", googlCur]]),
          prior: new Map([["MSFT", msftPr], ["GOOGL", googlPr]]),
        },
        hyperscalerCapex: [{ ticker: "GOOGL", current_ttm_capex: 130, prior_ttm_capex: 100 }],
        is_annual_trigger: true,
      }),
    );
    assert.equal(out.length, 5);
    assert.equal(find(out, "useful_life_policy").severity, "high");
    assert.equal(find(out, "aiq_drift").severity, "warn");
    assert.equal(find(out, "hyperscaler_correlation").severity, "warn");
    assert.equal(find(out, "consensus_capex").severity, "data_gap");
    assert.equal(find(out, "annual_walk_forward").severity, "warn");
  });
});
