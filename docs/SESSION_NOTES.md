# Session Notes — last updated 2026-05-17 (session 9 — settings + README)

## SESSION 9 — autonomous polish (2026-05-17, post-compact)

Picked up after session-8 compact with Terry's directive: *"Run autonomously until you need my input on anything or come across mission critical decisions."* Lower-value polish items that didn't need continuous context. No new spec discoveries; no questions for Terry.

**Branch state**: `claude/epic-4-portal-ui` advanced 1 commit — `0acf744 → 31e93a8`. 335 tests pass (unchanged). Web typecheck clean.

**`31e93a8` /settings real implementation + README refresh.**

Replaced the last `PageStub` (`/settings`) with a real operator surface:
- **Account** — surfaces signed-in email via `getSupabaseServer().auth.getUser()` (same pattern as layout).
- **Pipeline freshness** — 11 probes against the data tables that drive every UI surface (fundamentals/consensus/prices/macro/options/insider/short-interest/composite/concentration/memos/aiq_drafts). Each probe queries `MAX(timestamp_col)` and computes hours since latest. Status color: green if < SLA, amber if stale, rose if no data. Per-table SLAs match cadence — 30h for daily, 200h for weekly Saturday chain, 400h for bimonthly short interest, 720h for manual AIQ drafts.
- **Cron registry** — hand-maintained list of 17 cron jobs mirroring `supabase/migrations/*_cron.sql`. Cron job table (`cron.job`) is not queryable from the anon role under RLS, so we keep a static registry. Doc note in the page reminds the next session to keep it in sync if a new cron migration lands.
- **Theme** — pointer to topbar swatch (no UI duplicated; localStorage palette persists from there).

Files:
- `web/src/lib/settings-data.ts` (new) — `getSettingsSnapshot()` with fixture-mode fallback; `CRON_REGISTRY` constant + `PROBES` array; column names verified against actual migration schemas (`prices_raw.date`, `insider_form4_raw.filing_date`, `short_interest_raw.settlement_date`, `fundamentals_raw.ingested_at`, others as `as_of`).
- `web/src/app/settings/page.tsx` — server component, ISR 300s (5-min refresh keeps freshness display useful without DB hammer).
- `web/src/components/shell/Sidebar.tsx` — Terry Turner avatar block now wraps in a Link to `/settings` with a Tip. Discovery: prior to this, /settings was only reachable from Cmd Palette; settings convention in nearby tools (Linear, Slack) is the user-avatar.

**README rewrite** — replaced session-1-era README with current shipped state:
- Epic 1-6 completion table (all ✅ except S in prod, which is a credential issue not a code issue).
- Updated stack lines (Next.js 16, not 15).
- 15-route surfaces table.
- Quick-start with fixture-mode fallback explanation.
- Cold-start guidance points at `docs/SESSION_NOTES.md` (was missing).
- Removed stale "Epic 4 not yet started" + "`prototype/` is the visual reference" language.

**Migration rollback audit** — verified every forward migration in `supabase/migrations/*.sql` has a matching `rollback/*_rollback.sql`. 49/49 clean.

**Items deferred** (require Terry or external access):
- PR #6 retitle (would need GitHub MCP auth; not appropriate to initiate without user consent).
- Production cutover (Terry-only — API key provisioning, Vercel deploy, Epic-6 auth hardening).
- Per-page visual fidelity polish vs Reticle/Basis Proforma references (needs browser).

**Total session-9 footprint**: 1 commit, 474 insertions, 95 deletions, 1 new file (`web/src/lib/settings-data.ts`), 3 edited (README, settings page, sidebar). No engine changes, no schema changes, no test changes.

---

## SESSION 8 — completed work (2026-05-17)

Picked up Terry's session-7 directive. Done so far:

