import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  buildMacroRow,
  computeAaii3WkSpread,
  parseFearGreed,
  parseNaaimTable,
  pickAtOrBefore,
  type AaiiWeekly,
  type MacroRow,
} from "./macro.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string) => readFileSync(resolve(here, "fixtures", name), "utf8");

// ─── parseNaaimTable ────────────────────────────────────────────────────────

test("parseNaaimTable: real fixture parses to date+value pairs", () => {
  const rows = parseNaaimTable(fixture("naaim_table.html"));
  assert.ok(rows.length >= 5, `expected >=5 rows, got ${rows.length}`);
  // First row should be the newest (table is newest-first).
  assert.equal(rows[0].date, "2026-05-13");
  assert.equal(rows[0].value, 77.34);
  // Second row should be the 5/6 reading used in the spec seed.
  assert.equal(rows[1].date, "2026-05-06");
  assert.equal(rows[1].value, 96.67);
});

test("parseNaaimTable: tolerates the full page (not just the table fragment)", () => {
  const fragment = fixture("naaim_table.html");
  const wrapped = `<html><body><div><p>filler</p>${fragment}<p>more</p></div></body></html>`;
  const rows = parseNaaimTable(wrapped);
  assert.ok(rows.length >= 5);
  assert.equal(rows[0].date, "2026-05-13");
});

test("parseNaaimTable: drops header row + malformed cells silently", () => {
  const html = `
    <table>
      <tr><th>Date</th><th>NAAIM Mean</th></tr>
      <tr><td>05/06/2026</td><td>96.67</td></tr>
      <tr><td>not-a-date</td><td>50</td></tr>
      <tr><td>04/29/2026</td><td>nope</td></tr>
      <tr><td>04/22/2026</td><td>88.10</td></tr>
    </table>`;
  const rows = parseNaaimTable(html);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], { date: "2026-05-06", value: 96.67 });
  assert.deepEqual(rows[1], { date: "2026-04-22", value: 88.1 });
});

test("parseNaaimTable: empty input returns []", () => {
  assert.deepEqual(parseNaaimTable(""), []);
  assert.deepEqual(parseNaaimTable("<html></html>"), []);
});

// ─── parseFearGreed ─────────────────────────────────────────────────────────

test("parseFearGreed: real CNN fixture yields chronological series", () => {
  const json = JSON.parse(fixture("fng.json"));
  const series = parseFearGreed(json);
  assert.ok(series.length >= 10, `expected >=10 points, got ${series.length}`);
  // Sorted oldest first.
  for (let i = 1; i < series.length; i++) {
    assert.ok(series[i - 1].date <= series[i].date, `not sorted at ${i}: ${series[i - 1].date} vs ${series[i].date}`);
  }
  // Every value is in [0, 100].
  for (const r of series) {
    assert.ok(r.value >= 0 && r.value <= 100, `value out of range: ${r.value}`);
  }
});

test("parseFearGreed: current reading overrides any same-date history point", () => {
  const json = {
    fear_and_greed: { score: 77.5, timestamp: Date.UTC(2026, 4, 15) },
    fear_and_greed_historical: {
      data: [
        { x: Date.UTC(2026, 4, 14), y: 60 },
        { x: Date.UTC(2026, 4, 15), y: 50 }, // stale; should be replaced by current
      ],
    },
  };
  const series = parseFearGreed(json);
  assert.equal(series.length, 2);
  const may15 = series.find((p) => p.date === "2026-05-15");
  assert.ok(may15);
  assert.equal(may15!.value, 77.5);
});

test("parseFearGreed: garbage input returns []", () => {
  assert.deepEqual(parseFearGreed(null), []);
  assert.deepEqual(parseFearGreed("nope"), []);
  assert.deepEqual(parseFearGreed({}), []);
  assert.deepEqual(parseFearGreed({ fear_and_greed_historical: { data: "wat" } }), []);
});

test("parseFearGreed: silently skips malformed history points", () => {
  const series = parseFearGreed({
    fear_and_greed_historical: {
      data: [
        { x: Date.UTC(2026, 4, 10), y: 50 },
        { x: null, y: 60 },
        { x: Date.UTC(2026, 4, 11), y: null },
        { y: 70 },
        { x: Date.UTC(2026, 4, 12), y: 80 },
      ],
    },
  });
  assert.equal(series.length, 2);
  assert.equal(series[0].value, 50);
  assert.equal(series[1].value, 80);
});

// ─── computeAaii3WkSpread ──────────────────────────────────────────────────

const aaii = (date: string, spread: number): AaiiWeekly => ({ date, spread });

test("computeAaii3WkSpread: three weeks → simple mean", () => {
  const series = [aaii("2026-05-07", 10), aaii("2026-04-30", 5), aaii("2026-04-23", 15)];
  const v = computeAaii3WkSpread(series, "2026-05-14");
  assert.ok(v !== null);
  assert.ok(Math.abs(v! - 10) < 1e-12);
});

test("computeAaii3WkSpread: uses three most recent at-or-before asOf, ignoring older", () => {
  const series = [
    aaii("2026-05-07", 12),
    aaii("2026-04-30", 6),
    aaii("2026-04-23", 0),
    aaii("2026-04-16", 999), // should be ignored
  ];
  const v = computeAaii3WkSpread(series, "2026-05-10");
  assert.ok(v !== null);
  assert.ok(Math.abs(v! - 6) < 1e-12);
});

