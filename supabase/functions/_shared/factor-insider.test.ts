import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BUY_OVERRIDE,
  SELL_OVERRIDE,
  detectClusterOverride,
  type InsiderFiling,
} from "./factor-insider.ts";

function buy(name: string, daysAgo: number, value: number, opts: Partial<InsiderFiling> = {}): InsiderFiling {
  return {
    ticker: "X",
    transaction_date: dateMinus(daysAgo),
    insider_name: name,
    insider_title: null,
    transaction_code: "P",
    acquired_disposed: "A",
    shares: 100,
    price_per_share: value / 100,
    transaction_value: value,
    is_10b5_1: null,
    ...opts,
  };
}
function sell(name: string, daysAgo: number, value: number, opts: Partial<InsiderFiling> = {}): InsiderFiling {
  return {
    ticker: "X",
    transaction_date: dateMinus(daysAgo),
    insider_name: name,
    insider_title: null,
    transaction_code: "S",
    acquired_disposed: "D",
    shares: 100,
    price_per_share: value / 100,
    transaction_value: value,
    is_10b5_1: null,
    ...opts,
  };
}
function dateMinus(days: number): string {
  const d = new Date("2026-05-16T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
const ASOF = "2026-05-16";

// ─── BUY override ───────────────────────────────────────────────────────────

test("BUY override: 3 insiders ≥ $1M each, last 90 days → +5", () => {
  const filings: InsiderFiling[] = [
    buy("Alice", 10, 1_200_000),
    buy("Bob", 30, 1_500_000),
    buy("Carol", 80, 2_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, "BUY");
  assert.equal(r.override, BUY_OVERRIDE);
  assert.equal(r.insiders, 3);
  assert.equal(r.total_value, 4_700_000);
});

test("BUY override: 2 insiders only → no fire", () => {
  const filings: InsiderFiling[] = [
    buy("Alice", 10, 1_200_000),
    buy("Bob", 30, 1_500_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, null);
  assert.equal(r.override, 0);
});

test("BUY override: insider just under $1M aggregate doesn't count", () => {
  const filings: InsiderFiling[] = [
    buy("Alice", 10, 999_999),
    buy("Bob", 30, 1_500_000),
    buy("Carol", 80, 2_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, null);
});

test("BUY override: per-insider aggregate counts (3x $400K by one insider = $1.2M)", () => {
  const filings: InsiderFiling[] = [
    buy("Alice", 10, 400_000),
    buy("Alice", 20, 400_000),
    buy("Alice", 30, 400_000), // Alice aggregate: $1.2M
    buy("Bob", 30, 1_500_000),
    buy("Carol", 80, 2_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, "BUY");
  assert.equal(r.insiders, 3);
});

test("BUY override: transactions outside 90d window are ignored", () => {
  const filings: InsiderFiling[] = [
    buy("Alice", 10, 1_200_000),
    buy("Bob", 100, 1_500_000), // outside 90d
    buy("Carol", 200, 2_000_000), // outside 90d
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, null);
});

// ─── SELL override ──────────────────────────────────────────────────────────

test("SELL override: 3 insiders ≥ $5M each, last 60 days → -3", () => {
  const filings: InsiderFiling[] = [
    sell("Alice", 10, 6_000_000),
    sell("Bob", 30, 7_500_000),
    sell("Carol", 50, 10_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, "SELL");
  assert.equal(r.override, SELL_OVERRIDE);
  assert.equal(r.insiders, 3);
});

test("SELL override: 10b5-1 sales are excluded", () => {
  const filings: InsiderFiling[] = [
    sell("Alice", 10, 6_000_000, { is_10b5_1: true }),
    sell("Bob", 30, 7_500_000),
    sell("Carol", 50, 10_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  // Only Bob + Carol qualify → 2 insiders → no fire
  assert.equal(r.kind, null);
});

test("SELL override: undetermined is_10b5_1 (null) is conservatively counted", () => {
  const filings: InsiderFiling[] = [
    sell("Alice", 10, 6_000_000, { is_10b5_1: null }),
    sell("Bob", 30, 7_500_000, { is_10b5_1: null }),
    sell("Carol", 50, 10_000_000, { is_10b5_1: null }),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, "SELL");
  assert.equal(r.insiders, 3);
});

test("SELL override: transactions outside 60d window are ignored", () => {
  const filings: InsiderFiling[] = [
    sell("Alice", 10, 6_000_000),
    sell("Bob", 30, 7_500_000),
    sell("Carol", 80, 10_000_000), // outside 60d → not counted
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, null);
});

// ─── Asymmetric tie-break ───────────────────────────────────────────────────

test("Both BUY and SELL qualify: BUY wins (informativeness asymmetry)", () => {
  const filings: InsiderFiling[] = [
    buy("Alice", 10, 1_200_000),
    buy("Bob", 30, 1_500_000),
    buy("Carol", 50, 2_000_000),
    sell("Dan", 10, 6_000_000),
    sell("Eve", 30, 7_500_000),
    sell("Frank", 50, 10_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, "BUY");
  assert.equal(r.override, BUY_OVERRIDE);
});

// ─── Code filtering ─────────────────────────────────────────────────────────

test("Exercises (M) and tax-withholdings (F) are ignored", () => {
  const filings: InsiderFiling[] = [
    { ...buy("Alice", 10, 5_000_000), transaction_code: "M" },
    { ...buy("Bob", 30, 5_000_000), transaction_code: "F" },
    { ...buy("Carol", 50, 5_000_000), transaction_code: "M" },
  ];
  const r = detectClusterOverride(filings, ASOF);
  assert.equal(r.kind, null);
});

// ─── 12-month historical-data acceptance check ──────────────────────────────

test("12-month rolling check: detects 2 distinct cluster events at correct points", () => {
  // Build 12 months of synthesized history with two clusters: a BUY
  // cluster around month 8 and a SELL cluster around month 11.
  const all: InsiderFiling[] = [];
  // Normal background noise: scattered single-insider $100K transactions
  for (let m = 1; m <= 12; m++) {
    all.push(buy(`Noise${m}`, m * 30, 100_000));
  }
  // BUY cluster: 3 insiders, large buys, in the 90 days ending around
  // the "month 8" snapshot.
  const buyClusterDays = [240, 250, 260]; // ~8 months ago
  all.push(buy("BuyA", buyClusterDays[0], 1_500_000));
  all.push(buy("BuyB", buyClusterDays[1], 2_000_000));
  all.push(buy("BuyC", buyClusterDays[2], 1_800_000));
  // SELL cluster: 3 insiders, large sells, in the 60 days ending around
  // the "month 11" snapshot. Two of three are 10b5-1 to verify exclusion.
  const sellClusterDays = [10, 30, 50];
  all.push(sell("SellA", sellClusterDays[0], 8_000_000, { is_10b5_1: false }));
  all.push(sell("SellB", sellClusterDays[1], 9_000_000, { is_10b5_1: false }));
  all.push(sell("SellC", sellClusterDays[2], 12_000_000, { is_10b5_1: false }));

  // Snapshot at as_of = today: SELL cluster should be detected (BUY
  // cluster is now 8 months old, out of the 90d BUY window).
  const todaySnap = detectClusterOverride(all, ASOF);
  assert.equal(todaySnap.kind, "SELL", `today snap: expected SELL, got ${JSON.stringify(todaySnap)}`);
  assert.equal(todaySnap.insiders, 3);

  // Snapshot 8 months ago: BUY cluster should be the active signal.
  const eightMonthsAgo = new Date("2026-05-16T00:00:00Z");
  eightMonthsAgo.setUTCDate(eightMonthsAgo.getUTCDate() - 240);
  const eightSnap = detectClusterOverride(all, eightMonthsAgo.toISOString().slice(0, 10));
  assert.equal(eightSnap.kind, "BUY", `eight-month snap: expected BUY, got ${JSON.stringify(eightSnap)}`);
  assert.equal(eightSnap.insiders, 3);

  // Snapshot in the middle (4 months ago): neither cluster is in its window
  // (BUY cluster is 4 months old; SELL cluster is 4 months in the future).
  const fourMonthsAgo = new Date("2026-05-16T00:00:00Z");
  fourMonthsAgo.setUTCDate(fourMonthsAgo.getUTCDate() - 120);
  const fourSnap = detectClusterOverride(all, fourMonthsAgo.toISOString().slice(0, 10));
  assert.equal(fourSnap.kind, null, `four-month snap: expected null, got ${JSON.stringify(fourSnap)}`);
});

// ─── Edge cases ─────────────────────────────────────────────────────────────

test("Empty filings list → null", () => {
  const r = detectClusterOverride([], ASOF);
  assert.equal(r.kind, null);
  assert.equal(r.override, 0);
});

test("Filings with null shares + null transaction_value contribute 0", () => {
  const filings: InsiderFiling[] = [
    {
      ...buy("Alice", 10, 0),
      shares: null,
      transaction_value: null,
      price_per_share: null,
    },
    buy("Bob", 30, 1_500_000),
    buy("Carol", 50, 2_000_000),
  ];
  const r = detectClusterOverride(filings, ASOF);
  // Alice contributes 0 → doesn't meet the $1M floor → 2 qualifying → no fire
  assert.equal(r.kind, null);
});
