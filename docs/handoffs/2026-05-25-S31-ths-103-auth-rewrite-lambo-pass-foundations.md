# S31 — THS-103 sell flow + password auth + launch runbook + Lambo Pass foundations

**Date:** 2026-05-25 (UTC)
**Branch:** `claude/peaceful-rubin-KqluN`
**HEAD SHA:** `251763a`
**Commits ahead of `origin/main`:** 9 (none of S31 is on `main` yet — `main` last fast-forwarded at `b559ae7` mid-session, then S31 added 8 more commits on top of branch only)
**Continuation of:** S30 (2026-05-25, Linear cleanup + merge to main + Vercel project mismatch)

## Headline

Two unrelated chunks of work shipped this session, both major:

1. **THS-103 sell flow + password-only auth + launch runbook** (commit `b559ae7`, fast-forwarded to `main` mid-session). The /portfolio page now supports partial + full sells with realized P&L math, the closed-positions section, and reserve reconciliation. `/login` was rewritten from magic-link to email+password per Terry's directive (sbcglobal.net delivery for Mom was unreliable). A new `docs/runbooks/launch.md` covers the Mac-side steps for THS-104/105/107 end-to-end.
2. **Lambo Pass v1 foundations** (8 commits, S31-only) — Terry's comprehensive design brief executed in waves: §A spine fix (revised to Universe-only after his clarification), §F three signature primitives (`DerivationLadder`, `QuietActionRow`, `TraceOverlay`), §G two industry-first features (TraceOverlay wired on Universe Detail, ConvictionTape wired on Dashboard). The polish layer (§B sticky, §C per-page nits, §D cross-cutting, §E severity discipline) is filed as THS-108 for a follow-on pass.

The build is green (TS=0, lint=0 errors, `next build` 18/18 routes). The branch needs to be merged to `main` before Vercel will deploy the Lambo Pass work.

## Operating posture (verbatim from Terry this session)

- **Mid-session:** "Lets keep running autonomously" + "Only come to me for mission critical decisions" — reinforced the existing CLAUDE.md rule. Held.
- **§A scope correction:** "look at universe i think it just means duplkicate spine on like that one" — narrowed the spine fix from sitewide to Universe-only. I had over-applied the brief; reverted Wave 0's global lift on 5 pages, kept the Universe-specific trim.
- **§E typo correction:** "Btw if that said to change the accent color do not do that that was a typo and it should not be changed, only the severities color" — the brief's "monochromatic tightening of indigo" was a typo. `--accent` stays untouched; only severity (red/green) discipline applies. Captured in THS-108.
- **Subagent dispatch posture:** "Dispatch /subagent-driven-development/dispatching-parallel-agents as much as you can utilize" — used parallel implementers for Wave 1 (4 agents, all disjoint files: 4 primitives) and Wave 2 (2 agents, disjoint files: Universe Detail wiring vs Dashboard wiring). Per-page §C nits + cross-cutting sweep deferred to THS-108 rather than dispatching 10 more agents speculatively.

## Tickets shipped / advanced

### THS-103 — Sell flow + realized P&L + retroactive entry + reserves credit
**State change:** Todo → **In Review**. Comment posted with full shipped-summary + known limitation (re-opening a closed ticker preserves `realized_pl` but the row disappears from the closed-positions view).

**Commits:** `b559ae7` (single bundled commit including auth rewrite + runbook).

**Files:**
- Migration: `supabase/migrations/20260525000000_ths_103_sell_flow.sql` (adds `exit_price`, `realized_pl`, `realized_proceeds`, `original_shares`; relaxes `shares > 0` → `shares >= 0`)
- New UI: `web/src/app/portfolio/SellForm.tsx`, `SellDrawer.tsx`
- Updated UI: `PositionsTable.tsx` (Sell button + closed-positions section), `AggregateBar.tsx` (Col 2 = Realized P&L · all time)
- Server action: `sellPosition()` in `web/src/app/portfolio/actions.ts` (single-row-per-(user,ticker), cumulative realized P&L)
- Data layer: `portfolio-data.ts` fetches closed positions, computes new aggregates, reserve formula = `capital + total_realized_pl − Σ(cost_basis × open_shares)`
- Types: `portfolio-types.ts` extended with `ClosedPositionRow` + `SellablePositionPrefill`

