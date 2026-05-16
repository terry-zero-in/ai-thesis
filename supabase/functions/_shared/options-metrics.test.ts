import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MIN_CONTRACTS_FOR_METRICS,
  SHORT_TERM_DTE_MAX,
  computeOptionsMetrics,
  type OptionContract,
} from "./options-metrics.ts";

function contract(o: Partial<OptionContract>): OptionContract {
  return {
    contract_type: "call",
    strike: 100,
    dte: 30,
    open_interest: 100,
    implied_volatility: 0.4,
    delta: 0.25,
    ...o,
  };
}

function fillChain(extra: OptionContract[] = []): OptionContract[] {
  // 8 filler call/put pairs at 30-DTE with mid-band deltas to satisfy
  // MIN_CONTRACTS_FOR_METRICS without firing any specific signal.
  const filler: OptionContract[] = [];
  for (let i = 0; i < 4; i++) {
    filler.push(contract({ contract_type: "call", delta: 0.5, open_interest: 50 }));
    filler.push(contract({ contract_type: "put", delta: -0.5, open_interest: 50 }));
  }
  return [...filler, ...extra];
}

describe("computeOptionsMetrics", () => {
  it("returns all-null when below MIN_CONTRACTS_FOR_METRICS", () => {
    const out = computeOptionsMetrics([
      contract({}),
      contract({ contract_type: "put", delta: -0.25 }),
    ]);
    assert.equal(out.put_call_ratio, null);
    assert.equal(out.skew_25d, null);
    assert.equal(out.iv_term_slope, null);
    assert.ok(out.contracts_used < MIN_CONTRACTS_FOR_METRICS);
  });

  it("P/C ratio: total put OI / total call OI", () => {
    const chain = fillChain([
      contract({ contract_type: "put", open_interest: 1000, delta: -0.5 }),
    ]);
    // Filler: 4 calls × 50 OI = 200; 4 puts × 50 = 200; plus extra put 1000 → 1200/200 = 6.
    const out = computeOptionsMetrics(chain);
    assert.ok(out.put_call_ratio != null);
    assert.equal(out.put_call_ratio, 6);
  });

  it("P/C ratio: 0 call OI → null (no division by zero)", () => {
    // Build a put-only chain at sufficient size — call_oi = 0.
    const chain: OptionContract[] = [];
    for (let i = 0; i < 8; i++) chain.push(contract({ contract_type: "put", open_interest: 100, delta: -0.5 }));
    const out = computeOptionsMetrics(chain);
    assert.equal(out.put_call_ratio, null);
  });

  it("skew_25d: picks closest-to-25Δ call and put, returns put IV - call IV", () => {
    const chain = fillChain([
      contract({ contract_type: "call", delta: 0.27, implied_volatility: 0.30, dte: 30 }),
      contract({ contract_type: "put", delta: -0.24, implied_volatility: 0.42, dte: 30 }),
    ]);
    const out = computeOptionsMetrics(chain);
    assert.ok(out.skew_25d != null);
    // Expect roughly 0.42 - 0.30 = 0.12.
    assert.ok(Math.abs(out.skew_25d! - 0.12) < 1e-9);
  });

  it("skew_25d: returns null when no contract within ±0.10 of 0.25 delta", () => {
    const chain = fillChain([
      contract({ contract_type: "call", delta: 0.05, implied_volatility: 0.30, dte: 30 }),
      contract({ contract_type: "put", delta: -0.05, implied_volatility: 0.30, dte: 30 }),
    ]);
    const out = computeOptionsMetrics(chain);
    assert.equal(out.skew_25d, null);
  });

  it("skew_25d: restricted to short-dated (DTE ≤ 60)", () => {
    const chain = fillChain([
      // Only long-dated 25Δ contracts available — should not match.
      contract({ contract_type: "call", delta: 0.25, implied_volatility: 0.30, dte: 120 }),
      contract({ contract_type: "put", delta: -0.25, implied_volatility: 0.42, dte: 120 }),
    ]);
    const out = computeOptionsMetrics(chain);
    assert.equal(out.skew_25d, null);
    assert.equal(SHORT_TERM_DTE_MAX, 60);
  });

  it("iv_term_slope: long-dated mean IV minus short-dated mean IV", () => {
    const chain: OptionContract[] = [];
    // 8 short-dated contracts at IV 0.30
    for (let i = 0; i < 8; i++)
      chain.push(contract({ implied_volatility: 0.30, dte: 30, delta: 0.5 }));
    // 4 long-dated (90 DTE) contracts at IV 0.50
    for (let i = 0; i < 4; i++)
      chain.push(contract({ implied_volatility: 0.50, dte: 90, delta: 0.5 }));
    const out = computeOptionsMetrics(chain);
    // Expect 0.50 - 0.30 = 0.20.
    assert.ok(out.iv_term_slope != null);
    assert.ok(Math.abs(out.iv_term_slope! - 0.20) < 1e-9);
  });

  it("iv_term_slope: returns null when one tenor bucket is empty", () => {
    const chain: OptionContract[] = [];
    for (let i = 0; i < 10; i++)
      chain.push(contract({ implied_volatility: 0.30, dte: 30, delta: 0.5 }));
    const out = computeOptionsMetrics(chain);
    assert.equal(out.iv_term_slope, null);
  });

  it("ignores contracts with neither OI nor IV", () => {
    const chain = fillChain([
      contract({ contract_type: "call", open_interest: null, implied_volatility: null, delta: 0.25 }),
    ]);
    const out = computeOptionsMetrics(chain);
    assert.equal(out.contracts_used, 8); // filler only; the malformed extra excluded
  });

  it("backwardation: negative iv_term_slope signals near-term stress", () => {
    const chain: OptionContract[] = [];
    for (let i = 0; i < 6; i++)
      chain.push(contract({ implied_volatility: 0.60, dte: 30, delta: 0.5 }));
    for (let i = 0; i < 6; i++)
      chain.push(contract({ implied_volatility: 0.30, dte: 90, delta: 0.5 }));
    const out = computeOptionsMetrics(chain);
    assert.ok(out.iv_term_slope != null && out.iv_term_slope < 0);
  });
});
