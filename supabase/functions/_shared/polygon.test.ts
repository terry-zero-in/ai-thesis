import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { normalizePolygonContract, type PolygonOptionRow } from "./polygon.ts";

describe("normalizePolygonContract", () => {
  it("maps call contract with full greeks + IV + OI", () => {
    const row: PolygonOptionRow = {
      details: { contract_type: "call", strike_price: 200, expiration_date: "2026-06-30" },
      greeks: { delta: 0.27 },
      implied_volatility: 0.33,
      open_interest: 1500,
    };
    const c = normalizePolygonContract(row, "2026-05-16");
    assert.ok(c);
    assert.equal(c!.contract_type, "call");
    assert.equal(c!.strike, 200);
    assert.equal(c!.delta, 0.27);
    assert.equal(c!.implied_volatility, 0.33);
    assert.equal(c!.open_interest, 1500);
    assert.equal(c!.dte, 45); // 2026-06-30 - 2026-05-16 = 45 days
  });

  it("maps put contract with negative delta", () => {
    const row: PolygonOptionRow = {
      details: { contract_type: "put", strike_price: 180, expiration_date: "2026-07-31" },
      greeks: { delta: -0.24 },
      implied_volatility: 0.41,
      open_interest: 800,
    };
    const c = normalizePolygonContract(row, "2026-05-16");
    assert.ok(c);
    assert.equal(c!.contract_type, "put");
    assert.equal(c!.delta, -0.24);
  });

  it("returns null when contract_type missing or non-standard", () => {
    const row: PolygonOptionRow = {
      details: { expiration_date: "2026-06-30" } as PolygonOptionRow["details"],
    };
    assert.equal(normalizePolygonContract(row, "2026-05-16"), null);
  });

  it("returns null when expiration_date missing", () => {
    const row: PolygonOptionRow = {
      details: { contract_type: "call", strike_price: 100 },
    };
    assert.equal(normalizePolygonContract(row, "2026-05-16"), null);
  });

  it("handles missing greeks / IV / OI gracefully (fields → null)", () => {
    const row: PolygonOptionRow = {
      details: { contract_type: "call", strike_price: 100, expiration_date: "2026-06-30" },
    };
    const c = normalizePolygonContract(row, "2026-05-16");
    assert.ok(c);
    assert.equal(c!.delta, null);
    assert.equal(c!.implied_volatility, null);
    assert.equal(c!.open_interest, null);
  });

  it("computes DTE correctly across month boundary", () => {
    const row: PolygonOptionRow = {
      details: { contract_type: "call", strike_price: 100, expiration_date: "2026-12-31" },
    };
    const c = normalizePolygonContract(row, "2026-01-01");
    assert.ok(c);
    assert.equal(c!.dte, 364);
  });
});
