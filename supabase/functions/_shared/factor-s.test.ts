import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSForCohort, type Layer, type SInputs } from "./factor-s.ts";

function base(ticker: string, layer: Layer = 1): SInputs {
  return {
    ticker,
    layer,
    revisions_delta: null,
    options_skew: null,
    susi_z: null,
    insider_override: null,
  };
}

test("computeSForCohort: empty input returns []", () => {
  assert.deepEqual(computeSForCohort([]), []);
});

test("computeSForCohort: all-missing tickers get null sScore", () => {
  const r = computeSForCohort([base("X"), base("Y")]);
  assert.equal(r[0].sScore, null);
  assert.equal(r[1].sScore, null);
});

test("Higher revisions_delta ranks higher (positive=bullish)", () => {
  const inputs: SInputs[] = [
    { ...base("A"), revisions_delta: 0.10, susi_z: 0, insider_override: 0 },
    { ...base("B"), revisions_delta: 0.00, susi_z: 0, insider_override: 0 },
    { ...base("C"), revisions_delta: -0.05, susi_z: 0, insider_override: 0 },
  ];
  const r = new Map(computeSForCohort(inputs).map((x) => [x.ticker, x.sScore]));
  assert.ok((r.get("A") ?? 0) > (r.get("B") ?? 0));
  assert.ok((r.get("B") ?? 0) > (r.get("C") ?? 0));
});

test("Higher SUSI = more bearish = lower S", () => {
  const inputs: SInputs[] = [
    { ...base("Low"), susi_z: -2.0 }, // low SI = bullish
    { ...base("Mid"), susi_z: 0.0 },
    { ...base("High"), susi_z: 3.0 }, // elevated SI = bearish
  ];
  const r = new Map(computeSForCohort(inputs).map((x) => [x.ticker, x.sScore]));
  assert.ok((r.get("Low") ?? 0) > (r.get("Mid") ?? 0));
  assert.ok((r.get("Mid") ?? 0) > (r.get("High") ?? 0));
});

test("Higher options skew (puts richer) = more bearish = lower S", () => {
  const inputs: SInputs[] = [
    { ...base("Calls"), options_skew: -0.05 }, // calls richer = bullish
    { ...base("Neutral"), options_skew: 0 },
    { ...base("Puts"), options_skew: 0.05 }, // puts richer = bearish
  ];
  const r = new Map(computeSForCohort(inputs).map((x) => [x.ticker, x.sScore]));
  assert.ok((r.get("Calls") ?? 0) > (r.get("Neutral") ?? 0));
  assert.ok((r.get("Neutral") ?? 0) > (r.get("Puts") ?? 0));
});

test("Insider BUY override (+5) ranks higher than SELL (-3)", () => {
  const inputs: SInputs[] = [
    { ...base("Buy"), insider_override: 5 },
    { ...base("Neutral"), insider_override: 0 },
    { ...base("Sell"), insider_override: -3 },
  ];
  const r = new Map(computeSForCohort(inputs).map((x) => [x.ticker, x.sScore]));
  assert.ok((r.get("Buy") ?? 0) > (r.get("Neutral") ?? 0));
  assert.ok((r.get("Neutral") ?? 0) > (r.get("Sell") ?? 0));
});

test("Options-skew-blocked path: 3-signal ticker still scores cleanly", () => {
  // Simulates THS-59-pending world: options_skew is null for all tickers.
  const inputs: SInputs[] = [
    { ...base("A"), revisions_delta: 0.05, susi_z: -0.5, insider_override: 5 },
    { ...base("B"), revisions_delta: 0.00, susi_z: 0.0, insider_override: 0 },
    { ...base("C"), revisions_delta: -0.04, susi_z: 1.0, insider_override: -3 },
  ];
  const r = computeSForCohort(inputs);
  // All three should have non-null sScore despite options_skew=null.
  for (const x of r) assert.ok(x.sScore !== null, `${x.ticker} sScore should be non-null`);
  // A should rank highest (most bullish on all three available signals).
  const byTicker = new Map(r.map((x) => [x.ticker, x.sScore]));
  assert.ok((byTicker.get("A") ?? 0) > (byTicker.get("C") ?? 0));
});

test("Insider-only ticker still scores (rescaled weights)", () => {
  const inputs: SInputs[] = [
    { ...base("Buy"), insider_override: 5 },
    { ...base("Mid"), insider_override: 0 },
    { ...base("Sell"), insider_override: -3 },
  ];
  const r = computeSForCohort(inputs);
  for (const x of r) assert.ok(x.sScore !== null);
});

test("Single-name cohort returns neutral 50", () => {
  const r = computeSForCohort([
    { ...base("X"), revisions_delta: 0.05, options_skew: 0, susi_z: 0, insider_override: 0 },
  ]);
  assert.equal(r.length, 1);
  assert.equal(r[0].sScore, 50);
});

test("Insider override fires correctly (acceptance criterion)", () => {
  // Build a 5-name cohort where one name has a strong BUY override and
  // the others are neutral. The BUY-override name should clearly rank
  // higher than the others.
  const inputs: SInputs[] = [
    { ...base("BuyCluster"), revisions_delta: 0.02, susi_z: 0, insider_override: 5 },
    { ...base("N1"), revisions_delta: 0.02, susi_z: 0, insider_override: 0 },
    { ...base("N2"), revisions_delta: 0.02, susi_z: 0, insider_override: 0 },
    { ...base("N3"), revisions_delta: 0.02, susi_z: 0, insider_override: 0 },
    { ...base("SellCluster"), revisions_delta: 0.02, susi_z: 0, insider_override: -3 },
  ];
  const r = new Map(computeSForCohort(inputs).map((x) => [x.ticker, x.sScore]));
  const buy = r.get("BuyCluster") ?? 0;
  const sell = r.get("SellCluster") ?? 0;
  const neutral = r.get("N1") ?? 0;
  assert.ok(buy > neutral, `BuyCluster (${buy}) should exceed neutral (${neutral})`);
  assert.ok(neutral > sell, `Neutral (${neutral}) should exceed SellCluster (${sell})`);
});