**Acceptance per ticket:** schema ✅, UI Sell action ✅, SellDrawer ✅, Closed-positions section ✅, sellPosition() action ✅, total_realized_pl + reserve formula ✅, AggregateBar Col 2 swap ✅. Verify scenario from ticket body (buy 10@100 → sell 5@150 → sell 5@80 → realized +$150) confirmed by inspection of the math; live DB round-trip pending Terry's runbook execution.

**Judgment calls:**
- Removed `closePosition()` action entirely (no UI callers after the swap). Less code to maintain.
- Single-row-per-(user,ticker) preserved per ticket spec — partial sells decrement `shares`, accumulate `realized_pl`, set `closed_at` only when `shares` reaches 0.
- `exit_price` stores the MOST RECENT sale price (display only). The canonical math is `realized_pl` cumulative.
- Reserve formula: `capital + realized_pl − deployed-in-open`. Verified end-to-end against the ticket's example: 100K start → buy 10@100 = 99K → sell 5@150 = 99,750 → sell 5@80 = 100,150. ✓

### Auth rewrite (no Linear ticket — Terry directive)

**Commits:** `b559ae7` (same bundle as THS-103).

**Files:**
- `web/src/app/login/page.tsx` — copy stripped of magic-link wording
- `web/src/app/login/LoginForm.tsx` — email + password fields, generic error
- `web/src/app/login/actions.ts` — `signInAction()` replaces `sendMagicLink()`, returns generic "Invalid email or password" (anti-enumeration)
- `/auth/callback` route retained as dead code for future password-recovery wiring

### Launch runbook (no Linear ticket — operational doc)

**Commits:** `b559ae7`.

**File:** `docs/runbooks/launch.md` — 8 Mac-side steps covering THS-104 (4 secrets + 20 edge function deploys), THS-105 (manual cron fire + 3-user RLS smoke + sell-flow smoke), THS-107 (Vercel re-link to `ai-thesis-v2` + redeploy), and password provisioning for all 3 users via admin API curl (no email delivery dependency).

### Lambo Pass §A — Mono Meta Spine (Universe-only after revision)

**Commits:** `1dd73d6` (initial global lift) → `d9438cf` (revert + Universe-only narrowing).

**Net state:**
- Dashboard, Regime, Portfolio, Decisions, AIQ — render `<EngineStatusStripAsync />` per-page as before
- Universe (`/universe`) — does NOT render EngineStatusStrip; the engine-info segments already echoed `PageHeader.meta`, and `LiveStubbedStrip` echoed `Mode: Tier-A Composite` on top of that
- Universe Detail (`/universe/[ticker]`) — also stripped of EngineStatusStrip alongside the list. Trivial to restore if Terry wants the detail page to keep the global row.
- `Shell.tsx` still mounts `TraceProvider` and `<TraceOverlay />` at shell level (kept from F3)

### Lambo Pass §F — Three signature primitives

