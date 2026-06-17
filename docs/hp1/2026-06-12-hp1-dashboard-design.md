# HP-1 Dashboard — Design Doc
**Date:** 2026-06-12 · **Author:** Perplexity (with Terry) · **Status:** awaiting Terry ratification
**Executes:** Claude Code · **Pairs with:** `HP1_SPEC_v1.1.md`, `FABLE_REVIEW_RUBRIC_v1.md`, `HP1_redteam_findings.md` (2026-06-12)

---

## 0. Purpose and posture

A personal decision tool for exactly two users (Terry + mom). It must answer, in under two minutes per session: **what should I do today, why, and what's the evidence.** The Fable `decisions[]` array is the product; everything else is supporting disclosure. Robust but condensed — no Wall Street vanity metrics, no decorative charts, no memo prose. Every number carries provenance (source + as-of date). The decision is always Terry's; the app never executes trades.

Ratified inputs to this design (from the 2026-06-12 session):
- Standalone app via **fork of `ai-thesis`** (Terry: "repurpose this model and reuse it")
- **Corrected backtest record only** — the lookahead-inflated record is never displayed
- **Manual trade log** — tracking starts with the first real purchase (today or early next week)
- Fable's evidence trail IS the news/research surface — no separate news feed
- The handoff's five locked surfaces, extended with Portfolio and System

---

## 1. Build prerequisites — engine fixes BEFORE any UI work

These come from `HP1_redteam_findings.md`. The dashboard displays engine output; if the engine ships with these defects, the dashboard launders bad numbers into confident-looking pixels. **Order is deliberate: P0 items block everything else.**

| # | Fix | Finding | Acceptance |
|---|---|---|---|
| P0-1 | **Execution lag**: rebalance weights take effect the next trading day after signal computation. | F1 (BLOCKER) | Regression test: weights set at `t` earn zero return at `t`. Restated 24M+36M record committed as `results_24m_v2.csv` / `results_36m_v2.csv`. |
| P0-2 | **Restate the record everywhere**: spec §3/§6, handoff, verdict doc all updated to corrected numbers (~93% CAGR / 2.03 Sharpe blend; +10–12 CAGR pts vs EW-50, ~+0.05 Sharpe). Re-ratify merge decision #5 explicitly as a judgment call, not a measurement. | F2 (BLOCKER), F15 | No surface, doc, or seed row contains the old void same-day-execution record. |
| P0-3 | **`adjusted_pct` role defined**: Fable adjustments **block new entries** (no entry when adjustment ≤ −10) and may **accelerate exits**; they never reorder sleeve selection and never force exits. Engine percentile drives selection. | F17 (MAJOR) | Written into spec §4 + rubric §5; enforced in orchestrator code, not prompt. |
| P0-4 | **Citation validation**: orchestrator fetches every evidence URL on DOWNGRADE / UPGRADE / VETO rows; checks the page resolves and contains the claimed date/entity; failure demotes the verdict to FLAG with `validation_failed: true`. | F18 (MAJOR) | Validation result stored per evidence item; UI renders validated/unvalidated state. |
| P1-1 | **Staged deployment rule** in spec §4: capital enters in 3 tranches over 4–8 weeks; tranche N+1 releases only at its date AND breadth ≥ 40% (else hold at T-bill, re-check every run). | F14 (MAJOR) | `tranches` table drives the Decision Sheet deployment tracker. |
| P1-2 | **Initial Fable bounds [−10, +5]** until calibration data exists (6 months), then revisit. | F23 | Rubric §5 updated; bound enforced in orchestrator schema validation. |
| P1-3 | **Calibration loop defined**: persist every run; at 6 months compare forward 10-day returns of DOWNGRADE vs CONFIRM names; no separation → shrink bounds to [−5, 0]. | F22 | `fable_calibration` view + System surface panel ship at v1 (they accumulate from day 1). |
| P1-4 | **Index-level event triggers** ported from v2: SPY single-day ≤ −5%, VIX ≥ 25 for 3+ sessions → off-cycle Fable run. | v2 reuse | Trigger rows appear in Portfolio rail with FIRED/CLEAR states. |
| P2 | dd_dev floor fix (≥20 negative obs or total-vol fallback), `w.max() ≤ 0.15` assertion, 252d full-eligibility option flag, post-tax display (see §6.4). | F8, F24, F5, F6 | Engine flags + tests. |

