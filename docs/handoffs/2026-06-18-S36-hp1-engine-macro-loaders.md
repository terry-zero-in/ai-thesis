# S36 Handoff — HP-1 engine + price/macro loaders shipped; live activation handed to Terry

**Date:** 2026-06-18 (UTC)
**Branch:** `claude/magical-darwin-43eiyb` (even with `origin/main` + this handoff commit)
**HEAD before handoff:** `74dcfce` (= `origin/main`, includes PRs #28/#29/#30)
**Commits ahead of origin/main:** 1 (this handoff doc)
**Continuation of:** `docs/handoffs/2026-06-17-S35-hp1-standalone-db-live.md` (S35 stood up the standalone DB; this session built the loaders + engine on top of it)

---

## HEADLINE (read first)

1. **HP-1 Phase 1 DATA LAYER is complete and merged** — prices → engine → macro, all on `main`, all verified on **real data** (not just synthetic tests).
2. **Nothing is live yet** — the `hp1.*` data tables are still empty. The single gate is Terry setting the `HP1_DB_URL` secret and running the Action once with `period=3y`. Exact steps are in the session thread and in "Pending Terry actions" below.
3. **The engine is proven**: `python engine/hp1_smoke.py` runs the production `compute_run()` against live yfinance and prints today's ranks with no DB. Verified 2026-06-17: 50 names → 200 rows, breadth 80% / gate 1.0 / risk-on.
4. **Documented deviation:** Core is **price-only** this phase (`engine_version = v1.2-priceonly-core`). Spec §3 Core = price-only ×0.75 + §5 fundamental overlay ×0.25; the overlay's Tier-A Q/G/V/AIQ inputs aren't in `hp1.*` yet, so the blend lands later. The version string flags it.

---

## Operating posture this session

- Standing CLAUDE.md rule (autonomous by default; only stop for mission-critical/external-credential/spec-ambiguity decisions).
- Terry, mid-session: **"Lets go with what you think makes the most sense right now."** — explicit delegation. I used it to (a) build the verifiable offline engine preview instead of a macro loader I couldn't verify from the sandbox, then (b) build the macro loader once Terry supplied verified source specs.
- Terry supplied the macro-gauge source specs (CNN F&G headers, AAII legacy `.xls`, the 3-week AAII spread definition) with live oracle values to test against — treated as authoritative over the schema comment where they differed (see judgment calls).

---

## Tickets shipped — THS-110 (HP-1 Phase 1, Urgent, In Progress)

Three PRs, all squash-merged to `main`:

### PR #28 — engine + price loader + daily Action (`3d12545`)
- `engine/hp1_daily_run.py` — pure `compute_run(px, universe)`: per-view (combined/pure_play/megacap, z-scored within each) × per-sleeve (tactical/core) ranks → `hp1.engine_runs` (1 row) + `hp1.engine_ranks` (~200). breadth/gate per spec §4. Each investable lands in `combined` + its one category view → 4 rows/name.
- `engine/hp1_db.py` — psycopg **direct-Postgres** I/O (the `hp1` schema isn't exposed over PostgREST; an ETL job is a direct-DB client; owner/service role bypasses RLS = the documented write path).
- `engine/hp1_price_loader.py` — yfinance bootstrap → `hp1.prices` (idempotent upsert; source-swappable to FMP/Polygon at `fetch_yf()` only).
- `engine/hp1_engine.py` — `factors()` additively emits `dist100`/`dist200` (backtest unaffected).
- `.github/workflows/hp1-engine.yml` (daily post-close load→run) + Python test job in `ci.yml` + pinned `engine/requirements.txt`.
- Codex **P1 fix** (in-PR): stale-price guard — `compute_run` excludes any investable without a non-null close on the run date (tracked-ineligible per §2), warns, fails only if nothing is fresh. Was: a name the loader failed to refresh would be ranked on its last stale close while the run was stamped current.
- Reverted the moot #23 ingestion extension (dead code under standalone; 335 v2 tests still pass).

### PR #29 — macro loader + offline preview (`f370145`)
- `engine/hp1_macro_loader.py` — NAAIM / AAII / CNN F&G → `hp1.macro_gauges`, each behind a pure parser + `fetch_*()`. Per-gauge **stale guard**: a failed source carries its last-good DB value forward (flagged in `source`) and never blocks (gauges are Fable downgrade-only flags, not engine mechanics).
- `engine/hp1_smoke.py` — offline end-to-end engine preview against live yfinance (no DB).
- `hp1_db`: `fetch_latest_macro` + `upsert_macro_gauges`. Independent `macro` job in the Action. `xlrd` added (AAII `.xls`).

### PR #30 — pooler hardening (`74dcfce`)
- `hp1_db.connect()` sets `prepare_threshold=None` so the connection works through both Supabase pooler modes (transaction 6543 / session 5432). GitHub Actions reaches the DB only via the pooler (direct host is IPv6-only). Without this, psycopg's auto-prepared statements break under transaction pooling.

**Acceptance vs THS-110 ("stand up HP-1's standalone data + app foundation"):** data foundation = DONE + verified. App foundation (frontend fork) = NOT started (next phase). Live activation = pending Terry. → ticket stays **In Progress**.

### Judgment calls (with reasoning)
- **AAII spread = 3-week average bull-bear (pp), not latest-week.** The schema comment says `aaii_spread = bullish - bearish`, but Terry's instruction ("compute per HP1_SPEC regime; current 3wk ≈ −8, NOT v2's +5.4 placeholder") supersedes. The spec has no literal formula, so Terry's direction is authoritative. Stored latest-week bullish/bearish alongside the 3wk spread; documented in code. Verified live: −8.1pp.
- **F&G stored as int** (schema is `int`): 32.7 → 33 via round(). The gauge is a downgrade-only flag; int precision is fine.
- **Filter-and-continue over fail-the-run** for stale prices (Codex P1): one yfinance gap shouldn't drop a day's ranks; excluding a stale name matches the spec's "tracked, ineligible." Told Codex/Terry it's switchable to strict-fail.
- **Direct Postgres (psycopg) over supabase-py REST**: `hp1` isn't a PostgREST-exposed schema; ETL is naturally direct-DB.
- **NAAIM parsed from the program page** (not a clean API): the page embeds the last ~10 weekly readings as date/value pairs; took the max-date row. Verified current (79.27 @2026-06-10). Wrapped in the stale guard so a parse break carries forward, never blocks.

---

## Linear management
- THS-110: three progress comments posted this session (engine, macro, S36 close). No state change (stays In Progress). No re-parents.
- **No new tickets filed.** Deferred items (Core overlay blend, backtest_record seed, AIQ seed port) belong to later HP-1 phases already on the backlog (THS-111+) and the HP-1 project, NOT v2's THS-92 — recorded here instead of mis-filing.

---

## Prod DB state at end of session — standalone project `uetclnhbubmkwbherwkw`
| table | rows |
|---|---|
| `hp1.universe` | 53 (50 investable / 42 pure_play / 8 megacap + SPY/QQQ/^VIX) |
| `hp1.anth_state` | 1 (ceiling 15×, WAIT) |
| `hp1.prices` | **0** — pending first loader run |
| `hp1.engine_runs` | **0** — pending first engine run |
| `hp1.engine_ranks` | **0** |
| `hp1.macro_gauges` | **0** — pending first macro run |

- Migrations applied (3, unchanged this session): `20260617000000_hp1_schema`, `…000100_hp1_rls_harden`, `…000200_hp1_universe_prices_macro`.
- **No schema changes this session** (all work was application code + CI). Security advisors unchanged (0 lints as of S35).
- Write paths verified non-destructively via `BEGIN…ROLLBACK` dry-runs (engine_runs/ranks + macro_gauges) — 0 residue.

---

## Commits pushed (session work, all merged to origin/main)
```
74dcfce THS-110 make hp1_db pooler-safe (disable prepared statements) (#30)
f370145 THS-110 macro-gauge loader + offline engine preview (#29)
3d12545 THS-110 HP-1 engine: daily prices→ranks run, yfinance loader, scheduled Action (#28)
```
(Plus this handoff commit on the branch.)

---

## Pending Terry actions
| # | Item | Unblocks | How |
|---|---|---|---|
| 1 | **`HP1_DB_URL` secret** = Supabase **transaction pooler** string for `uetclnhbubmkwbherwkw` (`…pooler.supabase.com:6543/…`, NOT the IPv6-only direct host) | all live data | repo → Settings → Secrets and variables → Actions → `HP1_DB_URL` |
| 2 | **Run `HP-1 engine (daily)` Action with `period=3y`** | first live prices + engine + macro write | Actions tab → workflow → Run workflow |
| 3 | **Create `terry-zero-in/hp1` repo** (Private) | frontend phase | github.com/new; then tell CC — it adds to scope via `add_repo` |
| 4 | (later) Provision 2 auth users (Terry write / mom read) | identity-based RLS upgrade (currently authenticated = read-only for all) | Supabase Auth |

After #1+#2, ping CC to verify the run (engine_runs=1, engine_ranks≈200, prices populated, macro_gauges today).

---

## Next ticket / phase in build order
- **THS-110 continues** until live-activated (Terry #1+#2) — then the data foundation is provably Done.
- **Next build phase = the frontend fork** (`terry-zero-in/hp1`, gated on Terry #3). Surfaces in order per `docs/hp1/2026-06-12-hp1-dashboard-design.md` §5: Today → Portfolio + Trade Log → Ranks → Name View → ANTH → Regime → Runs → System. Forks the v2 `web/` app (already Reticle-based), repoints reads to `hp1.*`. Likely tracked as THS-111+ (HP-1 backlog) — confirm the exact ticket when starting.
- **Later phases:** Fable orchestrator + citation validation (needs an LLM key + scope decision); Core §5 overlay blend; backtest_record + AIQ seeds.

---

## Verified facts (don't re-prove)
- **Standalone HP-1 Supabase = `uetclnhbubmkwbherwkw`** (us-east-1, name "AI Thesis") — in this session's Supabase MCP scope. **v2 prod = `mvxgnliwvoauwwarrlrr`** (us-west-2, OUT of scope). Basis = `dmhuvacfwrfrrfwyrqlx`.
- GitHub MCP scope = `terry-zero-in/ai-thesis` only. Branch = `claude/magical-darwin-43eiyb`. PRs are **squash-merged** (reset branch to `origin/main` before stacking new work).
- Engine grain: `engine_ranks` = (run_id, ticker, view, sleeve); each investable → 4 rows (combined + category view × 2 sleeves) = ~200/run. breadth gate 40/25 → 1.0/0.5/0.25.
- Macro sources verified live 2026-06-18: F&G `production.dataviz.cnn.io/index/fearandgreed/graphdata` (needs browser UA/Referer/Origin; bare req 418s) = 32.7; AAII `aaii.com/files/surveys/sentiment.xls` (legacy .xls; .xlsx mirror is ~3mo stale) 3wk spread −8.1; NAAIM `naaim.org/programs/naaim-exposure-index/` page parse = 79.27@2026-06-10.
- yfinance reachable from the sandbox; CNN F&G (418) and AAII (403) blocked from sandbox WITHOUT Terry's exact headers (they work WITH them); all three work from GitHub Actions runners.
- Engine math lives ONLY in `engine/hp1_engine.py` (spec §3: no rewrite). `hp1_daily_run` imports `factors()` verbatim.

---

## Skills loaded this session
None formally invoked via the Skill tool (this was a continuation session, not a cold start). Operated under the standing CLAUDE.md posture: autonomy-by-default, honesty-before-agreement, verification-before-completion (every claim backed by a test run or a live/dry-run check). Next cold start should load the CLAUDE.md skill set per its session-start rule.

---

## Recommendations for next session
1. **If Terry has set `HP1_DB_URL` + run the backfill:** verify the live run first (counts + spot-check a few ranks vs the `hp1_smoke.py` preview), then the data foundation is Done.
2. **Highest-value next build = the frontend fork** once `terry-zero-in/hp1` exists. The backend is done and verified; the UI is what makes it usable for Terry + Mom + Dad. Start with the Today surface (sets the pattern), per the design spec, wired to `hp1.*`.
3. **Don't build the Core §5 overlay or Fable orchestrator yet** — both need upstream inputs (Tier-A fundamentals in `hp1`; an LLM key + scope decision). Surface to Terry before starting either.
4. Keep using `hp1_smoke.py` as the fast real-data sanity check on any engine change.