**Step 1 — verification of session 7's 11 commits.** All green:
- `node --test --experimental-strip-types supabase/functions/_shared/*.test.ts` → 327 pass / 0 fail / 0 skip
- `cd web && npx tsc --noEmit` → clean
- Concentration tax arithmetic at `composite.ts:180-181` matches spec (additive-before-multiplier; TSM/NVDA worked examples reproduce within 0.5pt)
- Schema interfaces all aligned: `options_raw.skew_25d` ↔ `loadSInputs`, `aiq_drafts.sources` writer ↔ web `AiqDraftSources` (6 keys), `concentration_history.tax` ↔ `computeComposite` signature
- LLM JSON parsers (AIQ, weekly) tolerate ```json fences and persist parse_error rows

**Step 2 — Terry's confirmed answers, applied:**

- **Universe expansion**: no-op. All 26 names Terry listed (AMD, AMAT, KLAC, MRVL, ARM, SNPS, CDNS, DDOG, S, MDB, NET, ESTC, AI, ETR, NRG, TLN, NEE, AES, PWR, BE, EQIX, DLR, ADBE, WDAY, ZS, SAP) are **already** in the seed at `20260515000200_e13_seed_universe.sql`. Current universe count is 50 + `^VIX` from THS-69. AIQ-drafts pipeline doc already lists the 32 missing names for the batch loop — no extension needed.

- **THS-48 dep-flag seed migration**: shipped at `20260517000000_e24_extend_depreciation_flags.sql`. Inserts 4 new rows dated 2026-05-17 (ORCL, MSFT, GOOGL, AMZN); supersedes the prior ORCL -7 row via the reader's "latest flagged_at per ticker" semantics. META unchanged (existing -12 capped row matches Terry's stated value).

  Per Terry's verification rule I pulled each company's most recent 10-K via `sec.ts::fetchLatestFiling` and grepped for useful-life language. Found material discrepancies vs Terry's quoted magnitudes (META "to 5.5y" not "5→7y range"; ORCL & AMZN both 1.0y exact but assigned different bands; GOOGL 2023 change is outside the spec's strict 24-month window; AMZN 2024 extension was reversed in 2025; MSFT FY25 10-K doesn't contain extension language — would be in FY24). Batched all four discrepancies + a recommended-default for each back to Terry as a single question. Terry replied "go" — interpreted as apply-defaults. Committed with:
  - ORCL = -10 (5→6y, 1.0y exact, ext -5 + Burry -5)
  - MSFT = -3 (6→6.5y per FY24, not re-verified — flagged in migration header)
  - GOOGL = -10 (4→6y 2023, applied regardless of 24-mo window per Terry's "rank don't filter")
  - AMZN = -7 (5→6y 2024, applied regardless of 2025 reversal per same principle)
  - META unchanged

  Migration includes per-ticker SEC source URLs and a DO-block assertion on the final penalty_v values. Rollback at `rollback/20260517000000_e24_rollback.sql`.

**Step 3 — autonomous queue, executed:**

- **`b6adda2` docs: park 10b5-1 parser + forward capex consensus.** Terry deferred both to v1 + documented as known limitations. `docs/HANDOFF.md` created (revisit conditions for each). Inline docstrings updated in `factor-insider.ts` and `quarterly-checklist.ts`.
- **`7fbbc9b` THS-47 follow-on: promote-to-aiq_rubric server action on /aiq-drafts.** New `web/src/app/aiq-drafts/actions.ts` with `promoteAiqDraft`. DraftCard now has a "Promote to rubric" button visible on unreviewed non-parse-error drafts. Maps the draft's per-dim jsonb notes to the per-dim columns and stamps `approved_at` / `approved_by`. RLS keeps it authenticated-only. Pipeline doc updated.
- **`3d15054` THS-66 follow-on: rich weekly memo render from sections.parsed.** MemoCard now renders structured weekly memos as a high_book grid (ticker / score / color-coded action / bear-case + rationale), cross-book notes, and watch-next-week. Falls back to body markdown for daily memos. Added a weekly fixture row so dev mode shows the structured layout.

**Spec/ticket reconciliation pass (`Explore` agent audit):**

Audit was very clean. One real drift finding:

> **Sentiment cap missing** (spec line 119): *"A name in bottom-quartile Q with top-quartile S is capped at score = 55 (not 65 as v1). Quality + AIQ are the durable filters; if both fail and sentiment is the only thing carrying a name, that is exactly the failure mode of 2021."*
>
> Implementation status: NOT in `composite.ts`. The composite math currently lets a low-Q/high-S name produce a >55 final score with no cap.
>
> Cost to implement: small in code (~30 lines + tests). The actual judgment call is **what "score" means** — the cap applies before or after the macro multiplier? before or after the concentration tax? — and Terry has been precise about composite arithmetic ordering before, so this should be batched.

Other findings — all already documented or justified:
- L4 capex efficiency uses TTM revenue / TTM capex (spec wants contracted MW pipeline value) — documented in `factor-g.ts:18-21` as data gap.
- ORCL boundary call (1.0y → −5 ext) — documented in `20260517000000_e24_extend_depreciation_flags.sql` header.

Everything else checked cleanly: layer weights, macro gate thresholds + multiplier, composite tier cutoffs, insider cluster constants, momentum sub-weights, S-score weights, dep penalties, concentration tax cap at −15, V-score maintenance capex at 50% mid default.

**Branch state**: `claude/epic-4-portal-ui` advanced 9 commits this session — `22a4ba4 → e6910a7`. 335 tests pass (was 327). Web typecheck clean.

**Session 8 second-half additions** (after the spec-drift batch):

- **`c412170` spec line 119 sentiment cap.** Real drift found by the reconciliation audit: spec says "bottom-quartile Q + top-quartile S → max final 55." Not implemented. Shipped with Terry's three judgment calls — post-everything clamp, whole-universe quartile reference, percentile-at-score-time. No-op until S goes live (Epic 5) because sTopQuartile=false whenever S is null. +8 tests cover the fire case, three no-op cases, ceiling-not-floor semantics, post-multiplier ordering, percentile boundary math, null-S resilience, and small-universe (< 4) safety. New `computeSentimentCapFlags()` helper. New `CompositeResult.sentimentCapApplied` field. New `sentiment_cap_hits` in compute-composite-scores response. New `sentiment_cap_applied` in `scores_history.factor_breakdown`.

- **`4ce322d` /backtest UI.** `run-backtest` persists to `backtest_runs` with no read surface — found by the completion audit. Built page + RunRow with summary stats inline, 200×28 cumulative-return SVG sparkline, expandable per-month return + turnover grid. Wired into sidebar nav with `I.refresh` icon. ISR 30min, fixture fallback with 2 sample runs × 36 months. 

- **`82ed8d3` Dashboard /.** Replaced flagship PageStub. Six sections in 2-col grid: tier distribution (4 cells wide, current + Δ vs prior week), macro gate (multiplier + plain-English explainer), pipeline freshness, top winners, top losers, tier crossings (wide). Wholly derived from `getLatestUniverseScores()` — no new DB query. Prior-tier reconstructed from prior_composite via spec cutpoints (75/60/45/0).

- **`e6910a7` /aiq index.** Replaced editor-stub. Universe-wide rubric table with totals + per-dim cells, sorted by total desc (un-scored names red-accented at bottom). Each ticker links to `/aiq/<ticker>` editor; header has "Drafts queue ↗" jump to `/aiq-drafts`. New `getAiqIndex()` loader joining universe + latest rubric per ticker.

**UI surface delta**: 12 → 15 real pages. Only remaining PageStub is `/settings` (intentionally minimal for v1).

**Completion estimate after this session**: ~83-85% on buildable surface. Remaining ~15-17% is production deploy / API keys / Vercel cutover (Terry-only), per-page visual fidelity polish vs Reticle/Basis Proforma references (needs browser), and Epic-6 auth hardening for production. Engine + UI + data pipelines are functionally complete.

**One open question for Terry** (batched per the autonomous-by-default contract):

The sentiment cap (spec line 119). When applied to a name with `Q_score` in the bottom quartile of the universe AND `S_score` in the top quartile, the spec says cap final at 55. Three judgment calls:

1. **Where in the arithmetic does the cap apply?** Pre-tax + pre-multiplier composite? Or final (post-tax, post-multiplier)? My read: post-everything, since the spec calls it the "score" cap and the macro multiplier is a "de-rate" — capping pre-multiplier would let a 96% multiplier push us back above 55.

2. **What quartile reference set?** The whole investable universe (50 names)? Only same-layer peers? Only High-book candidates? My read: whole universe — that's what the spec says and avoids tiny-bucket noise.

3. **Quartile boundaries**: integer cut at the 25th/75th percentile of the current universe snapshot, or fixed thresholds (e.g. Q ≤ 50, S ≥ 70)? My read: percentile-of-universe, computed at score time — matches the spec's distributional framing.

Recommended defaults: 1 → post-everything, 2 → whole universe, 3 → percentile-at-score-time. Confirm or override and I'll ship the cap.

---

---

## NEXT-SESSION COLD-START — READ THIS FIRST

Written immediately before /compact at the end of PM session 7. The session 7 tally lives further down — only the directive Terry needs you to follow on session 8 is here.

### Step 1 (mandatory): verify session 7's work before adding anything new

Terry's instruction verbatim: *"First step of next session is to double check the work you did this session to make sure all looks good, and then get started on what's next."*

Session 7 shipped 11 commits across 5 ticket completions + 4 maintenance items. Branch head is `8ecc0f5` on `claude/epic-4-portal-ui`. Before doing any new work:

1. Run the full suite: `node --test --experimental-strip-types supabase/functions/_shared/*.test.ts` — expect **327 passing**.
2. Typecheck web: `cd web && npx tsc --noEmit` — expect zero errors.
3. Walk the 11 session-7 commits with `git log --oneline 1d4fca2..8ecc0f5` and re-read each diff. Look for:
   - **Spec drift** — did the concentration-tax wiring (`7298b36`) actually match the spec arithmetic, or did I round wrong? Re-derive TSM/NVDA finals from the worked examples in `docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Scoring`.
   - **JSON-parsing brittleness** in the LLM-output paths (`compute-weekly-ranking`, `generate-aiq-draft`) — the `parseStrictJson` / `parseAiqDraft` paths should be resilient to common Claude output drift (extra whitespace, occasional fences). Confirm.
   - **Schema mismatches** — did I add columns that the loader/orchestrator reads correctly? Specifically: `concentration_history.tax` read by `loadCompositeInputs` (commit `7298b36`); `options_raw.skew_25d` read by `loadSInputs` (`9c33115`); `aiq_drafts` sources jsonb shape vs DraftCard reads (`a83070d`).
   - **Cron timing collisions** — Saturday chain is Q 22:00 → composite 22:45 → weekly memo Sun 23:00. Daily memo 13:00 UTC. Options 22:00 Mon-Fri. Insider 22:50 Mon-Fri. No overlaps but worth a re-read.
   - **Untouched tests in changed code** — `composite.test.ts` got 8 new tax tests; the 22 existing tests still passed at session end, which means the default tax=0 path is preserved, but spot-check that.

If anything looks wrong, fix it before starting new work. The build is at a known-clean state right now; the next session preserves that or fixes it explicitly.

### Step 2: Terry's confirmed answers — apply when picking up THS-48 + universe expansion

Terry resolved the two remaining blocked items in his close-out message. Quoted verbatim:

**(1) Universe expansion** — *"include all 26 names from algorithm doc §Part A, not 20."* Names to add:

```
AMD, AMAT, KLAC, MRVL, ARM, SNPS, CDNS,
DDOG, S, MDB, NET, ESTC, AI,
ETR, NRG, TLN, NEE, AES, PWR, BE,
EQIX, DLR, ADBE, WDAY, ZS, SAP
```

Operating principle: *"Universe is for ranking, not filtering. Low-conviction names should be scored low by the engine, not pre-filtered out."* Don't apply quality gates before inclusion — let the composite + tier classifier do the filtering.

Cross-check: 26 names listed, current universe has 50 investables, target is 70+. After this addition the count is ~76 (universe.txt vs aiq_rubric coverage). The AIQ draft pipeline shipped this session (`a83070d`) will need to run against these names too — extend the batch loop in `docs/aiq-drafts-pipeline.md`. The 32-ticker "missing AIQ" list in that doc will jump to ~58 after the universe expansion. Re-list before starting the batch.

**(2) Dep-flag penalties for THS-48** — *"apply per the spec's penalty band verbatim (algorithm doc §Fix 5). No 'freshness window' softening."* Final values:

| Ticker | Extension | Penalty (band) | Burry overstatement |
|---|---|---|---|
| **META** | >1.5y total (two extensions, 5→7y range) | **-10** | **-3** |
| **ORCL** | extension in 10-K FY25 | **-5** (per band) | **-5** |
| **MSFT** | 6 → 6.5y in FY24 (0.5y) | **-3** (per band) | **none** |
| **GOOGL** | 4 → 6y in 2023 (2.0y) | **-10** (per band: "extended by >1.5 years") | **none** |
| **AMZN** | 5 → 6y in 2024 (1.0y) | **-7** (per band: "extended by 1.0-1.5 years") | **none** |

**Crucial verification rule from Terry, verbatim:** *"Confirm the band reads against actual filing language before committing — extension magnitudes are public. Where filings are ambiguous, flag in batch instead of choosing."*

Procedurally: before opening a PR / committing the migration that seeds these, pull each ticker's most recent 10-K (the `sec.ts::fetchLatestFiling` helper shipped this session does exactly this) and verify the extension language and magnitude matches what Terry quoted. If you find a discrepancy — e.g. MSFT actually extended by 1.0y not 0.5y, or the META "two extensions" is actually one bigger extension — **flag it in a single batched message back to Terry**, don't silently choose. He's giving you the spec band; he's telling you to double-check that the spec band actually applies to current filings.

Build the `depreciation_flags` seed migration for the five names above using the spec-band penalty values. Schema is already in place (`supabase/migrations/20260515002000_e23_seed_depreciation_flags.sql` for the existing META/ORCL seeds; this is an extension). Drop a per-ticker `source_url` pointing at the SEC filing URL (the `fetchLatestFiling` helper returns this). The V-score will pick up the new penalties on the next Saturday compute.

### Step 3: pick up the autonomous queue

After verification + THS-48 + universe expansion, the autonomous queue is whatever Terry triggers next. Things I flagged at end of session 7 that don't need his input:

- **Spec ↔ ticket reconciliation pass** (standing maintenance item from PM session 5).
- **Promote-to-aiq_rubric server action** on /aiq-drafts (replaces the manual SQL snippet in `docs/aiq-drafts-pipeline.md`).
- **Rich weekly memo render** — `sections.parsed` has structured JSON (high_book table, cross_book_notes, watch_next_week) that the /memos UI isn't using yet.
- **PR #6 retitle + README refresh** (cosmetic).

Things still requiring Terry's input:
- **10b5-1 backfill** — parse SEC link footnotes.
- **`consensus.capex_fy1/fy2`** — make THS-67 check 4 fire on the spec'd signal instead of the TTM proxy.

---

## PM session 7 final tally (autonomous, post-compaction)

Picked up after the PM session 6 handoff. After Terry resolved the
three blocking decisions (Polygon for options, Claude Sonnet 4.6 /
Opus 4.7 for memos, FMP+EDGAR+Claude for AIQ expansion), shipped the
entire blocked backlog in one run plus the queued maintenance items.
Final tally: **10 commits, 327 tests passing (was 255 at session
start), branch `claude/epic-4-portal-ui` head `a83070d`.**

### Items shipped this session (in order)

| Commit | Ticket / item | What |
|---|---|---|
| `5f2755d` | **THS-67** Quarterly review checklist | Helper + `quarterly_reviews` table + Feb/May/Aug/Nov 5th @ 23:00 UTC cron. /decisions wired with new `quarterly_review` AlertKind. Check 4 (consensus capex) ships as `data_gap` since the consensus table doesn't carry capex. 11 tests. |
| `01678e5` | **THS-57/61 follow-on** Insider clusters on /decisions | Replaces the stub. 4-week walker, BUY/SELL transitions, fired/cleared semantics. |
| `b9dd5b5` | **THS-64 follow-on** `backtest_runs` table | One row per `run-backtest` invocation. Response includes the new `id`. |
| `c993002` | **THS-69** VIX daily ingest + portfolio trigger 2b live | `^VIX` row in universe with `kind='macro'`. FMP legacy endpoint via `fetchVixHistory`. ReservePanel reads last 3 closes from prices_raw. |
| `1d4fca2` | docs | First mid-session SESSION_NOTES update. |
| `7298b36` | **THS-63 → composite** Concentration tax wiring | Additive-before-multiplier per spec arithmetic (TSM 82.2 / NVDA 75.7 both reconcile within 0.5). `computeComposite()` accepts optional `concentrationTax`. `factor_breakdown` JSONB exposes `pre_tax`, `pre_multiplier`, `post_multiplier`. 8 new tests. |
| `9c33115` | **THS-59** Options surface ingest (Polygon) | New `options_raw` table. Pure `options-metrics.ts` computes put_call_ratio, skew_25d (closest-to-25Δ within ±10Δ tolerance, short-dated only), iv_term_slope. Polygon client with `next_url` pagination. Mon-Fri 22:00 UTC cron. `loadSInputs` now reads `options_raw.skew_25d` (no more THS-59-pending stub). Needs `POLYGON_API_KEY` env. 16 tests. |
| `90fe496` | **THS-65** Sonnet daily memo cron | New `memos` table (kind='daily'/'weekly', UNIQUE per kind+as_of). Pure `memo-context.ts` builder. Anthropic client wraps `/v1/messages` with `cache_control: ephemeral` on the system prompt. Edge fn with 3× retry + fail-row persistence. Mon-Fri 13:00 UTC cron (8am CDT / 7am CST). /memos route with expand-on-click cards. 9 tests. Needs `ANTHROPIC_API_KEY` env. |
| `cff3d55` | **THS-66** Opus weekly ranking cron | Pure `weekly-ranking.ts` builder (full ranking + High book + bear-case flags + mean pairwise corr). Strict JSON output schema: `{headline, summary, high_book[{ticker, action ∈ add/hold/trim/exit, action_rationale, bear_case}], cross_book_notes, watch_next_week}`. Parse failures persist `parse_error` + raw body for review. Sun 23:00 UTC cron. 13 tests. Uses Opus 4.7. |
| `a83070d` | **THS-47** AIQ draft pipeline | `aiq_drafts` staging table (NOT writing to aiq_rubric until approved). `generate-aiq-draft` edge fn fetches latest SEC 10-K (EDGAR, public) + FMP earnings transcript per ticker, hands both to Claude Sonnet 4.6 with the 6-dim rubric prompt. /aiq-drafts review surface shows scores + per-dim citations + source links. Pipeline docs at `docs/aiq-drafts-pipeline.md`. 15 tests (10 parser + 5 EDGAR HTML). |

### Final cron schedule

Saturday weekly:
- Q-scores: 22:00 UTC
- G-scores: 22:15
- V-scores: 22:30
- Concentration tax: 22:35
- M-scores: 22:40
- S-scores: 22:42
- Composite scores: 22:45 (now reads concentration_history.tax)

Sunday:
- Weekly ranking memo (Opus 4.7): 23:00 UTC

Daily Mon-Fri:
- Options surface ingest (Polygon): 22:00 UTC
- Insider Form 4 (FMP): 22:50 UTC
- Daily memo (Sonnet 4.6): 13:00 UTC (8am CT)

Quarterly:
- Quarterly review checklist: Feb/May/Aug/Nov 5th @ 23:00 UTC

Bi-monthly:
- Short interest (FMP): 22:30 UTC, 1st + 16th of each month

On-demand (no cron):
- `run-backtest` — body `{start, end, top_n, cost_bps}`. Persists to `backtest_runs`.
- `generate-aiq-draft` — body `{ticker}`. Persists to `aiq_drafts`.

### Test suite state

**327 tests passing across `_shared/`.** Run: `node --test --experimental-strip-types supabase/functions/_shared/*.test.ts` from repo root.

New this session: quarterly-checklist (11), options-metrics (10), polygon (6), composite tax (8), memo-context (9), weekly-ranking (13), aiq-drafts (10), sec (5) — 72 new tests on top of the 255 from prior sessions.

### Required env vars (full list)

- `ANTHROPIC_API_KEY` — daily memo, weekly memo, AIQ drafts
- `POLYGON_API_KEY` — options ingestion
- `FMP_API_KEY` — fundamentals, consensus, transcripts, VIX, short interest, insider
- `SEC_USER_AGENT` — recommended for prod (avoids EDGAR rate limits); format `"Company Name email@example.com"`
- `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — all edge functions
- `CRON_INVOKE_SECRET` — required to invoke any edge function

### Open follow-ons surfaced this session

1. **CBOE fallback for VIX** — current ingest fails closed if FMP legacy endpoint goes away. Low priority unless FMP coverage proves unreliable.
2. **Promote-to-aiq_rubric UI button on /aiq-drafts** — SQL snippet in `docs/aiq-drafts-pipeline.md` does it manually for v1.
3. **`consensus.capex_fy1/fy2` columns + FMP ingestion** — makes THS-67 check 4 fire on the spec'd signal instead of the TTM proxy.
4. **Weekly memo rich render** — /memos shows raw body for both daily + weekly; structured JSON on `sections.parsed` is unused by the UI. Add a dedicated weekly view that renders the High book table + cross_book_notes + watch_next_week.
5. **10b5-1 backfill** — same as prior session. Still pending SEC link-footnote parser.
6. **AIQ chunking** — `generate-aiq-draft` passes raw first 12K chars of 10-K; targeted MD&A + Risk Factors + segment extraction would improve scoring fidelity.

### Maintenance still pending

1. **Spec ↔ ticket reconciliation pass** (Terry's standing observation).
2. **PR #6 retitle** — currently `claude/epic-4-portal-ui` but spans Epics 3-6 work.
3. **README session-start instructions** still reference build order Epic 1→6 (now consumed).
4. **THS-48 dep-flags expansion to all L2 names** — still queued; needs source data (which extensions were actually filed for AMZN, MSFT, etc.).

### What's left in Linear

All originally-queued tickets are now **Done** or blocked on external work the operator must do (universe expansion to 70 names, env-var configuration in prod, manual approval workflows).

---

## (legacy) PM session 7 update (autonomous, post-compaction)

Picked up after the PM session 6 handoff. Shipped THS-67 + three
maintenance follow-ons + THS-69. Cold-start block below is updated to
reflect actual state.

| Ticket / item | Commit | What |
|---|---|---|
| **THS-67** Quarterly review checklist | `5f2755d` | Helper + `quarterly_reviews` table + edge fn + Feb/May/Aug/Nov 5th 23:00 UTC cron. /decisions wired with new AlertKind `quarterly_review`. Check 4 (consensus capex) ships as `data_gap` — consensus table doesn't carry capex; surfaces TTM proxy and flags the missing column. 11 tests. |
| **THS-57/61 follow-on** Real insider clusters | `01678e5` | /decisions alerts now derive `insider_cluster` events from `insider_form4_raw` (4-week walker, BUY/SELL transitions). THS-61 helper semantics replicated on web side (factor-insider.ts is Deno-targeted). |
| **THS-64 follow-on** `backtest_runs` table | `b9dd5b5` | One row per `run-backtest` invocation (id, ran_at, start/end, params jsonb, summary jsonb, series jsonb). API contract unchanged — response includes the new `id`. |
| **THS-69** VIX daily ingest + trigger 2b live | `c993002` | Loosened `universe.kind` to `'macro'`, seeded `^VIX`. `fetchVixHistory` hits FMP's legacy `/api/v3/historical-price-full/^VIX` (stable EOD endpoint is sparse for indices). ingest-prices special-cases `^`-prefixed tickers. ReservePanel trigger 2b now reads last 3 ^VIX closes from `prices_raw` and fires when all ≥ 25. |

**Test suite:** 266 tests passing (was 255 — added 11 in THS-67).

**Concentration tax → composite wiring (NOT shipped this session):**
The cold-start handoff flagged this as needing Terry's call. The spec
arithmetic (TSM 82.2 with Q=92/G=88/V=75/AIQ=92/tax=-1, NVDA 75.7 with
similar numbers/tax=-5) is only consistent with **additive,
applied before the macro multiplier**:
```
composite        = weighted_avg(Q, G, V, AIQ, M, S)          // pre-tax
composite_taxed  = composite + concentration_history.tax     // tax is negative
final_score      = composite_taxed * macro_multiplier        // multiplier only if composite_taxed >= 75
```
Verified TSM arithmetic: 87.7 + (-1) = 86.7 × 0.95 = 82.4 (spec 82.2).
Verified NVDA: 85.15 + (-5) = 80.15 × 0.95 = 76.14 (spec 75.7).

Deferred to next session because the change flips tier classifications
across the universe and warrants explicit confirmation. One-line decision
needed from Terry: "yes, additive-before-multiplier per spec" or
"override to <alternative>". Once confirmed, the wiring is a small
change in `composite.ts` + `loadCompositeInputs` + a couple of tests.

---

## NEXT-SESSION COLD-START — READ THIS FIRST

This block is the handoff written immediately before /compact. The full session log lives below; only the operational summary you need to keep moving is here.

### Where we are

- **Epic 1 Foundation**: Done (prior sessions)
- **Epic 2 Tier-A scoring**: Done (prior sessions)
- **Epic 3 AIQ + overlays + macro**: Done except THS-47 (AIQ universe expansion to 50/70 names) and THS-48 (dep-flags expansion to all L2 names). Both are seed-migration follow-ons.
- **Epic 4 Portal UI (THS-32)**: **Done**. All 7 sub-issues + the auth sub-ticket THS-68 closed.
- **Epic 5 Tier-B scoring (THS-33)**: **Functionally done** — THS-58 (M), THS-60 (SUSI), THS-61 (insider), THS-62 (S-composite) all shipped. **Only THS-59 remains**, blocked on a vendor decision (Polygon vs Tradier vs broker for options surface).
- **Epic 6 Maintenance (THS-34)**: Partial. **THS-63 (concentration tax) and THS-64 (backtest harness) shipped this session**. THS-65 (Sonnet daily memo cron), THS-66 (Opus weekly ranking cron), and THS-67 (quarterly review checklist) remain.

### What needs Terry's input before unblocking

Two decisions gate the remaining backlog:

1. **Options vendor for THS-59** — Polygon ($79/mo, vendor-independent), Tradier (free with broker), or broker API (free with broker). Recommended default in PR #6 SESSION_NOTES: **Polygon $79/mo**. Without this, S-composite's `options_skew` signal stays null (partial-coverage rescaling handles it gracefully).
2. **LLM integration for THS-65 / THS-66** — Anthropic Console API key vs Bedrock vs Vertex. THS-65 = daily 8am CT Sonnet memo cron (top movers + news digest + insider Form 4s + macro state); THS-66 = Sunday-evening Opus ranking cron (full universe + correlation heatmaps + bear-case checks). Both need a single decision on which provider + credential source.

### What next session can do without asking

**THS-67 — Quarterly review checklist automation.** Pure orchestration, no external deps. Acceptance: quarterly job creates checklist row + notification. Surface-level scope from the ticket:
1. After each earnings cycle, auto-generate a checklist:
   - any L2 ticker changed useful-life policy?
   - any AIQ drift > 10 pts?
   - hyperscaler pairwise correlation moved > 0.20?
   - consensus 2026/2027 capex moved > 10%?
   - annual walk-forward re-optimize trigger
2. Persist as a row in a new `quarterly_reviews` table.
3. Surface in the UI (likely a card on /regime or a new /maintenance route).

This is autonomous work. Pick it up first if Terry hasn't answered the vendor/LLM questions.

After THS-67, the autonomous queue is empty until Terry decides on vendor + LLM. **Maintenance-list tickets** that could be picked up to bridge:
- **THS-47** AIQ rubric universe expansion to 50/70 names (adds NOW + INTU among others). Migration only.
- **THS-48** Depreciation-flag seed expansion to all L2 names. Migration only.
- **Wire concentration tax into composite** (open follow-on from THS-63) — subtract `concentration_history.tax` in the final score; requires Terry to confirm application semantics (multiplicative / additive / tier-shift).
- **Surface insider cluster events in /decisions** — THS-57's `insider_cluster` alert kind is stubbed; small follow-on can compute per-week clusters from `insider_form4_raw` and emit them. THS-61's `detectClusterOverride` is reusable.
- **`backtest_runs` persistence table** (THS-64 follow-on) — `(id, params jsonb, summary jsonb, ran_at)` so runs are comparable over time.

### Where the work lives

- **Branch**: `claude/epic-4-portal-ui` — head commit `2848b59` (THS-64 backtest). The branch name is historical (Epic 4 long since closed); current head includes Epic 5 + Epic 6 work. Consider retitling PR #6 to **"Epics 4–6: portal UI + Tier-B scoring + maintenance"** before merging, or stack the next session's work onto this branch. No functional concern either way.
- **PR #6** — open against `main`. Linear comments are the canonical per-ticket close-out; commit messages mirror them; SESSION_NOTES is the cross-session narrative.

### Cron schedule (final, after this session)

Saturday weekly:
- Q-scores: 22:00 UTC
- G-scores: 22:15
- V-scores: 22:30
- Concentration tax: 22:35
- M-scores: 22:40
- S-scores: 22:42
- Composite scores: 22:45

Bi-monthly:
- Short interest (FMP): 22:30 UTC, 1st + 16th of each month

Daily Mon-Fri:
- Insider Form 4 (FMP): 22:50 UTC

On-demand (no cron):
- `run-backtest` — operator-triggered with `{start, end, top_n, cost_bps}`

### Test suite state

- **255 tests passing** across `_shared/`.
- New this session: factor-m.test.ts (10), susi.test.ts (7), fmp-short-interest.test.ts (4), factor-insider.test.ts (14), fmp-insider.test.ts (4), factor-s.test.ts (10), concentration.test.ts (9), backtest.test.ts (9).
- Run: `node --test --experimental-strip-types supabase/functions/_shared/*.test.ts` from repo root.

### THS-63 / THS-64 close-out (only landed in Linear + commit messages — not yet captured below)

| Ticket | Commit | Summary |
|---|---|---|
| **THS-63** | `a4d0468` | Concentration tax. Pure `computeConcentrationTax`: 40% mean pairwise corr + 40% PC1 (power iteration on cov matrix) + 20% supply-chain degree; percentile-ranked, scaled to [-15, 0]. Schema-expand: `supply_chain_deps` (26 curated edges across the AI stack) + `concentration_history`. Cron Sat 22:35 UTC. 9 tests including NVDA/TSM acceptance. |
| **THS-64** | `2848b59` | Backtest harness. Pure `runBacktest`: walk-forward, top-N equal-weighted, lookahead-safe, partial-coverage scaling, one-way cost per turnover. Edge function `run-backtest` reads scores_history + prices_raw, derives month-end closes. NOT on cron (explicit trigger, body `{start, end, top_n, cost_bps}`). 9 tests including lookahead-safety + known max-DD sequence. "±10% Sharpe replication of v2 hand-scoring" acceptance bullet can't be tested locally — needs multi-year history. |

**Open follow-ons surfaced by THS-63:**
- Concentration tax not yet wired into composite/final score — application semantics (multiplicative / additive / tier-shift) needs Terry's call.
- `supply_chain_deps.edge_weight` column stored but unused (degree-count loader ignores it); weighted-degree is a small change if you want CEG's `weight=2` edge to count double.
- Fixture universe percentile-rank calibration is coarser than the real 50-name universe; if production calibration falls outside the spec's NVDA=-5 / TSM=-1 target after first cron run, tune `blended/100 × -15` to a softmax or sqrt scaling to compress the extremes.

**Open follow-ons surfaced by THS-64:**
- No `backtest_runs` persistence — the report is the return value, not stored.
- "Factor attribution" output is top-line only; per-factor return decomposition would need the per-factor score series.
- `/weekly` route (mentioned in THS-66 spec) is not wired. Backtest JSON is ready to render there when THS-66 lands.

### Maintenance items carried forward (not addressed this session)

1. **Spec ↔ ticket reconciliation pass** (Terry's standing observation from PM session 5) — two known drifts: reserve target ($30K spec vs $20K ticket), and AIQ table arithmetic (GOOGL/ORCL corrected this session to per-dim sums). Worth a dedicated session to grep every numeric across spec/tickets/code and identify a single authoritative source per fact.
2. **PR #6 branch retitle** — currently named `claude/epic-4-portal-ui` but includes Epics 4–6 work. Cosmetic only.
3. **README session-start instructions** still reference build order Epic 1→6 but the build has now consumed most of it. Quick refresh worth doing alongside reconciliation.

---

## PM session 6 (2026-05-16) — Epic 4 close + Epic 5 burn-through: THS-57 / 58 / 60 / 61 / 62

### Shipped this session

| Ticket | Commit | What |
|---|---|---|
| **THS-57** | `6cf5858` | Tier movement log + alerts at `/decisions`. Schema-expand `alert_acks(alert_key PK, acked_at, acked_note)` — alerts are derived on read from `scores_history + macro_gauges`, only acks persist. 5 alert kinds (tier_change, conv_drop, aiq_drift, macro_flip, insider_cluster stub). Sidebar unseen-count badge wired via `getUnseenAlertCount()` threaded through ConditionalShell → Shell → Sidebar. Per-row expand + optional ack note. Fixture shows 4 canonical events. |
| **THS-58** | `2a61ab4` | M-score: 12-1 momentum + SUE + revision breadth per spec §Fix 2 (25/40/35 weights). Cross-sectional cohort. SUE v1 simplification = percentage-surprise instead of stdev-divided (documented; one-line swap when `consensus.fy1_eps_stdev` lands). Cron 22:40 UTC Sat. Composite loader now reads m_score (and s_score for THS-62). |
| **THS-60** | `df56f04` | Short interest + SUSI. `short_interest_raw` table with `susi_z` stored alongside the raw observation. Pure `computeSusi()` — z-score of latest vs trailing 24mo baseline, calendar-aware cutoff. FMP `/short-interest` fetcher with alias-tolerant normalizer. Bi-monthly cron (1st + 16th of each month). |
| **THS-61** | `e9d080a` | Insider Form 4 ingestion + cluster override detection. `insider_form4_raw` table. Pure `detectClusterOverride()` — BUY +5 / SELL -3 / neither, per-insider aggregate thresholds, 10b5-1 excluded from SELL count (null = conservatively included). FMP `/insider-trading` fetcher. Daily Mon-Fri cron. 12-month rolling-window acceptance test. |
| **THS-62** | `2413d64` | S-score: revisions delta + skew + SUSI + insider override (30/25/20/25). Cross-sectional. Bullish-higher convention (skew + SUSI negated). Partial-coverage rescaling — options_skew null until THS-59, so other three carry full weight in v1. Cron 22:42 UTC Sat, between M (22:40) and composite (22:45). |

**Final Saturday scoring lineup:** Q 22:00 · G 22:15 · V 22:30 · M 22:40 · S 22:42 · composite 22:45.

**Test suite:** 237 tests passing across `_shared/`. New tests this session: factor-m.test.ts (10), susi.test.ts (7), fmp-short-interest.test.ts (4), factor-insider.test.ts (14), fmp-insider.test.ts (4), factor-s.test.ts (10).

### Epic state after this session

- **Epic 1 Foundation** — Done (carried over)
- **Epic 2 Tier-A scoring** — Done (carried over)
- **Epic 3 AIQ + overlays + macro** — partly done (open: AIQ expand THS-47, dep flags expand THS-48)
- **Epic 4 Portal UI (THS-32)** — Done. All 7 sub-issues (THS-51..57) + the auth sub-ticket THS-68 closed.
- **Epic 5 Tier-B scoring** — functionally complete with one vendor-blocked sub-issue (THS-59 options). M, SUSI, insider, S-composite all shipped.

### THS-59 needs Terry's input (vendor decision)

THS-59 (options surface ingestion: 25Δ skew, P/C ratio, IV term) is blocked on choosing **Polygon vs Tradier vs broker API**. Without that pick, options ingestion can't ship and S-score's `options_skew` signal stays null (which is fine — partial-coverage rescaling handles it; the three other signals carry full weight). Decision factors:

| Vendor | Cost | Strengths | Notes |
|---|---|---|---|
| **Polygon.io** | $79/mo Starter (options endpoints) | Best coverage, generous rate limit, REST + WebSocket | Standalone — no broker dependency |
| **Tradier** | Free with funded broker account | Solid options chains, real-time NBBO | Tied to broker; Terry would need a Tradier brokerage relationship |
| **Broker API** | Free with broker | Direct from execution venue, lowest latency | Schwab/IBKR — varies by broker; some require funded accounts |

Recommended default: **Polygon $79/mo** — vendor-independent, no broker tie-in, simplest to deploy. Schema, fetcher pattern, and cron job all mirror the existing FMP-based ingest functions (1-day implementation once Terry green-lights).

### Open follow-ons surfaced this session (in priority order)

1. **THS-59 options vendor decision** (above) — only Epic 5 sub-issue not yet shipped.
2. **THS-69 VIX daily ingestion** — already opened last session; unblocks `/portfolio` trigger 2b.
3. **SUE stdev** — `consensus.fy1_eps_stdev` column + ingestion; would replace M-score's percentage-surprise proxy with classical SUE. One-line swap in `computeSue()`.
4. **10b5-1 backfill** — fetch SEC link footnotes from `insider_form4_raw.source_url`, parse 10b5-1 indicators, back-fill `is_10b5_1`. Until this lands, real 10b5-1 sales may inflate SELL cluster counts (one-sided over-detection, not missed signal).
5. **Insider cluster events into /decisions** — THS-57's `insider_cluster` alert kind is wired but stubbed; small follow-on can compute per-week clusters from `insider_form4_raw` and surface them.
6. **AIQ universe expansion** (THS-47) — adds NOW + INTU among the 50→70 names. One-line migration to start.

### Next-session cold-start: Epic 6 maintenance

Epic 6 sub-issues (THS-34 parent):
- **THS-63** Concentration tax (correlation matrix + supply-chain + PCA, capped at -15pts) — pure math, no vendor deps. NVDA → -5 test, TSM → -1 test.
- **THS-64** Backtest harness (walk-forward, 5y window, monthly rebalance, 10bps each side) — depends on enough price history in `prices_raw`.
- **THS-65** Sonnet daily memo cron 8am CT — **needs LLM integration choice + Anthropic API key**.
- **THS-66** Opus weekly ranking cron Sun eve — same LLM dependency.
- **THS-67** Quarterly review checklist — pure orchestration.

**Build order:** THS-63 → THS-64 are pure-math, autonomous. THS-65 / THS-66 need Terry's API-key decision (Anthropic Console key vs Bedrock vs Vertex). THS-67 can land last.

Branch: still on `claude/epic-4-portal-ui` (PR #6) — the branch name is now historical (Epic 4 long since closed); current head includes Epic 5 work. Worth retitling the PR to "Epics 4-5: portal UI + Tier-B scoring" before merge; otherwise no functional concern.

---

## PM session 5 (2026-05-16) — Epic 4 continuation: THS-55 + THS-56 + spec reconciliation

### Shipped this session

| Ticket | Commit | What |
|---|---|---|
| **THS-55** | `5c88ba9` | Portfolio dashboard `/portfolio`. Schema-expand for `portfolio_settings` (singleton, $100K/$20K seeded) + `portfolio_positions` (PK FK universe; soft-close via `closed_at`). Page: AggregateBar (5 KPIs) · PositionsTable (per-row close + drawdown highlight ≥7%) · ReservePanel (gauge + 3 triggers: position drawdown >7%, SPY -5% single-day, **VIX stub pending**) · AddPositionForm (UPSERT-by-ticker for averaging-in). `revalidate = 300` ISR. RLS `authenticated`-only on both new tables. |
| **THS-56** | *(this commit)* | Regime panel `/regime`. Reads `macro_gauges` (no migration — uses existing E25 schema). MultiplierBanner (active multiplier + gates-hit count + 0/1/2/3-gate curve). Three GaugeCard tiles (NAAIM, AAII 3wk, F&G) with current reading, 12-month sparkline, threshold dashed line, fired chip if gate currently hit, threshold-crossing summary footer. Fixture mode synthesizes 52 weeks landing on spec §Part 2 May 14 reading (NAAIM 96.67 / AAII 5.36 / F&G 66 → 1 gate → 0.95×). `revalidate = 1800` (weekly cadence makes anything tighter wasted). |
| **THS-69** | *(Linear-only)* | New sub-issue of E3 macro ingest: VIX daily ingestion (FMP `/historical-price-full/^VIX`, fall back to CBOE). Unblocks portfolio trigger 2b. |
| **Docs** | *(this commit)* | Algorithm spec §Score table: GOOGL AIQ 74 → 75 and ORCL AIQ 60 → 52 (per-dim sums authoritative; spec table previously had arithmetic drift). Composite column values left alone — they're a doc approximation that doesn't fully reconcile with the published L2 weights either way; recomputation is the live engine's job. Editorial notes added under both rationales. |

### Spec ↔ ticket reconciliation observation (Terry)

> "Items 1 and 4 are signals the algorithm spec doc has drifted from the live tickets. Worth tightening at some point — when you're ready, ask Claude Code to do a 'spec ↔ ticket reconciliation pass' as a separate session, identifying every numeric or scope mismatch and proposing a single authoritative source per fact. Not now, but on the maintenance list."

Two drifts surfaced this session, on the maintenance list:
1. **Reserve target.** Algorithm spec §Position-construction guardrails says 30% reserve ($30K); THS-55 ticket says $20K. Used $20K (settings row is editable in one SQL). Authoritative source decision pending.
2. **AIQ table arithmetic.** GOOGL spec table = 74 but per-dim sum = 75; ORCL spec table = 60 but per-dim sum = 52. Per-dim sums are authoritative (more documented rigor). Spec table updated this session for these two; the composite column values were left alone since the L2 weight formula on file (Q=32 G=22 V=14 AIQ=14 rescaled to sum to 1) doesn't reconcile with the published composites cleanly either way — those are doc approximations to begin with and the live engine computes the canonical numbers.

**Future reconciliation session checklist (when Terry triggers it):**
- Every numeric in the spec doc table (composites, finals, conc-tax, position size $) cross-checked against `compute-composite-scores` outputs
- $20K vs $30K reserve resolved with one authoritative number
- Per-name rationale paragraphs cross-checked against per-dim AIQ sums in `20260516000000_e31_aiq_rubric_seed.sql`
- Output: a `docs/spec-reconciliation.md` listing every fact and its single source of truth

### THS-55 deviations + open follow-ons

1. **VIX trigger 2b** — stubbed as "data pending" in ReservePanel. Live state lands when THS-69 ships.
2. **No "fundamental news" carve-out on trigger 1** — current behavior fires on any -7% drawdown regardless of news. Confirmed default: keep current, surface as alert with "news context unknown" annotation, revisit when THS-59 news ships.
3. **Reserve drift** — see reconciliation observation above.

### THS-56 deviations + open follow-ons

1. **No per-gauge hover popover** — the ticket says "hover shows historical instances at each threshold". Shipped as a per-card footer chip showing total-crossings + last-crossing-date instead of a hover popover, which serves the same informational need without the design lift of an absolute-positioned overlay. Revisit if Terry wants the literal hover treatment.
2. **No live ingestion** — `macro_gauges` is operator-curated weekly per the THS-45 migration. Live NAAIM XML / AAII / CNN F&G ingestion has been a queued open question since PM session 3. Page renders fine on operator-curated rows; live ingestion is a separate Epic 3 ticket.
3. **Gates calculated UI-side, not from `scores_history.macro_gates_hit`** — the page computes gates from the latest `macro_gauges` row directly so the panel works even when no scores have been computed yet. Cross-check: when a `scores_history` row exists for the same as_of, its `macro_gates_hit` should equal the panel's count (mirrors `composite.ts::countMacroGates`).

### Next-session cold-start: THS-57 Tier movement log + alerts

THS-55 and THS-56 shipped end-to-end this session. Build order next: **THS-57** Tier movement log (and decisions log) at `/decisions`. Acceptance per ticket: shows tier transitions over time (e.g. AVGO moved L1 High → L1 Medium 2026-04-12 on G-score downgrade), with timestamp, factor that drove the move, and a "Mark reviewed" annotation flow.

**Implementation sketch:**
1. Fetcher reads `scores_history` for all tickers, computes per-week tier transitions (compare each as_of to the prior one for the same ticker)
2. Schema-expand for an `annotations` table (or `decisions` per the existing `/decisions` route stub): `(id, ticker, as_of, kind, note, created_at)` — kind: "reviewed" / "memo-linked" / "trade-action"
3. Page at `/decisions` (existing stub) — transitions list filtered by time range + ticker + "needs review" flag, plus an annotation form
4. Right rail: filter chips (tier-change kind, layer, named-only)

Branch: continue on `claude/epic-4-portal-ui` (PR #6). Stack THS-57 onto THS-56 head.

---

## PM session 4 (2026-05-16) — Epic 4 burn-through: THS-52 / 53 / 68 / 46 / 54

### Shipped this session

| Ticket | Commit | What |
|---|---|---|
| **THS-52** | `59b04ef` | Universe table page (`/universe`). Sortable + filterable table of 50 names. Columns: ticker · name · layer chip · composite · final · tier badge · Q/G/V/AIQ mini-bars · Δw · macro flag. Three filter surfaces (header search + layer chips + tier chips in right rail); rail registers `universe-filter` key via layout effect. Row click → `/universe/[ticker]` (THS-53 stub). Data path: `getLatestUniverseScores()` joins `universe` (active) with latest + prior `scores_history` rows per ticker; deterministic synthesized fixture fallback when env unset or DB empty (clearly labeled). Skipped virtualization — 50 rows native well under the 500ms target. Build + lint clean, `/universe` 200 in 33ms. |
| **THS-68** | `476e09d` | **NEW SUB-TICKET** — magic-link auth gate. `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`) refreshes Supabase session on every navigation and redirects unauthenticated to `/login?next=<path>`. `/login` server-action sends OTP; `/auth/callback` exchanges code → session cookie; `/logout` signs out. Root layout reads user via `getUser()` (validated, not cookie-only). TopBar shows email chip with click-to-logout. `ConditionalShell` skips chrome on `/login` + `/auth/*` + `/logout`. No-op when env unset so fixture dev still works. Unblocks every write-path screen (THS-54, THS-57, THS-46/47/48 admin entry). |
| **THS-46** | `166a177` | AIQ rubric seed for 18 of 20 spec hand-scored names. NOW + INTU aren't in the active universe seed (FK rejects) — flagged as open follow-on. 10 names get explicit per-dim breakdowns from spec rationale (TSM, NVDA, AVGO, VST, GEV, GOOGL, ANET, PLTR, ORCL, META). 8 names (CEG, VRT, MSFT, AMZN, CRWD, SNOW, ASML, LRCX) get derived breakdowns proportional to dim caps; rows tagged "approximate". Two source-doc arithmetic discrepancies (GOOGL spec=74 vs dims=75, ORCL spec=60 vs dims=52) — used per-dim sums. End-of-migration assertion DO block raises with offending ticker on drift. |
| **THS-54** | `bbfae8f` | AIQ rubric editor at `/aiq/[ticker]` + audit history side panel. 6 dim inputs (0-20 / 0-15) with live total, per-dim notes textareas, source URL, general notes. Server-action `saveAiqRubric` UPSERTs on `(ticker, scored_at=today)` — same-day re-save overwrites in-progress; next-day creates new audit row. History panel shows last 20 versions with per-dim delta chips. Schema-expand: `20260516000100_e44_aiq_rubric_extend.sql` adds 6 per-dim note columns + source_url. `/universe/[ticker]` AIQ panel gets an "Edit" chip cross-link. |
| **THS-53** | `7aa4a24` | Per-name detail page replacing the THS-52 stub. Header (composite / final / tier / macro), Q/G/V/AIQ factor panels reading sub-decomp from `scores_history.factor_breakdown` JSONB, 6-dim AIQ rubric, 12-week composite + final sparkline (pure SVG, no chart lib), depreciation flags list (L2-only per spec). Form 4 / news / sentiment ship as "Data pending" stubs — no ingestion yet, flagged THS-58/59/60 follow-on. Route kept as `/universe/[ticker]` (Terry confirmed) rather than the ticket's `/n/[ticker]`. Extracted shared universe seed into `web/src/lib/universe-fixture.ts`. `/universe/NVDA` 200 in 126ms. |

**Files of note:**
- `web/src/lib/supabase/{client,server}.ts` — `@supabase/ssr` clients; return `null` when env unset so dev with fixtures works
- `web/src/lib/universe-data.ts` — fetcher + fixture (the L1/L2/L3/L4/L5 seed keyed off `20260515000200_e13_seed_universe.sql`)
- `web/src/components/universe/{UniverseTable,UniverseFilterRail,TierBadge,LayerChip,MiniBar}.tsx`
- `web/src/hooks/universe-filter-context.tsx` — shared filter state across page + rail (lifted to Shell so the right-side CtxPanel and the canvas table reference the same source of truth)
- `web/src/app/universe/layout.tsx` — registers rail key on mount via `useCtxPanel().setRail("universe-filter")`; restores to `agent` on unmount

**Deviations from THS-52 acceptance criteria:**
1. Skipped virtualization (`<500ms` target met without it on 50 rows; revisit if profiling shows need)
2. "70 names" in acceptance criteria → 50 (seed universe is 50, Terry-confirmed in migration comments)

### Next-session cold-start: THS-55 Portfolio dashboard

THS-54 blocker resolved end-to-end this session — auth + AIQ seed + editor all shipped. Next in build order is **THS-55** (Portfolio dashboard). It's read-only like THS-52/53, so the pattern is well-established:

1. Fetcher in `web/src/lib/portfolio-data.ts` reading `scores_history` joined with whatever position-sizing table the algorithm spec defines (need to grep — may need schema-expand for actual position weights / cash reserve)
2. Page at `web/src/app/portfolio/page.tsx` replacing the THS-51 stub
3. Right-rail registers `portfolio-rail` for whatever filters/summary belongs there per spec
4. Components: position table, allocation chart, cash/reserve summary

Branch: continue on `claude/epic-4-portal-ui` (PR #6). Stack THS-55 onto THS-54 head.

### Resolved blocker (was: THS-54 batched question)

The next ticket in build order is **THS-54** (AIQ rubric editor at `/aiq/[ticker]`). It's a **write path** — saves new rows into `aiq_rubric` for audit history. Two real blockers stop me from shipping it autonomously:

1. **Auth gate not wired yet.** RLS on `aiq_rubric` is `authenticated`-only (`20260515000100_e12_overlay_tables.sql:118`). An anon browser can't write. Magic-link login was deferred from THS-51 as "follow-on (likely THS-51b)" but never broken out as a ticket.
2. **AIQ rubric seed not shipped.** THS-46 (AIQ seed migration) is still pending — listed in PM session 3 queued question #3. The editor surface can render against empty state, but until THS-46 lands, the audit-history side panel has nothing prior to diff against.

**Three options, recommended default in brackets:**
1. **(rec)** Ship **THS-51b: magic-link login** as a one-shot ticket → then THS-46 (15-min seed migration) → then THS-54. Unblocks every write-path screen (THS-54, THS-57 decision log, THS-46/47/48 admin entry).
2. Skip THS-54 for now; do THS-55 (Portfolio dashboard) + THS-56 (Regime) + THS-57 (Decision log) which are read-only. Come back to THS-54 with auth in a later epic.
3. Ship THS-54 with a "service-role from admin endpoint" backdoor for v1 single-tenant. Worst option — defers proper auth, ugly bypass pattern.

**Standing recommendation:** option 1.

### Open follow-on tickets surfaced this session (THS-53 deliverables)

- **THS-58** — Insider Form 4 ingestion + display (SEC EDGAR feed, weekly cadence)
- **THS-59** — News ingestion + display (likely Polygon/FMP news endpoint)
- **THS-60** — Sentiment timeline (news-derived sentiment over the 12-week window)

Each currently renders as a "Data pending" stub card on `/universe/[ticker]`.

### Prior session: THS-53 cold-start (now done — see commit `7aa4a24`)

**Goal:** Per-name detail page. Ticket says route is `/n/[ticker]` but I shipped `/universe/[ticker]` stub in THS-52 (the convention `/universe → /universe/[ticker]` matches the rest of the app — judgment call within the references). **Open question — keep `/universe/[ticker]` or move to `/n/[ticker]`?** Recommend keep.

**Sections per spec:**
1. Header — ticker · layer chip · current composite · tier badge · macro flag
2. Factor decomposition — Q/G/V/AIQ bars with hover-detail sub-components (drawn from `scores_history.factor_breakdown` JSONB)
3. AIQ rubric breakdown — 6 dimensions (data: `aiq_rubric_scores` table)
4. Depreciation flags if applicable (data: `depreciation_flags` table — only L2 names per seed)
5. Score history sparkline — 12 weeks (data: `scores_history` time series for the ticker)
6. Insider Form 4 list (data: **no schema yet** — needs new ingestion ticket)
7. Recent news (data: **no schema yet** — needs new ingestion ticket)
8. Sentiment timeline stubbed

**Acceptance:** all sections render for any of 20 hand-scored names; loads <800ms.

**Honest data-gap inventory (read first before sizing):**
- `scores_history.factor_breakdown` exists in schema (`20260515000100_e12_overlay_tables.sql`) — populated by `compute-composite-scores` Saturday cron — empty in dev without a deployed project. **Fixture pattern from THS-52 reuses cleanly.**
- `aiq_rubric_scores` — **blocked on THS-46** (AIQ seed migration). Can ship the surface against a fixture and wire when THS-46 lands. (Or do THS-46 first — it's a simple seed migration, see queued question #3 in PM session 3 notes.)
- `depreciation_flags` — partly seeded in THS-43; THS-48 expands the seed to all L2 names. Ship surface against partial seed.
- Form 4 / news / sentiment — **no schema, no ingestion** yet. Recommend: render as "Data pending" stub blocks with placeholder skeletons; spawn follow-on tickets THS-58 (Form 4) + THS-59 (news) explicitly out of scope here.

**Recommended scope cut for v1:**
- Header (1) + factor decomposition (2) + AIQ rubric (3) + depreciation flags (4) + sparkline (5) ship real
- Insider Form 4 (6) + news (7) + sentiment (8) ship as "Data pending" placeholder cards, with notes in the PR description for follow-on tickets

**Implementation plan:**
1. Fetcher `getNameDetail(ticker)` in `web/src/lib/name-detail-data.ts` — pulls latest `scores_history` row (incl. `factor_breakdown` JSONB) + last 12 weeks of composite (sparkline) + `aiq_rubric_scores` + `depreciation_flags` for ticker. Fixture fallback for each piece.
2. Page at `web/src/app/universe/[ticker]/page.tsx` (replace the THS-52 stub). Server-side data fetch via `getSupabaseServer()` — fall back to client-side fixture if env unset.
3. Components in `web/src/components/name/`:
   - `NameHeader.tsx` — ticker · name · layer chip · final score · tier badge · macro flag (reuses TierBadge / LayerChip)
   - `FactorPanels.tsx` — Q/G/V/AIQ panels with sub-factor breakdown (rendered from `factor_breakdown` JSONB shape; check `supabase/functions/_shared/composite.ts` for the exact shape)
   - `AiqRubric.tsx` — 6-dim breakdown
   - `DepFlagsList.tsx` — only renders if ticker has dep flags
   - `Sparkline.tsx` — 12-week composite line; tiny SVG, no chart lib (per the "don't add libs casually" rule)
   - `DataPendingCard.tsx` — reusable stub block for Form 4 / news / sentiment
4. Right rail registers `name-detail` key — initial content: decision history thread placeholder (drives /decisions, THS-57)

**Files to create/edit list (~10 files); est. 2-3 hours.**

**Branch:** continue on `claude/epic-4-portal-ui` (PR #6). Stack THS-53 commit onto THS-52 head.

---

## PM session 3 (2026-05-15) — Epic 3 kickoff: THS-49 live macro ingest

### Shipped this session

| Ticket | Commits | What |
|---|---|---|
| **THS-49** | `facf3e5` + `020c999` | Live macro gauges ingest end-to-end. New `_shared/macro.ts` (pure parsers + forward-fill row builder), `_shared/macro-fetchers.ts` (HTTP shells with browser headers), `ingest-macro` edge function (daily + backfill modes), daily cron 21:45 UTC. Codex PR review caught two bugs: P1 backfill was clobbering the curated May 14 seed; P2 same-week fallback was writing raw single-week spread as a 3-wk MA. Both fixed in `020c999` — buildMacroRow priority is now `live → existing → previousRow → null`. |
| **THS-50** | `8815d01` | Macro multiplier sanity check. Math + integration already shipped in Epic 2 (`composite.ts` + `compute-composite-scores`); this ticket adds the spec-cited May 14 2026 acceptance test (NAAIM 96.67, AAII 5.36, F&G 66 → 0.95), a tier-reclassification test (78 raw × 0.95 = 74.1 → drops High → Medium), and a "<75 never de-rated" invariance test. |
| **THS-51** | `14314ee` + `f6cf589` | Epic 4 kickoff — `web/` subapp scaffolded by porting Reticle's chrome (Sidebar / TopBar / CtxPanel / CmdPalette / ShortcutsOverlay / GoToPill / ThemeSwitcher / Tip + tweaks panel + primitives + overlays + design tokens) onto AI Thesis. Stack: Next.js 16.2.6 + React 19.2.4 + Tailwind v4 + Supabase SSR + Geist/Geist_Mono. 8 routes mounted (/, /universe, /portfolio, /regime, /aiq, /memos, /decisions, /settings) — each renders a `PageStub` proving the shell boots. Build clean. Codex caught GoToPill still showed Reticle's old G-prefix hints — fixed in `f6cf589`. Branch: `claude/epic-4-portal-ui` → PR #6 (stacked on PR #5). |

### THS-52 cold-start (next ticket — Urgent priority)

**Goal:** Universe table page (`/universe`). Columns: ticker · name · layer · composite · tier badge · Q/G/V/AIQ mini-bars · prior-week delta · macro flag. Sortable + filterable, sticky header, row click → /universe/[ticker]. Acceptance: 50 names < 500ms; sort + filter responsive.

**Visual reference:** Reticle Routines/Delegations row treatment (Terry confirmed in PM session 3). Local screenshots in `design-references/01-base-reticle-screenshots/`. The Reticle web codebase was uploaded as a zip earlier (extracted to `/tmp/reticle/` — gone after container restart). Components to mine if Terry re-uploads: `web/src/components/{routines,delegations}/{Row,Group,ColHead,RowExpansion}.tsx`.

**Implementation plan:**
1. **Supabase browser client** — `web/src/lib/supabase/client.ts` reading `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Single-tenant; anon role + RLS does the protection. Use `@supabase/ssr` (already in deps).
2. **Data fetcher** — `getLatestUniverseScores(asOf?)`: join `universe` (active investable) with the latest `scores_history` row per ticker. Returns `{ticker, name, layer, composite, final_score, tier, q, g, v, aiq, prior_composite, macro_gates_hit, macro_multiplier}`. **Note: real scoring data only exists after Saturday cron runs against a deployed project.** Ship with a fixture fallback so the table renders during dev when DB is empty.
3. **UniverseTable component** at `web/src/components/universe/UniverseTable.tsx`. Sticky header, hairline dividers, hover row-actions, mono tabular figures. Sortable columns via local state.
4. **Primitives** — `TierBadge` (High/Medium/Low/Avoid + color), `MiniBar` (0-100 horizontal bar for Q/G/V/AIQ), `LayerChip` (L1-L5).
5. **Filter chips in right rail** — extend `CtxRailKey` with `"universe-filter"`, set on `/universe` mount, render in `CtxPanel`.
6. **TopBar filter input** — wire `FilterProvider.q` to filter rows by ticker substring.
7. **Row click → `/universe/[ticker]/page.tsx`** — stub for THS-53; render PageStub for now.
8. **Skip virtualization** — 50 rows native is well under 500ms target. Add only if profiling shows need.

**Files to create:**
- `web/src/lib/supabase/{client.ts, server.ts}`
- `web/src/lib/universe-data.ts` — fetcher + fixture
- `web/src/components/universe/{UniverseTable.tsx, UniverseFilterRail.tsx, TierBadge.tsx, MiniBar.tsx, LayerChip.tsx}`
- `web/src/app/universe/[ticker]/page.tsx` — THS-53 stub
- `web/src/app/universe/layout.tsx` — set right-rail key

**Files to edit:**
- `web/src/app/universe/page.tsx` — replace stub with real surface
- `web/src/hooks/ctx-panel-context.tsx` — extend `CtxRailKey` union
- `web/src/components/shell/CtxPanel.tsx` — branch on rail to render filter when active

**Acceptance check at end:**
- `cd web && npm run build` clean
- `next start` → `/universe` renders 50 rows from fixture
- Sorting toggles work, filter chips work, ticker search filters

Branch: continue on `claude/epic-4-portal-ui` (PR #6) — no need to branch off; stack THS-52 commits onto the THS-51 head.

Branch: `claude/epic-3-overlays` (off `claude/epic-2-tier-a-scoring` head — same stacking pattern PR #4 used vs PR #2, since Epic 3 schema depends on Epic 2's `macro_gauges` table).

### Live-feed reality vs spec (THS-49 deviations to flag)

1. **NAAIM** — spec cites `…/wp-content/uploads/2017/04/exposure-index.xml`. That URL now 404s; NAAIM ships a versioned XLSX per week with a date in the path that changes weekly. Switched to scraping the public Exposure Index page's inline HTML data table (Date | Mean | Bearish | Q1 | Q2 | Q3 | Bullish | Deviation). Table carries the 10 most recent weekly readings; that's enough for the daily ingest. Backfilling more than ~10 weeks requires downloading the weekly XLSX and parsing — deferred.
2. **CNN F&G** — spec says "via Perplexity". Going direct: `https://production.dataviz.cnn.io/index/fearandgreed/graphdata` returns ~252 daily history points; requires `User-Agent`, `Origin: https://www.cnn.com`, `Referer: https://www.cnn.com/` (without them returns HTTP 418 "I'm a teapot"). Strictly better than LLM-mediated scrape: free, no API key, no parse hallucination risk. **Flagged for Terry's confirmation.**
3. **AAII** — spec wants weekly Thursday cron. AAII's public sentiment page is behind Imperva bot protection (`/sentimentsurvey/sent_results` returns the "Pardon Our Interruption" interstitial regardless of headers — JS challenge). Cannot be fetched headlessly without a paid scraping service or Perplexity dep. **v1 ships AAII as operator-curated forward-fill**: the function reads the most recent `macro_gauges.aaii_3wk_spread` on every daily run and persists it; the operator overrides on Thursdays either by SQL update or by invoking `ingest-macro` with `{"aaii_3wk_spread": <number>}` in the POST body. THS-49 acceptance "weekly AAII cron running" is therefore **partial**: cron infra runs daily but AAII update is manual.

### Saturday/daily pipeline (updated)

| UTC | Cadence | Job | Notes |
|---|---|---|---|
| 21:00 | Mon-Fri | `ingest-prices` | Daily OHLCV + momentum view refresh |
| 21:30 | Mon-Fri | `ingest-consensus` | Daily analyst snapshot + forward_pe_history refresh |
| 21:45 | **Daily** | **`ingest-macro`** | **NAAIM + F&G live; AAII forward-fill** |
| 22:00 | Sat | `compute-q-scores` | Q-score |
| 22:15 | Sat | `compute-g-scores` | G-score |
| 22:30 | Sat | `compute-v-scores` | V-score |
| 22:45 | Sat | `compute-composite-scores` | Reads latest `macro_gauges` row written by 21:45 macro job |

### Operator first-run for macro (append)

```bash
supabase functions deploy ingest-macro

# 12-month backfill (NAAIM + F&G; AAII forward-fills from existing seed):
supabase functions invoke ingest-macro --no-verify-jwt \
  --body '{}' \
  -H "Content-Type: application/json" \
  -- "?backfill_days=365"

# Thursday flow (operator-curated AAII update — AAII publishes Thursdays):
supabase functions invoke ingest-macro --no-verify-jwt \
  --body '{"aaii_3wk_spread": 5.36}'
```

### Migration ledger additions

| 20260515002500 | THS-49 | `ingest-macro` daily cron 21:45 UTC |

### Queued questions for Terry (batch ask)

1. **CNN F&G — direct vs Perplexity.** Recommendation: direct (free, simpler, in-place). Spec says Perplexity. (Coupled to #2 — if Perplexity gets provisioned for AAII, easy to also route F&G through it.)
2. **AAII live ingestion strategy.** Three options:
   - **(rec, status quo)** Keep operator-curated forward-fill. AAII publishes Thursdays; manual `{"aaii_3wk_spread": X}` POST once/week is 60s of work. Avoids a new external dep.
   - Add Perplexity API as new dep (`PERPLEXITY_API_KEY`). Unblocks both AAII and the spec-literal F&G path. Adds external dep + per-call LLM cost.
   - Add a headless-browser scraping dep (ScraperAPI/Browserless/Apify). Adds external dep + per-call cost. Pure scrape, no LLM parse.
3. **THS-46/47/48 admin landing** (carried over from prior session). For per-name data entry (AIQ rubric scoring, depreciation flag updates, AI segment overrides):
   - **(rec)** Seed-only migrations — versioned in git, no UI dep, slow to update; fine if updates are quarterly.
   - Supabase Studio inline forms — no code, fast updates, no git audit trail.
   - Dedicated admin page — Epic 4 dependency; best UX + audit trail but Epic 4 not started.

### Spec deviations flagged in code (cumulative, +1 this session)

- `factor-q.ts` safety pillar uses `+altman_z` (not `-altman_z` per pseudocode).
- `factor-g.ts` L4 falls back to overall TTM revenue / TTM capex (MW pipeline data unavailable).
- `factor-v.ts` only ships `mid` maintenance-capex band.
- `composite.ts` strengthens "Tier-A rescale" to "drop any null factor and rescale remaining."
- **NEW** `macro.ts` + `ingest-macro` go direct to NAAIM page scrape and CNN F&G JSON instead of Perplexity-mediated. AAII is operator-curated forward-fill in v1.

### Epic 3 status after this session

| # | Ticket | What | Status |
|---|---|---|---|
| 1 | THS-46 | AIQ rubric 20-name seed | Not started — data entry, waits on admin landing decision |
| 2 | THS-48 | Depreciation flags for all L2 names | Partial (META + ORCL seeded; need AMZN/GOOGL/MSFT/AVGO if applicable) |
| 3 | **THS-49** | **Live macro ingestion** | **Done** (NAAIM + F&G live; AAII operator-curated v1) |
| 4 | **THS-50** | **Macro multiplier** | **Done** — spec May 14 acceptance test green; multiplier wires through to `final_score` and tier reclassification correctly. |
| 5 | THS-47 | AIQ expansion 20 → 50 names | Not started — data entry; depends on operator scoring |

**Next ticket:** THS-46/47/48 are data entry that wait on Terry's admin-landing decision. If those are deferred, jump to Epic 5 (Tier-B Scoring: momentum + sentiment) — real engineering work, no blockers.

---

## PM session 2 (2026-05-15) — Epic 2 closed end-to-end

### THS-43 (V) + THS-45 (composite) shipped

Continuing from the THS-42 checkpoint above, the rest of Epic 2 landed in two more commits:

- `6037434` — **THS-43 V-score:** schema-expand `fundamentals_raw.depreciation_and_amortization`; `forward_pe_history` matview (prices × consensus, refreshed at the tail of `ingest-consensus`); `depreciation_flags` seed (META −12, ORCL −7); pure V math (PEG-like + adj FCF yield + own-history fwd P/E z with <90/<365/365+ graceful degradation bands + §Fix 5 penalty, clamped to [−12,0]); `compute-v-scores` edge function; weekly cron Sat 22:30 UTC.
- `643ad68` — **THS-45 composite:** `LAYER_WEIGHTS` per §Part 3; missing-factor-tolerant rescale (drops any null factor and rescales the rest to sum 1.0); §Fix 4 Bayesian macro multiplier; tier cut-points ≥75/≥60/≥45; `macro_gauges` table + `upsert_composite_score` RPC; `compute-composite-scores` edge function; weekly cron Sat 22:45 UTC.

**Epic 2 parent THS-30 marked Done.** Tests 161/161 in `_shared/*.test.ts`.

### Saturday scoring pipeline (final order)

| UTC | Job | Queries | Writes |
|---|---|---|---|
| 22:00 | `compute-q-scores` | 5 | `q_score` + `factor_breakdown.q` |
| 22:15 | `compute-g-scores` | 4 | `g_score` + `factor_breakdown.g` |
| 22:30 | `compute-v-scores` | 6 | `v_score` + `factor_breakdown.v` |
| 22:45 | `compute-composite-scores` | 4 | `composite` + `final_score` + `tier` + `macro_*` + `factor_breakdown.composite` |

All four use `upsert_factor_score` or `upsert_composite_score` (both SECURITY DEFINER, service-role only, JSONB-merge-aware) so peer slices in `factor_breakdown` survive. **Critical pattern: any future per-factor or composite writer MUST use these RPCs, never `.upsert()`.**

### Cumulative Epic 2 ledger (migrations 20260515001000–002400)

| Timestamp | Ticket | Purpose |
|---|---|---|
| 001000 | THS-41 | fundamentals_raw +8 columns (QMJ) |
| 001100 | THS-41 | Q cron Sat 22:00 |
| 001200 | THS-42 | ai_segment_overrides table |
| 001300 | THS-42 | seed: NVDA + AVGO |
| 001400 | THS-42 | fundamentals_raw +r_and_d_expense |
| 001500 | THS-42 | upsert_factor_score RPC (JSONB merge) |
| 001600 | THS-42 | G cron Sat 22:15 |
| 001700 | THS-43 | fundamentals_raw +depreciation_and_amortization |
| 001800 | THS-43 | forward_pe_history matview |
| 001900 | THS-43 | refresh_forward_pe_history RPC |
| 002000 | THS-43 | seed: META + ORCL depreciation_flags |
| 002100 | THS-43 | V cron Sat 22:30 |
| 002200 | THS-45 | macro_gauges table + seed (May 14 2026) |
| 002300 | THS-45 | upsert_composite_score RPC |
| 002400 | THS-45 | Composite cron Sat 22:45 |

### Operator first-run additions (append to existing list)

```bash
# In addition to ingest-* functions already covered in earlier notes:
supabase functions deploy compute-q-scores compute-g-scores compute-v-scores compute-composite-scores

# To trigger Tier-A scoring manually before first cron tick:
supabase functions invoke compute-q-scores         --no-verify-jwt --body '{}'
supabase functions invoke compute-g-scores         --no-verify-jwt --body '{}'
supabase functions invoke compute-v-scores         --no-verify-jwt --body '{}'
supabase functions invoke compute-composite-scores --no-verify-jwt --body '{}'

# v1 macro_gauges is operator-curated — insert a weekly row before composite runs:
psql "$DATABASE_URL" -c "INSERT INTO macro_gauges (as_of, naaim, aaii_3wk_spread, fear_greed)
                          VALUES (CURRENT_DATE, <naaim>, <aaii>, <fg>);"
```

### Spec deviations flagged in code (cumulative)

- `factor-q.ts` safety pillar uses `+altman_z` (not `-altman_z` per pseudocode); negating would invert pillar intent.
- `factor-g.ts` L4 falls back to overall TTM revenue / TTM capex (contracted MW pipeline data isn't in any provider).
- `factor-v.ts` only ships `mid` maintenance-capex band; `low` needs 5y pre-AI history we don't have, `high` is one-line addition.
- `composite.ts` strengthens "Tier-A rescale" to "drop any null factor and rescale remaining" — same behavior in the spec's stated case (M/S null) plus graceful degradation for unexpected single-factor nulls.

### Epic 3 (Overlays) — kickoff plan

**Parent ticket: THS-31 — "EPIC 3 — AIQ Rubric, Depreciation Flags, Macro Gate".**

**Build order (per THS-31 description):**

| # | Ticket | What | Status after Epic 2 |
|---|---|---|---|
| 1 | **THS-46** | AIQ rubric seeded with 20-name slate from §Part 3 | Not started — pure data entry into `aiq_rubric` (table exists from THS-36). Six dimensions per name from the spec's hand-scored AIQ values. |
| 2 | **THS-48** | Depreciation flags populated for all L2 names | **Partially done** — `depreciation_flags` seeded with META + ORCL in `20260515002000`. Need to add AMZN/GOOGL/MSFT/AVGO if applicable per §Fix 5. |
| 3 | **THS-49** | Macro gauge ingestion (live NAAIM/AAII/F&G fetchers) | **Table done** — `macro_gauges` table + RLS + operator-curated seed shipped in `20260515002200`. This sub-issue is now specifically about LIVE ingestion: NAAIM XML feed, AAII page scrape or API, CNN F&G. Probably a new daily edge function. |
| 4 | **THS-50** | Macro multiplier | **Done** — already shipped in `composite.ts` as `macroMultiplier(gauges)` + `countMacroGates`. The composite job applies it to High scores. Mark Done after a sanity check that the live-ingest THS-49 result feeds it correctly. |
| 5 | **THS-47** | AIQ expansion from 20 → 50 names | Not started — pure data entry; depends on operator scoring the remaining 30 names. |

**Overlap warning:** because Epic 2 shipped graceful-degradation fallbacks for everything Epic 3 was supposed to provide, large portions of Epic 3 are now *data entry* rather than code work. The one substantive code item left is THS-49 (live macro ingestion). Don't redo the macro multiplier math (THS-50) — it's in `composite.ts` and tested.

**Suggested Epic 3 ordering once you start:**
1. **THS-49 first** (real engineering work) — live macro ingestion edge function, daily cron, hooked into `macro_gauges`.
2. **THS-46 + THS-47 + THS-48** in parallel — three data-entry tickets that need operator validation more than they need Claude. If there's an admin UI in scope for any of these, that's Epic 4 (Portal UI) territory; Epic 3 v1 might just be raw SQL inserts.
3. **THS-50** — final sanity check + close-out.

Worth confirming with Terry before starting: is THS-46/47/48 supposed to land via Supabase Studio inline forms (manual), a dedicated admin page (Epic 4 dependency), or seed-only migrations? CLAUDE.md says "Make small design judgment calls in line with the references" — but admin surfaces aren't covered by Reticle/Basis Proforma. This is the kind of question to batch up.

Reticle base clone (see CLAUDE.md "Reticle base file" section) is needed before Epic 4 (Portal UI) but Epic 3 may or may not require it depending on the admin-UI decision above.

### Known operator-side validation gaps

| Gap | Verifies when |
|---|---|
| Hand-scored 20-name slate ±5 on Q/G/V | First FMP-key + DB run; iteration on math if off-spec |
| Weekly pass under 60 seconds | First live cron run; cron timeout set to 60s |
| `forward_pe_history` confidence bands | ≥90 days of joint price+consensus ingestion |
| Composite tier classification across cohort | First composite cron run with all four factors populated |
| `ai_segment_overrides` seed completeness | Operator adds remaining 18 slate names |
| `depreciation_flags` seed completeness | Operator adds AMZN/GOOGL/MSFT/AVGO if applicable |

---

## PM session 2 (2026-05-15) — Epic 2 sub-issues, continued

### Update at 2026-05-15 end-of-day

**THS-42 (G-score) shipped end-to-end on PR #4** in three additional commits after the schema piece:
- `fea294e` — `r_and_d_expense` column added to `fundamentals_raw`; wired through `FmpIncomeRow` + `mergeStatements` (no sign flip needed; R&D is reported positive).
- `9adecba` — full G ship: `factor-g.ts` pure math (NTM growth + layer-specific AI segment + layer-specific capex efficiency, 29 new tests), `loadGInputsByLayer` (4 queries: universe + 12 trailing quarters + latest consensus + ai_segment_overrides), `compute-g-scores` edge function, weekly cron Saturday 22:15 UTC.

**JSONB merge RPC (key cross-cutting change):**
- Naive `.upsert()` on `scores_history.factor_breakdown` replaces the column wholesale, so Q-then-G would wipe Q's `q` slice. Migration `20260515001500_e22_upsert_factor_score_rpc.sql` adds `upsert_factor_score(ticker, as_of, factor, score, breakdown)` — SECURITY DEFINER, service_role only, factor-name whitelist. Shallow-merges JSONB with `||` on conflict.
- `compute-q-scores` rewired to use the same RPC. **Every future per-factor compute function MUST use this RPC** — not `.upsert()` — or it'll silently overwrite peer factors' breakdowns.

**Tests:** 116/116 pass in `supabase/functions/_shared/*.test.ts`.

**Spec deviations flagged in code (cumulative):**
- `factor-q.ts` safety pillar uses `+altman_z` (not `-altman_z` per pseudocode). Flagged in module header.
- `factor-g.ts` L4 capex efficiency falls back to overall TTM revenue / TTM capex when the override table doesn't carry MW pipeline data. Flagged in module header.
- `factor-g.ts` L3/L4/L5 without a curated override row produce correlated AI-segment and capex-efficiency signals (same numerator and denominator). Pillar ranking still correct, just lower variance.

### Migration ledger additions (this session, cumulative)

| 20260515001000 | THS-41 | E2.1 prep: `fundamentals_raw` +8 columns for QMJ |
| 20260515001100 | THS-41 | E2.1 weekly Q-score cron |
| 20260515001200 | THS-42 | E2.2 `ai_segment_overrides` table |
| 20260515001300 | THS-42 | E2.2 seed: NVDA + AVGO |
| 20260515001400 | THS-42 | E2.2 prep: `r_and_d_expense` column |
| 20260515001500 | THS-42 | E2.2 `upsert_factor_score` RPC (JSONB merge) |
| 20260515001600 | THS-42 | E2.2 weekly G-score cron |

### THS-43 (V-score) — what needs to land

Per Terry's directions earlier this session:
1. **`forward_pe_history` materialized view** = `prices_raw × consensus` joined on `(ticker, date=as_of)`, computing `close / NULLIF(ntm_eps, 0)`. Indexed `(ticker, date DESC)` for fast 5y window scans. Refresh nightly via the same cron pattern as `momentum_12_1`.
2. **V math** — three sub-signals + penalty:
   - PEG-like: `ev_ebitda / ntm_revenue_growth` (need EBITDA — operating_income + D&A; we don't ingest D&A. Likely another schema-expand: add `depreciation_and_amortization` column from FMP `/stable/income-statement.depreciationAndAmortization`.)
   - Adjusted FCF yield: `(fcf + (capex - maintenance_capex)) / ev`. Maintenance capex = 50% of current capex per §Fix 6 "mid" default.
   - Own-history forward P/E z: `(forward_pe_today - mean_5y) / stdev_5y` with graceful degradation (<90 obs → null, 90-365 → flag low-confidence, 365+ → full).
   - Penalty: from `depreciation_flags` table (THS-36, empty) — sums per spec §Fix 5 scaled depreciation penalty + named-name Burry penalty (ORCL −5, META −3). Penalty caps at −12.
3. **Depreciation flags seed.** Per §Fix 5: META gets the largest penalty (two extensions in 12 months, 4→7 yr → −10), ORCL Burry penalty (−5), AMZN/GOOGL flags etc. Operator-side data; ship a seed from the spec's cited disclosures.
4. **EV computation** — market cap (have) + total_debt (have) − cash_and_equivalents (have). All in existing fundamentals.
5. **`compute-v-scores` edge function** using the same `upsert_factor_score` RPC pattern. Weekly cron Saturday 22:30 UTC.
6. **Tests** — ≥25 covering each sub-signal, the maintenance-capex band, the penalty math, and the own-history graceful degradation.

### Known schema-expand items queued for THS-43

- `depreciation_and_amortization` column on `fundamentals_raw` (FMP `depreciationAndAmortization`) — required for EBITDA in PEG-like signal.
- Possibly `interest_expense` (FMP `interestExpense`) if we want a more accurate EBIT vs operating_income — but spec uses operating_income as the EBIT proxy in Altman Z and the spec doesn't pin down EV/EBITDA's EBIT-vs-EBITDA-vs-operating-income exactly. Default: use operating_income + D&A as EBITDA.

### Original Epic 2 kickoff notes follow ↓↓↓

---

## PM session 2 (2026-05-15) — Epic 2 sub-issues kickoff

### Shipped this session (all on PR #4 — `claude/epic-2-tier-a-scoring`)

| Ticket | Status | Commits | What |
|---|---|---|---|
| THS-44 | **Done** | `79fbb9c` | `stats.ts`: `mean`, `stddev` (sample), `zScoreInCohort`, `percentileRankInCohort`, `percentileFromZ`. NaN-safe; ties get midpoint; 32 unit tests. |
| THS-41 | **Done** | `fa66d69` + `32b7b75` + `ee673ff` | (a) Schema extension — 8 columns added to `fundamentals_raw` (cash, retained_earnings, current_assets, current_liabilities, income_before_tax, income_tax_expense, dividends_paid, common_stock_repurchased), `mergeStatements` extended with `Math.abs()` on cash outflows. (b) Pure Q math: `metrics.ts` (ROIC w/ effectiveTaxRate, Altman Z, EPS vol, OLS beta, payout yield, 5y delta) + `factor-q.ts` (4-pillar QMJ, layer-aware payout weighting, missing-metric-tolerant pillar aggregation). 39 new tests, 87/87 in `_shared/` pass. (c) `compute-q-scores` edge function loads cohort in 5 queries, writes q_score + factor_breakdown.q to scores_history. Weekly cron Saturday 22:00 UTC. |
| THS-42 schema | **Partial** | `ec53583` | `ai_segment_overrides` table per Terry's spec (ticker, period_end, ai_revenue, source_url, disclosure_quality, notes; RLS forced; updated_at trigger). Seed for NVDA $39.1B + AVGO $8.4B from spec §Part 3. Math + integration still to ship. |

### Key Terry directives this session

- **Standing directive — schema-expand by default.** When you hit a downstream factor referencing a field/table not in the schema yet, add the column or table without stopping to ask. Surface it in the end-of-session batch only.
- **PR pattern.** All engineering from THS-36 forward goes through PRs against main. Already followed — PRs #2 (Epic 1) and #4 (Epic 2) are open. Don't push to main directly.
- **No proxies for Q.** The 8-column schema extension was required because the slim THS-35 schema couldn't support real QMJ. Spec doc on main (`1b8a8bb`) was already updated to match — merged into Epic 2 branch.
- **AI segment proxy → curated overrides + layer defaults.** Per spec §Fix 4. Do NOT use FMP segment endpoint + string matching.
- **Forward P/E history → compute from existing prices × consensus.** Materialize a view; don't backfill a vendor endpoint. Graceful degradation for short history.

### Spec deviation flagged in code

- **factor-q.ts safety pillar uses `+altman_z`, not `-altman_z`.** Spec pseudocode reads `-altman_z_score(...)` but negating it inverts the pillar's intent (high Altman Z = safer should contribute *positively*). Flagged in the module header; one-line flip if Terry wants strict pseudocode.

### THS-42 — remaining work for next session

1. **r_and_d_expense column.** L5 capex efficiency formula needs R&D explicitly (`AI ARR / (R&D + infra)`). FMP `/stable/income-statement` exposes `researchAndDevelopmentExpenses`. Add to `fundamentals_raw`, extend `FmpIncomeRow` + `mergeStatements`, add a `fundamentals_raw_addendum` migration.
2. **`factor-g.ts` pure math.** Three signals: NTM revenue growth (consensus.ntm_revenue vs TTM revenue from fundamentals), AI segment growth (override × layer-default fallback), capex efficiency (layer-specific). Same cohort-z-then-percentile pattern as factor-q.
3. **`compute-g-scores` edge function.** Mirrors `compute-q-scores`. Writes `g_score` + `factor_breakdown.g`.
4. **Cron migration.** Saturday 22:15 UTC, 15 min after Q.
5. **Tests.** ≥20 tests covering each signal and the layer fallback logic.

Acceptance for THS-42 (hand-scored slate ±5) is operator-side; cannot validate in build env without FMP key.

### Migration ledger additions

| 20260515001000 | THS-41 | E2.1 prep: `fundamentals_raw` +8 columns for QMJ |
| 20260515001100 | THS-41 | E2.1 weekly Q-score cron (Sat 22:00 UTC) |
| 20260515001200 | THS-42 | E2.2 `ai_segment_overrides` table + RLS + trigger |
| 20260515001300 | THS-42 | E2.2 seed: NVDA + AVGO explicit AI revenue disclosures |

### Open judgment calls / known gaps (cumulative)

| Where | Status |
|---|---|
| L4 capex efficiency formula | Spec asks for "contracted MW pipeline value / capex" — that data isn't in any standard provider. Will fall back to revenue YoY / capex YoY for L4 in v1 and document. |
| L5 R&D denominator | Needs new `r_and_d_expense` column on fundamentals_raw. See THS-42 remaining-work item 1. |
| Hand-scored 20-name slate ±5 on Q | Cannot run in container; operator validates on first FMP-key deploy. |
| AI segment overrides seed | Only 2/20 slate names seeded (NVDA, AVGO). Operator-curated additions land as follow-on inserts. |

---

## Original handoff (PM session 1, 2026-05-15)

The remainder of this file describes Epic 1 completion. Most of it is now historical; refer to it only for FMP endpoint details, ANET classification reasoning, or the original operator first-run steps (which still apply, just add the new compute-q-scores function to the deploy list).

---

# Session Notes — last updated 2026-05-15 (Epic 1 close)

This file is the cold-start handoff doc. A fresh Claude session should be able to read it and immediately know:
- where the build is
- what's in-flight
- what decisions have been made (and why)
- what's open / blocked
- what to do next

Append to this file at the end of every significant session; never delete past entries.

---

## Current state (2026-05-15)

### Epic 1 — Foundation (THS-29): SUB-CHAIN COMPLETE

| Ticket | Status | Notes |
|---|---|---|
| THS-35 | **Done** | Core schema: universe, fundamentals_raw, prices_raw, consensus, revisions. RLS forced, anon returns empty. |
| THS-36 | **Done** | Overlay tables: aiq_rubric (GENERATED total), depreciation_flags, scores_history (JSONB GIN). |
| THS-37 | **Done** | Universe seeded with 50 names (NOT 70 — the title was a typo, Terry confirmed). ANET → L1 Compute (Arista is Ethernet hardware, not an app). |
| THS-38 | **Done** | `ingest-fundamentals` edge function, daily pg_cron at 21:15 UTC. |
| THS-39 | **Done** | `ingest-consensus` edge function + revisions deltas. NTM=FY1 simplification. rating_avg null on shape mismatch (probe ratingScore / overallScore / rating, 1..5 band). |
| THS-40 | **Done** | `ingest-prices`, `momentum_12_1` matview, SPY benchmark, refresh RPC. |
| **THS-29 (epic)** | **Ready to mark Done** once Terry green-lights moving to Epic 2. |

**Branch:** `claude/epic-1-foundation-z3WvR` — pushed.
**PR:** [#2 — Epic 1 — Foundation](https://github.com/terry-zero-in/ai-thesis/pull/2) — open, **listening for activity** via `subscribe_pr_activity`.

### Final universe (51 rows total)

| Layer | Count | Names |
|---|---|---|
| L1 Compute | 14 | NVDA, AVGO, AMD, TSM, ASML, AMAT, LRCX, KLAC, MRVL, ARM, SNPS, CDNS, MU, **ANET** |
| L2 Hyperscaler | 7 | MSFT, GOOGL, AMZN, META, ORCL, IBM, CRM |
| L3 App | 9 | PLTR, SNOW, CRWD, S, DDOG, MDB, NET, ESTC, AI |
| L4 Power | 14 | VST, CEG, GEV, ETR, NRG, TLN, NEE, AES, ETN, PWR, BE, EQIX, DLR, VRT |
| L5 Incumbent | 6 | ADBE, NOW, INTU, WDAY, ZS, SAP |
| L0 Benchmark | 1 | SPY (kind='benchmark') |

---

## Build order — where we are

```
Epic 1 — Foundation                ✅ DONE  (PR #2 open)
Epic 2 — Tier-A Scoring Engine     ◯ NEXT
Epic 3 — Overlays                  ◯
Epic 4 — Portal UI                 ◯ ⚠️ Reticle base needed before this fires
Epic 5 — Tier-B Scoring            ◯
Epic 6 — Maintenance               ◯
```

---

## Migration ledger (all in `supabase/migrations/`, with matching `rollback/`)

| Timestamp | Ticket | What |
|---|---|---|
| 20260515000000 | THS-35 | Core tables + RLS forced + grants |
| 20260515000100 | THS-36 | Overlay tables (aiq_rubric, depreciation_flags, scores_history) |
| 20260515000200 | THS-37 | Universe seed (50 investable; ANET pre-classified as L1 after the fix) |
| 20260515000300 | THS-38 | Fundamentals cron (pg_cron, 21:15 UTC Mon-Fri) |
| 20260515000400 | THS-39 | Consensus cron (21:30 UTC Mon-Fri) |
| 20260515000500 | THS-40 | Universe.kind column + SPY seed; layer CHECK loosened to 0..5 |
| 20260515000600 | THS-40 | `momentum_12_1` materialized view + unique index |
| 20260515000700 | THS-40 | `refresh_momentum_12_1()` SECURITY DEFINER RPC, service_role only |
| 20260515000800 | THS-40 | Prices cron (21:00 UTC Mon-Fri) |
| 20260515000900 | THS-37 fix | Reclassify ANET from L3 App to L1 Compute |

All cron migrations gracefully skip when pg_cron/pg_net aren't available (so vanilla local Postgres still applies them).

---

## Edge Functions (`supabase/functions/`)

```
_shared/
  env.ts           — readEnv + requireEnv (Deno + Node compatible)
  fmp.ts           — FMP client + pure mergeStatements / buildConsensusRow
  fmp.test.ts      — 4 tests
  consensus.test.ts — 6 tests (incl. rating fallback chain + sanity band)
  revisions.test.ts — 5 tests
  revisions.ts     — pure computeRevisionDeltas (at-or-before cutoff)
  supabase.ts      — serviceClient + activeTickers({kind})
  auth.ts          — requireCronAuth (Bearer secret guard)
ingest-fundamentals/
ingest-consensus/
ingest-prices/
```

Tests: **15/15 passing** via `node --test --experimental-strip-types supabase/functions/_shared/*.test.ts`.

### Key FMP migration (post-Codex review)

FMP migrated to `/stable/` in 2025; `/api/v3/` is legacy. **All endpoints in the client** are now on `/stable/` with `?symbol=` query params:

- `/stable/income-statement?symbol=X&period=quarter&limit=8`
- `/stable/balance-sheet-statement?symbol=X&...`
- `/stable/cash-flow-statement?symbol=X&...`
- `/stable/analyst-estimates?symbol=X&period=annual&limit=4`
- `/stable/price-target-consensus?symbol=X`
- `/stable/ratings-snapshot?symbol=X` (shape not docs-verified; probe ratingScore → overallScore → rating, sanity-band 1..5)
- `/stable/historical-price-eod-full?symbol=X&from=&to=` (handles both `{historical: [...]}` and bare-array response shapes)

`ingest-consensus` uses `Promise.allSettled` so a single endpoint flake doesn't kill the other two for that ticker.

### Operator first-run steps (when FMP key + project ready)

```bash
supabase link --project-ref <ref>
supabase db push

supabase secrets set FMP_API_KEY=... CRON_INVOKE_SECRET=...

psql "$DATABASE_URL" <<SQL
SELECT vault.create_secret('https://<ref>.supabase.co', 'project_url');
SELECT vault.create_secret('<same-secret-as-CRON_INVOKE_SECRET>', 'cron_invoke_secret');
SQL

supabase functions deploy ingest-fundamentals ingest-consensus ingest-prices
# verify_jwt = false is already set per-function in supabase/config.toml

# First-run backfill
supabase functions invoke ingest-prices --no-verify-jwt --body '{}' # add ?days=400 in the URL
supabase functions invoke ingest-fundamentals --no-verify-jwt --body '{}'
supabase functions invoke ingest-consensus   --no-verify-jwt --body '{}'
```

---

## Reticle base — critical context for Epic 4

**See `CLAUDE.md` → "Reticle base file" section** for the full handoff. Summary:

- **GitHub (authoritative):** https://github.com/terry-zero-in/optimize-claude-docs — clone this at Epic 4 kickoff.
- Original local copy on Terry's Mac: `/Users/terryturner/Hub/reticle-optimizeclaude/`.
- GitHub MCP scope is restricted to `terry-zero-in/ai-thesis`; reach `optimize-claude-docs` via `git clone` over HTTPS, not MCP tools. If clone fails (private/auth), escalate.
- Reticle provides verbatim (with Basis re-skin only): left sidebar (220px), right rail (280px), top bar (48px), inner-page tab strip ("Delegations" + "Reviews" pattern → reused on Basis tabbed surfaces like the Rent Roll analogue).
- Canvas content per page (Dashboard, Universe, Detail, Portfolio, Regime, AIQ, Memos, Proforma, Insights) comes from `design-references/02-*`, `03-*`, `04-*`. NOT from Reticle.
- `prototype/` is the content reference for what AI Thesis canvases should look like. Reticle is the chrome base. Both stay in scope during Epic 4.

---

## Skills in use (loaded this session)

- `/honesty` — always on; no flattery, ground every opinion, surface disagreement before executing
- `/ferrari` — design-build conviction posture; act on inferred context, render rather than describe
- `/linear` — Terry's quality bar; Lamborghini + diamond ring standard; institutional precision + dev-tool craft
- `/ui-ux-pro-max` — UI/UX rule database; query via `python3 skills/ui-ux-pro-max/scripts/search.py`
- `/frontend-design` — distinctive aesthetics over generic AI-slop
- `/fidelity` — evidence-gated review; every benchmark claim must trace to a fresh `web_fetch`; per-suggestion evidence blocks

All six are in `~/.claude/skills/` and surface via the Skill tool when Terry types `/<skill-name>`.

---

## Open judgment calls / known gaps

| Where | Status |
|---|---|
| **NTM = FY1** in `buildConsensusRow` | Documented simplification. Easy to upgrade to time-weighted FY1+FY2 blend later when spec defines one. |
| **`upward_breadth_pct`** in `revisions` | Left NULL. FMP standard endpoints don't expose individual-analyst revisions cleanly. Follow-up: investigate `/stable/upgrades-downgrades-rss-feed` or grades-summary. |
| **`/stable/ratings-snapshot` field name** | Not docs-verified. Defensive probe (ratingScore → overallScore → rating) with 1..5 sanity band; falls back to NULL on out-of-band. |
| **FMP first run** | Cannot be tested in this build env (no API key). Cron migrations apply cleanly to a real Supabase project; operator instructions documented above. |

---

## Working agreements with Terry (from this session)

- 50 names is the universe total. Not 70. The ticket title was a typo.
- ANET = Arista Networks → L1 Compute. Always.
- When `/api/v3/` shows up anywhere in FMP code in a future session, flag it — that's legacy.
- `Promise.all` over multiple FMP endpoints is wrong; always `Promise.allSettled` so one flake doesn't drop the others.
- Local Postgres without pg_cron/pg_net is fine for testing — migrations have skip-paths for that environment.
- Tests: 15 in `supabase/functions/_shared/*.test.ts`. Add more as new pure helpers land. Never test the FMP wire path locally — it requires a key.

---

## Next session — start here

1. Read `CLAUDE.md`
2. Read this file (`docs/SESSION_NOTES.md`)
3. Check PR #2 status (`subscribe_pr_activity` was set up — events arrive in the thread)
4. If Terry's ready, mark THS-29 Done and start Epic 2 — Tier-A Scoring Engine (THS-30). First sub-issue under it is the next thing to build.
5. If Epic 4 is firing, FIRST `git clone https://github.com/terry-zero-in/optimize-claude-docs` (Reticle base). If the clone fails (private repo / auth), escalate immediately.

---

## SESSION S27 (2026-05-22, autonomous batch)

**Note:** Sessions S10–S27 are logged in `docs/handoffs/` per-session. This entry is a pointer to keep `SESSION_NOTES.md` discoverable for the next cold start.

S27 picked up from S26's MCP-disconnected handoff and executed autonomously through 5 Linear tickets + 2 follow-ups. **Branch: `claude/peaceful-rubin-KqluN` (15 commits, all pushed).** Highlights:

- 4 prod migrations applied to `mvxgnliwvoauwwarrlrr`: e25_aiq_scores_cron, e80_routines_pr1 (multi-tenant pivot), e80_advisor_cleanup (THS-96), e34_ibm_depreciation_flag (THS-48), e44_aiq_rubric_edit_audit (THS-75).
- THS-71 (UI items 3a+3b), THS-73 (Score Math + engine-status strip on 7 pages), THS-74 (dashboard Today's Thesis + rail rework), THS-75 (AIQ Editor cockpit + needs-review queue) all shipped — In Review pending Terry's local visual checks.
- Linear: canceled THS-70 monetization epic, created **THS-92** "Personal-tool v1 polish" as successor, re-parented 10 sub-issues, filed THS-93/94/95 retro + THS-96/97/98 follow-ups.
- CLAUDE.md updated with autonomous-by-default rule.

**Full S27 record:**
- Part 1: `docs/handoffs/2026-05-22-S27-migrations-applied-linear-pivot-cleanup.md`
- Part 2: `docs/handoffs/2026-05-22-S27-autonomous-ticket-burn.md`

**Next session — start here:**
1. Read `CLAUDE.md` for the autonomy rule
2. Read `docs/handoffs/2026-05-22-S27-autonomous-ticket-burn.md` for current state + what's pending Terry
3. Check Linear THS-92 children for the next ticket in build order (after In Review tickets close to Done, likely THS-76)

---

## SESSION S28 (2026-05-24, /sch command + dashboard density fix)

**Note:** Sessions S10–S28 are logged in `docs/handoffs/` per-session. This entry is a pointer.

Tail of S27's autonomous run: Terry shared screenshots of the deployed Vercel preview, flagged the Score Movers + Top Positions tables as looking airy vs Linear/Lambo standard, and asked me to register `/sch` as a real slash command instead of treating it as verbal shorthand.

- `7c84be8` — dashboard table density fix (row padding 10px→7px, explicit lineHeight: 1.3, Driver column becomes the 1fr flex column instead of Layer)
- `1ecdcf2` — `.claude/commands/sch.md` registered so `/sch` is a real project slash command from now on
- THS-74 commented with the density fix details; remains In Review pending Terry's local re-screenshot
- No new prod migrations, no Linear scope changes

**Full record:** `docs/handoffs/2026-05-24-S28-sch-command-and-dashboard-density-fix.md`

**Next session — start here:**
1. Read `CLAUDE.md`
2. Read the S28 handoff above (which references S27 part 2 for the bulk of the autonomous run)
3. Check the In Review comments on THS-73 / 74 / 75 for any visual feedback Terry posted

---

## SESSION S28 update (2026-05-24, critical-path framing)

Terry pushed back mid-S28 with "what do we need to do to get this 100% ready to be used personally and by parents?" Re-framed the work: there are exactly **6 critical-path steps** between current state and "fully usable for Terry + Mom + Dad on the real prod URL." Polish tickets (THS-76+, THS-97, THS-98, THS-99) are noise relative to those 6.

- **The 6 steps** are at the top of `docs/handoffs/2026-05-24-S28-sch-command-and-dashboard-density-fix.md` (§"CRITICAL PATH TO 100% READY")
- Most are Terry-only (~50 min of his work total)
- One ambiguity Claude couldn't validate from the container: whether the Supabase edge functions are actually deployed (cron jobs need them). Check via `supabase functions list`.
- Suggested next-session shape: Terry pre-does steps 1/2/3 himself; next Claude session drives step 4 (firing daily-batch) → step 5 (merge + deploy) → step 6 (RLS smoke). 60-80% of the way to "100% ready" in one session.

**Next session — start here:**
1. Read the CRITICAL PATH section at the top of the S28 handoff doc.
2. If Terry has done steps 1/2/3 — drive step 4. If not — restart from step 1.
3. Do NOT crank polish tickets until the critical path is green.

---

## SESSION S29 (2026-05-24, Learn page + auth sync + pre-launch bug triage)

**Note:** Sessions S10–S29 are logged in `docs/handoffs/` per-session. This entry is a pointer.

S29 shipped 6 commits across three concerns: (1) a `/learn` methodology page with sticky TOC for non-quant users, (2) the auth → public.users sync trigger that closes the gap that would have blocked Mom + Dad from writing anything (THS-100), and (3) caught + fixed a build-breaking bug in the S28 Score Math drawer work before it could fail `vercel --prod`. Late session, Terry pasted a comprehensive Claude-browser app review that we triaged into two new tickets: **THS-101 pre-launch bug-fix bundle (8 items, ~2.5h)** and **THS-102 post-launch polish queue (~13 items, ~5h)**.

- **Mom + Dad can now sign in cleanly** — public.users backfilled + permanent trigger added (THS-100 Done). Dad's email corrected from `terryturner2027@gmail.com` typo → `terryturner@gmail.com`.
- **/learn shipped** — 10 sections + 43-entry glossary, voice-tuned for Mom/Dad with formulas demoted to `<details>` expansions, sticky TOC sidebar with scroll-spy.
- **Vercel build no longer broken** — split `score-math.ts` to keep `next/headers` out of the client bundle. Would have failed `vercel --prod` at critical-path step 5.
- **THS-101 filed (Todo, High):** 8 must-fix bugs from Claude-browser review (^VIX URL decode, /universe?tier= filter, popover overlap, env-var leak, Proposals breadcrumb, Backtest month roll, right-panel toggle, ^VIX in universe list). Single PR, ~2.5h, ideal for autonomous next-session crank.
- **Dashboard density second pass** — first pass (S28) wasn't tight enough; went 7px→4px on row padding, 1.3→1.2 line-height.

