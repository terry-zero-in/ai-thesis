// Unit tests for the pure FMP-normalization helpers. Run locally:
//   node --test --experimental-strip-types supabase/functions/_shared/fmp.test.ts
//
// We import only the pure helpers from fmp.ts. fetchIncome/Balance/Cash hit
// the network and require FMP_API_KEY; we don't exercise them here. The
// supabase-js / Deno-specific modules aren't touched by this test file.

import { test } from "node:test";
import assert from "node:assert/strict";

import { mergeStatements, type FmpBalanceRow, type FmpCashRow, type FmpIncomeRow } from "./fmp.ts";

test("mergeStatements joins on date and normalizes capex to magnitude", () => {
  const income: FmpIncomeRow[] = [
    {
      date: "2026-03-31",
      symbol: "NVDA",
      revenue: 30000,
      grossProfit: 22500,
      operatingIncome: 15000,
      netIncome: 12000,
      weightedAverageShsOutDil: 2480,
    },
  ];
  const balance: FmpBalanceRow[] = [
    {
      date: "2026-03-31",
      symbol: "NVDA",
      totalAssets: 90000,
      totalDebt: 11000,
      totalStockholdersEquity: 60000,
    },
  ];
  const cash: FmpCashRow[] = [
    {
      date: "2026-03-31",
      symbol: "NVDA",
      freeCashFlow: 11500,
      capitalExpenditure: -1800, // FMP returns capex as negative
    },
  ];

  const rows = mergeStatements("NVDA", "Q", income, balance, cash);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.ticker, "NVDA");
  assert.equal(row.period_end, "2026-03-31");
  assert.equal(row.period_type, "Q");
  assert.equal(row.revenue, 30000);
  assert.equal(row.gross_profit, 22500);
  assert.equal(row.operating_income, 15000);
  assert.equal(row.net_income, 12000);
  assert.equal(row.fcf, 11500);
  assert.equal(row.total_assets, 90000);
  assert.equal(row.total_debt, 11000);
  assert.equal(row.shareholders_equity, 60000);
  assert.equal(row.capex, 1800, "capex must be stored as positive magnitude");
  assert.equal(row.shares_diluted, 2480);
});

test("mergeStatements returns null for missing balance/cash matches", () => {
  const income: FmpIncomeRow[] = [
    { date: "2025-12-31", symbol: "X", revenue: 100, netIncome: 10 },
  ];
  const rows = mergeStatements("X", "Q", income, [], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].fcf, null);
  assert.equal(rows[0].total_assets, null);
  assert.equal(rows[0].capex, null);
  assert.equal(rows[0].gross_profit, null);
});

test("mergeStatements drops non-finite numbers to null", () => {
  const income: FmpIncomeRow[] = [
    {
      date: "2025-09-30",
      symbol: "Y",
      revenue: Number.NaN,
      grossProfit: Number.POSITIVE_INFINITY,
      netIncome: 5,
    },
  ];
  const rows = mergeStatements("Y", "Q", income, [], []);
  assert.equal(rows[0].revenue, null);
  assert.equal(rows[0].gross_profit, null);
  assert.equal(rows[0].net_income, 5);
});

test("mergeStatements is order-insensitive across statements", () => {
  // Income has Q1 + Q2; balance/cash arrive in reversed order. Result should
  // still join correctly per date.
  const income: FmpIncomeRow[] = [
    { date: "2026-03-31", symbol: "Z", revenue: 200 },
    { date: "2025-12-31", symbol: "Z", revenue: 180 },
  ];
  const balance: FmpBalanceRow[] = [
    { date: "2025-12-31", symbol: "Z", totalAssets: 900 },
    { date: "2026-03-31", symbol: "Z", totalAssets: 1000 },
  ];
  const cash: FmpCashRow[] = [
    { date: "2026-03-31", symbol: "Z", freeCashFlow: 50 },
    { date: "2025-12-31", symbol: "Z", freeCashFlow: 40 },
  ];
  const rows = mergeStatements("Z", "A", income, balance, cash);
  const byDate = Object.fromEntries(rows.map((r) => [r.period_end, r]));
  assert.equal(byDate["2026-03-31"].total_assets, 1000);
  assert.equal(byDate["2026-03-31"].fcf, 50);
  assert.equal(byDate["2025-12-31"].total_assets, 900);
  assert.equal(byDate["2025-12-31"].fcf, 40);
});
