# Session Notes — last updated 2026-05-15

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
