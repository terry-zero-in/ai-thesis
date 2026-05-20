# S4 handoff — 2026-05-18 — Iris × Voltage color system + Routines PR 1 (partial)

## 1. TL;DR

Headline: shipped two major architectural moves — full color-system swap to Iris × Voltage (replacing S2's Apex Blue) + half of the Routines plumbing PR. Migration SQL is in clipboard + on disk, NOT YET APPLIED to live Supabase (Terry's manual step before the rest can ship). Pending: 2 of 5 UI surfaces, 4 routine prompts, setup guide. ~1 day of focused work remaining to complete PR 1.

## 2. Architectural pivot or major decision

**Pivot 1 — Color system fully replaced.** Apex Blue (#3560F3, locked S2 2026-05-18 ~9am) was superseded same day (~9:30am) by Iris × Voltage v1.0. **Why:** Terry sent a 5-screen color-system spec ("Iris × Voltage" — jet-black canvas, vivid violet brand signal, neon chartreuse single-CTA, frost text scale) and directed "match it identically." Apex Blue lock is dead. **Tradeoff accepted:** all references to "the accent blue is locked, never revert" in prior handoffs are stale as of S4.

**Pivot 2 — Routines architecture (Bucket A + B, NOT C).** After Terry asked "is this monetizable?" I scoped three buckets — A: routines themselves, B: multi-tenant-ready schema (cheap-to-add-now), C: public marketing landing. Terry locked A + B only. **Why:** Schema choices are cheap now, painful to retrofit later; the marketing landing is premature without 60-90 days of personal-use validation. **Tradeoff accepted:** the Iris × Voltage Atmosphere gradient does NOT get applied to a marketing landing in this session.

## 3. State of the world

### Services + endpoints
- Production: `https://ai-thesis-v2.vercel.app` → HTTP 307 (auth redirect, expected)
- Latest deploy: `dpl_<see vercel inspect>` — target=production, READY, last fired 2026-05-18 12:46 CDT
- Direct deploy URL: `https://ai-thesis-v2-b46n77jh2-terry-8893s-projects.vercel.app` (401 — deployment protection on team URLs)

### Secrets (NAMES ONLY — never values)
- Vercel env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `FMP_API_KEY` — unchanged this session
- No new env vars added this session (Routines plumbing intentionally has no fire-endpoint usage; routines fire on schedule, app doesn't POST)
- Tokens to rotate (carry-over from S3): Supabase access token, Perplexity, FMP

### Scheduled jobs
- Existing Vercel crons unchanged (prices, scores, macro, AIQ cron stubs)
- **NEW (not yet active):** 4 Claude Code Routines on claude.ai/code, fire on these schedules once Terry creates them:
  - `daily-batch` — daily 04:30 ET / 09:30 UTC
  - `weekly-rescore` — Saturday 22:00 UTC
  - `monthly-curator` — first Saturday of month, 20:00 UTC
  - `position-pulse` — Sunday 18:00 UTC

### External integrations
- Anthropic Routines API — POST `https://api.anthropic.com/v1/claude_code/routines/{routine_id}/fire`
  - Header: `anthropic-beta: experimental-cc-routine-2026-04-01`
  - Per-routine bearer tokens (NOT Anthropic API key)
  - **15 runs/day cap PER ACCOUNT** (not per routine)
  - PR1 design: routines fire on schedule, app never calls fire endpoint → no bearer tokens needed in Vercel env

### DB state — ai-thesis Supabase
- 52 prior migrations applied
- **NEW migration written: `supabase/migrations/20260518000200_e80_routines_pr1.sql` (551 lines, 24770 bytes) — NOT YET APPLIED**
- Adds: `public.users` table, user_id columns on portfolio_*+alert_acks with RLS auth.uid()=user_id, 7 routine-output tables (aiq_draft_queue, weekly_summary, insider_summary, macro_log, memo_proposals, universe_proposals, position_pulse)
- Backfills all existing rows to Terry's auth.uid (terryturner2026@gmail.com)
- Atomic + idempotent

### Git state
- Branch: `main` @ `e1148087d32488c1bc72cd93d86f695a91790b2c`
- Commits ahead of `origin/main`: **9** (S2 handoff + 6 commits S3 + S4 color migration + S4 PR1 partial)
- Working tree: clean except untracked `docs/handoffs/2026-05-18-S3-polish-portfolio-next16-actions.md` (not yet committed from prior session)
- `tsc --noEmit` exit 0
- Pushed to GitHub: NO. SSH agent issue persists from S3. All deploys via `vercel --prod --yes` from `web/`. Terry must `git push origin main` from his terminal.

## 4. Action / API reference

None new this session in ai-thesis itself. Routines API for future reference:

```
POST https://api.anthropic.com/v1/claude_code/routines/{routine_id}/fire
Headers:
  Authorization: Bearer $ROUTINE_TOKEN
  anthropic-version: 2023-06-01
  anthropic-beta: experimental-cc-routine-2026-04-01
  Content-Type: application/json
Body: {"text": "Your message here"}
Response 200: { claude_code_session_id, claude_code_session_url }
```

Not used in PR1 — routines fire on schedule. Documented here for v2 (on-demand fires for ad-hoc rescoring).

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/app/globals.css` | modified | Iris × Voltage palette tokens replace Apex Blue. Aliases (`--canvas`, `--accent`, etc.) preserve all 682 component refs. |
| `web/src/components/primitives/Btn.tsx` | modified | Added `voltage` variant (pill 9999px, voltage-ink text, voltage state ladder). Fixed `#d04545` danger hover → color-mix. |
| `web/src/app/login/LoginForm.tsx` | modified | Sign-in button → Voltage pill (page primary CTA) |
| `web/src/app/portfolio/AddPositionForm.tsx` | modified | Buy/Add/Update button → Voltage pill |
| `web/src/app/aiq-drafts/DraftCard.tsx` | modified | Promote-to-rubric button → Voltage pill |
| `web/src/app/aiq/[ticker]/AiqEditor.tsx` | modified | Save scoring button → Voltage pill |
| `web/src/components/shell/Tip.tsx` | modified | Hex sweep `#1a1b1d` → `var(--surface)` |
| `web/src/components/shell/CtxPanel.tsx` | modified | Hex sweep `#1A1B1E` → `var(--border-subtle)` |
| `web/src/components/shell/Sidebar.tsx` | modified | Hex sweep + added /proposals nav entry |
| `web/src/components/universe/LayerChip.tsx` | modified | Categorical encoding: L1 off accent (collision) → `#5BC0DE` teal; L4 → `--warning`; L5 → `--frost-500` |
| `web/src/components/primitives/HeroNumber.tsx` | modified | Suppress delta block when `delta.value === 0` (fixes "$10,998.0" trailing-zero render) |
| `supabase/migrations/20260518000200_e80_routines_pr1.sql` | **CREATED** | 551-line migration — users table + user_id backfill + 7 routine-output tables. NOT YET APPLIED. |
| `web/src/lib/routine-outputs.ts` | **CREATED** | Server-side getters for the 7 routine-output tables. All use getSupabaseServer. |
| `web/src/lib/aiq-queue.ts` | **CREATED** | enqueueAiqDraft + getQueuedTickerSet helpers. |
| `web/src/lib/universe-data.ts` | modified | UniverseSnapshot gains `queuedTickers`; getLatestUniverseScores parallel-fetches the queue. |
| `web/src/components/universe/UniverseTable.tsx` | modified | Iris "Q" pill next to tickers in aiq_draft_queue. |
| `web/src/app/universe/page.tsx` | modified | Pass queuedTickers to table. |
| `web/src/components/dashboard/MorningBrief.tsx` | **CREATED** | Dashboard block surfacing daily-batch routine outputs (insider + macro + memo proposals). Invisible pre-routine-fire. |
| `web/src/app/page.tsx` | modified | Imports + renders `<MorningBrief data={morningBrief} />` between AlertCallout and KpiRow. |
| `web/src/app/proposals/page.tsx` | **CREATED** | NEW /proposals page rendering universe_proposals (monthly-curator output). Empty state explains cadence. |

## 6. Decisions locked

**D1. Iris × Voltage v1.0 is the canonical color system.**
- Why: Terry sent the spec with "match it identically" directive.
- Tradeoff accepted: Apex Blue lock from S2 is dead. Memory `basis_palette_shortlist` is stale.

**D2. One Voltage primary CTA per page (rule, not guideline).**
- Why: spec text says "one per page is the rule. The eye finds it instantly." Multiple Voltage = anti-pattern.
- Tradeoff accepted: Dashboard + Decisions have NO Voltage (no hero action on those pages). Don't manufacture one.

**D3. Atmosphere gradient NOT applied to data pages.**
- Why: per Browser Claude /lambo crit Terry forwarded — "Atmosphere lives on the palette doc, not on data pages. Pages of data deserve flat backgrounds."
- Tradeoff accepted: Atmosphere tokens are defined but unused. Live for future marketing/onboarding pages.

**D4. Iris is for SIGNALS, not severity. Severity ladder (success/warning/danger) is independent.**
- Why: spec text says "Iris reserved for conviction signals... never decorative." Severity is truth-state.
- Tradeoff accepted: when regime is defensive (3 gates), the multiplier UI uses `--danger`, NOT Iris-red-700.

**D5. Multi-tenant schema readiness (Bucket B) ships now; product surface (Bucket C) defers.**
- Why: schema is cheap-to-add-now / painful-to-retrofit. Marketing landing is premature without 60-90 days personal use.
- Tradeoff accepted: Terry can't show this to anyone as a product yet. Architecture is ready when he is.

**D6. Routines fire on schedule only; app never calls fire endpoint.**
- Why: Terry directive: "I dont plan on manually running or updating anything." Plus 15/day cap means app-triggered fires risk burning budget unpredictably.
- Tradeoff accepted: no real-time rescore. App queues to aiq_draft_queue, next daily-batch picks up.

**D7. Batch architecture, not per-user routines.**
- Why: 15/day cap is per Anthropic account, NOT per user. One shared daily-batch routine processing all users' queued work scales to thousands of users.
- Tradeoff accepted: per-user "fire now for me" not available.

**D8. v1 routines = 4, not 5. Earnings-batch deferred to v1.1.**
- Why: Terry confirmed earnings_calendar not ingested ("i dont have anything setup right now fyi"). Routine 3 has no data to read.
- Tradeoff accepted: earnings-driven AIQ refresh has manual lag until v1.1 adds the ingest.

## 7. Next-session test plan

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                                          # expect: e1148087d32488c1bc72cd93d86f695a91790b2c
git status --short                                          # expect: only S3 + S4 handoff docs untracked
git log --oneline origin/main..HEAD | wc -l                 # expect: 9 (or 0 if Terry pushed)
cd web && ./node_modules/.bin/tsc --noEmit && echo OK       # expect: OK
# Verify all "use server" files still pass the Next 16 async-only export rule
for f in $(grep -rl '^"use server"' src --include="*.ts" --include="*.tsx"); do
  bad=$(grep -nE "^export (const|let|var|enum|class)" "$f")
  [ -n "$bad" ] && echo "BAD: $f"
done                                                         # expect: empty
curl -s -o /dev/null -w "%{http_code}\n" https://ai-thesis-v2.vercel.app  # expect: 307
```

### 7.2 Migration verification (after Terry applies)

Run in Supabase Studio SQL editor (replace ai-thesis project URL):

```sql
SELECT
  (SELECT count(*) FROM public.users)                       AS users_count,           -- expect 1
  (SELECT subscription_tier FROM public.users LIMIT 1)      AS terry_tier,            -- expect 'owner'
  (SELECT count(*) FROM public.portfolio_positions WHERE user_id IS NOT NULL) AS positions_backfilled,
  (SELECT count(*) FROM public.alert_acks WHERE user_id IS NOT NULL)          AS acks_backfilled,
  (SELECT count(*) FROM public.aiq_draft_queue WHERE status = 'queued')       AS queue_seeded;  -- expect up to 5
```

### 7.3 Visual / UI verification (post-deploy)

In a browser logged into ai-thesis-v2.vercel.app:

1. **Iris × Voltage live:** open `/login` while signed out → "Send magic link" button should be a chartreuse pill (#CCFF33). If it's still blue, something's wrong.
2. **Hero number fix:** open `/portfolio` (after adding 1 position at cost = current price) → market value reads "$X,XXX" with NO trailing ".0" delta.
3. **MorningBrief visibility:** open `/` (dashboard) → there should be NO Morning Brief section yet (routines haven't fired). After Terry applies migration + creates routines + first daily-batch fires, it should appear with insider/macro/memo proposals.
4. **/proposals empty state:** open `/proposals` → should show "No pending proposals" empty state with cadence explanation. Sidebar nav should have new "Proposals" entry between Decisions and Backtest.
5. **/universe queued badge:** open `/universe` → no Iris "Q" pills yet (queue table doesn't exist on live DB yet). After migration applies + seed populates 5 tickers, those 5 rows should show the badge.

## 8. Budget / quota tracking

**Anthropic Routines: 15 runs/day per account.**
- Steady-state design: 4 routines, ~9-12 runs/week (~1.5/day avg)
- Initial setup testing budget: 8-12 runs (creating each routine, firing once to validate)
- Headroom OK during setup; comfortable steady state.

**No other quota changes this session.** Vercel + Supabase + FMP within prior budgets.

## 9. Known issues / backlog

### Blocking next-session work
1. **Migration NOT YET APPLIED to live Supabase.** Terry's manual step: Studio → SQL Editor → paste from clipboard (or `supabase/migrations/20260518000200_e80_routines_pr1.sql`) → Run. Pre-requisite: Terry must have signed in to deployed app at least once so `auth.users` has his row (migration raises clear error if not).

### PR 1 remaining (2 of 5 UI surfaces + prompts + guide)
2. `/aiq-drafts` page — add Pending tab listing aiq_draft_queue rows (uses `getQueuedAiqDrafts()` from `aiq-queue.ts`).
3. `/decisions` page — add "thesis_broken" alert kind sourced from `position_pulse` where verdict='broken' (uses `getPositionPulse()` from `routine-outputs.ts`).
4. Author 4 routine prompts as paste-ready specs in `docs/routines/`:
   - `01-daily-batch.md` (AIQ drafts + insider + macro + drift in one Claude session)
   - `02-weekly-rescore.md` (composite recompute + weekly narrative)
   - `03-monthly-curator.md` (ADD/TRIM suggestions to universe_proposals)
   - `04-position-pulse.md` (per-user thesis-intact check, broken → alert)
5. Setup guide `docs/routines/setup-guide.md`: step-by-step for Terry to create routines on claude.ai/code, configure Supabase MCP connectors with service-role key, validate first fires.

### Carry-over from earlier sessions
6. 9 commits unpushed to GitHub (SSH agent issue). Terry needs to `git push origin main` from his terminal.
7. S3 handoff doc (`docs/handoffs/2026-05-18-S3-polish-portfolio-next16-actions.md`) still untracked.
8. AAII data quality — Perplexity scrape gap (filled 5/366 days only). Not blocking PR1.
9. 3 API tokens to rotate (Supabase access, Perplexity, FMP) — carry-over from S3.

### Earnings calendar ingestion (defers Routine 3 to v1.1)
10. FMP `/earning_calendar` ingest needed before earnings-batch can ship. ~1-2 hours of cron wiring.

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Project root | `/Users/terryturner/Projects/ai-thesis` |
| Working dir | `/Users/terryturner/Projects/ai-thesis/web` |
| Migration path | `supabase/migrations/20260518000200_e80_routines_pr1.sql` |
| Migration line count | 551 |
| Migration byte size | 24,770 |
| HEAD SHA | `e1148087d32488c1bc72cd93d86f695a91790b2c` |
| Branch | `main` |
| Commits ahead of origin/main | 9 |
| Latest deploy ID | `dpl_5NJtnXAmWVDiUhnLL6YQ6VnuZG6Q` (Iris × Voltage) + `dpl_<new>` (PR1 partial) |
| Production URL | `https://ai-thesis-v2.vercel.app` |
| Terry's auth email | `terryturner2026@gmail.com` |
| ai-thesis Supabase project ref | (set via NEXT_PUBLIC_SUPABASE_URL env var; ai-thesis project, not Reticle) |
| Reticle Supabase project ref | `ydzvrosvkmqkdaqgsxtb` (KEEP — hosts Routines/Paperclip oc_* catalog, NOT ai-thesis data) |
| Anthropic Routines fire endpoint | `https://api.anthropic.com/v1/claude_code/routines/{routine_id}/fire` |
| Anthropic Routines beta header | `anthropic-beta: experimental-cc-routine-2026-04-01` |
| Anthropic Routines daily cap | 15 runs/day per account |
| Iris × Voltage spec | 5-image set Terry pasted at session start; CSS at `web/src/app/globals.css` |
| Accent color (old) | `#3560F3` Apex Blue (LOCKED S2, SUPERSEDED S4) |
| Accent color (new) | `--iris-300: #A87DFE` (interactive signal) + `--voltage: #CCFF33` (single primary CTA) |
| Voltage-ink (text on voltage) | `#0B0C0F` near-black |
| Routines/Paperclip artifact dir | `~/Hub/reticle-optimizeclaude/db/oc-routine-*` (channel schema + role prompts) |

## 11. Pitfalls / gotchas

1. **Migration prerequisite — Terry must have signed in to deployed app at least once** so `auth.users` has his row. Migration raises with exact error message if not.
2. **Migration is single-tenant-safe today, multi-tenant-ready tomorrow.** Today: backfills all rows to Terry's user_id, behavior unchanged. Tomorrow: new signups get their own user_id, RLS enforces isolation. Don't rip it out thinking it broke single-user use — it didn't.
3. **The migration changes PKs on portfolio_settings (was id=1) and portfolio_positions (was ticker).** New PKs are user_id (singleton-per-user) and (user_id, ticker). Any external SQL referencing the old PKs will break. None known in app code.
4. **`alert_acks` PK also changed** from `alert_key` to `(user_id, alert_key)`. App code uses upsert by alert_key — verify it still works post-migration (app reads cookie-bound user_id automatically).
5. **15 runs/day cap is per Anthropic account, NOT per routine.** Routines themselves can be created in unlimited quantity. Don't burn the budget on validation fires.
6. **Routine output tables have anon SELECT permitted.** This is intentional — dashboard reads without an auth dance. Once Bucket C (multi-tenant signups) lights up, may need to switch to authenticated-only for some.
7. **Iris-300 collides with old layer-categorical L1 violet.** Fixed in `LayerChip.tsx` — L1 moved to `#5BC0DE` teal. If you reintroduce categorical encoding elsewhere, do NOT use iris-300 for L1.
8. **Atmosphere tokens are defined but NOT applied to body.** Don't reach for `var(--mist)` or `var(--frost-bg)` as a UI surface fill — they're gradient stops, not UI elevation steps. Surface tier is `--jet → --onyx → --carbon → --steel`.
9. **`Empty` placeholder for routine outputs is "render nothing", not "render explainer card".** MorningBrief returns null when nothing has fired. The dashboard already has score-movers + macro gate strip carrying the page — Morning Brief is additive, not load-bearing. Don't add fake "Routines coming soon" cards.
10. **SSH agent NOT loaded in agent's terminal.** 9 commits unpushed to GitHub. Production is current (Vercel CLI deploy works). Terry must push from his own terminal.
11. **`docs/handoffs/2026-05-18-S3-polish-portfolio-next16-actions.md` still untracked** from S3. Either commit it as part of S5's first commit, or include it in the same commit as S4 handoff.
12. **TS interface `UniverseSnapshot.queuedTickers` is mandatory** — buildSnapshot and fixtureSnapshot return empty array. universe-data-server.ts doesn't fetch the queue (server variant powers the dashboard rail, which doesn't render queued badges). Don't add queue fetch to the server variant unless dashboard needs it.

## 12. Next-session pickup point

Run §7.1 verification (4 commands, ~30s). Then ask Terry: **"have you applied the e80 migration in Supabase Studio yet?"** If yes → proceed with Task 43 remainder (/aiq-drafts Pending tab + /decisions thesis-broken alert), then Task 44 (4 routine prompts), then Task 45 (setup guide). If no → wait for migration apply before any work referencing the new tables (the lib helpers will return empty until tables exist, but the UI surfaces shipped this session already handle that gracefully).