test("computeAaii3WkSpread: excludes weeks after asOf", () => {
  const series = [
    aaii("2026-06-04", 50), // after asOf
    aaii("2026-05-07", 10),
    aaii("2026-04-30", 20),
    aaii("2026-04-23", 30),
  ];
  const v = computeAaii3WkSpread(series, "2026-05-14");
  assert.ok(v !== null);
  assert.ok(Math.abs(v! - 20) < 1e-12);
});

test("computeAaii3WkSpread: <3 observations → null", () => {
  assert.equal(computeAaii3WkSpread([], "2026-05-14"), null);
  assert.equal(computeAaii3WkSpread([aaii("2026-05-07", 10)], "2026-05-14"), null);
  assert.equal(
    computeAaii3WkSpread([aaii("2026-05-07", 10), aaii("2026-04-30", 5)], "2026-05-14"),
    null,
  );
});

test("computeAaii3WkSpread: drops NaN spreads", () => {
  const series = [
    aaii("2026-05-07", 10),
    aaii("2026-04-30", NaN),
    aaii("2026-04-23", 15),
    aaii("2026-04-16", 5),
  ];
  const v = computeAaii3WkSpread(series, "2026-05-14");
  // valid observations are 10, 15, 5 → mean 10
  assert.ok(v !== null);
  assert.ok(Math.abs(v! - 10) < 1e-12);
});

// ─── pickAtOrBefore ─────────────────────────────────────────────────────────

test("pickAtOrBefore: returns latest row ≤ asOf", () => {
  const series = [
    { date: "2026-05-01", value: 1 },
    { date: "2026-05-08", value: 2 },
    { date: "2026-05-15", value: 3 },
  ];
  assert.equal(pickAtOrBefore(series, "2026-05-10")?.value, 2);
  assert.equal(pickAtOrBefore(series, "2026-05-15")?.value, 3);
  assert.equal(pickAtOrBefore(series, "2026-05-16")?.value, 3);
});

test("pickAtOrBefore: returns null when asOf precedes earliest row", () => {
  const series = [{ date: "2026-05-08", value: 2 }];
  assert.equal(pickAtOrBefore(series, "2026-05-01"), null);
});

test("pickAtOrBefore: stable across input orderings", () => {
  const series = [
    { date: "2026-05-15", value: 3 },
    { date: "2026-05-01", value: 1 },
    { date: "2026-05-08", value: 2 },
  ];
  assert.equal(pickAtOrBefore(series, "2026-05-10")?.value, 2);
});

// ─── buildMacroRow ─────────────────────────────────────────────────────────

const prev: MacroRow = {
  as_of: "2026-05-13",
  naaim: 96.67,
  aaii_3wk_spread: 5.36,
  fear_greed: 60,
  source_notes: "yesterday",
};

test("buildMacroRow: live values override yesterday's row", () => {
  const row = buildMacroRow({
    asOf: "2026-05-14",
    naaim: [{ date: "2026-05-13", value: 77.34 }],
    fearGreed: [{ date: "2026-05-14", value: 66 }],
    aaiiWeekly: [
      aaii("2026-05-07", 5),
      aaii("2026-04-30", 8),
      aaii("2026-04-23", 6),
    ],
    previousRow: prev,
    sourceNotes: "test",
  });
  assert.equal(row.as_of, "2026-05-14");
  assert.equal(row.naaim, 77.34);
  assert.equal(row.fear_greed, 66);
  assert.ok(row.aaii_3wk_spread !== null);
  assert.ok(Math.abs(row.aaii_3wk_spread! - (5 + 8 + 6) / 3) < 1e-12);
  assert.equal(row.source_notes, "test");
});

test("buildMacroRow: missing live readings forward-fill from previousRow", () => {
  // Empty NAAIM + F&G + AAII feeds simulate a Thursday-only-AAII publish day
  // with the other two stale; forward-fill should kick in for all three.
  const row = buildMacroRow({
    asOf: "2026-05-14",
    naaim: [],
    fearGreed: [],
    aaiiWeekly: [], // <3 obs → null
    previousRow: prev,
  });
  assert.equal(row.naaim, 96.67);
  assert.equal(row.aaii_3wk_spread, 5.36);
  assert.equal(row.fear_greed, 60);
});

test("buildMacroRow: no previous row + no live data → all-null row", () => {
  const row = buildMacroRow({
    asOf: "2026-05-14",
    naaim: [],
    fearGreed: [],
    aaiiWeekly: [],
    previousRow: null,
  });
  assert.equal(row.naaim, null);
  assert.equal(row.aaii_3wk_spread, null);
  assert.equal(row.fear_greed, null);
});

test("buildMacroRow: NAAIM uses latest-at-or-before, ignores newer-than-asOf rows", () => {
  const row = buildMacroRow({
    asOf: "2026-05-10",
    naaim: [
      { date: "2026-05-13", value: 77.34 }, // after asOf
      { date: "2026-05-06", value: 96.67 },
      { date: "2026-04-29", value: 93.79 },
    ],
    fearGreed: [],
    aaiiWeekly: [],
    previousRow: null,
  });
  assert.equal(row.naaim, 96.67);
});