---

## 2. Architecture

### 2.1 Repo and deployment

- **Fork `terry-zero-in/ai-thesis` → `terry-zero-in/hp1`** (private). Keep: web shell, auth, design tokens, table/gauge/log components, settings, AIQ editor, command palette, disclosure footer. Delete: v2 scoring pages' business logic (universe scoring views, proposals), keep the components.
- **Vercel**: new project `hp1`, same team. Env vars copied except new schema name.
- **Linear**: new project under THS team ("HP-1 Dashboard"), tickets cut from this doc's §8 build plan by Claude Code on day 1.

### 2.2 Data platform — standalone Supabase project (REVISED 2026-06-16)

**A new, dedicated Supabase project** (Claude Code cannot access the v2 project). All objects live under schema **`hp1`**. Full DDL is in `hp1_schema.sql` — run it once in the new project's SQL editor. Consequence of going standalone: **HP-1 owns its own ingestion** — there is no v2 public schema to read. The schema therefore includes `hp1.prices` (adjusted daily closes — the engine cannot score without these) and `hp1.macro_gauges` (NAAIM/AAII/F&G for the Regime surface). Fable's other checklist inputs (consensus revisions, Form 4, short interest) are fetched live by Fable's web tools per-run rather than stored, so no extra ingestion tables are required at v1.