**Commits:**
- `1d37111` — `DerivationLadder.tsx` (signature pattern #2 of 3, inline `→` chain)
- `79ffdef` — `QuietActionRow.tsx` + `.quiet-actions` rule in globals.css (signature pattern #3 of 3, hover-reveal action pills)
- `497be10` — `TraceOverlay` system (TraceProvider + TraceTarget + TraceOverlay), mounted in Shell.tsx — F3 doubles as the §G feature 1 primitive

**MonoMetaSpine.tsx** is signature pattern #1 of 3; already existed pre-S31.

### Lambo Pass §G feature 1 — Score Provenance Trace (TraceOverlay)

**Commits:** `497be10` (primitive) → `ed07212` (wiring on Universe Detail).

**Files added/touched:**
- NEW `web/src/components/conviction/TraceProvider.tsx`, `TraceTarget.tsx`, `TraceOverlay.tsx`
- NEW `web/src/lib/name-trace-data.ts` — single query against `scores_history` (schema deviation: there are NO separate `q_scores/g_scores/...` tables; per-factor scores live as columns on `scores_history`)
- `web/src/app/universe/[ticker]/page.tsx` — parallel-fetches `getNameTraceData(ticker)`, passes to client
- `web/src/app/universe/[ticker]/NameDetailClient.tsx` — accepts `trace: TraceData | null`, passes through
- `web/src/components/name/NameHeader.tsx` — wraps composite hero in `<TraceTarget>` (only when trace is non-null), renders `T trace ↗` mono hint chip
- `web/src/components/primitives/HeroNumber.tsx` — extended with optional `wrapValue` + `footer` render-props so TraceTarget + DerivationLadder integrate without restructuring

**Keyboard:** `T` (lowercase or capital) toggles overlay when a score is focus/hover-armed. `Esc` always closes. Cmd/Ctrl/Alt guards. Skips when typing in inputs.

**Empty state:** returns `null` when `scores_history` has < 2 rows for the ticker — overlay shows "No trace target. Hover a score and press T."

### Lambo Pass §G feature 2 — Conviction Tape

**Commits:** `408260b` (primitive) → `251763a` (wiring on Dashboard).

**Files added/touched:**
- NEW `web/src/components/conviction/ConvictionTape.tsx`
- NEW `web/src/lib/conviction-tape-data.ts` — 4 data sources (recent decisions, score movers 7d, regime gate proximity, portfolio trigger proximity), `Promise.allSettled` per source, per-source try/catch, ranking by severity → recency → magnitude, cap at 5
- `web/src/app/page.tsx` — mounts `<ConvictionTape items={tapeItems} />` as the very first JSX child of the Dashboard root (above GreetingStrip + DashboardRailRegister + EngineStatusStrip)

**Keyboard:** ←/→ scrub (when focused), Space pins/unpins, mouseenter pauses rotation, status-dot click pins, clicking the row triggers the action.

**Persistence:** localStorage key `"conviction-tape:pinned"` survives recompute via stable per-item IDs (`alert:tier_change:{ticker}:{as_of}` etc.).

**Empty state:** returns `null` when all sources contribute zero items — collapses tape to 0px.

**Per-source soft cap of 3** prevents one source from monopolizing all 5 slots.

## Linear management this session

| Ticket | State | Action |
|---|---|---|
| THS-103 (sell flow) | Todo → **In Review** | Comment posted with shipped summary + known limitation |
| THS-104 (env secrets) | Todo (unchanged) | Comment posted referencing runbook Steps 2-4 |
| THS-105 (daily-batch + RLS smoke) | Todo (unchanged) | Comment posted referencing runbook Steps 4 + 7 |
| THS-107 (Vercel re-link) | Todo (unchanged) | Comment posted referencing runbook Step 5 |
| **THS-108 (NEW)** | Todo, Medium | Filed mid-/sch — Lambo Pass §B/C/D/E polish + Trace/Tape follow-ons. Parent: THS-92. |

## Prod database state at end of session

- Migration `20260525000000_ths_103_sell_flow.sql` exists in `supabase/migrations/` but is **NOT YET APPLIED** to live Supabase. Terry's runbook Step 1 applies it via `supabase db push`. Until then, the sell flow will 500 on the new columns.
- All other tables unchanged from S30. `scores_history` is still the canonical denormalized score table (no per-factor tables exist).
- No row-count changes — this session shipped code only, no data ops.
- Advisor / security state: no `force_rls` or RLS changes this session. THS-100 sync trigger (S29) still in place.

## Commits pushed

```
251763a S31 Lambo Pass §G feature 2 wiring — ConvictionTape on Dashboard
ed07212 S31 Lambo Pass §G feature 1 wiring — TraceOverlay on Universe Detail
d9438cf S31 Lambo Pass §A revisited — narrow the spine fix to Universe only
408260b S31 Lambo Pass §G feature 2 — ConvictionTape
497be10 S31 Lambo Pass §G feature 1 — TraceOverlay (Score Provenance Trace)
79ffdef S31 Lambo Pass §F — QuietActionRow primitive
1d37111 S31 Lambo Pass §F — DerivationLadder primitive
1dd73d6 S31 Lambo Pass §A — kill duplicate Mono Meta Spine
b559ae7 THS-103 sell flow + password auth + launch runbook
```

All on `claude/peaceful-rubin-KqluN`. `main` is at `b559ae7` (the THS-103 commit was fast-forwarded to main mid-session before the Lambo Pass work began; the 8 Lambo commits are branch-only and need a merge to land on main / hit Vercel).

## Pending Terry actions

| # | Action | Where | Effort |
|---|---|---|---|
| 1 | **Merge `claude/peaceful-rubin-KqluN` → `main`** so Vercel picks up the Lambo Pass work + the auth/sell-flow work | local Mac: `git checkout main && git merge --ff-only claude/peaceful-rubin-KqluN && git push origin main` | 1 min |
| 2 | **Apply THS-103 migration** | Mac: `cd supabase && supabase db push` (runbook Step 1) | 2 min |
| 3 | **Run launch runbook** Steps 2-8 — secrets, edge fn deploys, manual cron fire, Vercel re-link, set 3 passwords, RLS + sell-flow smoke | `docs/runbooks/launch.md` | ~45 min |
| 4 | **Visual eyeball Lambo Pass on Vercel** — check the Conviction Tape lights up (or collapses to 0px if data tables empty), Trace Overlay toggles with `T` on Universe Detail, DerivationLadder reads as a clean pipeline, Universe page no longer has the three-strip stack | Vercel preview / prod | 15 min |
| 5 | **Decide on §G calibration items** (insider BUY → severity remap, NameDetail strip restoration, ConvictionTape mover deep-link to trace) — captured in THS-108 follow-ons | review THS-108 | 5 min |
| 6 | **Decide on THS-108 dispatch posture** — single agent for cross-cutting, parallel agents per page, or sequential | review THS-108 | conversation |

## Next ticket in build order

**Strictly speaking:** THS-104 (env secrets), unchanged from S30. The launch path remains the blocker for personal-tool v1 going live for Mom + Dad.

**Recommended sequence:**
1. Pending Action #1 (merge to main) — unblocks Vercel
2. Pending Actions #2 + #3 (runbook) — gets the app actually working for the 3 users
3. Pending Action #4 (visual review) — verify the Lambo Pass landed visually as intended
4. Decide on THS-108 (polish layer) — only after Terry has seen the foundations in production

Cranking THS-108 immediately would be premature — its scope assumes Terry has eyeballed the §A/F/G changes and confirmed direction.

## Verified facts (carry forward)

- **Branch:** `claude/peaceful-rubin-KqluN`
- **Supabase project ref:** unchanged from S30 (canonical reference in S30 handoff if you need it)
- **3 users in `auth.users`:** terry@zero-in.io, at-turner@sbcglobal.net (Mom), terryturner@gmail.com (Dad). Mom + Dad are mirrored into `public.users` via the THS-100 sync trigger. All three need passwords set in S31's launch runbook Step 6 (no magic link in v1 anymore).
- **Vercel projects:** Mac currently linked to wrong project (`ai-thesis` not `ai-thesis-v2`). Runbook Step 5 re-links. Don't deploy until re-linked.
- **scores_history schema:** denormalized — `q_score`, `g_score`, `v_score`, `aiq_score`, `composite`, `macro_multiplier` all live as columns on the same row. There are NO separate per-factor tables. (Discovered by W2-A agent while wiring TraceOverlay.)
- **Lambo Pass primitives are NOT consumed yet by existing pages** beyond Universe Detail (DerivationLadder, TraceTarget). `QuietActionRow` is built but unwired — PositionsTable / AIQ Editor / Decisions still use the old four-buttons-per-row treatment. Wiring is in THS-108 scope.

## Skills loaded this session

- `/subagent-driven-development`
- `/dispatching-parallel-agents`
- `/lambo`
- `/linear` (design doctrine)
- `/verification-before-completion`
- `/honesty`
- (`/sch` invoked to wrap)

## Recommendations for next session

**If Terry hasn't run the launch runbook yet** (most likely state on next-session start): the FIRST priority is the merge + Mac-side runbook. The Lambo Pass work is invisible until deployed. Coordinate with Terry — these are mostly his Mac actions, not Claude actions.

**If the runbook has been run + the app is live**: the next session should be the visual-review pass with Terry. He'll either:
- (a) approve the Lambo Pass foundations and dispatch THS-108 to crank the polish layer
- (b) flag corrections (e.g. ConvictionTape mover items don't feel right, TraceOverlay missing something) — handle inline, then dispatch THS-108
- (c) pivot to operations (data quality, cron health) before more UI work

**Don't dispatch THS-108 cold.** It's a large polish ticket (10+ surfaces) and most items are judgment calls that benefit from confirming direction with Terry first. The §G follow-ons (insider BUY remap, NameDetail strip restoration, trace deep-link) are tiny and could ship in any session.

**Watch for cron health after the runbook fires.** Daily-batch on a Saturday weekly-rescore will exercise the most surfaces. The dashboard mover columns, regime gate proximity, decisions alerts — these all feed the Conviction Tape. If the tape lights up with real items, the underlying engine is alive end-to-end.
