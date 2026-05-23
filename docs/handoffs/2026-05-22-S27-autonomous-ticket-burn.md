# S27 — autonomous ticket burn (THS-71 / 73 / 74 / 75 / 48 / 96)

**Date:** 2026-05-22 → 2026-05-23 UTC rollover
**Branch:** `claude/peaceful-rubin-KqluN` (latest HEAD `26bebc8`, 19 commits ahead of `origin/main` at the start of this session, all pushed)
**Continuation of:** S27 part 1 — `2026-05-22-S27-migrations-applied-linear-pivot-cleanup.md` (e25/e80 apply + Linear pivot)

This doc covers everything S27 shipped AFTER the initial migration apply: autonomous ticket execution across 5 Linear tickets and 2 hygiene/follow-up tickets.

## Operating posture this session

Terry's directive 2026-05-22 (now codified in `CLAUDE.md`): "Run autonomously from issue to issue. Only stop to ask about mission-critical items or decisions that will materially impact the scope." Mission-critical = hard-to-reverse prod changes, genuine spec ambiguity, external credentials.

This handoff documents what got shipped under that rule. Most UI work was dispatched to focused subagents (one per ticket); main session orchestrated, verified, and Linear-managed.

## Tickets shipped

### THS-96 — Supabase advisor cleanup (Done)

Migration `20260523000000_e80_advisor_cleanup.sql` (commit `06a931e` draft, applied via `apply_migration`).
- Wrapped all 10 e80-introduced `auth.uid()` direct calls as `(select auth.uid())` (12 → 2 remaining `auth_rls_initplan` warnings, all pre-existing).
- Consolidated 4 `multiple_permissive_policies` patterns (aiq_draft_queue, memo_proposals, universe_proposals, position_pulse) — split FOR ALL writes into per-action INSERT/UPDATE/DELETE so `*_all_select` is the sole SELECT path.
- Added 3 FK covering indexes (memo_proposals.resolved_by, memo_proposals.ticker, universe_proposals.resolved_by).
- Idempotent + atomic.

### THS-71 — Routines plumbing Bucket A items 3a + 3b (UI complete, Done structurally)

Commit `8643573`. Two UI surfaces:
- **/aiq-drafts:** `MovingPillTabs` 3-tab layout (Pending / Unreviewed / Reviewed). Pending pulls from `getQueuedAiqDrafts()` and renders 5 e80-seeded queue rows.
- **/decisions:** `thesis_broken` alert kind added; `alerts-data.ts` queries `position_pulse where verdict='broken'` (RLS-scoped). Renders via existing AlertRow chrome; BulkAckButton works generically.

Remaining acceptance ([ ] All 4 routines fired + verified, [ ] Vercel deploy) is **external-credentials / external-deploy** — only Terry can do those, can't be done via MCP.

### THS-48 — Depreciation flags 6th hyperscaler (Done)

Migration `20260523001000_e34_ibm_depreciation_flag.sql` (commit `885d753`, applied).
- IBM flag added (`extension_years=3.0`, `penalty_v=-10`, source: IBM 2025 Annual Report). IBM extended estimated total useful life of assets from 5y (2021) → 8y (2022) → 9y (2023, peak) → stabilized at 8y in 2024-2025. Net +3.0y vs baseline.
- All 6 "true" hyperscalers now flagged (META, MSFT, GOOGL, AMZN, ORCL, IBM).
- CRM (7th L2 hyperscaler in universe) is a SaaS tenant on AWS/GCP — not flagged. Universe classification tracked separately as **THS-97**.

### THS-73 — Engine visibility (Score Math drawer + status strips) — In Review

4 commits: `a82cc8e` → `e0bf24d`. Three sub-patterns:
1. **EngineStatusStrip** on 7 analytical pages (Dashboard, Universe, Detail, Regime, Decisions, Portfolio, AIQ Editor). Mono spine: `as_of · prices · macro · AIQ · engine v1.0 · mode`. Hover tooltips show source + cadence per segment. Helper `getEngineStatus()` joins scores_history / prices_raw / macro_gauges / aiq_rubric.
2. **ScoreMathDrawer** primitive — derives any ticker's final score with auditor-grade reconciliation (≤±0.1 banner if engine diverges). Opens from detail-page header. Helper `getScoreMath(ticker)` joins scores_history / concentration_history / depreciation_flags. New `deriveFinalScore()` does the math.
3. **LiveStubbedStrip** on /universe — Q/G/V/AIQ in `--text-1`, M/S in `--text-3`.

