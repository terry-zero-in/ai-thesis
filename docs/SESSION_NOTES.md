# Session Notes — last updated 2026-05-16 (PM session 4 — extended)

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
