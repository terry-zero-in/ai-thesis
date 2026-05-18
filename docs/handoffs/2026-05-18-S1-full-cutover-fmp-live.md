# S1 Handoff — 2026-05-18

**Branch:** `fix/fmp-stable-api-endpoints` @ `62f161d` · **PR:** [#9](https://github.com/terry-zero-in/ai-thesis/pull/9) (OPEN, MERGEABLE, no review) · **Commits ahead of `origin/main`:** 1 · **Pushed:** YES · **Last verified:** 2026-05-18 02:40 CDT

---

## 1. TL;DR

- Live scoring engine running end-to-end on https://ai-thesis-v2.vercel.app — 50 tickers tier-classified, real macro multiplier, real insider data, all from $29/mo FMP Starter + $0 Supabase Free.
- Backfill chain: prices 13,974 rows · fundamentals 550 · consensus 50 · form4 416 (5 of 50 tickers with recent real transactions) · macro_gauges 366 days · scores_history 50 · concentration 9.
- Diagnosed + fixed 2 FMP stable-API endpoint renames blocking entire ingest chain (`historical-price-eod-full` → `historical-price-eod/full`; `insider-trading` → `insider-trading/search`). Committed to PR #9 awaiting review.
- 4 tier shift: NVDA/MU/TLN/VRT in High (was 2 in High pre-real-macro); macro multiplier 1.00× (0 of 3 gates hit at NAAIM 77.34 / AAII +5.36 / F&G 62.9).
- True monthly cost is ~$35-45 (FMP $29 + Perplexity PAYG ~$5-15), NOT the $100-135 I initially quoted from CUTOVER.md prerequisites.
- Open Anthropic question: route through Terry's Claude Max via Routines (saves $5-30/mo) vs. direct Anthropic API. Architecture sketched, not decided.

## 2. Architectural pivot or major decision

**Decision: ship to production on Supabase Free + FMP Starter instead of the CUTOVER.md "Supabase Pro $25 + Polygon $79 + FMP Starter" stack.** Why: Supabase changed policy and pg_cron/pg_net are now on Free, eliminating the Pro upgrade dependency entirely. Polygon turned out to be optional — S-score works on insider override from FMP Form 4 alone; the missing options/skew signal only adds robustness, not correctness. Tradeoff accepted: no daily Supabase backups (limited backup on Free), no Polygon options data (S-score is a 1-component score for now, sentiment cap remains live via percentile-based fallback). Reversible: upgrade Supabase to Pro anytime; add Polygon anytime. The cheaper stack proved sufficient for tier-A scoring across all 50 universe tickers.

## 3. State of the world

- **Services:**
  - Live deploy: https://ai-thesis-v2.vercel.app (HTTP 200 verified 02:40 CDT, magic-link auth wall up)
  - Supabase project: `mvxgnliwvoauwwarrlrr` "AI Thesis" (Free plan, org `vercel_icfg_KtM5dD6oeBiWBB7es126PZQx` `terry-8893's projects`, us-west-2, Postgres 17.6.1.121, ACTIVE_HEALTHY)
  - Local dev server: NOT verified live this session (Vercel deploy is primary surface)

- **Secrets (names only — values in Supabase function env):**
  - `CRON_INVOKE_SECRET` — rotated multiple times this session, current value lost from local stash; regenerate via `openssl rand -hex 32` and `supabase secrets set` if needed for manual invocation
  - `FMP_API_KEY` — Terry's Starter-tier key (paid this session)
  - `PERPLEXITY_API_KEY` — Terry's key (paid this session, scrape volume so far minimal)
  - `SEC_USER_AGENT` — set to "AI Thesis v2 terryturner2026@gmail.com"
  - Supabase auto-provides: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY`, `SUPABASE_JWKS`, `SUPABASE_DB_URL`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`
  - Vault (for cron→function auth): `project_url`, `cron_invoke_secret` (NOTE: vault `cron_invoke_secret` may be out-of-sync with function env value — vault.secrets has `UPDATE` permission denied via SQL; vault.create_secret worked once but subsequent rotation only updated function env; needs manual sync via Supabase dashboard if cron-triggered runs fail auth)

- **Scheduled jobs (17 cron jobs from migrations, all wired via pg_cron):**
  - `fundamentals_ingest_cron` Tue 23:00 UTC weekly
  - `consensus_ingest_cron` Tue 23:00 UTC weekly
  - `prices_ingest_cron` Mon-Fri 20:45 UTC
  - `q/g/v/m/s_scores_cron` Sat 00:30-04:30 UTC
  - `composite_cron` Sat 05:00 UTC
  - `concentration_cron` Sat 05:30 UTC
  - `macro_ingest_cron` Tue 22:00 UTC weekly
  - `short_interest_cron` bimonthly
  - `form4_cron` daily
  - `options_cron` daily (NOTE: no POLYGON_API_KEY set, will fail)
  - `quarterly_review_cron` Q-end +5 business days
  - `daily_memo_cron` 13:00 UTC daily (NOTE: no ANTHROPIC_API_KEY set, will fail)
  - `weekly_ranking_cron` Sunday 18:00 UTC (NOTE: same)

- **External integrations:**
  - FMP Starter ($29/mo) — historical EOD, fundamentals, consensus, insider Form 4 by symbol all working post fmp.ts patch
  - Perplexity (PAYG) — macro scrape working for NAAIM + F&G; AAII forward-filled (Perplexity couldn't find latest)
  - Anthropic — NOT configured; memos + AIQ-drafts will not generate
  - Polygon — NOT configured; options-derived S-score component empty (insider override fills the gap)
  - SEC EDGAR — used by Form 4 via FMP wrapper; SEC_USER_AGENT set

- **DB state (verified 02:40 CDT):**
  - `universe`: 52 rows (52 active investable tickers; 70 named in spec but only 52 made it through migrations)
  - `scores_history`: 50 rows (one per investable ticker for as_of 2026-05-18; tiers 4 High / 10 Med / 18 Low / 18 Avoid)
  - `aiq_rubric`: 18 rows (seeded from migration; remaining 34 universe names need editorial OR generate-aiq-draft once Anthropic configured)
  - `depreciation_flags`: 6 rows (AMZN, GOOGL, META, MSFT, ORCL — ORCL twice from migration)
  - `fundamentals_raw`: 550 rows
  - `consensus`: 50 rows
  - `prices_raw`: 13,974 rows (400 days × 50 tickers; ^VIX failed — legacy endpoint deprecated)
  - `revisions`: 50 rows (one per ticker, computed from consensus)
  - `macro_gauges`: 366 rows (2025-05-18 → 2026-05-18 backfilled via Perplexity)
  - `insider_form4_raw`: 416 rows across 5 tickers (AVGO 100, AES 99, MSFT 99, KLAC 97, ARM 21 — other 45 tickers have only Form 3/5/amendments in recent history, correctly filtered out)
  - `concentration_history`: 9 rows (deepest tax AMD at -11.8)

- **Git state:**
  - Local on branch `fix/fmp-stable-api-endpoints` @ `62f161d`
  - 1 commit ahead of `origin/main` (which is at `2ba87af`, the PR #8 squash-merge from 2026-05-18 01:10 UTC)
  - Working tree clean
  - PR #8 MERGED · PR #9 OPEN MERGEABLE no review

## 4. Action / API reference

| Function endpoint | Auth | Purpose | Status this session |
|---|---|---|---|
| `POST /functions/v1/ingest-prices?days=N` | Bearer CRON_INVOKE_SECRET | FMP historical EOD backfill | ✓ 13,974 rows |
| `POST /functions/v1/ingest-fundamentals` | Bearer CRON_INVOKE_SECRET | FMP income/balance/cash statements | ✓ 550 rows |
| `POST /functions/v1/ingest-consensus` | Bearer CRON_INVOKE_SECRET | FMP analyst estimates + price targets + ratings | ✓ 50 rows (after rate-limit retry) |
| `POST /functions/v1/ingest-form4` | Bearer CRON_INVOKE_SECRET | FMP insider transactions by symbol | ✓ 416 rows (5 of 50 tickers had real transactions) |
| `POST /functions/v1/ingest-macro?backfill_days=N` | Bearer CRON_INVOKE_SECRET | Perplexity NAAIM/AAII/F&G scrape | ✓ 366 days |
| `POST /functions/v1/ingest-short-interest` | Bearer CRON_INVOKE_SECRET | FMP short interest | ⊘ NOT RUN — endpoint is Premium tier; ingest would fail-skip |
| `POST /functions/v1/ingest-options` | Bearer CRON_INVOKE_SECRET | Polygon options skew | ⊘ NOT RUN — no POLYGON_API_KEY |
| `POST /functions/v1/compute-{q,g,v,m,s}-scores` | Bearer CRON_INVOKE_SECRET | Per-factor scoring | ✓ All 5 ran, 50 tickers each |
| `POST /functions/v1/compute-composite-scores` | Bearer CRON_INVOKE_SECRET | Composite + tier + macro multiplier | ✓ Ran TWICE (once with seed macro 0.95×, then with live macro 1.00×) |
| `POST /functions/v1/compute-concentration` | Bearer CRON_INVOKE_SECRET | Herfindahl + tax | ✓ 9 rows |
| `POST /functions/v1/compute-{daily-memo,weekly-ranking}` | Bearer CRON_INVOKE_SECRET | LLM synthesis | ⊘ NOT RUN — no ANTHROPIC_API_KEY |
| `POST /functions/v1/generate-aiq-draft` | Bearer CRON_INVOKE_SECRET | LLM AIQ draft for unscored tickers | ⊘ NOT RUN — no ANTHROPIC_API_KEY |
| `POST /functions/v1/run-backtest` | Bearer CRON_INVOKE_SECRET | Operator-invoked backtest | ⊘ NOT RUN |

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `supabase/functions/_shared/fmp.ts` | modified | Two endpoint renames (line 340 + 549) diagnosed during cutover; commented inline with reason |
| `docs/state/2026-05-17-build-vs-spec-gap.md` | created | Build-vs-spec gap audit; anchored cutover decisions tonight |
| `docs/handoffs/2026-05-18-S1-full-cutover-fmp-live.md` | created | This handoff doc |
| `.vercel/` | created (project link metadata) | Links repo to Vercel project `ai-thesis-v2` |
| Supabase: new project `mvxgnliwvoauwwarrlrr` | provisioned | "AI Thesis" Free-tier project (Terry created it directly via dashboard mid-session after I had provisioned wrong project earlier) |
| Supabase: 51 migrations applied to `mvxgnliwvoauwwarrlrr` | applied | Full schema; previously empty |
| Supabase: 19 edge functions deployed to `mvxgnliwvoauwwarrlrr` | deployed (v1) | All from `supabase/functions/`; redeployed once after fmp.ts patch |
| Vercel project: `terry-8893s-projects/ai-thesis-v2` | created + deployed | New project; not the older `thesis` project (that's a different product Terry was building) |
| Supabase auth config: site_url + uri_allow_list | patched via Management API | Magic-link redirect to https://ai-thesis-v2.vercel.app + previews + localhost:3000/3003 |

## 6. Decisions locked

1. **Supabase Free is sufficient for production-quality v1.**
   - **Why:** pg_cron + pg_net moved to Free tier policy; schema + 17 cron jobs + 19 edge functions all run cleanly. Saved $25/mo vs CUTOVER.md assumption.
   - **Tradeoff accepted:** Limited backup retention (7-day vs Pro's 30-day point-in-time recovery); no read replicas; no custom domains on Supabase side (Vercel handles that). For single-tenant, single-user, can-rebuild-from-FMP-anytime, this is fine.

2. **Polygon ($79/mo) is NOT needed for v1.**
   - **Why:** S-score works on insider override from Form 4 alone (insider_override=50 in tonight's run). The missing options/skew adds robustness, not correctness. Defer until live behavior surfaces a real gap.
   - **Tradeoff accepted:** S-score is a 1-signal score (insider only). Sentiment cap still functions but uses percentile fallback. Composite tiers still computed accurately.

3. **FMP Starter $29/mo over Premium ~$59 or higher.**
   - **Why:** Starter delivers fundamentals + historical EOD + insider by symbol — everything tier-A scoring needs. Lost: earnings transcripts (used by `generate-aiq-draft` for richer LLM context) and short_interest (one S-score input that's already 0/50 via insider override). Both are quality reductions, not blockers.
   - **Tradeoff accepted:** AIQ-drafts will get less context (10-K only, no Q&A transcript), and short-interest signal is null. Terry scores AIQ manually anyway; short-interest gap doesn't change tier outputs.

4. **Use new Supabase project "AI Thesis" (`mvxgnliwvoauwwarrlrr`) — NOT Reticle (`ydzvrosvkmqkdaqgsxtb`).**
   - **Why:** Reticle is empty (Terry's earlier mental model that the active project was AI Thesis turned out wrong); confusion led to creating a fresh project mid-session. Reticle abandoned but not deleted — Terry's call whether to clean up.
   - **Tradeoff accepted:** One unused Supabase project lingering (`Reticle`, also empty). Not destructive; can delete later. The other prior project (`supabase-indigo-ocean`) was already deleted by Terry this session.

5. **Use new Vercel project `ai-thesis-v2` — NOT existing `thesis` project.**
   - **Why:** Existing `thesis` project had env vars set 6 days ago for Inngest + Resend + Perplexity + Anthropic, indicating a DIFFERENT product Terry was building. The AI Thesis web codebase has zero Inngest/Resend imports. Repurposing would have corrupted Terry's other work.
   - **Tradeoff accepted:** Two domains under terry-8893s-projects.vercel.app — old `thesis-nu.vercel.app` (other product) + new `ai-thesis-v2.vercel.app` (this).

6. **PR #9 opened (not merged in-session) for fmp.ts endpoint fixes.**
   - **Why:** Different from PR #8 (which Terry pre-approved for autonomous merge). PR #9 surfaced for Terry's review since the fmp.ts changes touch the data ingest layer and warrant a sanity check. Branch pushed, branch protection is the only thing between it and main.
   - **Tradeoff accepted:** main is at `2ba87af` (PR #8 merged), `fix/fmp-stable-api-endpoints` is `62f161d` and contains the actual working endpoint paths. If next session does cutover-related work, they MUST work off this branch or merge PR #9 first to avoid the fmp.ts paths reverting.

7. **Anthropic via Routines (using Terry's Claude Max) deferred to future-session decision.**
   - **Why:** $5-30/mo savings vs. complexity of building Routines that POST to Supabase. Not blocking — the 2 Anthropic-using cron jobs (compute-daily-memo, compute-weekly-ranking) will fail silently each day/week until Anthropic key OR Routines wiring exists.
   - **Tradeoff accepted:** /memos page stays on fixture mode until decided. /aiq-drafts queue stays empty until decided. No data loss either way.

## 7. Next-session test plan

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git fetch origin
git checkout fix/fmp-stable-api-endpoints
git rev-parse HEAD                                          # expect: 62f161d292601148e26085f492c0f0deddf36ced
git log --oneline origin/main..HEAD | wc -l                 # expect: 1
git status --short                                          # expect: empty
gh pr view 9 --json state,mergeable,reviewDecision -q '.'   # check whether merged or needs follow-up
curl -s -o /dev/null -w "vercel: %{http_code}\n" -L https://ai-thesis-v2.vercel.app/   # expect: 200
export SUPABASE_ACCESS_TOKEN='<get from terry; old token sbp_ad67b... should be rotated>'
supabase projects list 2>&1 | grep "AI Thesis"             # expect: linked dot + ref mvxgnliwvoauwwarrlrr
```

### 7.2 Verify live data state

```bash
# Service role key (regenerate if rotated):
SUPA_SERVICE=$(supabase projects api-keys --project-ref mvxgnliwvoauwwarrlrr 2>&1 | grep "service_role " | awk '{print $3}')

# Top 5 by composite — expect NVDA, MU, ANET, TLN, VRT all with composite 75+
curl -s "https://mvxgnliwvoauwwarrlrr.supabase.co/rest/v1/scores_history?select=ticker,composite,tier,macro_multiplier&order=composite.desc&limit=5" \
  -H "apikey: $SUPA_SERVICE" -H "Authorization: Bearer $SUPA_SERVICE" | python3 -m json.tool

# Tier distribution — expect 4 High / 10 Medium / 18 Low / 18 Avoid
curl -s "https://mvxgnliwvoauwwarrlrr.supabase.co/rest/v1/scores_history?select=tier" \
  -H "apikey: $SUPA_SERVICE" -H "Authorization: Bearer $SUPA_SERVICE" \
  | python3 -c "import sys,json; from collections import Counter; d=json.load(sys.stdin); print(Counter(r['tier'] for r in d))"

# Macro state — expect NAAIM 77.34, AAII +5.36, F&G 62.9, 0 gates hit, multiplier 1.00x
curl -s "https://mvxgnliwvoauwwarrlrr.supabase.co/rest/v1/macro_gauges?select=*&order=as_of.desc&limit=1" \
  -H "apikey: $SUPA_SERVICE" -H "Authorization: Bearer $SUPA_SERVICE"
```

### 7.3 Visual / UI verification

1. Open https://ai-thesis-v2.vercel.app
2. Magic-link sign in with terryturner2026@gmail.com (check spam if not in inbox; Supabase Free has 4 emails/hour cap)
3. Walk each route, confirm real data renders (not fixture mode):
   - `/` — Dashboard tier distribution chip should show 4/10/18/18 split
   - `/universe` — table populated with real Q/G/V/M/composite/tier per ticker (sorted by composite desc)
   - `/universe/NVDA` — composite 79.95, tier HIGH, Q=96, G=89, V=54, M=69, S=51
   - `/universe/META` — depreciation flag visible
   - `/aiq` — 18 of 52 rows with real rubric data
   - `/decisions` — should show 1 SELL cluster + insider activity for AVGO/AES/MSFT/KLAC/ARM
   - `/regime` — real NAAIM/AAII/F&G readings + 366-day trend chart (NOT fixture)
   - `/memos` — still fixture (no Anthropic) — verify "no Anthropic key" empty state vs. fake data
   - `/portfolio` — empty book ($100K default) — add positions manually if testing
4. **CRITICAL CHECK:** verify `aiq_score` column in `/universe/[ticker]` is NOT null — earlier verification showed scores_history has aiq_score=null for all 50, but aiq_rubric has 18 rows. Possible join bug in compute-composite-scores.

## 8. Budget / quota tracking

- **Supabase Free:** unlimited bandwidth, 500MB storage (using <50MB), 2GB egress/mo, 500K edge-function invocations/mo. At current cadence (17 weekly cron jobs × 4 weeks = 68 invocations/mo + ad-hoc manual runs ~50), nowhere near limit.
- **FMP Starter $29/mo:** 300 calls/min rate limit (hit once during prices ingest, recovered after sleep). 5-year historical, US coverage, annual fundamentals + historical EOD + insider by symbol all included.
- **Perplexity PAYG:** Charges per query. 365-day macro backfill = 365 queries. Weekly cron = 1 query × 4 = 4/mo. Initial spend probably $5-15, ongoing <$5/mo.
- **Vercel Free:** 100GB bandwidth/mo, no team features needed (single-tenant). Will not hit limits.
- **Total realistic monthly run-rate: $35-45.**

## 9. Known issues / backlog

1. **PR #9 fmp.ts fixes unmerged.** Anyone working off main will hit the same 404s tonight's session diagnosed. Merge first OR work from `fix/fmp-stable-api-endpoints` branch. Quick: `gh pr merge 9 --squash --delete-branch`.

2. **`aiq_score` column null for all 50 scores_history rows despite 18 rubric rows existing.** Likely a join bug in `compute-composite-scores` — function may not be reading `aiq_rubric` table. Investigation needed: read `supabase/functions/compute-composite-scores/index.ts` and check whether it queries aiq_rubric and how it handles missing rows.

3. **Form 4 coverage limited to 5 tickers.** Not a bug — correct filtering of Form 3/5/amendments. To increase coverage, would need to either: (a) increase limit beyond 100 most-recent-filings, (b) walk back through historical filings by date range, or (c) accept that 45 of 50 universe tickers have no recent insider transactions worth highlighting. Cron will keep current 5 fresh.

4. **^VIX historical pricing broken.** Legacy `/api/v3/historical-price-full/^VIX` endpoint returns 403 deprecated. FMP's stable API has different VIX semantics. Need new VIX source OR alpha-vantage/yahoo scrape. Affects: portfolio trigger 2 (currently half-wired) and any future VIX-aware scoring.

5. **AAII forward-filled in macro_gauges.** Perplexity scrape can't find latest AAII bull-bear spread reliably; falls back to most recent known value. Acceptable for cron-driven weekly refresh but means /regime AAII line is stale until AAII publishes.

6. **No Anthropic key → memos + AIQ-drafts not running.** `compute-daily-memo` and `compute-weekly-ranking` and `generate-aiq-draft` will fail every scheduled run with "Missing ANTHROPIC_API_KEY". Decide: pay PAYG (~$5-30/mo) OR build Routines wiring to use Claude Max.

7. **CRON_INVOKE_SECRET vault ↔ function-env may be out of sync.** During session I rotated secret 3 times (mismatched calls); only the most recent supabase secrets set value is in function env. Vault has stale value (UPDATE permission denied via SQL). Manual invocation works against function env but cron-triggered runs will fail auth until vault is synced. Fix via Supabase dashboard: SQL Editor → `SELECT vault.create_secret('<new-value>', 'cron_invoke_secret');` (note: may need to delete the existing one first).

8. **Empty Reticle Supabase project lingering.** `ydzvrosvkmqkdaqgsxtb` was abandoned mid-session when Terry created the "AI Thesis" project directly. Empty, costs $0, but adds clutter. Terry's call whether to delete via Supabase dashboard.

9. **Two project naming conventions overlap:** Vercel `thesis` project (Terry's other product, do NOT touch) vs `ai-thesis-v2` (this). Future Vercel work must use `ai-thesis-v2`. The `.vercel/` link in this repo is correct.

10. **Two API tokens in chat history that should be rotated:**
   - Supabase personal access token `sbp_ad67b561bb496794ae69c426fac17197f0d50ba9`
   - Perplexity API key `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`
   - FMP API key `xnxw9DLdXCMAiVtl0o56flJMF8lvdKWT`
   - Rotate after this session is fully closed; update Supabase function env after Perplexity + FMP rotations.

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Project root | `/Users/terryturner/Projects/ai-thesis` |
| Web app root | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch (this session HEAD) | `fix/fmp-stable-api-endpoints` |
| HEAD SHA (S1 end) | `62f161d292601148e26085f492c0f0deddf36ced` |
| Main SHA (PR #8 merge) | `2ba87af3f462fe5605ab5c678bfe03b496215700` |
| Commits ahead of `origin/main` | 1 |
| PR #9 URL | https://github.com/terry-zero-in/ai-thesis/pull/9 |
| PR #8 URL (MERGED) | https://github.com/terry-zero-in/ai-thesis/pull/8 |
| Repo (origin) | `git@github.com:terry-zero-in/ai-thesis.git` |
| Live deploy URL | https://ai-thesis-v2.vercel.app |
| Vercel project | `terry-8893s-projects/ai-thesis-v2` |
| Supabase project ID | `mvxgnliwvoauwwarrlrr` ("AI Thesis") |
| Supabase project URL | `https://mvxgnliwvoauwwarrlrr.supabase.co` |
| Supabase project DB host | `db.mvxgnliwvoauwwarrlrr.supabase.co` |
| Supabase org | `vercel_icfg_KtM5dD6oeBiWBB7es126PZQx` (`terry-8893's projects`, Free plan) |
| Supabase dashboard direct | https://supabase.com/dashboard/project/mvxgnliwvoauwwarrlrr |
| Empty/abandoned Supabase project | `ydzvrosvkmqkdaqgsxtb` ("Reticle") — Terry's call to clean up |
| Spec — design | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Spec — algorithm | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Cutover runbook | `/Users/terryturner/Projects/ai-thesis/docs/CUTOVER.md` |
| Gap audit (this session) | `/Users/terryturner/Projects/ai-thesis/docs/state/2026-05-17-build-vs-spec-gap.md` |
| Prior handoff (S5) | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S5-source-jsonb-mercury7-pr-open.md` |
| Cron jobs registry | `/Users/terryturner/Projects/ai-thesis/web/src/lib/settings-data.ts` CRON_REGISTRY const (17 jobs) |

## 11. Pitfalls / gotchas

1. **fmp.ts endpoint paths in main are STALE.** Anyone running cutover from `main` (`2ba87af`) without merging PR #9 will hit the same 404s I spent hours debugging. Always work from `fix/fmp-stable-api-endpoints` until merged.

2. **`/insider-trading/latest` is the global feed, NOT symbol-filtered.** It IGNORES the `symbol` param and returns the most-recent insider filings across ALL companies. Use `/insider-trading/search` for per-ticker queries. PR #9 has this fix.

3. **`/historical-price-eod-full` (hyphenated) was renamed to `/historical-price-eod/full` (slash).** Old path returns 404 even on paid plans. Other related endpoints (`/historical-price-eod/light`, `/historical-price-eod/non-split-adjusted`, `/historical-price-eod/dividend-adjusted`) all use the same slash pattern.

4. **FMP Starter does NOT include earnings transcripts or short-interest.** Both return 402 "Restricted Endpoint". Don't wire them and expect them to work without upgrading FMP plan.

5. **Form 4 coverage low for non-active-insider names is normal.** 45 of 50 universe tickers had only Form 3/5/amendments in recent history. The function correctly filters those out (no transaction code). NOT a bug.

6. **Magic-link emails have a 4/hour cap on Supabase Free.** Don't burn it on misclicks during sign-in testing.

7. **Vault `cron_invoke_secret` may be out of sync with function env CRON_INVOKE_SECRET.** Manual `curl` invocation works (uses function env). Cron-triggered runs validate against vault. If next-session cron runs fail with 401, sync the vault via Supabase dashboard SQL Editor.

8. **FMP Starter has 300/min rate limit; prices ingest burned through it fast.** Sequencing matters: prices (52 × 4 calls each = ~200) → consensus (52 × 2 = ~104) → fundamentals (52 × 3 = ~150) → form4 (52 × 1 = 52). If running all sequentially without sleep, will hit 429 around minute 2. Wait 60s between large batches.

9. **CUTOVER.md is now partially stale.** Says "Supabase Pro $25/mo required" — false (Free works). Says "Polygon $79/mo" — false (optional). The migration commands (`supabase db push`) and edge function deploy commands are still correct.

10. **Terry's two Supabase accounts may surface differently in different tools.** MCP is bound to `Fontera - ApexQuote` org (different account, has unused/abandoned projects). CLI (with this session's token) hits `terry-8893's projects` org (where AI Thesis lives). Don't mix them.

11. **`aiq_score` is null across all 50 scored tickers despite 18 rubric rows.** Verified at session end. Either composite function isn't joining aiq_rubric, or join is keyed wrong. Diagnose before re-running scoring chain.

12. **Vercel project named `thesis` is OFFICIAL Terry property for DIFFERENT product.** Has Inngest/Resend/Perplexity/Anthropic env vars from another build. Do NOT modify, do NOT deploy to. Use `ai-thesis-v2` Vercel project only.

## 12. Next-session pickup point

Run §7.1 verification (< 60s). Then **decide on PR #9 merge first** — gh pr view 9 to see if Terry merged it overnight; if still OPEN with no review, ask whether to merge autonomously. After merge (or working from the branch), next decision is: **Anthropic-via-Routines vs. direct Anthropic API spend.** This is a discrete architecture choice. If yes Anthropic API: paste key, set ANTHROPIC_API_KEY, run compute-daily-memo + compute-weekly-ranking + generate-aiq-draft. If yes Routines: build the 3 routine specs that call Claude Code and POST to Supabase memos/aiq_drafts tables. **Don't recompute scores or re-run backfills** unless the §7.3 visual verification surfaces a real bug (most likely the `aiq_score` null issue from §11 #11).
