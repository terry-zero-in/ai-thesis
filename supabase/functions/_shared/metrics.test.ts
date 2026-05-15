import { test } from "node:test";
import assert from "node:assert/strict";
import {
  altmanZ,
  beta,
  dailyReturns,
  effectiveTaxRate,
  epsSeriesFromFundamentals,
  epsVolatility,
  fcfOverRevenue,
  fiveYearDelta,
  grossProfitOverAssets,
  leverage,
  operatingMargin,
  payoutYield,
  roic,
  type Fundamentals,
} from "./metrics.ts";

const baseFunds: Fundamentals = {
  revenue: null,
  gross_profit: null,
  operating_income: null,
  net_income: null,
  fcf: null,
  total_assets: null,
  total_debt: null,
  shareholders_equity: null,
  shares_diluted: null,
  cash_and_equivalents: null,
  retained_earnings: null,
  current_assets: null,
  current_liabilities: null,
  income_before_tax: null,
  income_tax_expense: null,
  dividends_paid: null,
  common_stock_repurchased: null,
};
const f = (over: Partial<Fundamentals>): Fundamentals => ({ ...baseFunds, ...over });

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ─── Simple ratios ──────────────────────────────────────────────────────────

test("grossProfitOverAssets: golden path", () => {
  approx(grossProfitOverAssets(f({ gross_profit: 250, total_assets: 1000 }))!, 0.25);
});

test("grossProfitOverAssets: zero or null inputs → null", () => {
  assert.equal(grossProfitOverAssets(f({ gross_profit: 250, total_assets: 0 })), null);
  assert.equal(grossProfitOverAssets(f({ gross_profit: null, total_assets: 1000 })), null);
});

test("operatingMargin / fcfOverRevenue: golden path", () => {
  approx(operatingMargin(f({ operating_income: 150, revenue: 1000 }))!, 0.15);
  approx(fcfOverRevenue(f({ fcf: 200, revenue: 1000 }))!, 0.20);
});

// ─── Effective tax rate ─────────────────────────────────────────────────────

test("effectiveTaxRate: normal case", () => {
  approx(effectiveTaxRate(f({ income_before_tax: 1000, income_tax_expense: 200 }))!, 0.20);
});

test("effectiveTaxRate: clamps to [0, 0.5]", () => {
  // Negative tax expense (tax benefit) → 0
  assert.equal(effectiveTaxRate(f({ income_before_tax: 1000, income_tax_expense: -50 })), 0);
  // Effective > 50% → 0.5
  assert.equal(effectiveTaxRate(f({ income_before_tax: 100, income_tax_expense: 80 })), 0.5);
});

test("effectiveTaxRate: loss year → null", () => {
  assert.equal(effectiveTaxRate(f({ income_before_tax: -100, income_tax_expense: 20 })), null);
});

// ─── ROIC ───────────────────────────────────────────────────────────────────

test("roic: NOPAT / invested capital", () => {
  const v = roic(f({
    operating_income: 200,
    income_before_tax: 1000,
    income_tax_expense: 200,         // 20% effective rate
    total_debt: 300,
    shareholders_equity: 500,
    cash_and_equivalents: 100,
  }));
  // NOPAT = 200 × 0.8 = 160; invested capital = 300 + 500 - 100 = 700; roic ≈ 0.2286
  approx(v!, 160 / 700, 1e-12);
});

test("roic: null operating_income → null", () => {
  assert.equal(roic(f({ operating_income: null, shareholders_equity: 100 })), null);
});

test("roic: invested capital ≤ 0 → null (negative equity, no offsetting cash)", () => {
  assert.equal(
    roic(f({
      operating_income: 50,
      income_before_tax: 100,
      income_tax_expense: 20,
      total_debt: 0,
      shareholders_equity: -10,
    })),
    null,
  );
});

test("roic: cash missing treated as 0", () => {
  const v = roic(f({
    operating_income: 100,
    income_before_tax: 500,
    income_tax_expense: 100,
    total_debt: 200,
    shareholders_equity: 800,
    cash_and_equivalents: null,
  }));
  // NOPAT = 80; invested capital = 200 + 800 - 0 = 1000; roic = 0.08
  approx(v!, 0.08);
});

// ─── Leverage ───────────────────────────────────────────────────────────────

test("leverage: D/E golden path", () => {
  approx(leverage(f({ total_debt: 300, shareholders_equity: 600 }))!, 0.5);
});

test("leverage: negative equity → null", () => {
  assert.equal(leverage(f({ total_debt: 300, shareholders_equity: -100 })), null);
});

// ─── Altman Z ───────────────────────────────────────────────────────────────

test("altmanZ: golden path matches formula", () => {
  // Hand-computed reference. wc/ta = 200/2000 = 0.1; re/ta = 600/2000 = 0.3;
  // op/ta = 300/2000 = 0.15; mcap/tl = 4000/(2000-800) = 3.333...; rev/ta = 1500/2000 = 0.75.
  // Z = 1.2*0.1 + 1.4*0.3 + 3.3*0.15 + 0.6*(4000/1200) + 1.0*0.75
  //   = 0.12 + 0.42 + 0.495 + 2.0 + 0.75 = 3.785
  const z = altmanZ(
    f({
      total_assets: 2000,
      current_assets: 600,
      current_liabilities: 400,
      retained_earnings: 600,
      operating_income: 300,
      revenue: 1500,
      shareholders_equity: 800,
    }),
    4000, // market cap
  );
  approx(z!, 3.785, 1e-9);
});