**Full record:** `docs/handoffs/2026-05-24-S29-learn-page-auth-sync-bug-triage.md`

**Next session — start here:**
1. Load skills per CLAUDE.md.
2. Read the S29 handoff doc (especially the THS-101 section with exact fix locations for the 8 items).
3. Crank THS-101 as a single PR. Then surface to Terry for visual check before he drives critical-path steps 2-6.

---

## SESSION S30 (2026-05-25, Linear cleanup + merge to main + Vercel project mismatch finding)

**Note:** Sessions S10–S30 are logged in `docs/handoffs/` per-session. This entry is a pointer.

S30 shipped 2 commits and a wholesale Linear cleanup. The THS-101 8-item bug bundle landed (commit `154e818`), then the branch was merged into `main` (commit `56458d6`) and fast-forwarded — making `main` finally current with all S25-S29 work. Discovered at the very end: Terry has TWO Vercel projects in his account, and his Mac is linked to the wrong one. `ai-thesis-v2.vercel.app` (the URL Mom + Dad were going to use) is still serving 8h-old code. New ticket THS-107 captures this blocker.

- **THS-101 shipped (Done)** — 8 pre-launch fixes in `154e818`: ^VIX URL decode, ?tier= filter wiring, popover background, memo env-var leak sanitized, Proposals breadcrumb, Backtest year-roll, right-panel toggle, ^VIX filtered from universe. 18 routes build, lint baseline unchanged.
- **`main` is current** — `60e465f → 56458d6`, includes all S25-S29 work. Resolved 7 conflicts from PR #10 (dep/burry filter chips) keeping the new dep_flag plumbing but reverting fixture-fallback to S25's "empty over fake" directive.
- **Linear hygiene** — closed THS-6, 7, 14, 24, 31 (stale). Created THS-103 (sell flow + realized P&L + retro entry — full spec), THS-104 (env secrets), THS-105 (daily-batch fire + RLS smoke test), THS-106 (merge — Done), THS-107 (Vercel project mismatch — High, Todo).
- **Vercel project mismatch (THS-107)** — `vercel --prod` from Terry's Mac deployed to `ai-thesis-three.vercel.app` instead of `ai-thesis-v2.vercel.app`. The default subdomain returns Vercel-level 404. Resolution recommended in ticket: re-link Mac to `ai-thesis-v2`, redeploy.
- **Sell feature scoped (THS-103)** — schema migration + `sellPosition()` server action + `SellDrawer.tsx` + closed positions table + realized P&L tile. Partial sells supported. Retro exit dates editable. ~4h Claude autonomous work. Reconciliation math worked end-to-end in ticket body.

