import { test } from "node:test";
import assert from "node:assert/strict";
import { runBacktest, type BacktestConfig, type ReturnObs, type ScoreObs } from "./backtest.ts";

const REBAL_DATES = [
  "2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30", "2025-05-31",
  "2025-06-30", "2025-07-31", "2025-08-31", "2025-09-30", "2025-10-31",
  "2025-11-30", "2025-12-31", "2026-01-31",
];

function cfg(topN = 3, costPerSide = 0.001): BacktestConfig {
  return { rebalanceDates: REBAL_DATES, topN, costPerSide };
}

test("runBacktest: empty inputs → empty result", () => {
  const r = runBacktest([], [], { rebalanceDates: [], topN: 3, costPerSide: 0.001 });
  assert.equal(r.rebalance_count, 0);
  assert.equal(r.sharpe, 0);
});

test("runBacktest: single rebalance date → empty result (need ≥ 2 to form a period)", () => {
  const r = runBacktest([], [], { rebalanceDates: ["2025-01-31"], topN: 3, costPerSide: 0.001 });
  assert.equal(r.rebalance_count, 0);
});

test("runBacktest: perfect oracle (score = next-period return) earns the universe's best returns", () => {
  // Universe of 5 tickers; oracle knows the next-month return.
  const tickers = ["A", "B", "C", "D", "E"];
  const scores: ScoreObs[] = [];
  const returns: ReturnObs[] = [];
  // Returns: A always +5%, B always +3%, C 0%, D -2%, E -5%. Oracle gets the best 3.
  const rets: Record<string, number> = { A: 0.05, B: 0.03, C: 0, D: -0.02, E: -0.05 };
  for (let i = 0; i < REBAL_DATES.length; i++) {
    const d = REBAL_DATES[i];
    for (const t of tickers) {
      scores.push({ as_of: d, ticker: t, score: 100 * rets[t] }); // ranking == return
      if (i > 0) returns.push({ as_of: d, ticker: t, ret: rets[t] });
    }
  }
  const r = runBacktest(scores, returns, cfg(3, 0));
  // Top-3 = A, B, C → mean return = (0.05 + 0.03 + 0) / 3 = 0.02667
  const expectedMonthly = (0.05 + 0.03 + 0) / 3;
  for (const m of r.monthly_returns_net) assert.ok(Math.abs(m - expectedMonthly) < 1e-9);
  assert.ok(r.sharpe > 100); // zero variance → very high Sharpe before clamp; we don't clamp
});

test("runBacktest: turnover cost reduces net return below gross", () => {
  // Universe rotates: scores swap between two pairs every period.
  // Period 1: A, B selected. Period 2: C, D selected. etc. → high turnover.
  const tickers = ["A", "B", "C", "D"];
  const scores: ScoreObs[] = [];
  const returns: ReturnObs[] = [];
  for (let i = 0; i < REBAL_DATES.length; i++) {
    const d = REBAL_DATES[i];
    // Even period: A,B preferred. Odd: C,D preferred.
    const order = i % 2 === 0 ? ["A", "B", "C", "D"] : ["C", "D", "A", "B"];
    for (let j = 0; j < tickers.length; j++) {
      scores.push({ as_of: d, ticker: order[j], score: 100 - j * 10 });
    }
    if (i > 0) for (const t of tickers) returns.push({ as_of: d, ticker: t, ret: 0.01 });
  }
  const r = runBacktest(scores, returns, cfg(2, 0.001));
  // Gross = 0.01 per period. Net should be slightly below; turnover > 0 on
  // every period after the first.
  for (let i = 0; i < r.monthly_returns_net.length; i++) {
    assert.ok(r.monthly_returns_net[i] <= r.monthly_returns[i]);
  }
  assert.ok(r.avg_turnover > 0.5);
});

test("runBacktest: lookahead-safe — score from after rebalance date is excluded", () => {
  // Provide a "future" score that, if used, would change ranking.
  // Engine should ignore it.
  const scores: ScoreObs[] = [
    { as_of: "2025-01-31", ticker: "A", score: 50 },
    { as_of: "2025-01-31", ticker: "B", score: 80 }, // B wins at jan 31
    { as_of: "2025-02-28", ticker: "A", score: 99 }, // future! ignored at jan 31 rebalance
    { as_of: "2025-02-28", ticker: "B", score: 10 },
  ];
  const returns: ReturnObs[] = [
    { as_of: "2025-02-28", ticker: "A", ret: 0.10 },
    { as_of: "2025-02-28", ticker: "B", ret: -0.05 },
  ];
  const r = runBacktest(scores, returns, {
    rebalanceDates: ["2025-01-31", "2025-02-28"],
    topN: 1,
    costPerSide: 0,
  });
  // At jan 31, B is top → holds B → earns -5%.
  assert.equal(r.monthly_returns_net.length, 1);
  assert.ok(Math.abs(r.monthly_returns_net[0] + 0.05) < 1e-9);
});

