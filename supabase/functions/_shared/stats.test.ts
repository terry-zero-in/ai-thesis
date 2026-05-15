import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mean,
  stddev,
  winsorize,
  zScoreInCohort,
  percentileRankInCohort,
  percentileFromZ,
} from "./stats.ts";

const approx = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) <= eps, `expected ${a} ≈ ${b} (±${eps})`);

// ─── mean / stddev ───────────────────────────────────────────────────────────

test("mean: golden path", () => {
  assert.equal(mean([1, 2, 3, 4, 5]), 3);
});

test("mean: ignores NaN / non-finite values", () => {
  assert.equal(mean([1, 2, NaN, 3, Infinity, -Infinity]), 2);
});

test("mean: empty cohort → NaN", () => {
  assert.ok(Number.isNaN(mean([])));
});

test("stddev: single value → 0", () => {
  assert.equal(stddev([5]), 0);
});

test("stddev: all-equal cohort → 0", () => {
  assert.equal(stddev([4, 4, 4, 4]), 0);
});

test("stddev: matches sample (N-1) formula", () => {
  // [2,4,4,4,5,5,7,9] — classic Wikipedia example: sample std = sqrt(32/7)
  approx(stddev([2, 4, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7), 1e-12);
});

test("stddev: filters NaN before computing", () => {
  approx(stddev([2, 4, NaN, 4, 4, 5, 5, 7, 9]), Math.sqrt(32 / 7), 1e-12);
});

// ─── winsorize ───────────────────────────────────────────────────────────────

test("winsorize: 2/98 clips both tails on 0..99", () => {
  const xs = Array.from({ length: 100 }, (_, i) => i);
  const w = winsorize(xs, 0.02);
  approx(w[0], 1.98);
  approx(w[99], 97.02);
  assert.equal(w[50], 50);
});

test("winsorize: NaN inputs pass through, finite values still clipped", () => {
  const w = winsorize([0, 1, 2, 3, NaN, 4, 5, 100], 0.1);
  assert.ok(Number.isNaN(w[4]));
  // 100 should be clipped well below 100
  assert.ok(w[7] < 100);
});

test("winsorize: single finite value untouched", () => {
  assert.deepEqual(winsorize([7]), [7]);
});

test("winsorize: empty cohort untouched", () => {
  assert.deepEqual(winsorize([]), []);
});

test("winsorize: all-NaN cohort untouched", () => {
  const w = winsorize([NaN, NaN, NaN]);
  assert.equal(w.length, 3);
  for (const v of w) assert.ok(Number.isNaN(v));
});

test("winsorize: p=0 is a no-op", () => {
  assert.deepEqual(winsorize([1, 2, 3, 1000], 0), [1, 2, 3, 1000]);
});

test("winsorize: rejects bad p", () => {
  assert.throws(() => winsorize([1, 2, 3], 0.5));
  assert.throws(() => winsorize([1, 2, 3], -0.1));
  assert.throws(() => winsorize([1, 2, 3], NaN));
});

// ─── zScoreInCohort ──────────────────────────────────────────────────────────

test("zScoreInCohort: golden path against [1,2,3,4,5]", () => {
  // mean=3, sample std = sqrt(2.5); z(5) = (5-3)/sqrt(2.5)
  approx(zScoreInCohort(5, [1, 2, 3, 4, 5]), 2 / Math.sqrt(2.5), 1e-12);
});

test("zScoreInCohort: all-equal cohort → 0 (no Infinity)", () => {
  assert.equal(zScoreInCohort(5, [4, 4, 4, 4]), 0);
});

test("zScoreInCohort: single-name cohort → 0", () => {
  assert.equal(zScoreInCohort(5, [5]), 0);
});

test("zScoreInCohort: NaN value → NaN", () => {
  assert.ok(Number.isNaN(zScoreInCohort(NaN, [1, 2, 3])));
});

test("zScoreInCohort: NaNs in cohort filtered", () => {
  approx(
    zScoreInCohort(5, [1, 2, NaN, 3, 4, 5]),
    2 / Math.sqrt(2.5),
    1e-12,
  );
});

// ─── percentileRankInCohort ──────────────────────────────────────────────────

test("percentileRankInCohort: midpoint rank for ties", () => {
  // [1,2,2,2,3] → value 2 has 1 below, 3 equal: rank = 1 + 1.5 = 2.5 → 50%
  assert.equal(percentileRankInCohort(2, [1, 2, 2, 2, 3]), 50);
});

test("percentileRankInCohort: all-equal cohort → 50 (regardless of value's identity)", () => {
  assert.equal(percentileRankInCohort(7, [7, 7, 7, 7]), 50);
});

test("percentileRankInCohort: top-of-distribution → 100", () => {
  assert.equal(percentileRankInCohort(10, [1, 2, 3, 4, 5]), 100);
});

test("percentileRankInCohort: bottom-of-distribution → 0", () => {
  assert.equal(percentileRankInCohort(-1, [1, 2, 3, 4, 5]), 0);
});

test("percentileRankInCohort: missing data filtered", () => {
  assert.equal(percentileRankInCohort(3, [1, 2, NaN, 4, 5]), 50);
});

test("percentileRankInCohort: NaN value → NaN", () => {
  assert.ok(Number.isNaN(percentileRankInCohort(NaN, [1, 2, 3])));
});

test("percentileRankInCohort: empty cohort → NaN", () => {
  assert.ok(Number.isNaN(percentileRankInCohort(5, [])));
});

// ─── percentileFromZ ─────────────────────────────────────────────────────────

test("percentileFromZ: z=0 → 50", () => {
  approx(percentileFromZ(0), 50, 1e-6);
});

test("percentileFromZ: z=1 → ~84.13", () => {
  assert.ok(Math.abs(percentileFromZ(1) - 84.13) < 0.01);
});

test("percentileFromZ: z=-1 → ~15.87", () => {
  assert.ok(Math.abs(percentileFromZ(-1) - 15.87) < 0.01);
});

test("percentileFromZ: z=1.96 → ~97.5", () => {
  assert.ok(Math.abs(percentileFromZ(1.96) - 97.5) < 0.05);
});

test("percentileFromZ: NaN → NaN", () => {
  assert.ok(Number.isNaN(percentileFromZ(NaN)));
});