Ingestion to build in Phase 1 (HP-1's own, not reused): a daily price loader (FMP or Polygon) for all 50 names → `hp1.prices`, and a weekly macro loader → `hp1.macro_gauges`. Universe = HP-1's 50 (CRWV, NBIS, IREN, APLD, ALAB, CRDO, FN, COHR, CLS, TER, MPWR, RDDT, TEM, DELL and the rest — full list in HP1_SPEC_v1.1 §2). Discipline rule unchanged: **everything HP-1 writes lives under `hp1`.**

### 2.3 Engine

Port `hp1_backtest.py`'s factor math (with P0-1/P2 fixes) to a **scheduled GitHub Action** (Python, runs post-close every trading day ~5:30 PM CT) that writes `hp1.engine_runs` + `hp1.engine_ranks`. Python stays the reference implementation — no TS rewrite of math (drift risk). The Action also computes breadth, gate gross, exit-trigger proximity, and migration-flag streaks.

### 2.4 Fable orchestrator

Supabase scheduled edge function (or the same GitHub Action pipeline, Claude Code's call) that, every 2 trading days post-engine + on event triggers:
1. Assembles the review set per rubric §2 (~20–28 names) and the input bundle per rubric §3.
2. Calls the Anthropic API with rubric §10's verbatim system prompt, web search + fetch tools, temp low, search budget 4–6/name.
3. **Validates citations** (P0-4) server-side.
4. Schema-validates output JSON (retry once on invalid; then store raw + mark run failed — engine output is never blocked).
5. Writes `hp1.fable_runs` + `hp1.fable_reviews`.
ANTH block runs every cycle per rubric §9. Conflict controls (F19): the block must include `reasons_against[]` (3 cited reasons not to invest, every run), and a GO status renders in the UI as **"GO (pending non-Anthropic check)"** until Terry marks the independent-check box on the ANTH surface — the checkbox is the control, stored with timestamp.

### 2.5 Schema (`hp1.*`) — tables Claude Code creates

```
engine_runs      (run_id, as_of, breadth_pct, gate_gross, regime_read, universe_n,
                  data_through, engine_version, created_at)
engine_ranks     (run_id, ticker, layer, view, score, pct, z_m, z_ram, z_dd, driver_tag,
                  above_100, above_200, dist_100_pct, dist_200_pct, dd_from_high,
                  sleeve_eligible, r3, r6, r12)
fable_runs       (run_id, engine_run_id, trigger_type, model, started_at, status,
                  raw_json, portfolio_block jsonb, decisions jsonb, cash_note)
fable_reviews    (run_id, ticker, verdict, adjustment, adjusted_pct, action, action_reason,
                  flags text[], confidence, evidence jsonb,  -- each item: {claim, source, date, url, validated bool}
                  next_event jsonb, reviewed_at)
trades           (id, ticker, side, qty, price, fee, executed_at, sleeve, tranche_id,
                  note, entered_by)                           -- manual entry, the only write path for positions
positions        (VIEW over trades: ticker, sleeve, qty, cost_basis, position_high,
                  entry_date, tax_lots jsonb)
tranches         (id, label, amount, planned_date, released_at, breadth_at_release, status)
anth_state       (id, ceiling_multiple, ceiling_set_at, verified_run_rate, run_rate_source,
                  run_rate_date, run_rate_verified bool, independent_check_at, status, history jsonb)
decisions_log    (id, fable_run_id, priority, text, kind, acked_at, acked_by, outcome_note)
backtest_record  (variant, window, cagr, vol, sharpe, sortino, maxdd, worst_day, total,
                  engine_version, is_canonical)               -- corrected record only
aiq_scores       (reuse v2's aiq_rubric table shape, hp1 copy; port 20 seeds, queue 30 drafts)
fable_calibration (VIEW: per verdict-class forward 5/10/21-day returns vs CONFIRM baseline)
```

Auth: the new project's Supabase Auth, two users — Terry (owner/write), mom (viewer/read-only). RLS enforced via `hp1.profiles.role` and `hp1.is_owner()` (see `hp1_schema.sql`). Server jobs (engine Action, Fable function) write via the service_role key, which bypasses RLS.

---

## 3. Design system

Inherit the locked Reticle tokens from `AI-Thesis-v2-Master-Design-Spec.md` **verbatim** — colors, type scale (Geist + JetBrains Mono, tabular numerals), 220px sidebar / 48px topbar / 280px right rail, radius ≤ 6px, hairlines not boxes, no shadows. No new tokens except one addition:

**Verdict chip mapping** (the only new semantic): CONFIRM = text-3 neutral chip · FLAG = warning-soft · DOWNGRADE = danger-soft · UPGRADE = success-soft · VETO = danger solid · validation-failed = warning outline with "unvalidated" suffix. Driver tags render as mono text chips (return-driven / stability-driven / balanced / broken-trend), never colored — they are descriptions, not judgments.

Every page keeps v2's **provenance ribbon**: `as_of <engine date> · prices <date> · fable <run datetime or "—"> · engine v<x> · mode <Live|Stale>`. Any source older than its cadence renders that segment in `--warning`. The disclosure footer carries over verbatim.

---

## 4. Navigation

```
COMMAND CENTER          WORKSPACE               REFERENCE
  Today    (/)            Fable Runs (/runs)      System   (/system)
  Ranks    (/ranks)       AIQ Editor (/aiq)       Learn    (/learn, port as-is)
  Portfolio(/book)        Trade Log  (/trades)
  ANTH     (/anth)
  Regime   (/regime)
```

Decisions ack-log lives inside Today (it IS the product, not a side page). Command palette (⌘K) carries over: jump to ticker, surface, or "log trade."

---

## 5. Surfaces

### 5.1 Today — the Decision Sheet (home)

The two-minute screen. Layout top to bottom:

1. **Decision stack** — the latest run's `decisions[]` (max 5, ranked). Each row: priority number (mono), the ≤140-char text, kind chip, source link (jumps to the name view or ANTH), and an **ack** button. Acked rows collapse to single-line history below. Empty state: `No action. All holdings CONFIRM; next sleeve rebalance <date>.` If the latest Fable run failed: banner `review failed, engine-only` (danger-soft) + engine-derived mechanical alerts still render.
2. **Deployment tracker** (until fully deployed, then collapses to a one-line summary): horizontal segmented bar — tranche 1/2/3 amounts, released vs pending, breadth condition state, reserve at T-bill. Direct port of v2's Reserve panel pattern. Data: `tranches`.
3. **Regime strip**: breadth % (vs 40/25 gates), gate gross, NAAIM / AAII / F&G mini-gauges (values + threshold ticks, no charts), Fable's ≤120-char regime read. One row, mono values.
4. **ANTH tile**: status chip (GO pending-check / WAIT / STOP), verified run-rate + source date, implied EV vs ceiling (or "ceiling unset"), one-line reason. Click → /anth.
5. **Holdings strip**: one compact row per held name — ticker, sleeve, P&L %, exit-trigger proximity meter (distance to 100d MA in %, sessions-below count 0–5, distance to −20%), verdict chip from last review. Names within 2% of a trigger or ≥3 sessions below MA sort to top with warning tint.

Anti-requirements (locked): no memos, no charts, no news feed, nothing below the fold on a 13" laptop at default density.

### 5.2 Ranks — the Rank Board

v2 Universe table pattern. View toggle: **Combined / Pure-play / Megacap** (spec §2 views; z-scores are per-view from the engine). Columns: rank · Δ vs prior run (mono, signed) · ticker+name · layer chip · score · engine pct · adjusted pct (only when ≠ engine, rendered as `88 → 78` with verdict chip) · driver tag · trend state (above/below 100d & 200d as two dots) · next event (type + date) · sleeve eligibility. Row hover reveals zM/zRAM/zDD decomposition inline (disclosure over decoration). Row click → Name View. Names outside the Fable review set show a `not reviewed` (text-3) marker — never a stale verdict. Broken-trend names render the whole row at 60% opacity.

### 5.3 Name View (/ranks/[ticker])

Three stacked sections, no tabs:
1. **Engine block**: score, percentile, factor decomposition bars (zM/zRAM/zDD with weights), 12m sparkline with 100d/200d MA overlay (the one chart in the app — it answers "where is the trend gate"), drawdown-from-high, sleeve status, driver tag history (last 10 runs, mono strip).
2. **Fable history**: reverse-chron review cards — verdict chip, adjustment, action_reason, confidence, flags; **evidence list with validated badges, each item: claim, source, date, link**. This is Terry's "research/news" — the cited justification trail for why Fable signed off or didn't, every run. Searched-empty statements render too (`searched: "MRVL guidance" — no material findings`) per the gap-flagging convention.
3. **Fundamentals overlay block** (Core names): Q/G/V/AIQ percentiles within layer, depreciation/Burry penalty line items with source links, maintenance-capex band (low/mid/high) with regime-dependent flag, AIQ per-dimension table (links to /aiq editor).

### 5.4 Portfolio (/book)

Direct adaptation of v2's Portfolio page (the strongest existing surface). Changes only:
- **Sleeve grouping**: Tactical and Core sections with per-sleeve subtotals, vs-benchmark line (EW-50 and QQQ since inception, computed from `trades` + price chain — corrected-methodology benchmarks, same costs assumptions displayed).
- **Right rail = Triggers** (port v2's FIRED/CLEAR pattern): per-name −20%-from-high, 5-session MA rule progress (n/5 mono counter), portfolio −12% circuit breaker, SPY −5% day, VIX ≥25 streak, migration flags (with Fable MIGRATE_CONFIRM/REJECT state). Plus concentration readout: max layer % vs 40% cap per sleeve, breach list.
- **Tax panel** (new, F6): realized ST/LT YTD, unrealized by lot age, estimated tax drag at Terry's marginal rate (settings value), per-position "days to LT" column toggle. Compact — one summary row + expandable table.
- **Trade entry**: v2's Add Position drawer, extended with sleeve + tranche selectors. Sells require selecting lots (FIFO default).
- Migration path: if any v2 paper book should carry over, it imports as **watch-only history**, never as positions (positions come only from `trades`). [OPEN-1 below.]

### 5.5 ANTH (/anth)

One page, four blocks:
1. **Status header**: GO/WAIT/STOP chip + the standing conflict note rendered verbatim + the **independent-check checkbox** (F19 control — GO is inert until checked each time status changes to GO; check event timestamped).
2. **Ceiling math**: Terry's ceiling multiple (editable by Terry only, history kept), verified run-rate (value, source, date, `run_rate_verified` state), implied max EV, latest reported mark vs ceiling (currently: $47B run-rate [Anthropic, 2026-05-28]; Series H $965B = 20.5x; diligence-recommended ceiling 14–16x = $658–752B — seeded from `anthropic_diligence.md`, 2026-06-12).
3. **Tranche plan**: allocation/day-1 · post-first-earnings · lockup ~180d — each with its gate condition and state.
4. **Evidence feed**: ANTH-block evidence arrays from every run, reverse-chron, validated badges, `reasons_against[]` always visible above reasons-for.

### 5.6 Regime (/regime)

Port v2's Regime page, swap the mechanic: breadth gate replaces the macro multiplier. Hero: breadth % + gate gross (100/50/25) + threshold curve. Gauge cards for NAAIM/AAII/F&G carry over unchanged (downgrade-only flags — labeled as such). 12-month breadth trend chart and gate-state change history (port pattern). Footnote states the v2 macro multiplier was retired and why (inert; evidence link).

### 5.7 Fable Runs (/runs)

Port of v2's Memos page shape, structured: run timeline with status (ok / failed / event-triggered + trigger type), model + version, review-set size, verdict distribution mini-histogram (CONFIRM n / FLAG n / ...), cost, duration. Click → run detail: portfolio block, all per-name cards (same component as Name View §2), raw JSON accordion. Failed runs show raw payload + `engine-only mode` note.

### 5.8 System (/system)

The trust page:
- **Pipeline health**: last engine run, last Fable run, per-source ingest freshness (port v2's engine-status), job failures.
- **Backtest record**: the corrected tables only (24M + 36M, all variants, EW-50 and ex-IPO-cohort comparisons), the four caveats rendered as permanent fixtures, link to methodology. A short "what changed 2026-06-12" note records the lookahead correction — the old record is referenced in text, never in a table.
- **Fable calibration** (F22): downgrade-vs-confirm forward-return separation (5/10/21d), citation-validation pass rate, verdict-flip-without-new-evidence count, UPGRADE frequency. Sparse until data accumulates — show "n runs collected, readable at ~60" rather than fake precision.
- **Settings**: marginal tax rate, account labels (Terry/mom), notification toggles.

---

## 6. Cadences and jobs

| Job | Schedule | Writes |
|---|---|---|
| Engine run (GH Action) | Every trading day post-close 5:30 PM CT | engine_runs, engine_ranks |
| Fable review | Every 2 trading days post-engine + event triggers (hard-exit trip, name −8% day, circuit breaker, SPY −5%, VIX streak, ANTH filing news) | fable_runs, fable_reviews, decisions_log |
| Sleeve rebalance prompts | Every 10 (Tactical) / 21 (Core) trading days | decisions_log entries (the app prompts; Terry executes at broker and logs fills) |
| Overlay refresh | Monthly | overlay scores |
| AIQ re-score | Quarterly (next 2026-08) | aiq_scores |
| Ingest universe extension | Reuses v2 ingest schedules | public schema |

---

## 7. Out of scope (YAGNI — explicitly not in v1)

Broker API sync (Plaid/SnapTrade) · push/email notifications (in-app only; revisit after a month of use) · mobile layouts beyond responsive-readable · options data ingestion for HP-1 names · multi-portfolio support · any v2 composite scoring surfaces (the engine pages retire; AIQ editor survives) · backtest-on-demand UI (operator-invoked only) · Fable chat interface.

---

## 8. Build order (for Claude Code's plan)

1. **Engine fixes + restated record** (P0-1, P0-2, P2) — pure Python, no UI.
2. Schema migration (`hp1.*`) + universe ingest extension.
3. Engine GH Action wiring → engine_runs/ranks populating.
4. Fable orchestrator + citation validation (P0-3, P0-4) → first real runs.
5. Fork cleanup: nav, retire v2 pages, provenance ribbon rewire.
6. Surfaces in order: **Today → Portfolio + Trade Log → Ranks → Name View → ANTH → Regime → Runs → System.** (Today first — it sets the pattern; matches the handoff's "Decision Sheet first" instruction.)
7. AIQ seed port (20 names) + Fable draft queue for the remaining 30.
8. Calibration view + System page last.

Acceptance gate for "live": one full week of engine+Fable runs with zero failed citation validations unhandled, trade log holding real fills, and the Today page answering "what should I do" in one screen.

---

## 9. Open items for Terry

1. **[OPEN-1] v2 book: paper or real?** The portal shows 13 positions / $79,475 invested with "manual cost-basis entry," but you said nothing's been bought. If real: those positions need a migration decision (hold under v2 rules, migrate to HP-1 sleeves, or liquidate into the tranche plan) and the verdict doc's "−4.2% actual slate" vs the portal's +1.27% needs reconciling. If paper: it imports as watch-only history or not at all.
2. **[OPEN-2] ANTH ceiling ratification** — diligence recommends 14–16x verified run-rate ($658–752B at $47B). Your number goes in `anth_state`.
3. **[OPEN-3] Account split** — whose money in which sleeve (Terry vs mom), same book or two labeled books? v1 assumes one book with an account label per trade.
4. **[OPEN-4] Tax setting** — marginal rate for the tax panel; and whether any of this runs in an IRA (changes F6's urgency materially).