test("runBacktest: max_drawdown computed correctly on a known sequence", () => {
  // Sequence: +20%, -50%, +50%, -25% — peak after period 1 at 1.2, trough
  // at 0.6 → DD = -50% from peak.
  const tickers = ["X"];
  const monthly = [0.2, -0.5, 0.5, -0.25];
  const scores: ScoreObs[] = [];
  const returns: ReturnObs[] = [];
  const dates = ["2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30", "2025-05-31"];
  for (let i = 0; i < dates.length; i++) {
    scores.push({ as_of: dates[i], ticker: "X", score: 100 });
    if (i > 0) returns.push({ as_of: dates[i], ticker: "X", ret: monthly[i - 1] });
  }
  const r = runBacktest(scores, returns, { rebalanceDates: dates, topN: 1, costPerSide: 0 });
  // Cumulative: 1, 1.2, 0.6, 0.9, 0.675 → peak=1.2, trough after 1.2 is 0.6 → dd=-0.5
  assert.ok(Math.abs(r.max_drawdown + 0.5) < 1e-9, `expected -0.5, got ${r.max_drawdown}`);
});

test("runBacktest: hit_rate is fraction of positive net periods", () => {
  const scores: ScoreObs[] = [];
  const returns: ReturnObs[] = [];
  const dates = ["2025-01-31", "2025-02-28", "2025-03-31", "2025-04-30", "2025-05-31"];
  // 5 dates → 4 periods. monthly[i-1] for i=1..4 → uses indices 0..3.
  const monthly = [0.05, -0.02, 0.01, -0.10]; // 2 positive, 2 negative → 0.5
  for (let i = 0; i < dates.length; i++) {
    scores.push({ as_of: dates[i], ticker: "X", score: 100 });
    if (i > 0) returns.push({ as_of: dates[i], ticker: "X", ret: monthly[i - 1] });
  }
  const r = runBacktest(scores, returns, { rebalanceDates: dates, topN: 1, costPerSide: 0 });
  assert.ok(Math.abs(r.hit_rate - 0.5) < 1e-9, `expected 0.5, got ${r.hit_rate}`);
});

test("runBacktest: Sharpe annualization uses periodsPerYear", () => {
  // Constant +1% monthly return → mean=0.01, std=0 → Sharpe=0 (we don't
  // divide by zero). Make it noisy.
  const scores: ScoreObs[] = [];
  const returns: ReturnObs[] = [];
  const monthly = [0.02, -0.01, 0.03, -0.005, 0.02, 0.01, -0.005, 0.025, 0.005, 0.015, 0.0, 0.02];
  const dates = REBAL_DATES;
  for (let i = 0; i < dates.length; i++) {
    scores.push({ as_of: dates[i], ticker: "X", score: 100 });
    if (i > 0) returns.push({ as_of: dates[i], ticker: "X", ret: monthly[i - 1] });
  }
  const r = runBacktest(scores, returns, { rebalanceDates: dates, topN: 1, costPerSide: 0 });
  // mean ≈ 0.0104, std ≈ 0.0125, Sharpe annualized = mean*12 / (std*sqrt(12))
  //                                                ≈ 0.125 / 0.0433 ≈ 2.88
  assert.ok(r.sharpe > 2 && r.sharpe < 4, `Sharpe out of expected range: ${r.sharpe}`);
});

test("runBacktest: partial coverage scales up so missing-return doesn't drag", () => {
  // Two-ticker basket; one ticker missing a return one month. Average
  // should equal the available return (not divided by 2).
  const scores: ScoreObs[] = [
    { as_of: "2025-01-31", ticker: "A", score: 100 },
    { as_of: "2025-01-31", ticker: "B", score: 90 },
  ];
  const returns: ReturnObs[] = [
    { as_of: "2025-02-28", ticker: "A", ret: 0.10 },
    // B missing
  ];
  const r = runBacktest(scores, returns, {
    rebalanceDates: ["2025-01-31", "2025-02-28"],
    topN: 2,
    costPerSide: 0,
  });
  // A returned +10%, B null. Engine scales 1/2 × 0.10 up by (2/1) = 0.10.
  assert.ok(Math.abs(r.monthly_returns_net[0] - 0.10) < 1e-9);
});
