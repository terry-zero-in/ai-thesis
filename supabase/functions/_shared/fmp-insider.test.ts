import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeInsiderTrades, type FmpInsiderRow } from "./fmp.ts";

test("normalizeInsiderTrades: maps canonical FMP fields and parses transaction_code", () => {
  const rows: FmpInsiderRow[] = [
    {
      symbol: "NVDA",
      transactionDate: "2026-05-10",
      filingDate: "2026-05-12",
      reportingName: "Huang, Jensen",
      typeOfOwner: "CEO",
      transactionType: "P-Purchase",
      acquistionOrDisposition: "A",
      securitiesTransacted: 10000,
      price: 950,
      link: "https://www.sec.gov/...form4...html",
    },
  ];
  const out = normalizeInsiderTrades("NVDA", rows);
  assert.equal(out.length, 1);
  assert.equal(out[0].transaction_code, "P");
  assert.equal(out[0].insider_name, "Huang, Jensen");
  assert.equal(out[0].acquired_disposed, "A");
  assert.equal(out[0].transaction_value, 9_500_000);
  assert.equal(out[0].source_url?.startsWith("https://"), true);
  assert.equal(out[0].is_10b5_1, null); // FMP doesn't surface it
});

test("normalizeInsiderTrades: skips rows missing transaction_date / reportingName / type", () => {
  const rows: FmpInsiderRow[] = [
    { transactionType: "P-Purchase", reportingName: "X" } as FmpInsiderRow,
    { transactionDate: "2026-05-10", transactionType: "P-Purchase" } as FmpInsiderRow,
    { transactionDate: "2026-05-10", reportingName: "Y" } as FmpInsiderRow,
  ];
  assert.equal(normalizeInsiderTrades("X", rows).length, 0);
});

test("normalizeInsiderTrades: handles all common SEC codes", () => {
  const cases = [
    { input: "P-Purchase", expected: "P" },
    { input: "S-Sale", expected: "S" },
    { input: "M-Exempt", expected: "M" },
    { input: "F-InKind", expected: "F" },
    { input: "A-Award", expected: "A" },
  ];
  for (const c of cases) {
    const out = normalizeInsiderTrades("X", [
      {
        transactionDate: "2026-05-10",
        reportingName: "Insider",
        transactionType: c.input,
      } as FmpInsiderRow,
    ]);
    assert.equal(out[0]?.transaction_code, c.expected, `code for ${c.input}`);
  }
});

test("normalizeInsiderTrades: null shares + price → null transaction_value", () => {
  const rows: FmpInsiderRow[] = [
    {
      transactionDate: "2026-05-10",
      reportingName: "X",
      transactionType: "P-Purchase",
      securitiesTransacted: null,
      price: 100,
    } as FmpInsiderRow,
  ];
  const out = normalizeInsiderTrades("X", rows);
  assert.equal(out[0].transaction_value, null);
});
