import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeShortInterest, type FmpShortInterestRow } from "./fmp.ts";

test("normalizeShortInterest: maps canonical FMP fields", () => {
  const rows: FmpShortInterestRow[] = [
    {
      symbol: "NVDA",
      settlementDate: "2026-05-15",
      shortInterest: 100_000_000,
      sharesOutstanding: 24_500_000_000,
      averageDailyVolume: 200_000_000,
      daysToCover: 0.5,
    },
  ];
  const out = normalizeShortInterest("NVDA", rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].ticker, "NVDA");
  assert.equal(out[0].settlement_date, "2026-05-15");
  assert.equal(out[0].short_interest, 100_000_000);
  assert.equal(out[0].avg_daily_volume, 200_000_000);
  assert.equal(out[0].days_to_cover, 0.5);
});

test("normalizeShortInterest: falls back through field aliases", () => {
  const rows: FmpShortInterestRow[] = [
    {
      date: "2026-04-30",
      totalShortInterest: 75_000_000,
      avgDailyVolume: 150_000_000,
    } as FmpShortInterestRow,
  ];
  const out = normalizeShortInterest("AVGO", rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].settlement_date, "2026-04-30");
  assert.equal(out[0].short_interest, 75_000_000);
  assert.equal(out[0].avg_daily_volume, 150_000_000);
});

test("normalizeShortInterest: drops rows without settlement_date", () => {
  const rows: FmpShortInterestRow[] = [
    { shortInterest: 100 } as FmpShortInterestRow,
    { settlementDate: "2026-05-15", shortInterest: 200 } as FmpShortInterestRow,
  ];
  const out = normalizeShortInterest("X", rows);
  assert.equal(out.length, 1);
});

test("normalizeShortInterest: non-finite numbers normalize to null", () => {
  const rows: FmpShortInterestRow[] = [
    {
      settlementDate: "2026-05-15",
      shortInterest: Number.NaN as unknown as number,
      sharesOutstanding: undefined,
      avgDailyVolume: null,
    } as FmpShortInterestRow,
  ];
  const out = normalizeShortInterest("X", rows);
  assert.equal(out[0].short_interest, null);
  assert.equal(out[0].shares_outstanding, null);
  assert.equal(out[0].avg_daily_volume, null);
});