**Full record:** `docs/handoffs/2026-05-25-S30-linear-cleanup-merge-main-vercel-mismatch.md`

**Next session — start here:**
1. Load skills per CLAUDE.md.
2. Read the S30 handoff (especially the THS-107 section — the Vercel mismatch is the active blocker).
3. **Do NOT crank THS-103 yet.** First, work with Terry to resolve THS-107 (operational, 10 min) + THS-104 (env secrets, 30 min). Only when the deploy pipeline is verifiably alive should code work resume.

---

## SESSION S31 (2026-05-25, THS-103 sell flow + password auth + launch runbook + Lambo Pass foundations)

**Note:** Sessions S10–S31 are logged in `docs/handoffs/` per-session. This entry is a pointer.

S31 shipped 9 commits across two unrelated chunks. First half: THS-103 sell flow (migration + SellDrawer + sellPosition action + closed-positions section + Realized P&L AggregateBar + reserve reconciliation), magic-link → email+password auth rewrite, and `docs/runbooks/launch.md` covering all Mac-side launch steps end-to-end (commit `b559ae7`, fast-forwarded to `main` mid-session). Second half: Lambo Pass v1 foundations — §A spine fix (revised to Universe-only after Terry's mid-flight clarification), §F three signature primitives (`DerivationLadder`, `QuietActionRow`, `TraceOverlay`), §G two industry-first features (TraceOverlay wired on Universe Detail, ConvictionTape wired on Dashboard). Polish layer deferred to THS-108.

- **THS-103 → In Review** — sell flow shipped + verified by inspection. Smoke pending Terry's runbook execution.
- **Auth flipped to password-only** — `/login` rewritten, magic-link removed, runbook Step 6 provisions all 3 passwords via admin API curl (no email delivery dependency).
- **Lambo Pass foundations (8 branch-only commits, NOT on `main` yet)** — §A spine fix narrowed to Universe only after Terry's clarification "look at universe i think it just means duplicate spine on like that one." §E accent-desaturation was a typo per Terry; severities only. Two new features (TraceOverlay + ConvictionTape) wired with real data using `Promise.allSettled` per source for graceful degradation when tables are empty.
- **Schema discovery** — `scores_history` is denormalized: `q_score / g_score / v_score / aiq_score / composite / macro_multiplier` all live as columns on the same row. No separate per-factor tables. (Discovered while wiring TraceOverlay.)
- **THS-108 filed** — Lambo Pass §B/C/D/E polish + §G follow-ons (TraceOverlay deep-link from URL, insider BUY severity remap, NameDetail strip restoration). Medium, parent THS-92. Deferred to a follow-on pass after Terry visually reviews the foundations.

**Full record:** `docs/handoffs/2026-05-25-S31-ths-103-auth-rewrite-lambo-pass-foundations.md`

**Next session — start here:**
1. Load skills per CLAUDE.md.
2. Read the S31 handoff (especially the Pending Terry Actions table — merge to main + runbook execution + visual review are the unblock path).
3. **Do NOT dispatch THS-108 cold.** First confirm Terry has eyeballed the §A/F/G Lambo Pass foundations on a working Vercel deploy. THS-108's items are mostly judgment calls that depend on his direction post-review.

---

## SESSION S32 (2026-06-16, HP-1 Phase 0 — engine truth / lookahead fix)

**Note:** New workstream. HP-1 is a separate trading-engine build specced under `docs/hp1/`, distinct from AI-Thesis v2. This entry is a pointer.

Executed **Phase 0 only** of the HP-1 build: fixed a same-day-execution lookahead in the backtest engine and regenerated the canonical record. The old published record (110.5% CAGR / 2.43 Sharpe) is void; the corrected 24M blend is **93.1% / 2.03**, matching the independent audit essentially exactly. Shipped via PR #17 (squash-merged to `main` @ `63f0830`). No UI touched.

- **New `engine/` directory** — `hp1_engine.py` (t+1 execution, F8/F24 fixes), `restate_record.py`, `tests/test_engine.py` (4 passing), canonical `data/results_24m_v2.csv` + `results_36m_v2.csv`.
- **Void record retired** — `docs/hp1/results_24m.csv` → `results_24m_VOID.csv`; docs restated to v1.2 numbers (D1–D10 applied). Grep guard clean.
- **Decisions confirmed** — OPEN-1…4 + D8/D9/D10 locked 2026-06-16, Terry-confirmed. OPEN-2 (ANTH ceiling 15×) is his standing personal re-confirm.
- **No HP-1 Linear project exists yet** — recommend cutting it at Phase 1 kickoff. Zero Linear tickets touched this session.
- **Env facts** — engine runs on pandas 3.0.3 / numpy 2.4.6 / yfinance 1.4.1; yfinance + PyPI reachable in the remote sandbox; pin pandas in the Phase 1 GH Action.

**Full record:** `docs/handoffs/2026-06-16-S32-hp1-phase0-engine-truth-lookahead-fix.md`

**Next session — start here:**
1. Read `CLAUDE.md`, then `docs/hp1/2026-06-12-hp1-build-handoff.md` (HP-1 cold-start index).
2. Read the S32 handoff above.
3. **Do NOT fork cold.** Confirm Terry wants Phase 1 to start; cut the HP-1 Linear project first; then compute the v2-70 vs HP-1-50 ticker delta before extending ingestion.

---

## SESSION S33 (2026-06-16, HP-1 Phase 1 kickoff — decisions locked, fork plan ready)

**Note:** Same-day continuation of S32; checkpoint before compact. Pointer entry.

Phase 1 kickoff prep — no code shipped. Locked all four Phase 1 decisions (Terry "go with defaults"), computed the v2-vs-HP-1 ticker delta, and produced the full fork keep/strip/adapt inventory + execution order. Created the HP-1 Linear project. Build is blocked only on two Terry-side actions: create the private `hp1` repo + grant session access, and approve MCP writes (Linear/Supabase are approval-gated this session).

- **Decisions locked** — (1) same Supabase project + new `hp1` schema; (2) 19 uncovered tickers added to `public.universe` as data-only `kind='hp1'`; (3) Terry creates private `terry-zero-in/hp1` + grants scope (PENDING); (4) Vercel/secrets later.
- **Ticker delta** — v2 is 50 names (not 70). 31 shared. 19 to add for HP-1: AAPL, ALAB, APLD, APP, CLS, COHR, CRDO, CRWV, DELL, FN, IREN, MPWR, NBIS, PANW, RDDT, SMCI, TEM, TER, TSLA. Mechanism: first ship a migration extending `universe_kind_check` to allow `'hp1'` (current constraint rejects it — Codex catch), then insert into `public.universe`; `activeTickers()` feeds all ingest/score fns; backfill via `ingest-prices?days=2000`.
- **Fork inventory** — frame (shell/auth/globals.css tokens/primitives/AIQ editor/settings) carries over; work = rewire 17 `lib/*-data.ts` loaders `public`→`hp1.*` + build 4 new surfaces (/anth, /trades, /runs, /system). CRITICAL: stub `layout.tsx` `getUnseenAlertCount()` first or the fork errors on load.
- **Linear** — HP-1 project created (id 4ab1b51a-94e9-4ace-bb10-c1a50777be8c). Epics NOT created (MCP writes approval-gated) — next session creates the 5 phase epics.
- **No DB / no code changes.** `hp1` schema not yet created.

**Full record:** `docs/handoffs/2026-06-16-S33-hp1-phase1-kickoff-decisions-locked.md`

**Next session — start here:**
1. Read `CLAUDE.md`, `docs/hp1/2026-06-12-hp1-build-handoff.md`, then the S33 handoff.
2. **Confirm `terry-zero-in/hp1` exists + is in MCP scope** (Terry's pending action) — the fork can't start without it. Get MCP-write approval.
3. Create the 5 Linear epics, then execute the 8-step fork execution order in the S33 doc. Decisions are locked — don't re-ask.

---

## SESSION S35 (2026-06-17, HP-1 went STANDALONE — standalone DB stood up + verified live)

**Note:** S34 (universe-seed-merged; doc on the unmerged PR #21) sits between S33 and this. Pointer entry.

Mid-session the HP-1 topology flipped **shared → standalone** (main commits `9d52687`, `da08b0d`): HP-1 now owns its own Supabase project and never reads v2's `public.*`. Built + verified the entire standalone HP-1 database **LIVE** on the dedicated project, adopted the CC-authored migration as the canonical schema, and fixed a Codex P1 (RLS write-lock on the real-money trade ledger). Created the 5 HP-1 Linear epics (THS-109…113). Now blocked on Terry's price-source pick to start the engine/loaders.

- **Standalone DB is LIVE** on `uetclnhbubmkwbherwkw` ("AI Thesis", in MCP scope) — 13 `hp1` tables + `positions` view, `universe` 53 rows, `anth_state` seeded (15×/WAIT), RLS hardened (authenticated read-only; writes via service_role), 0 security-advisor lints. Migrations: `hp1_schema` → `hp1_rls_harden` → `hp1_universe_prices_macro`.
- **Project map** — standalone HP-1 = `uetclnhbubmkwbherwkw`; v2 prod = `mvxgnliwvoauwwarrlrr` (out of this session's scope); Basis = `dmhuvacfwrfrrfwyrqlx`. Do NOT apply `20260616000000` (shared-DB-only); nothing has been run against v2.
- **PRs merged** — #22 (schema), #23 (RLS harden + now-moot ingestion extension), #24 (universe/prices/macro), #25 (S35 handoff).
- **Linear** — created HP-1 epics: THS-109 (Phase 0, Done), **THS-110 (Phase 1, In Progress — this session)**, THS-111/112/113 (Backlog).
- **Pending Terry** — price source + key (FMP rec / Polygon / yfinance), standalone service-role key as a GH secret, `terry-zero-in/hp1` fork repo, 2 auth users (Terry write / mom read).

**Full record:** `docs/handoffs/2026-06-17-S35-hp1-standalone-db-live.md`

**Recommendation:** keep cranking — the DB foundation is verified-solid, so the engine/loader phase is well-scoped and low-risk the moment the price source lands. yfinance unblocks it with zero credential wait if Terry wants the engine producing live ranks fastest.

**Next session — start here:**
1. Read `CLAUDE.md`, then the S35 handoff above.
2. Get Terry's price source + key (gates everything). Then build in `engine/`: price loader → `hp1.prices`, adapt `hp1_engine.py` to write `hp1.engine_runs`/`engine_ranks` (per-view × per-sleeve grain), the GitHub Action, and the macro loader.
3. Revert the moot ingestion extension (#23) per the handoff; then the frontend fork (`terry-zero-in/hp1`).

---

## SESSION S36 (2026-06-18, HP-1 engine + price/macro loaders — Phase 1 data layer complete)

**Note:** Sessions S10–S36 are logged in `docs/handoffs/` per-session. This entry is a pointer.

Built the entire HP-1 Phase 1 data layer on top of S35's standalone DB and merged it (#28/#29/#30): the engine (`compute_run`: prices → per-view × per-sleeve ranks → `engine_runs`/`engine_ranks`), the yfinance price loader, the daily GitHub Action, the macro-gauge loader (NAAIM/AAII/CNN F&G → `macro_gauges`), an offline engine preview, and a pooler-safety fix. All verified on **real data** (engine: 50 names → 200 rows, breadth 80%/gate 1.0; macro reproduces Terry's oracles F&G 32.7 / AAII −8.1 / NAAIM 79.27). Nothing is live yet — the `hp1.*` data tables are empty pending Terry setting `HP1_DB_URL` + running the backfill.

- **Data layer DONE + merged** — engine, price loader, macro loader, daily Action, offline preview (`engine/hp1_*.py`). 29 engine tests pass; write paths dry-run-verified vs live DB (0 residue).
- **DB state** — schema live on `uetclnhbubmkwbherwkw` (universe 53, anth_state 1, 3 migrations); **prices/engine_runs/engine_ranks/macro_gauges all 0** until first run.
- **Deviation** — Core is price-only (`v1.2-priceonly-core`); §5 fundamental overlay blends in when Tier-A data lands in `hp1.*`.
- **Pending Terry** — (1) `HP1_DB_URL` secret (transaction-pooler string) + run `HP-1 engine (daily)` Action with `period=3y` → first live data; (2) create `terry-zero-in/hp1` repo → frontend phase.

**Full record:** `docs/handoffs/2026-06-18-S36-hp1-engine-macro-loaders.md`

**Recommendation:** the backend is done and proven — highest-value next move is the **frontend fork** once `terry-zero-in/hp1` exists. Don't start the Core §5 overlay or the Fable orchestrator yet (both need upstream inputs / a key + scope decision). Use `python engine/hp1_smoke.py` for fast real-data sanity checks.

**Next session — start here:**
1. Read `CLAUDE.md`, then the S36 handoff above.
2. If Terry has run the backfill: verify the live run (counts + spot-check ranks vs `hp1_smoke.py`), then THS-110 data foundation is Done.
3. If `terry-zero-in/hp1` exists: add it to scope and start the frontend fork — Today surface first, per `docs/hp1/2026-06-12-hp1-dashboard-design.md` §5, wired to `hp1.*`.
