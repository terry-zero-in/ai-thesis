import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSusi, type SiObservation } from "./susi.ts";

// Helper to fabricate a 24-month history with a controlled tail.
function history(values: number[]): SiObservation[] {
  return values.map((v, i) => {
    // settlement_date stamps walking backward bi-monthly from a fixed date.
    const baseMs = new Date("2026-05-15").getTime();
    const dt = new Date(baseMs - i * 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return { settlement_date: dt, short_interest: v };
  });
}

test("computeSusi: empty history returns null", () => {
  assert.equal(computeSusi([]), null);
});

test("computeSusi: too-small prior window (<6) returns null", () => {
  const h = history([100, 95, 90, 88, 92]); // 5 observations total → prior=4
  assert.equal(computeSusi(h), null);
});

test("computeSusi: zero-stdev prior window returns null", () => {
  const flat = history([100, 50, 50, 50, 50, 50, 50, 50]); // prior all 50
  assert.equal(computeSusi(flat), null);
});

test("computeSusi: positive surprise yields positive z", () => {
  const h = history([200, ...Array(20).fill(100)]); // latest 200 vs prior all-100
  // Prior stdev = 0 → returns null. Add small noise so stdev > 0.
  const withNoise = h.map((r, i) =>
    i === 0 ? r : { ...r, short_interest: 100 + (i % 3) },
  );
  const z = computeSusi(withNoise);
  assert.ok(z !== null && z > 5);
});

test("computeSusi: drop below prior baseline yields negative z", () => {
  const h = history([60, ...Array(20).fill(100).map((v, i) => v + (i % 3))]);
  const z = computeSusi(h);
  assert.ok(z !== null && z < -3);
});

test("computeSusi: latest at the prior mean returns ~0", () => {
  const priorVals = [100, 102, 98, 101, 99, 103, 97, 100];
  const priorMean = priorVals.reduce((s, v) => s + v, 0) / priorVals.length;
  const h = history([priorMean, ...priorVals]);
  const z = computeSusi(h);
  assert.ok(z !== null && Math.abs(z) < 0.01);
});

test("computeSusi: respects 24-month cutoff — older readings are ignored", () => {
  // Build a long history: 30 recent points (covered by 24mo window) +
  // 100 ancient points years before. The ancient points must NOT pull the z.
  const recent = Array(30).fill(100).map((v, i) => v + (i % 3));
  // Walk recent dates back 15 days each = ~13mo, all inside the 24mo window.
  const recentHist = recent.map((v, i) => ({
    settlement_date: new Date(new Date("2026-05-15").getTime() - i * 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    short_interest: v,
  }));
  // Ancient: 5 years older.
  const ancientHist = Array(100).fill(0).map((_, i) => ({
    settlement_date: new Date(new Date("2020-01-01").getTime() - i * 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    short_interest: 10000, // huge — would skew mean massively if included
  }));
  // latest observation
  const full: SiObservation[] = [
    { settlement_date: "2026-05-15", short_interest: 102 },
    ...recentHist.slice(1),
    ...ancientHist,
  ];
  const z = computeSusi(full);
  assert.ok(z !== null);
  // If ancient points leaked in, |z| would be huge. With only recent, z is small.
  assert.ok(Math.abs(z) < 5);
});
