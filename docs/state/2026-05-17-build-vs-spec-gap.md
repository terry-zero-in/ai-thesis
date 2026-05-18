# Build-vs-Spec Gap Audit — 2026-05-17

**Branch:** `claude/lambo-design-finish` @ `07d5e1a` · **Commits ahead of `origin/main`:** 51 · **PR:** [#8](https://github.com/terry-zero-in/ai-thesis/pull/8) (OPEN, MERGEABLE)

**Purpose:** Anchor the next-phase decision. Answers "where is the product actually vs. where the v2 spec says it should be?" so we can pick the next move based on real gaps, not guesses.

---

## Headline

**The product is past v1 spec scope, not behind it.** All 6 spec-required v1 routes are built + lambo-polished. Three routes the spec explicitly DEFERS to v1.1 (Memos, Decisions, Backtest) are ALSO already built. The dominant gaps are not UI; they're **data ingestion edges** and **production cutover** — i.e. the engine is wired but not pointed at live data on a deployed surface.

The "iPhone moment" test (a $5B PE acquisitions analyst pauses) fails today not because the screens look wrong, but because a third of the rails show ghost placeholders ("THS-58 ingestion pending") and the whole thing only runs on `localhost:3003`.

---

## Route-by-route status vs. design spec §5

| Spec route | Built? | File | Status |
|---|---|---|---|
| §5.1 `/dashboard` | ✓ | `web/src/app/page.tsx` | Real data (scores_history + macro_gauges + portfolio_positions); lambo-polished. Dashboard route is `/` not `/dashboard`. |
| §5.2 `/universe` | ✓ | `web/src/app/universe/page.tsx` | Real data via browser RLS + fixture fallback; Mercury #7 sticky-scroll shipped this session. |
| §5.3 `/n/[ticker]` (spec) → `/universe/[ticker]` (built) | ✓ | `web/src/app/universe/[ticker]/page.tsx` | Real data; activity rail shows ghosts for insider+news (data pending). |
| §5.4 `/portfolio` | ✓ | `web/src/app/portfolio/page.tsx` | Real data + `?seed=fixture-positions` demo book (S5). Triggers wired in logic but untested against live SPY/VIX. |
| §5.5 `/regime` | ✓ | `web/src/app/regime/page.tsx` | Real macro_gauges data + 52-wk fixture fallback. |
| §5.6 `/aiq/[ticker]` | ✓ | `web/src/app/aiq/[ticker]/page.tsx` | Real data; per-dim Source URL shipped this session (S5) but **migration not yet applied to any environment** — save path 400s against prod. |
| §5.7 `/memos` (spec: v1.1, deferred) | ✓ shipped early | `web/src/app/memos/page.tsx` | Daily + weekly LLM-synthesized memos with structured parsing. Past v1 scope. |

**Bonus routes built beyond spec §5:**

| Route | Spec status | Notes |
|---|---|---|
| `/aiq` | Not in spec | Universe-wide AIQ index table (sorted by total). Natural extension of /aiq/[ticker]. |
| `/aiq-drafts` | Not in spec | Drafts queue for LLM-parsed AIQ rows. Powers a pipeline doc'd at `docs/aiq-drafts-pipeline.md`. |
| `/backtest` | Spec §13 deferred to v1.1 | Operator-invoked backtest run viewer with monthly returns. Past v1 scope. |
| `/decisions` | Spec §13 deferred to v1.1 ("Decisions workflow") | Alerts log (tier changes, macro gates, insider clusters) with bulk-ack. Past v1 scope. |
| `/settings` | Not in spec wireframes | Pipeline freshness (11 probes) + cron registry (17 jobs) + theme. Operator dashboard. |
| `/login` | Not in spec | Magic-link auth via Supabase. Required for cutover. |

**Net:** 13 routes built; 7 are past v1 spec. The "v1" door is already shipped — we're operating in v1.1+ territory whether or not we've named it that.

---

## Acceptance criteria status (spec §12)

| Criterion | Status | Note |
|---|---|---|
| All 6 routes from §5 render | ✓ | Plus 7 more |
| Token system implemented as CSS variables | ✓ | `web/src/app/globals.css` |
| Every component in §4 has a built equivalent | ✓ | `web/src/components/primitives/` + `rails/` + `shell/` + `universe/` |
| Empty + loading + error states for /universe + /n/[ticker] | ⚠ | Per [[feedback_server_fetch_no_loading_state]], server-fetched RSC eliminates loading state — both routes are server-rendered. Empty + error states present. |
| Keyboard interaction surface (§7.2) documented | ⚠ | 26 shortcuts hardcoded in `web/src/lib/shortcuts.ts` + ShortcutsOverlay. NOT in spec language verbatim — e.g. ⌘5 in spec is Memos; in build, ⌘ ordering reflects current nav. |
| Walkthrough video (3-5 min) | ✗ | Not done. Low priority — was a Figma-handoff artifact; we shipped real code. |

---

## Engine status vs. algorithm spec §Part 4

**Spec v1 engine target (May 22-24 weekend):** Q, G, V, AIQ live; M and S as null stubs; macro gates Tier-A-only.

**Actual state (2026-05-17):**

| Factor | Spec v1 status | Actual status |
|---|---|---|
| Q (Quality) | Live | ✓ Live + factor_breakdown JSONB |
| G (Growth) | Live | ✓ Live + L4 capex caveat documented (uses FMP TTM, not contracted MW pipeline) |
| V (Value) | Live with depreciation penalty | ✓ Live; depreciation_flags seeded for ORCL/MSFT/GOOGL/AMZN/META |
| AIQ | Manual, quarterly | ✓ Live; aiq_rubric + aiq_drafts + LLM-parsing pipeline beyond spec |
| M (Momentum) | Null until v2 (week 2) | ✓ Wired (m_scores_cron Sat 03:30 UTC) — past spec |
| S (Sentiment) | Null until v2 | ⚠ Wired but data-starved (gates on options.skew_25d availability; null when sparse) |
| Concentration tax | Out-of-scope v1 | ✓ Wired in composite.ts (additive before multiplier); tested vs. NVDA/TSM hand-walks |
| Macro multiplier | Out-of-scope v1 | ✓ Wired (macro_gates_hit count + curve {0:1.00, 1:0.95, 2:0.90, 3:0.85}) |
| Sentiment cap (§2.8 line 119) | Not in v1 plan | ⚠ Wired (post-everything clamp, bottom-Q + top-Q S → max 55) but no-op until S goes live |
| Backtest harness | Out-of-scope v1 | ✓ Operator-invoked + run viewer at /backtest |

**Net:** engine is past spec v1 (full QGVMS + AIQ + macro + concentration + backtest), but S-score is data-starved and several "ready but never lived" paths exist.

---

## Data ingestion status — the actual gap surface

| Ingest path | Cron wired? | Edge function deployed? | Data flowing? | UI consumer | Gap impact |
|---|---|---|---|---|---|
| FMP fundamentals | ✓ | ✓ (assumed; not in this repo) | ✓ (seeded for fixtures) | Q-score | None |
| FMP consensus | ✓ | ✓ | ✓ | G-score, revisions | None |
| FMP prices | ✓ | ✓ | ✓ | M-score, portfolio P&L | None |
| Macro gauges (NAAIM/AAII/F&G via Perplexity) | ✓ | ✓ | ✓ | /regime, /decisions, macro multiplier | None |
| Options skew_25d | ✓ | ⚠ | ⚠ sparse | S-score | **S-score null in production → sentiment cap is no-op** |
| **Insider Form 4 (SEC EDGAR)** | ✓ | ✗ NOT DEPLOYED | ✗ | NameActivityRail (ghost), DashboardTodayRail (ghost), insider-cluster alerts (silent) | **3 rail surfaces show "data pending" — biggest visual gap** |
| **News / sentiment** | ✗ | ✗ | ✗ | NameActivityRail (ghost) | **Rail ghost; no plan documented** |
| Short interest | ✓ | ✓ | ✓ (bimonthly) | S-score component | Minor |
| **VIX live** | ✗ | ✗ | ✗ | Portfolio trigger 2 ("SPY -5% OR VIX >25") | **Portfolio trigger half-active (SPY wired, VIX placeholder)** |
| **Depreciation flag filter** | n/a (table seeded) | n/a | ✓ data present | UniverseFilterRail (depr/burry toggles `wired: false`) | **UI toggles exist but don't filter the table — quick wire-up win** |
| Quarterly reviews | ✓ | ✓ | ✓ | **No UI surface** | Data sits unused; no route renders it |

**Three classes of gap, ranked by leverage:**

1. **Form 4 ingestion (THS-58 / THS-61 / THS-66).** Single edge function unlocks 3 ghost surfaces simultaneously and activates a real alert kind. Highest-leverage data ingest task.
2. **Migration application + production cutover.** The S5 JSONB migration sits in repo unapplied; the whole app runs on localhost. `docs/CUTOVER.md` already exists (merged in #7 to main) but cutover isn't executed.
3. **Quick wire-ups.** Depreciation flag filter UI (1-2 hours). VIX trigger using yahoo or alpha vantage (1 session). Quarterly reports page (1 session if reusing /backtest patterns).

---

## Untested integration paths

These exist in code but have never run against live market data:

1. **Portfolio market triggers** — SPY -5% threshold, position-level drawdown (-7%), VIX >25 logic all coded in `web/src/lib/portfolio-data.ts`. Demo path verified (`?seed=fixture-positions` fires AMD trigger). Live verification pending Day-1 deploy.
2. **Sentiment cap logic** — Bottom-quartile Q + top-quartile S → composite clamped to 55. Spec §2.8:119. Wired in Supabase composite.ts. No-op until S-score data exists.
3. **Insider cluster derivation** — `web/src/lib/alerts-data.ts` derives cluster events from `insider_form4_raw` rows. Logic ready; table is empty until THS-66 ships.
4. **Concentration tax** — Wired in composite.ts before macro multiplier. Hand-walk verified vs. NVDA/TSM. No live multi-quarter test.

---

## Out-of-scope per spec §13 (intentional cuts — don't ding for absence)

- Mobile / sub-1024px responsive
- Multi-user collaboration
- Public-share / read-only links
- Customizable layout (drag-resize, hide columns)
- Themes other than dark
- Localization
- Onboarding tour / coach marks

---

## Open spec questions (§14) — unresolved

| # | Question | Spec default | Status |
|---|---|---|---|
| 1 | Brand mark — Basis logo + "AI Thesis" name? Or custom mark? | Basis logo + product name | TBD; topbar currently uses simple text wordmark |
| 2 | /portfolio: live brokerage integration vs. manual entry? | Manual v1; Plaid v1.1 | Manual entry shipped; Plaid TBD |
| 3 | Notification channel — in-app, email, SMS? | In-app v1; email digest v1.1 | In-app via /decisions log shipped; no email digest |

None of these block. All are v1.1+ scope.

---

## Documentation state

Existing build-state docs (all in `docs/`):

- `SESSION_NOTES.md` — Cold-start handoff (last entry: session 9, 2026-05-17)
- `HANDOFF.md` — v1 follow-ons + conditions (10b5-1 parser, capex consensus forward-fill)
- `PARKED.md` — Intentionally not built (v3 trigger workflow, memo approval as IA)
- `CUTOVER.md` — Production cutover playbook (merged via PR #7)
- `schema.md` — Manual ER diagram
- `aiq-drafts-pipeline.md` — AIQ LLM-parsing pipeline
- `design/lambo-review-2026-05-17.md` — Lambo design review queue (100% closed)
- `design/mercury-references.md` — Mercury pattern catalogue
- `handoffs/2026-05-17-S{1..5}-*.md` — Session-by-session detail

Worth noting: the Explore agent surveyed from the perspective of `claude/epic-4-portal-ui` (where SESSION_NOTES.md ends at session 9). The current branch `claude/lambo-design-finish` adds S1-S5 of lambo polish on top. No semantic conflict — the lambo branch is the more advanced superset.

---

## Top-tier-clean roadmap (ordered by leverage)

The "$5B PE analyst pauses" bar requires: (a) the engine reconciles end-to-end against live data, and (b) the surface is actually reachable. Today fails on both. Ranking by impact-per-session-of-work:

### Phase A — Make the engine real (highest leverage)

| # | Task | Effort | Why now |
|---|---|---|---|
| A1 | Apply S5 migration on Supabase dev branch → test backfill + rollback | 1 session | Unblocks PR #8 merge. The schema change is the only architectural risk in 50 commits. |
| A2 | Merge PR #8 once A1 green | 5 min | Stops divergence; future work descends from clean main. |
| A3 | Production cutover per `docs/CUTOVER.md` — apply all pending migrations, smoke save paths | 1 session | The cutover runbook already exists. Just execute it. |
| A4 | Deploy to Vercel + connect domain | 1 session | The thing has to be reachable to matter. |

### Phase B — Close the data-ingestion ghosts (UI trust vector)

| # | Task | Effort | Why now |
|---|---|---|---|
| B1 | Wire Form 4 ingestion edge function (THS-66) | 1-2 sessions | Single ingest unlocks THS-58 rail, THS-61 alerts, dashboard cluster ghost — 3 visible surfaces at once. |
| B2 | Wire VIX live (yahoo or alpha vantage) | 1 session | Portfolio trigger 2 currently half-wired; completes the deployment-trigger surface. |
| B3 | Wire depreciation flag filter UI (THS-46 toggles → table) | 1-2 hours | Data is present, mechanism exists, just connect the wire. Trivial visible win. |

### Phase C — Polish and v1.1 expansion (after A+B)

| # | Task | Effort | Why now |
|---|---|---|---|
| C1 | News/sentiment provider selection + ingest | 2-3 sessions | Removes the last rail ghost (NameActivityRail news). Provider choice needs Terry input. |
| C2 | Quarterly reports UI surface | 1 session | Data exists; reuses /backtest patterns. Low effort, fills a gap. |
| C3 | S-score reactivation (depends on B1 + C1 data flowing) | 1 session | Once data exists, sentiment cap becomes real. |
| C4 | Lambo Phase 2: post-deploy audit of every canvas against §7 quality test | 1-2 sessions | After A+B+C1-3, do a fresh lambo pass with real data in every surface. |

### What to NOT do next

- Don't open a new lambo pass on current state. Every rail-ghost is an empty surface — polishing it now is polishing emptiness. Real data first, then re-audit.
- Don't author Phase 2 tickets blind. Author them AFTER A+B so we know what cleanup falls out.
- Don't expand backtest scope. Current viewer is fine; deeper backtest belongs in v1.2.

---

## Recommended next move (single concrete action)

**Phase A1: apply the S5 migration on a Supabase dev branch and verify backfill + rollback work as designed.**

Reasoning:
- It's the only architectural change in PR #8. Without it, merging is a faith leap.
- It costs against Supabase quota (a dev branch is billable) — needs Terry's quota OK.
- ~30 min including dev branch lifecycle.
- Once green, PR #8 can be merged with confidence, and Phase A2-A4 cascade naturally from there.

**Decision Terry needs to make:**
1. OK to spend ~few-cents Supabase quota for a temp dev branch? (Phase A1 = blocked otherwise.)
2. If yes — also OK for me to merge PR #8 autonomously once A1 verifies green?
3. After A1+A2, which phase to push: A3 cutover (highest leverage), B1 Form 4 ingest (most visible win), or pause to discuss the Phase C provider-selection decisions?

---

*End of audit.*
