import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  parseAiqDraft,
  renderAiqDraftPayload,
  type AiqDraftSources,
} from "./aiq-drafts.ts";

const validJson = JSON.stringify({
  ticker: "NOW",
  disclosure_pts: 15,
  defensibility_pts: 16,
  concentration_pts: 13,
  capex_eff_pts: 13,
  indep_demand_pts: 14,
  accounting_pts: 14,
  notes: {
    disclosure: "AI revenue surfaced in 10-K MD&A; AI capex not separately disclosed.",
    defensibility: "Strong moat from Now Platform workflow lock-in (transcript).",
    concentration: "Diverse enterprise base across many verticals (10-K).",
    capex_eff: "Capital-light SaaS model — capex efficiency strong (10-K).",
    indep_demand: "Enterprise IT spend independent of hyperscaler capex (transcript).",
    accounting: "Clean accounting; SBC discussed but reasonable (10-K).",
  },
});

describe("parseAiqDraft", () => {
  it("parses well-formed JSON", () => {
    const r = parseAiqDraft(validJson);
    assert.equal(r.ticker, "NOW");
    assert.equal(r.disclosure_pts, 15);
    assert.equal(r.notes.accounting, /Clean accounting/i.test(r.notes.accounting) ? r.notes.accounting : "");
  });

  it("strips ```json fences", () => {
    const fenced = "```json\n" + validJson + "\n```";
    const r = parseAiqDraft(fenced);
    assert.equal(r.ticker, "NOW");
  });

  it("strips bare ``` fences", () => {
    const fenced = "```\n" + validJson + "\n```";
    const r = parseAiqDraft(fenced);
    assert.equal(r.ticker, "NOW");
  });

  it("throws on out-of-range integer", () => {
    const bad = JSON.parse(validJson);
    bad.disclosure_pts = 25;
    assert.throws(() => parseAiqDraft(JSON.stringify(bad)), /disclosure_pts out of range/);
  });

  it("throws on missing ticker", () => {
    const bad = JSON.parse(validJson);
    delete bad.ticker;
    assert.throws(() => parseAiqDraft(JSON.stringify(bad)), /missing ticker/);
  });

  it("throws on non-integer score", () => {
    const bad = JSON.parse(validJson);
    bad.capex_eff_pts = 7.5;
    assert.throws(() => parseAiqDraft(JSON.stringify(bad)), /non-integer capex_eff_pts/);
  });

  it("throws on missing notes section", () => {
    const bad = JSON.parse(validJson);
    delete bad.notes.accounting;
    assert.throws(() => parseAiqDraft(JSON.stringify(bad)), /missing or non-string notes.accounting/);
  });

  it("throws on malformed JSON", () => {
    assert.throws(() => parseAiqDraft("not json"), /Unexpected/);
  });
});

describe("renderAiqDraftPayload", () => {
  it("emits deterministic JSON", () => {
    const sources: AiqDraftSources = {
      ticker: "NOW",
      ten_k_url: "https://sec.gov/now-10k",
      ten_k_excerpt: "ServiceNow 10-K excerpt...",
      transcript_url: "https://fmp.com/now-q1",
      transcript_excerpt: "Q1 transcript excerpt...",
    };
    const a = renderAiqDraftPayload(sources);
    const b = renderAiqDraftPayload(sources);
    assert.equal(a, b);
    assert.match(a, /"NOW"/);
    assert.match(a, /"ten_k"/);
  });

  it("falls back to placeholder when excerpt missing", () => {
    const sources: AiqDraftSources = {
      ticker: "INTU",
      ten_k_url: null,
      ten_k_excerpt: null,
      transcript_url: null,
      transcript_excerpt: null,
    };
    const out = renderAiqDraftPayload(sources);
    assert.match(out, /not available/);
  });
});