test("altmanZ: missing market cap → null", () => {
  assert.equal(
    altmanZ(
      f({
        total_assets: 2000,
        current_assets: 600,
        current_liabilities: 400,
        retained_earnings: 600,
        operating_income: 300,
        revenue: 1500,
        shareholders_equity: 800,
      }),
      null,
    ),
    null,
  );
});

test("altmanZ: zero total liabilities → null", () => {
  // equity = total_assets → liabilities = 0 → guard returns null
  assert.equal(
    altmanZ(
      f({
        total_assets: 1000,
        current_assets: 500,
        current_liabilities: 200,
        retained_earnings: 400,
        operating_income: 100,
        revenue: 800,
        shareholders_equity: 1000,
      }),
      500,
    ),
    null,
  );
});

// ─── EPS series + volatility ────────────────────────────────────────────────

test("epsSeriesFromFundamentals: divides per row", () => {
  const series = epsSeriesFromFundamentals([
    { net_income: 100, shares_diluted: 100 },
    { net_income: 120, shares_diluted: 100 },
    { net_income: 90, shares_diluted: 100 },
    { net_income: null, shares_diluted: 100 },
    { net_income: 80, shares_diluted: 0 }, // zero shares → null
  ]);
  assert.deepEqual(series, [1.0, 1.2, 0.9, null, null]);
});

test("epsVolatility: under 4 finite points → null", () => {
  assert.equal(epsVolatility([1.0, 1.1, null]), null);
});

test("epsVolatility: stable EPS → low std", () => {
  const v = epsVolatility([1.0, 1.0, 1.0, 1.0, 1.0])!;
  approx(v, 0);
});

test("epsVolatility: volatile EPS → meaningful std", () => {
  const v = epsVolatility([1.0, 1.5, 0.8, 1.2, 0.9, 1.4])!;
  assert.ok(v > 0.2 && v < 0.4);
});

// ─── Beta + daily returns ───────────────────────────────────────────────────

test("dailyReturns: golden path with nulls", () => {
  const r = dailyReturns([100, 101, 99, null, 102, 0, 100]);
  // i=1: 101/100-1 = 0.01
  // i=2: 99/101-1 ≈ -0.0198
  // i=3: prev=99, cur=null → null
  // i=4: prev=null → null
  // i=5: 0/102-1 = -1
  // i=6: prev=0 → null
  approx(r[0]!, 0.01);
  approx(r[1]!, -2 / 101, 1e-12);
  assert.equal(r[2], null);
  assert.equal(r[3], null);
  approx(r[4]!, -1);
  assert.equal(r[5], null);
});

test("beta: own = 2× benchmark with noise → beta ≈ 2", () => {
  // Deterministic synthetic data: benchmark = sin wave, own = 2*bench + tiny noise.
  const bench: number[] = [];
  const own: number[] = [];
  for (let i = 0; i < 100; i++) {
    const b = Math.sin(i / 5) * 0.02;
    bench.push(b);
    own.push(2 * b + 0.0001 * Math.cos(i / 3));
  }
  const b = beta(own, bench)!;
  approx(b, 2, 0.02);
});

test("beta: fewer than 20 paired obs → null", () => {
  const own = [0.01, 0.02, -0.01];
  const bench = [0.005, 0.01, -0.005];
  assert.equal(beta(own, bench), null);
});

test("beta: mismatched lengths → null", () => {
  assert.equal(beta([0.01], [0.005, 0.01]), null);
});

// ─── Payout yield ───────────────────────────────────────────────────────────

test("payoutYield: dividends + buybacks / market cap", () => {
  const v = payoutYield(
    f({ dividends_paid: 200, common_stock_repurchased: 800 }),
    50000,
  );
  approx(v!, 0.02);
});

test("payoutYield: one component null treated as 0 (the other carries)", () => {
  const v = payoutYield(
    f({ dividends_paid: 100, common_stock_repurchased: null }),
    10000,
  );
  approx(v!, 0.01);
});

test("payoutYield: both null → null (don't claim a 0 yield)", () => {
  assert.equal(
    payoutYield(f({ dividends_paid: null, common_stock_repurchased: null }), 10000),
    null,
  );
});

test("payoutYield: zero/null market cap → null", () => {
  assert.equal(payoutYield(f({ dividends_paid: 100 }), 0), null);
  assert.equal(payoutYield(f({ dividends_paid: 100 }), null), null);
});

// ─── 5y delta ───────────────────────────────────────────────────────────────

test("fiveYearDelta: current minus 5y ago", () => {
  // 5 entries: indices 0..4 = (5y ago, 4y, 3y, 2y, current). current=0.30, 5y_ago=0.10 → delta 0.20.
  approx(fiveYearDelta([0.10, 0.15, 0.20, 0.25, 0.30])!, 0.20);
});

test("fiveYearDelta: under 5 periods → null", () => {
  assert.equal(fiveYearDelta([0.10, 0.15, 0.20, 0.25]), null);
});

test("fiveYearDelta: missing endpoint → null", () => {
  assert.equal(fiveYearDelta([0.10, 0.15, 0.20, 0.25, null]), null);
  assert.equal(fiveYearDelta([null, 0.15, 0.20, 0.25, 0.30]), null);
});
