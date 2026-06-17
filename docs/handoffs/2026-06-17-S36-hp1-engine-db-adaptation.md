# S36 Handoff — HP-1 engine adapted to the standalone DB + price loader + CI

**Date:** 2026-06-17 (UTC)
**Branch:** `claude/exciting-pasteur-v64lhm`
**Builds on:** S35 (`2026-06-17-S35-hp1-standalone-db-live.md`) — the standalone HP-1
DB (`uetclnhbubmkwbherwkw`) is live; this session built the engine + data plumbing
that writes into it. Executed S35 "Next session — start here" items 1 (engine) and 2 (revert).

---

## HEADLINE

1. **The HP-1 engine now reads `hp1.prices` and writes `hp1.engine_runs` + `hp1.engine_ranks`** matching the live schema exactly (validated against the live DB — see below).
2. **Price loader** (`engine/load_prices.py`) → `hp1.prices`. FMP `/stable/historical-price-eod/full` (the exact endpoint v2 uses) by default; yfinance for a free bootstrap backfill.
3. **Scheduled GitHub Action** (`.github/workflows/hp1-engine.yml`): load prices → run engine, 23:00 UTC Mon–Fri. Python engine tests added to `ci.yml`.
4. **Reverted the moot ingestion extension** (#23 part b) — `INGEST_KINDS`/`hp1` handling in v2's ingest fns + `_shared/supabase.ts`, dead under standalone topology. The RLS-harden migration (#23 part a) was kept.
5. **Factor math is now single-sourced** in `engine/hp1_factors.py`, imported by both the backtest and the production run — no drift (an explicit institutional concern in the docs).

---

## What shipped

| File | What |
|---|---|
| `engine/hp1_factors.py` (new) | Single source of factor math: `factors`, `weights`, `driver_tag`, `RF`, `COST`. Verbatim from the backtest; added `dist100`/`dist200` (needed by the DB schema). |
| `engine/hp1_score.py` (new) | Pure `compute_engine_output(prices, universe) → (run, ranks)`. 3 views (combined/pure_play/megacap) × 2 sleeves (tactical/core). Breadth gate, regime read, percentile, driver tags, sleeve eligibility. |
| `engine/hp1_db.py` (new) | pg8000 DB I/O over `HP1_DATABASE_URL`, schema-qualified `hp1.*`. `fetch_universe`, `fetch_prices` (wide adj_close), `write_engine_run` (txn), `upsert_prices`. |
| `engine/load_prices.py` (new) | Loader → `hp1.prices`. FMP (default) + yfinance bootstrap. Pure `_map_fmp_rows` mapper. `--full` backfill, `--since`, `--dry-run`. |
| `engine/run_engine.py` (new) | Daily orchestrator: fetch → score → write. `--dry-run` prints top-10 combined tactical. |
| `engine/hp1_engine.py` (mod) | Imports math from `hp1_factors`; lazy yfinance (so tests/CI don't need it); backtest's `tag()` → shared `driver_tag`. |
| `engine/requirements.txt`, `engine/conftest.py`, `engine/README.md` (new) | Pinned deps, test path setup, ops doc. |
| `engine/tests/test_score.py`, `test_load_prices.py` (new) | 13 new tests (shapes, views/membership, sleeve grain + denormalization invariant, breadth gate, percentage scaling, short-history exclusion, FMP mapper). |
| `.github/workflows/hp1-engine.yml` (new) | Scheduled load+run. `.github/workflows/ci.yml` (mod): added pytest job. |
| 5 ingest files | Reverted to pre-#23 (`git checkout 4b83aab --`). `INGEST_KINDS` gone. |

## Verification (done this session)

- **`python -m pytest engine/tests/ -q` → 17 passed** (4 pre-existing + 13 new). `hp1_engine.selftest()` passes (math unchanged).
- **Live DB write validated**: generated a real run from synthetic prices, inserted 1 `engine_runs` + 24 `engine_ranks` rows into the live `uetclnhbubmkwbherwkw` via MCP — **every CHECK/PK/FK/type passed** (3 views, 2 driver tags round-tripped), then deleted the test rows (DB back to 0/0). This proves the row shapes `hp1_db.write_engine_run` emits conform to the live schema.
- Entry points import cleanly and fail with a clear error when `HP1_DATABASE_URL` is unset.

## NOT verified (no credentials / blocked on Terry)

- **`load_prices.py` against live FMP** — needs `FMP_API_KEY`. The endpoint/field mapping mirrors v2's proven `_shared/fmp.ts` exactly, and `_map_fmp_rows` is unit-tested, but no live FMP call was made.
- **The full Python→DB path end-to-end** — needs `HP1_DATABASE_URL`. The write SQL was validated via MCP (same SQL/constraints); the pg8000 plumbing is thin and standard but unrun against the live DB.
- **The scheduled workflow** — will first run once the two secrets exist.

## Pending Terry actions (gate go-live — carried from S35, refined)

| # | Item | Note |
|---|---|---|
| 1 | **Confirm price source = FMP** (recommended; matches spec §5 "FMP /stable/ + Massive existing keys"). I built the FMP loader + a yfinance bootstrap. If Polygon is preferred instead, say so — it's a new fetcher, same `upsert_prices` sink. |
| 2 | **Add repo secrets** `HP1_DATABASE_URL` (standalone project Postgres connection string) + `FMP_API_KEY`. Then the workflow runs. |
| 3 | First run: trigger `HP-1 engine` workflow manually with `backfill=true` (yfinance is fine for the bootstrap) to populate `hp1.prices`, then the daily schedule takes over. |
| 4 | `terry-zero-in/hp1` fork repo + Vercel project (frontend, Phase 3). Engine/loaders can live here in `engine/` meanwhile. |

## Next session — start here

1. **Once secrets land**: run the backfill, confirm `hp1.prices` populated, run the engine, eyeball `engine_ranks` vs `docs/hp1/current_ranks.csv` (stale 2026-06-10 but directionally sane — NVDA/AVGO/semis up top in risk-on).
2. **Macro loader** → `hp1.macro_gauges` (NAAIM/AAII/F&G — sources need scraping; was an open question in v2 too). Same `--source`/sink pattern as `load_prices.py`.
3. **Phase 2 — Fable orchestrator** (rubric `FABLE_REVIEW_RUBRIC_v1.md`): every-2-trading-day run + event triggers, writes `hp1.fable_runs`/`fable_reviews`/`decisions_log`. D5 entry-block enforcement, D6 citation validation, D8 ANTH controls.
4. **Phase 3 — surfaces** (the fork): Today → Portfolio+Trade Log → Ranks → Name View → ANTH → Regime → Runs → System (design doc §8 order).

## Notes / decisions made (autonomous, defensible)

- **Direct Postgres (pg8000) for writes**, not PostgREST. Schema-qualified `hp1.*` ETL doesn't need PostgREST schema exposure; the connection string is server-only (satisfies "no browser writes"). If Terry prefers the service_role/PostgREST path, `hp1` must be added to the project's exposed schemas first.
- **Percentages stored 0–100** (breadth_pct, dist_*, dd_from_high, r3/r6/r12) to match the `breadth_pct` schema comment. r3/r6/r12 are display facts; the score already encodes the z's.
- **`engine_runs.regime_read`**: engine writes a mechanical baseline ("Risk-on · breadth 62% · gross 100%"); Fable can overwrite on its runs (design doc says the Today regime read is Fable's).
- The backtest universe in `hp1_engine.py` (hardcoded CAT_A/CAT_B) is unchanged — the **production** run reads the universe from `hp1.universe` (53 rows, L3a/L3b split, benchmarks/macro excluded from scoring).
