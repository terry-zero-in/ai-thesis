# S2 Handoff — 2026-05-18

**Branch:** `main` @ `029780e` · **Production:** [dpl_GDaktGsJdYQgLbgrmfjt9LJ1N3bm](https://vercel.com/terry-8893s-projects/ai-thesis-v2/GDaktGsJdYQgLbgrmfjt9LJ1N3bm) (READY · PROMOTED · aliasAssigned) · **Pushed:** YES · **Last verified:** 2026-05-18 03:55 CDT

---

## 1. TL;DR

- Tier-A polish pass shipped to production after Claude-in-Chrome walked the live site and surfaced a punch-list. Mono Meta Spine wired onto 5 analytical surfaces (Dashboard, Universe, Universe/[ticker], Decisions, Regime). Driver column derives factor-wise wow delta. Movers rows are now full-row Links. Form 4 renders real insider data; DataPendingCard ticket-ID pill stripped. AIQ Editor has Scored/Unscored/All toggle. Regime chart carry-forwards sparse NAAIM/AAII so all 3 series render; threshold dashes now anchor their values at the right edge.
- Root cause of the multi-page fixture leak: Vercel had **empty-string** `NEXT_PUBLIC_SUPABASE_*` env vars; `NEXT_PUBLIC_*` is baked at build time so the bundle inlined `""` → `getSupabaseBrowser()` returned null → every page fell to fixture. Re-PATCHed via Vercel REST API (CLI silently accepted empty values) and redeployed.
- One critical runtime regression introduced + hotfixed: server component imported `getServerGreeting()` from a `"use client"` module — Next 16 rejects non-component exports across the client/server boundary. Fix: extracted pure `computeGreeting()` to `web/src/app/greeting-compute.ts` (no `"use client"` directive); both server page and client GreetingStrip import from it. Caught locally by reproducing dashboard 500 with proxy bypass.
- compute-aiq-scores shipped as new edge function + weekly cron (Sat 22:35 UTC). 18 of 50 tickers now have `scores_history.aiq_score` populated. Vault `cron_invoke_secret` synced to function env via `vault.update_secret(id, ...)`; cron-path auth verified end-to-end via `net.http_post` from SQL.
- ^VIX rewired from dead legacy path to `/historical-price-eod/full?symbol=%5EVIX` on FMP stable. 276 bars backfilled (2025-04-14 → 2026-05-15, close range 13.47–33.82). Portfolio trigger 2b can now evaluate.
- Accent color rebrand mid-session: Cypher Indigo `#4D5BFF` → Apex-adjacent royal blue `#3560F3`. Full accent system (hover/pressed/soft/border/glow) re-anchored to RGB(53,96,243).

## 2. Architectural pivot or major decision

**Decision: keep Reticle Supabase project (`ydzvrosvkmqkdaqgsxtb`) — do NOT delete.** Why: S1 handoff §11 #8 and Block B #7 both claimed Reticle was "empty, abandoned, harmless." File state contradicted: Reticle hosts **20 tables of Routines/Paperclip infrastructure** — `oc_routines` (5 rows), `oc_routine_runs` (13 rows), `oc_routine_messages` (29 rows), `oc_delegation_queue` (3 rows), `oc_agents`, `oc_ticket_locks`, plus 14 product tables (dashboard_*, captures, prompts, skills, sessions, review_*). Deleting would have destroyed the very platform Terry just picked an hour earlier for the Anthropic-via-Routines architecture. Tradeoff accepted: handoff claim wrong twice in a row (S1 propagated S0's mistake); enforces [[feedback_verify_claimed_state]] hard — file state wins, always. Reticle stays as the Anthropic-via-Max DB for future Routines work.

## 3. State of the world

- **Services:**
  - Production: https://ai-thesis-v2.vercel.app (HTTP 200 verified 03:55 CDT)
  - Latest deploy: `dpl_GDaktGsJdYQgLbgrmfjt9LJ1N3bm` (READY · PROMOTED · aliasAssigned · sha=029780e)
  - Supabase project: `mvxgnliwvoauwwarrlrr` "AI Thesis" (Free, us-west-2, ACTIVE_HEALTHY)
  - Supabase project: `ydzvrosvkmqkdaqgsxtb` "Reticle" — **Routines/Paperclip DB, KEEP**
- **Secrets (names only — values in Vercel env / Supabase function env / Supabase vault):**
  - Vercel production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (type=plain — readable via API for verification), `SUPABASE_SERVICE_ROLE_KEY` (type=sensitive — write-only)
  - Supabase function env: `CRON_INVOKE_SECRET` (rotated 2026-05-18 ~02:30 CDT), `FMP_API_KEY`, `PERPLEXITY_API_KEY`, `SEC_USER_AGENT`
  - Supabase vault: `project_url`, `cron_invoke_secret` (synced via `vault.update_secret('a5767249-e337-43eb-9d6b-7540f7ca0eb7'::uuid, ...)` — matches function env now)
- **Scheduled jobs (18 total via pg_cron — added compute-aiq-scores-weekly this session):**
  - Saturday weekly chain: 22:00 Q · 22:15 G · 22:30 V · 22:35 AIQ · 22:35 concentration · 22:40 M · 22:42 S · 22:45 composite
  - Daily ingest (Mon-Fri): 21:00 prices · 21:15 fundamentals · 21:30 consensus · 22:00 options (no key, fails)
  - Other: form4 daily · macro Tue 22:00 · short-interest 1st+16th · daily-memo Mon-Fri 13:00 (no Anthropic, fails) · weekly-ranking Sun 23:00 (no Anthropic, fails) · quarterly-review feb/may/aug/nov 5
- **External integrations:**
  - FMP Starter $29/mo — historical EOD + fundamentals + consensus + insider + ^VIX all working
  - Perplexity PAYG — macro scrape (NAAIM 69/366 days, AAII 5/366, F&G 365/366 — sparse for AAII/NAAIM; chart carry-forwards)
  - Anthropic — **NOT configured;** route TBD (Terry picked Routines mid-session; build deferred)
  - Polygon — NOT configured; insider override fills S-score
  - SEC EDGAR — via FMP wrapper
- **DB state (verified 03:55 CDT):**
  - `universe` 52 rows (50 investable + 2 benchmark)
  - `scores_history` 50 rows for as_of 2026-05-18 (4 High · 10 Med · 18 Low · 18 Avoid)
  - `scores_history.aiq_score` populated for 18 of 50 (matches `aiq_rubric` row count)
  - `aiq_rubric` 18 rows
  - `prices_raw` 14,250 rows total (incl. 276 ^VIX bars)
  - `insider_form4_raw` 416 rows across 5 tickers (AVGO, AES, MSFT, KLAC, ARM)
  - `macro_gauges` 366 rows
- **Git state:**
  - `main` @ `029780e` (3 polish-pass commits + 1 hotfix this session)
  - Local 0 commits ahead of `origin/main`
  - Working tree clean
  - `.env.local` deleted from web/ (was auto-created by `vercel env pull` for local debug; gitignored)

## 4. Action / API reference

| Function endpoint | Auth | Purpose | Status this session |
|---|---|---|---|
| `POST /functions/v1/compute-aiq-scores` | Bearer CRON_INVOKE_SECRET | New: denormalize aiq_rubric → scores_history.aiq_score | ✓ deployed, scheduled, verified end-to-end via cron-path SQL |
| `POST /functions/v1/ingest-prices?days=400` | Bearer | Redeployed with fmp.ts ^VIX fix | ✓ 14,250 rows including 276 ^VIX |
| Vercel REST `PATCH /v9/projects/{id}/env/{envId}` | Bearer (CLI token) | Fix empty env vars (CLI silently accepted empty) | ✓ 3 vars re-set, deploy auto-triggered |
| Supabase Management API `POST /v1/projects/{ref}/database/query` | Bearer SUPABASE_ACCESS_TOKEN | Apply migration + cron payload sim + vault.update_secret | ✓ used multiple times when CLI db push needed password we didn't have |

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `supabase/functions/compute-aiq-scores/index.ts` | created | AIQ per-factor denormalization job (mirrors compute-q-scores pattern) |
| `supabase/migrations/20260518000100_e25_aiq_scores_cron.sql` | created | Weekly cron at 22:35 Sat, slot between V (22:30) and M (22:40) |
| `supabase/migrations/rollback/20260518000100_e25_rollback.sql` | created | Idempotent unschedule |
| `supabase/config.toml` | modified | `verify_jwt = false` for compute-aiq-scores so cron Bearer path works |
| `supabase/functions/_shared/fmp.ts` | modified | `fetchVixHistory` rewired from dead `/api/v3/historical-price-full/%5EVIX` to stable `/historical-price-eod/full?symbol=^VIX` |
| `supabase/functions/ingest-prices/index.ts` | modified | Stale "use legacy endpoint" comment updated to reflect new path |
| `web/src/app/page.tsx` | modified | GreetingStrip extraction; MonoMetaSpine; Driver column; MoversTable refactored from `<table>` to grid+`<Link>` rows; KPI 30D return apology copy reframed |
| `web/src/app/GreetingStrip.tsx` | created | Client component for reactive greeting (60s tick) |
| `web/src/app/greeting-compute.ts` | created | **Hotfix:** server-safe pure compute fn; both server page + client GreetingStrip import from here |
| `web/src/app/universe/page.tsx` | modified | Spine in header (names, as_of, engine, macro) |
| `web/src/app/universe/[ticker]/page.tsx` | modified | Form4Section replaces DataPendingCard for Form 4; ticket-ID pill stripped from other placeholders |
| `web/src/components/name/Form4Section.tsx` | created | Renders insider_form4_raw rows (date/type/insider/value); quiet "No recent Form 4 · monitored daily" for tickers without recent activity |
| `web/src/components/name/NameHeader.tsx` | modified | MonoMetaSpine alongside LayerChip |
| `web/src/components/name/DataPendingCard.tsx` | modified | `ticket` prop removed |
| `web/src/lib/name-detail-data.ts` | modified | Added Form 4 query to Promise.all; NameForm4Row type; form4_recent on NameDetail |
| `web/src/app/decisions/page.tsx` | modified | Spine + bulk-ack moved next to title; dropped "fixture" badge |
| `web/src/app/regime/page.tsx` | modified | Spine; "composite.ts §Fix 4" code-ref dropped from prose |
| `web/src/app/regime/RegimeTrendChart.tsx` | modified | `carryForward()` for sparse NAAIM/AAII series; threshold lines anchor "▲ N" labels at right edge |
| `web/src/app/portfolio/page.tsx` | modified | Removed canvas ReservePanel (rail-only source of truth now) |
| `web/src/app/portfolio/ReservePanel.tsx` | deleted | Duplicate of rail's PortfolioReserveRail |
| `web/src/components/rails/PortfolioReserveRail.tsx` | modified | VIX label `>` → `≥`; stale "main-canvas ReservePanel" comment updated |
| `web/src/app/aiq/page.tsx` | modified | Scored/Unscored/All toggle chips (URL `?show=`); spine; "↗" arrows → "›" chevrons for internal nav |
| `web/src/components/primitives/MonoMetaSpine.tsx` | created | Signature pattern #1 of 3 — reusable spine primitive |
| `web/src/lib/universe-data.ts` | modified | Carry prior_q/g/v/aiq alongside prior_composite (for Driver derivation) |
| `web/src/lib/dashboard-data.ts` | modified | `deriveDriver()` picks max-magnitude factor delta wow |
| `web/src/app/globals.css` | modified | Accent system: `#4D5BFF` → `#3560F3` (+ hover/pressed/soft/border/glow proportional re-anchor) |
| `web/.gitignore` | modified | `.env*.local` added (auto-added by `vercel env pull`) |
| `docs/handoffs/2026-05-18-S2-lambo-polish-fixture-fix.md` | created | This handoff |

## 6. Decisions locked

1. **Mono Meta Spine = signature pattern #1 of 3.**
   - **Why:** Every analytical surface needs a consistent provenance/version/cadence anchor. Bloomberg/Linear discipline: every number ties to a source. Spine is the canonical answer.
   - **Tradeoff accepted:** One extra row of chrome on every page. Mono text is quiet enough to not compete with content; pays for itself when users scan multi-surface state quickly.

2. **Reserve & Triggers panel lives in rail only — NOT canvas.**
   - **Why:** The architectural intent ("glance-mode compression in the rail, full instrument on canvas") was never honored — both rendered near-identical content. Rail is persistent operating-state context across every page; portfolio canvas should be positions table + add form, not a duplicate.
   - **Tradeoff accepted:** Slightly less visual real-estate dedicated to Reserve on the portfolio page itself. The rail keeps it always visible regardless of page.

3. **AIQ Editor default view = Scored only (hide unscored).**
   - **Why:** 34 of 52 tickers had em-dashes for every score column making 65% of the page look unfinished. Hiding behind a toggle lets the page read "complete for what's scored" while remaining one click away from the queue.
   - **Tradeoff accepted:** Operator has to click "Unscored" to surface backlog. Mitigated by the chip showing the unscored count inline.

4. **Form 4 placeholder REMOVED — render real data or quiet line.**
   - **Why:** Form 4 ingestion shipped tonight; 5 of 50 tickers have recent transactions, 45 don't (correct filtering of Form 3/5/amendments). A "ships later" placeholder for data that already ships is the worst credibility loss possible.
   - **Tradeoff accepted:** "No recent Form 4 transactions · monitored daily" line for 45 tickers reads quieter than I'd like, but it's accurate. Don't pad.

5. **`vault.update_secret(id, ...)` is the working path to update vault secrets.**
   - **Why:** S1 §11 #7 claimed vault.UPDATE was permission-denied via SQL — true for `UPDATE vault.secrets SET secret = ...` but FALSE for the `vault.update_secret(uuid, text)` RPC. Discovered + verified this session.
   - **Tradeoff accepted:** None. Update CUTOVER.md / S1 §11 #7 on next touch (deferred — not in scope this session).

6. **Reticle Supabase project KEEP — not abandoned.**
   - **Why:** Hosts Routines/Paperclip infrastructure (20 tables, ~140 rows incl. `oc_routines`, `oc_routine_runs`, `oc_routine_messages`, `oc_delegation_queue`). S1 handoff was wrong twice. File state wins.
   - **Tradeoff accepted:** Two Supabase projects under same org. Cost zero (Reticle is Free plan).

7. **Anthropic = Routines (via Claude Max), not direct API.**
   - **Why:** Terry's call mid-session. Saves $5-30/mo; rides existing Max sub.
   - **Tradeoff accepted:** Routines build is 2-4 hrs deferred work; daily-memo, weekly-ranking, generate-aiq-draft cron jobs will keep no-op'ing until built. Routines schema already exists in Reticle DB.

8. **Hotfix verification gate: reproduce locally before claiming ship.**
   - **Why:** I claimed Tier 1 + Tier 2 "shipped" based on tsc-pass + production-200. The production-200 was the `/login` redirect, NOT the authenticated dashboard. The dashboard 500'd at runtime because of a Next 16 client/server boundary violation (server importing a non-component export from `"use client"` file). Lesson: production-200 on an auth-gated app only proves the login wall responds.
   - **Tradeoff accepted:** None. Future deploys with non-trivial server-component changes need local repro via proxy-bypass before claiming green. Skill `verification-before-completion` calls this out as exactly the failure mode.

## 7. Next-session test plan

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git fetch origin
git rev-parse HEAD                              # expect: 029780ef8c2832d4e66b62f6a62b8409a34cafc9
git log --oneline origin/main..HEAD | wc -l     # expect: 0
git status --short                              # expect: empty
curl -sS -o /dev/null -w "vercel: %{http_code}\n" -L https://ai-thesis-v2.vercel.app/    # expect: 200
(cd web && ./node_modules/.bin/tsc --noEmit && echo "tsc=$?")     # expect: tsc=0
```

### 7.2 Verify live data + cron path

```bash
# DB row counts (uses Supabase Management API — rotate sbp_ token if expired)
TOKEN='sbp_ad67b561bb496794ae69c426fac17197f0d50ba9'
PAYLOAD=$(python3 -c "import json; print(json.dumps({'query': '''
SELECT
  (SELECT COUNT(*) FROM scores_history WHERE as_of = (SELECT MAX(as_of) FROM scores_history)) AS scores_latest,
  (SELECT COUNT(*) FROM scores_history WHERE as_of = (SELECT MAX(as_of) FROM scores_history) AND aiq_score IS NOT NULL) AS aiq_pop,
  (SELECT COUNT(*) FROM prices_raw WHERE ticker = chr(94) || \'VIX\') AS vix_bars,
  (SELECT COUNT(*) FROM cron.job WHERE jobname = \'compute-aiq-scores-weekly\') AS aiq_cron;
'''}))")
curl -sS -X POST "https://api.supabase.com/v1/projects/mvxgnliwvoauwwarrlrr/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$PAYLOAD" | python3 -m json.tool
# Expect: scores_latest=50, aiq_pop=18, vix_bars≥276, aiq_cron=1

# Cron-path auth (proves vault.cron_invoke_secret matches function env)
PAYLOAD=$(python3 -c "import json; print(json.dumps({'query': '''
SELECT net.http_post(
  url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = \'project_url\')
         || \'/functions/v1/compute-aiq-scores\',
  headers := jsonb_build_object(
    \'Content-Type\', \'application/json\',
    \'Authorization\', \'Bearer \' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = \'cron_invoke_secret\')
  ),
  body := \'{}\'::jsonb,
  timeout_milliseconds := 90000
) AS request_id;
'''}))")
RID=$(curl -sS -X POST "https://api.supabase.com/v1/projects/mvxgnliwvoauwwarrlrr/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$PAYLOAD" | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['request_id'])")
sleep 8
RPAYLOAD=$(python3 -c "import json,sys; print(json.dumps({'query': f\"SELECT status_code, content::text FROM net._http_response WHERE id = {sys.argv[1]};\"}))" "$RID")
curl -sS -X POST "https://api.supabase.com/v1/projects/mvxgnliwvoauwwarrlrr/database/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d "$RPAYLOAD" | python3 -m json.tool
# Expect: status_code=200, content contains "ok":true and "rows_upserted":18
```

### 7.3 Visual / UI verification (PAIRED with Terry)

1. Sign in to https://ai-thesis-v2.vercel.app with terryturner2026@gmail.com (magic-link cap 4/hr on Free).
2. **Dashboard `/`** — confirm:
   - Greeting reads "Good morning/afternoon/evening" matching current CT hour
   - Mono Meta Spine: `as_of 2026-05-18 · engine composite v1.0 · macro 1.00× (0/3) · weekly chain Sat 22:00–22:45 UTC`
   - KPI row: Portfolio "—", P&L "—", 30D return "—" (sub: "tracks once a position has been open ≥ 30 days"), High-tier names "4"
   - Score Movers table: every row is a click target (cursor pointer + hover tint + navigates to /universe/[ticker]). Driver column shows e.g. "Q +3.2" / "V -2.1" in mono, NOT "—".
   - Macro Regime alert callout: NOT visible (0/3 gates currently hit; only renders when macroGatesHit > 0).
3. **`/universe`** — table 50 rows, search input clearable, column header alignment matches data alignment.
4. **`/universe/NVDA`** — composite 79.95, tier HIGH, factor panels populated. Form 4 section: AVGO/AES/MSFT/KLAC/ARM tickers should show real insider transactions; NVDA itself likely shows "No recent Form 4 transactions · monitored daily."
5. **`/regime`** — chart renders all 3 series (NAAIM, AAII, F&G) over 366 days (carry-forwarded). Threshold dashes labeled at right edge: `▲ 90`, `▲ +30`, `▲ 80`. Active multiplier banner shows `1.00× (0/3 gates)`.
6. **`/aiq`** — default view shows 18 rows (Scored). Toggle "Unscored" → 34 rows. Toggle "All" → 52 rows. Each row clickable to `/aiq/[ticker]`.
7. **`/decisions`** — N events, M unseen. "Mark all read" button next to title.
8. **`/portfolio`** — Reserve & Triggers in right rail only (not duplicated on canvas). Positions table empty unless seeded.
9. **`/memos`** — fixture mode (Anthropic not configured); should NOT crash. Two stubbed memos visible.
10. **Accent color check:** any "›" / accent-colored element (active sidebar item, search underline, primary CTA) renders in royal blue `#3560F3`, NOT indigo `#4D5BFF`.

## 8. Budget / quota tracking

- **FMP Starter $29/mo** — well within 300/min rate limit at current cadence
- **Perplexity PAYG** — backfill spend ~$5-15 one-time; ongoing <$5/mo
- **Supabase Free** — 500K edge-function invocations/mo cap; using maybe 100/mo
- **Vercel Free** — 100GB bandwidth/mo
- **Anthropic** — $0 (not configured; Routines path picked)
- **Realistic total: $35-45/mo** (unchanged from S1)

## 9. Known issues / backlog

1. **Anthropic-via-Routines build** — 3 routines (compute-daily-memo, compute-weekly-ranking, generate-aiq-draft) + supporting endpoints. Reticle DB schema (`oc_routines`, `oc_routine_runs`, `oc_routine_messages`, `oc_delegation_queue`) already exists; build on it. ~2-4 hrs. Major remaining work item.

2. **Punch-list deferred items** (Claude-in-Chrome review, not blockers):
   - G4 ⌘K command palette (biggest perceived-quality lever per the review)
   - U1 universe table skeleton (replace loading spinner)
   - U2 Q/G column truncation at 1325px width
   - U3/A4 column-header tooltips for Q/G/AIQ sub-scores
   - P5 typeahead combobox for AddPositionForm ticker selector
   - R4 active-multiplier glow on Regime "CURVE" mini-table
   - U4 filter pills selected/active state visual

3. **Memos page (M1-M4)** — empty-feeling 2 memos, no expand affordance, no detail view. Gated on Anthropic decision; full pass after Routines build.

4. **Backtest page (B1-B6)** — described as "the moat" in review; deserves dedicated session, not polish. Two static rows currently.

5. **AAII forward-fill** — Perplexity scrape only fills 5 of 366 days for AAII. Chart now carry-forwards so doesn't read broken, but data quality is poor. Better source needed (AAII publishes directly, no public API).

6. **3 API tokens to rotate post-session** (still in chat history):
   - Supabase personal access: `sbp_ad67b561bb496794ae69c426fac17197f0d50ba9`
   - Perplexity: `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`
   - FMP: `xnxw9DLdXCMAiVtl0o56flJMF8lvdKWT`
   - After rotation: update Supabase function env + Vercel SUPABASE_* env if anon key changes.

7. **CRON_INVOKE_SECRET rotated mid-session, value not preserved.** Vault + function env are in sync now. If next session needs the value, regenerate via `openssl rand -hex 32` + `supabase secrets set` + `vault.update_secret('a5767249-e337-43eb-9d6b-7540f7ca0eb7'::uuid, 'NEWVALUE')`.

8. **CUTOVER.md and S1 handoff §11 #7 are stale on the vault topic** — both said "vault UPDATE permission denied." Reality: `UPDATE vault.secrets SET secret = ...` IS denied, but `vault.update_secret(uuid, text)` RPC works. Optional follow-up: amend both docs.

9. **PROGRESS.md / S1 handoff §11 #8 false claim on Reticle.** Wrote "abandoned, empty, harmless." Reality: 20 tables / 140 rows of Routines/Paperclip data. Optional: amend S1 with correction.

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Project root | `/Users/terryturner/Projects/ai-thesis` |
| Web app root | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch | `main` |
| HEAD SHA (S2 end) | `029780ef8c2832d4e66b62f6a62b8409a34cafc9` |
| origin/main SHA | same (0 ahead) |
| Production URL | https://ai-thesis-v2.vercel.app |
| Latest production deploy | `dpl_GDaktGsJdYQgLbgrmfjt9LJ1N3bm` (sha=029780e) |
| Vercel project | `terry-8893s-projects/ai-thesis-v2` (`prj_YkjioJcd1aEBmr1becSngnv9g8wP`) |
| Vercel team | `team_lz1y0drEGAlm56SDV39OP1zk` |
| Vercel env IDs | URL=`q9pbvfRkEhcwG5eD`, ANON=`h49cU1PxgqqQMJxS`, SRK=`oQezxEcpUrPo4Krt` |
| Supabase AI Thesis project | `mvxgnliwvoauwwarrlrr` (https://supabase.com/dashboard/project/mvxgnliwvoauwwarrlrr) |
| Supabase Reticle project (Routines DB — KEEP) | `ydzvrosvkmqkdaqgsxtb` |
| Supabase vault `cron_invoke_secret` ID | `a5767249-e337-43eb-9d6b-7540f7ca0eb7` |
| Supabase vault `project_url` ID | `410b587e-1a50-4a8d-8f2d-c0768cb0f42d` |
| Supabase org | `vercel_icfg_KtM5dD6oeBiWBB7es126PZQx` (`terry-8893's projects`) |
| Repo (origin) | `git@github.com:terry-zero-in/ai-thesis.git` |
| Vercel CLI auth token path | `/Users/terryturner/Library/Application Support/com.vercel.cli/auth.json` |
| Accent (new) | `#3560F3` (hover `#4F78F5`, pressed `#2A4DC2`) |
| Accent (old, for reference) | `#4D5BFF` Cypher Indigo |
| Spec — design | `docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Spec — algorithm | `docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Cutover runbook (partially stale) | `docs/CUTOVER.md` |
| Prior handoff (S1) | `docs/handoffs/2026-05-18-S1-full-cutover-fmp-live.md` |
| Lambo bar reference (cross-arc) | `~/.claude/skills/lambo/SKILL.md` |

## 11. Pitfalls / gotchas

1. **`"use client"` files cannot export non-component members consumed by server components.** Next 16 enforces this at runtime, not type-check. tsc passes but page 500s. Caught this session via `getServerGreeting()` regression — extracted pure fn to `greeting-compute.ts`. Pattern: any utility a server page wants to import must live OUTSIDE a `"use client"` module.

2. **`production: 200` on an auth-gated app only proves the login wall responds.** The dashboard's runtime crash didn't surface in curl because curl gets the `/login` redirect. Always repro the actual route locally with proxy bypass (`PUBLIC_PREFIXES.push("/")`) before claiming a non-trivial server-component change shipped.

3. **Vercel CLI `env add` and `env rm --yes` silently accept empty/no-op invocations.** `echo "value" | vercel env add KEY production` returns "Saving / Overrode" success messages even when the value isn't actually set. Use the Vercel REST API directly: `PATCH /v9/projects/{id}/env/{envId}` with `{"value": "..."}` payload. Token at `~/Library/Application Support/com.vercel.cli/auth.json`.

4. **`NEXT_PUBLIC_*` env vars are baked at BUILD time in Next 16.** Setting them after a deploy does nothing until you redeploy. If you `vercel env add` a NEXT_PUBLIC var, you MUST `vercel --prod` after.

5. **`type: 'sensitive'` Vercel env vars are write-only via the API.** GET returns encrypted blob you can't decrypt. Use `type: 'plain'` for any var you want to verify post-set (NEXT_PUBLIC_* are fine as plain since they're public anyway). SUPABASE_SERVICE_ROLE_KEY should stay sensitive.

6. **`vault.update_secret(uuid, text)` is the RPC to use for vault rotations.** Direct `UPDATE vault.secrets SET secret = ...` is denied for the service role. The RPC works. Vault ID for `cron_invoke_secret` is `a5767249-e337-43eb-9d6b-7540f7ca0eb7`.

7. **Reticle project `ydzvrosvkmqkdaqgsxtb` is NOT abandoned — it's the Routines/Paperclip DB.** S1 handoff was wrong. Do not delete. 20 tables, ~140 rows. This is the foundation for the Anthropic-via-Routines build.

8. **Two Vercel projects exist:** `ai-thesis-v2` (this) and `thesis` (Terry's other product, has Inngest/Resend/Perplexity/Anthropic env vars). Always deploy to `ai-thesis-v2` only. `.vercel/` is correctly linked.

9. **Magic-link auth has 4 emails/hour cap on Supabase Free.** Don't burn it on misclicks.

10. **AIQ Editor default view = Scored.** If you query the page expecting all 52 rows, add `?show=all` to URL. Default of 18 is intentional, not a bug.

11. **^VIX ticker requires URL-encoding for FMP:** `%5EVIX` in URLs, `^VIX` in DB. The URL constructor handles the encoding via `searchParams.set("symbol", "^VIX")`.

12. **Driver column needs prior_q/g/v/aiq present on UniverseRow.** Derivation is null if either current or prior factor score is null. For new tickers with only 1 week of history, Driver will read "—" — expected, not a bug.

## 12. Next-session pickup point

Run §7.1 (5 commands, <60s). Then **decide on Anthropic-via-Routines build** — Terry locked this path mid-S2; the 2-4 hr build is the only major remaining work item. If yes-go: plan-mode the architecture (3 routines + Supabase write paths + Reticle schema reuse) and ask Terry to approve before code. If no-go-yet: pick from Tier 3 punch-list (G4 ⌘K palette is the highest-impact next polish, ~1 hr).
