# Session Handoff — AI Thesis v2

> **Provenance.** This document is generated and maintained inside **Terry's Perplexity Computer conversations**, not by Claude Code. It captures the running state of the project as of each Perplexity session for Terry, so a new Perplexity thread (or a new Claude Code session) can resume without context gaps. Treat the timestamps below as Perplexity-thread checkpoints. Claude Code reads this file at the start of each session for context; Claude Code does NOT write to this file — Terry updates it via the Perplexity Space.

**Maintained by:** Terry Turner, via Perplexity Computer (Space: "AI Thesis v2")
**Last updated:** Saturday, May 16, 2026, 7:51 PM CDT
**Repo:** [github.com/terry-zero-in/ai-thesis](https://github.com/terry-zero-in/ai-thesis) (private)
**Linear project:** [AI Thesis v2 — Scoring Engine & Portfolio](https://linear.app/basisuw/project/ai-thesis-v2-scoring-engine-and-portfolio-79a38aec2b49) (THS team)
**Operating posture:** Defined in repo `/CLAUDE.md` — autonomous by default, batch questions with recommended defaults, surface schema gaps proactively, never silently change algorithm spec.

---

## TL;DR — where we are

**Epic 1 (Foundation) and Epic 2 (Tier-A Scoring) shipped.** Schema expanded mid-build to support full QMJ. Epic 3 (Overlays) and Epic 4 (Portal UI) are mid-build — concentration tax wiring + run order locked. Three external decisions (Polygon, Claude Sonnet/Opus, AIQ pipeline) confirmed. Universe and dep-flag scope corrected to spec-verbatim. Backlog (THS-58/59/65/66 sequencing) unblocked. Two non-blocking gaps parked: 10b5-1 parsing and forward capex consensus.

---

## What shipped (as of May 16 session 7)

### Epic 1 — Foundation
- THS-35 Supabase schema applied
- **Schema expanded mid-build** (commit `1b8a8bb` on `main`) to add 8 columns for full QMJ Q-score support: `cash_and_equivalents`, `retained_earnings`, `current_assets`, `current_liabilities`, `income_before_tax`, `income_tax_expense`, `dividends_paid`, `common_stock_repurchased`. Documented in `docs/AI-Thesis-v2-Algorithm-and-Deployment.md` §Part 4.
- THS-36 / 37 / 38 / 39 / 40 ingestion + universe seed live

### Epic 2 — Tier-A Scoring
- THS-41 Q-score (QMJ verbatim — ROIC from NOPAT, Altman Z, market beta vs SPY, payout including buybacks)
- THS-42 G-score
  - AI-segment proxy: **layer defaults from spec §Fix 4** + per-ticker `ai_segment_overrides` table seeded for the 20-name slate. No FMP segmentation string-match.
- THS-43 V-score
  - Own-history forward P/E z-score derived from `forward_pe_history` materialized view (`prices_raw.close / consensus.ntm_eps`). Graceful degradation: <90 obs → sub-signal null and rescale to other two; 90–365 obs → low-confidence flag; 365+ → full. Window = `min(5y, available)`.
- THS-44 cross-sectional helpers (winsorize, z-score within layer, percentile)
- THS-45 composite + tier assignment

### Epic 3 — Overlays (partial)
- THS-46 AIQ seed (20-name slate ported from spec §Part 3)
- **Concentration tax → composite wiring confirmed and shipping:**
  ```
  composite_taxed = composite + concentration_history.tax       # tax is negative
  final_score     = composite_taxed * macro_multiplier if composite_taxed >= 75 else composite_taxed
  ```
  Reconciled against TSM and NVDA worked examples (within rounding). To be reflected in algorithm doc with worked examples inline.

### Epic 4 — Portal UI (partial)
- THS-51 app shell + sidebar / topbar / right rail (Reticle base)
- THS-52 universe table
- THS-53 name detail
- THS-54 AIQ editor (read-only currently)
- THS-55 portfolio dash (**$20K reserve target — settings table for one-edit update**)

---

## Mid-session corrections (do not silently re-introduce)

These were errors made in earlier Perplexity replies; documented so they don't drift back in:

1. **Universe trim was wrong.** Earlier suggested cutting 6 names from the planned 26-name expansion (AMD, AES, BE, AI, MDB, CDNS). **Reverted.** Universe holds *all* 70 names from algorithm doc §Part A. Universe is for ranking, not filtering — low-conviction names should be scored low by the engine, not pre-excluded.

2. **Dep-flag penalty softening was wrong.** Earlier suggested -3 baselines for older extensions. **Reverted.** Apply the spec's penalty band verbatim. Final assignments below.

3. **Ticket-number confusion.** Earlier conflated THS-59 (options ingestion) with THS-65 (Sonnet daily memo). Final mapping verified below.

---

## Run order for next session (priority order)

1. **Ship concentration tax → composite wiring** (one-line change, universe-wide tier impact)
2. **THS-47** — AIQ expansion to remaining 50 names (drafts only, none commit to `aiq_rubric` until Terry approves)
3. **THS-48** — Depreciation flags for L2 hyperscalers (verbatim per spec)
4. **THS-56** — Regime panel (Epic 4 portal completion)
5. **THS-57** — Tier movement log + alerts (Epic 4 close-out)
6. **THS-58** — Form 4 / insider ingestion (Epic 5 prep)
7. **THS-59** — Options surface ingestion (Polygon, Starter tier $79/mo)
8. **THS-61** — VIX daily ingestion + `prices_raw` row (sub-issue of Epic 3 macro ingest; FMP `/historical-price-full/^VIX` primary, CBOE direct fallback)
9. **THS-65** — Sonnet 4.6 daily memo cron
10. **THS-66** — Opus 4.7 weekly ranking cron

---

## Locked decisions (do not re-litigate)

| Topic | Decision | Rationale |
|---|---|---|
| Reserve target | **$20K** (settings-table editable) | THS-55 ticket more recent than spec; one-edit reversible |
| Trigger 1 "no fundamental news" carve-out | **Fire on any -7% drawdown; annotate "news context unknown"** | No news ingestion until THS-59 ships; revisit later |
| NOW + INTU AIQ seed | **Rolled into THS-47** as one-line universe-expansion migration | Don't open separate ticket |
| GOOGL spec vs dims (74 vs 75) | **Per-dim sums authoritative (75)** — update algo doc to match | Spec table had arithmetic error |
| ORCL spec vs dims (60 vs 52) | **Per-dim sums authoritative (52)** — update algo doc to match | Spec table had arithmetic error |
| Concentration tax → composite | **Additive, before macro multiplier** (see formula above) | Reconciles to spec worked examples |
| Options vendor (THS-59) | **Polygon Starter $79/mo** | Tradier unreliable for less-liquid universe names (PWR, BE, AES) |
| Daily memo (THS-65) | **Claude Sonnet 4.6** | Already in algorithm doc + stack |
| Weekly ranking (THS-66) | **Claude Opus 4.7** | Already in algorithm doc + stack |
| AIQ scoring labor (THS-47) | **Option (b)** — Claude drafts against FMP transcripts + SEC EDGAR 10-K/10-Q; Terry reviews; nothing writes to `aiq_rubric` until approved | Faster end-to-end without sacrificing judgment ownership |
| AIQ draft surfacing | **Single batch** in review screen or `/docs/aiq-drafts.md`, not dripped one at a time | — |
| 10b5-1 backfill (PARKED) | Accept conflation as known limitation for v1; don't block on parser | ~half-session of work; insider-cluster path works directionally without it |
| Forward capex consensus (PARKED) | Leave TTM-capex proxy in place for THS-67 quarterly check #4; document gap | FMP ingestion + schema extension is out of scope for current epic close-out |

---

## Dep-flag final assignments (apply verbatim per spec §Fix 5)

| Ticker | Extension | Penalty | Burry overstatement |
|---|---|---|---|
| META | >1.5y total (two extensions, 5→7y range) | **-10** | **-3** |
| ORCL | Extension referenced 10-K FY25 | **-5** | **-5** |
| MSFT | 6 → 6.5y in FY24 (0.5y) | **-3** | none |
| GOOGL | 4 → 6y in 2023 (2.0y) | **-10** per ">1.5 years" band | none |
| AMZN | 5 → 6y in 2024 (1.0y) | **-7** per "1.0–1.5 years" band | none |

**Confirm extension magnitudes against actual filing language before committing.** Where filings are ambiguous, flag in next session's batch instead of choosing.

---

## Universe — 26 names to ADD (THS-47 + universe expansion)

Algorithm doc §Part A, full list, no trim:

- **L1 Compute:** AMD, AMAT, KLAC, MRVL, ARM, SNPS, CDNS
- **L3 AI-Native:** DDOG, S, MDB, NET, ESTC, AI
- **L4 Power:** ETR, NRG, TLN, NEE, AES, PWR, BE, EQIX, DLR
- **L5 Incumbent:** ADBE, WDAY, ZS, SAP

Plus NOW + INTU (AIQ-seed gap, rolled into THS-47).

Run AIQ rubric draft pipeline on all 28 new names. Use FMP `/stable/earnings-call-transcripts` + SEC EDGAR 10-K/10-Q. Draft scores to a single review file (`/docs/aiq-drafts.md`). Nothing writes to `aiq_rubric` until Terry approves.

---

## Standing directives (CLAUDE.md operating posture)

- **Expand schema by default** when a downstream factor references a field we don't have. Surface in end-of-session batch, don't stop to ask.
- **Algorithm spec is locked.** Don't silently soften penalties, change weights, or alter formulas. If the spec seems wrong, surface as a spec-amendment conversation — don't change behavior in a ticket reply.
- **Universe is for ranking, not filtering.** Don't pre-exclude low-conviction names.
- **All engineering work through PRs** (recommended). Re-confirm if Claude Code has been pushing direct to `main`.
- **Batch all questions at end of session** with recommended defaults. Don't drip them one at a time.

---

## Parked items (non-blocking, surfaced in session 7)

1. **10b5-1 parsing for insider clusters.** Current insider-cluster path doesn't parse SEC link footnotes to distinguish pre-scheduled 10b5-1 sales from discretionary sales. Building a parser is ~half-session of work. **Parked:** accept the conflation as known limitation for v1. Revisit after Epic 6 ships if false-positive rate is material.

2. **`consensus.capex_fy1` / `capex_fy2`.** THS-67 quarterly check #4 currently fires on a TTM-capex proxy because `consensus` table doesn't carry forward FY1/FY2 capex. **Parked:** leave the TTM proxy and document the gap. Extending FMP ingestion + schema is a separate sub-issue (open new sub-issue if/when this materially affects quarterly check accuracy).

Neither item blocks the autonomous queue.

---

## Outstanding spec drift to reconcile (maintenance task — not blocking)

- Algorithm doc table for GOOGL (74) and ORCL (60) doesn't match per-dim sums (75, 52). Update doc.
- Algorithm doc Reserve language ($30K in §Position-construction) doesn't match THS-55 ($20K shipped). Reserve = $20K is the live truth.
- Concentration tax formula needs explicit worked examples (TSM, NVDA) added to algorithm doc.

When you have a quiet session, run a **spec ↔ ticket reconciliation pass** as a dedicated session: identify every numeric or scope mismatch and propose a single authoritative source per fact.

---

## Where things live (quick reference)

| Need | Location |
|---|---|
| Operating instructions for Claude Code | `/CLAUDE.md` |
| Algorithm spec | `/docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Design spec | `/docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Design source hierarchy | `/DESIGN_REFERENCES.md` |
| This handoff | `/docs/HANDOFF.md` |
| Visual reference (chrome) | `/design-references/01-base-reticle-screenshots/` |
| Visual reference (canvas primary) | `/design-references/02-canvas-primary-basis-proforma/` |
| Visual reference (canvas secondary) | `/design-references/03-canvas-secondary-investment-portal/` |
| Visual reference (component mining) | `/design-references/04-additional-basis-q-series/` |
| Current visual state | `/prototype/` (not locked — reference only) |
| Linear board | https://linear.app/basisuw/team/THS |
| Perplexity Space | "AI Thesis v2" (where this handoff is maintained) |

---

## How to start the next session

### In a new Perplexity thread (in the AI Thesis v2 Space)

```
Resuming AI Thesis v2 build. Read /docs/HANDOFF.md in the repo for full state.
```

The Space's system instructions handle the rest (load honesty skill, surface CLAUDE.md, etc.).

### In a new Claude Code session

```
Read CLAUDE.md and docs/HANDOFF.md. Then resume per the run order at the bottom of HANDOFF.md.

Operate autonomously per CLAUDE.md. Batch questions at end of session.
```

---

## Update policy for this file

This file is updated **only from inside a Perplexity Computer conversation in the AI Thesis v2 Space**. It is the source of truth for cross-session state. Claude Code reads it at session start, executes against it, and reports back. Terry reviews Claude Code's session output in a Perplexity thread, decides, and updates this file at the end of each session via Perplexity Computer.

If Claude Code ever needs to suggest an edit to this file, surface the suggestion in the end-of-session batch with the exact text to add/change. Terry applies it from Perplexity.

---

End of handoff.