Judgment calls: depreciation penalty annotated as "(already inside V — informational)" rather than additively summed; `/universe/[ticker]/page.tsx` split into thin RSC + `NameDetailClient.tsx`; universe-row math affordance stays as the prior `ScoreMathPopover` (avoiding 70 server-side fetches).

In Review pending Terry's local visual + math reconciliation check on 3 sample tickers.

### THS-74 — Dashboard Today's Thesis command-center (In Review)

3 commits: `05ae796` → `2404597`. Two structural changes:
- **TodayThesisCard** — 5-row module between greeting and KPI tiles. Macro state / Portfolio posture / Current bias / Watchlist pressure / Required action. Required-action row has accent chevron CTA → `/decisions?kind=<lead-kind>`. All rows degrade to dim string when source empty.
- **Right rail rework** — `DashboardTodayRail.tsx` rewrite: dropped Top Movers + MoversByTier (canvas covers analysis); added Calendar (placeholder — schema gap filed as THS-98), Insider 24h, Macro gate strip.

Plus `getGreeting()` consolidation and market-clock subtitle (`Monday, May 18 · NYSE open · 2h 14m to close`).

Judgment calls: time format follows literal `CT` example (Chicago) not the abstract "NYC time" mention; `?kind=` filter used (page doesn't have `?status=unacked`); markdown notes render as plain text (no lib in package.json).

In Review pending Terry's local layout / density / hairline / accent CTA check.

### THS-75 — AIQ Editor cockpit (In Review)

3 commits: `5799671` → `26bebc8`. Schema + cockpit + queue.

**Schema:** new columns on `aiq_rubric`: `confidence text` + `last_change_reason text` via `ADD COLUMN IF NOT EXISTS`. Migration `20260523002000_e44_aiq_rubric_edit_audit.sql` (applied via MCP, recorded at `20260523024635_e44_aiq_rubric_edit_audit`).

**Cockpit panel** (per /aiq/[ticker]): 6-dim editor, live composite recompute, severity-style confidence pill (High/Medium/Low), last/next-review meta in header, reason-for-change field, dirty chip near Save. Critical incidental fix: `getAiqContext` returned hardcoded `seed = null` since the 2026-05-22 fixture strip — every editor route showed "not in universe." Patched with real universe lookup.

**Needs-review queue** atop /aiq index: tickers with `last_scored > 90d ago`, sorted most-overdue first. Only renders when there's something to review.

Judgment calls: kept explicit Save button (preserves UPSERT-by-day versioning) + dirty chip instead of debounced auto-save; lightweight schema option over a separate `aiq_rubric_edits` audit table; confidence on severity palette (not iris) per /lambo Q-lock.

In Review pending Terry's local visual on cockpit density and overdue band.

## Linear management

Tickets created/moved in S27:
- **THS-92** (new epic) — "Personal-tool v1 polish (post-monetization-cancel)" — In Progress. 10 sub-issues re-parented from canceled THS-70.
- **THS-93** (retro, Done) — S25 fixture/demo data strip + memo cadence move to weekly
- **THS-94** (retro, Done) — S26 page-walk + motion + token audits
- **THS-95** (S26 migration follow-up, Done) — apply 2 missing migrations to prod (closed after Gate 2 verified)
- **THS-96** (advisor cleanup, Done)
- **THS-97** (CRM universe classification — Low priority, Backlog)
- **THS-98** (earnings calendar schema + ingestion — Medium priority, Backlog)
- **THS-70 / 84 / 85 / 86 / 87** (canceled — monetization epic + sub-issues + duplicate)
- **THS-33 / 34** (closed Done — parent epics with all sub-issues already Done)
- **THS-48** (Done) — IBM flag added
- **THS-71** (In Progress → still In Progress — UI shipped, routine-fires + Vercel deploy gate Terry-only)
- **THS-73 / 74 / 75** (Backlog → In Review)
- **THS-91** description rewritten — dropped daily-cron language, reframed around weekly Saturday cadence

## Prod database state at end of S27

- 4 migrations applied this session: e25_aiq_scores_cron, e80_routines_pr1, e80_advisor_cleanup, e34_ibm_depreciation_flag, e44_aiq_rubric_edit_audit (5 actually — that's e25 + e80 + advisor + IBM flag + AIQ audit columns).
- All advisor warnings introduced by e80 cleared. Remaining advisor noise is pre-existing Epic 1-3 (separate scope).
- `auth.users`: 3 rows (terry@zero-in.io, at-turner@sbcglobal.net, terryturner2027@gmail.com). Dad's confirmed email `terryturner@gmail.com` NOT yet present.
- `public.users`: 1 row (Terry at owner tier).
- `portfolio_positions`: 13 rows backfilled with user_id NOT NULL.
- `aiq_draft_queue`: 5 rows seeded (status=queued).
- 7 routine output tables exist; all empty except seeded queue.
- `depreciation_flags`: 6 unique tickers flagged (5 from prior + IBM added today).

## Commits pushed (15 in S27)

```
26bebc8  THS-75 /aiq needs-review queue (quarterly cadence overdue)
45c7495  THS-75 AIQ cockpit — 6-dim editor + composite + confidence + cadence
5799671  THS-75 aiq_rubric edit-audit columns (migration + apply)
2404597  THS-74 market-clock subtitle + getGreeting consolidation
c6f6412  THS-74 right rail — Calendar + Insider 24h + Macro gate strip
05ae796  THS-74 Today's Thesis card + 5 data rows
e0bf24d  THS-73 live/stubbed factor strip on /universe
56d3b7e  THS-73 score math drawer primitive + open affordance on detail page
d8adc39  THS-73 wire engine-status strip into 7 analytical pages
a82cc8e  THS-73 engine-status strip primitive + data helper
885d753  THS-48 add IBM depreciation flag (6th hyperscaler)
8643573  THS-71 /aiq-drafts Pending tab + /decisions thesis_broken alert
06a931e  THS-96 draft e80 advisor cleanup migration + confirm Dad email
bb84229  docs(handoffs): S27 part 1 — e25 + e80 migrations applied, Linear pivoted
ab2b956  docs(CLAUDE.md): codify autonomous-by-default rule for future sessions
8a826c5  fix(e80): swap hardcoded owner email to terry@zero-in.io
```

## What's pending Terry's action

| Item | Action |
|---|---|
| Visual review of THS-73 (Score Math drawer + status strips on 7 pages) | Local dev server walk-through; reconcile math on 3 sample tickers; resolve In Review |
| Visual review of THS-74 (dashboard Today's Thesis + rail rework) | Local dev server; check density, hairlines, accent CTA |
| Visual review of THS-75 (AIQ cockpit + needs-review queue) | Local dev server; cockpit panel density, confidence pill placement, overdue band styling |
| Create Dad in Studio | `terryturner@gmail.com` — Studio → Authentication → Users → Add user, auto-confirm ON, strong password |
| Run public.users + portfolio_settings backfill for Dad | Once Dad exists, paste-ready SQL is in `docs/setup/2026-05-21-supabase-setup-checklist.md` §2c–2e |
| Env secrets for routines (THS-71 acceptance) | ANTHROPIC_API_KEY, FMP_API_KEY, POLYGON_API_KEY, CRON_INVOKE_SECRET in Supabase Edge Function Secrets |
| Wire routines in claude.ai/code | Set up 4 routines per `docs/routines/setup-guide.md` |
| Vercel prod deploy | `vercel --prod --yes` to confirm green build |
| Decide THS-98 (earnings calendar) ingestion source | FMP earnings endpoint, or alternative |
| Decide THS-97 (CRM classification) | Re-classify L3 or keep L2 with notes |

## What's next in build order

Under THS-92, after the In-Review tickets resolve to Done:

- **THS-76** — next sub-issue under THS-92 (not yet inspected this session)
- **THS-77** — same
- **THS-78** — Universe row hierarchy (per audit)
- **THS-79 / 80 / 82** — craft polish

Plus the carried-forward routine first-fires + Vercel deploy on THS-71 — Terry actions.

## Verified facts (so the next session doesn't have to re-prove)

- Supabase project: `mvxgnliwvoauwwarrlrr` (AI Thesis, us-west-2, Postgres 17.6.1.121).
- Linear team: Thesis, ID `21c004fc-6402-4d22-9316-fa9a05bb9b82`.
- Branch: `claude/peaceful-rubin-KqluN` — system-mandated for this remote session class.
- Terry's primary email: `terry@zero-in.io` (uid `77631cb5-93bf-4b2b-b992-eae1ca0d271c`).
- Dad's email: `terryturner@gmail.com` (NOT yet in auth.users).
- Mom's email: `at-turner@sbcglobal.net` (in auth.users, confirmed, never signed in).

## Skills loaded this session

- `/honesty`
- `/verification-before-completion`
- `/dispatching-parallel-agents`
- `/subagent-driven-development`
