# HP-1 engine

Risk-adjusted-momentum scoring for the fixed HP-1 AI universe. Reads `hp1.prices`,
ranks the universe per view × sleeve, writes `hp1.engine_runs` + `hp1.engine_ranks`.
Spec: `docs/hp1/HP1_SPEC_v1.1.md`. Schema: the standalone `hp1` Supabase project
(`uetclnhbubmkwbherwkw`).

## Layout

| File | Role |
|---|---|
| `hp1_factors.py` | **Single source of factor math** (zM/zRAM/zDD, tac/core, weights, driver_tag). Imported by both the backtest and the production run — no drift. |
| `hp1_score.py` | Pure scoring: price matrix + universe → one `engine_runs` row + `engine_ranks` rows. Views = combined/pure_play/megacap; z-scores recomputed within each. |
| `hp1_db.py` | DB I/O over a connection string (pg8000, schema-qualified `hp1.*`). |
| `load_prices.py` | Price loader → `hp1.prices` (FMP default, yfinance bootstrap). |
| `run_engine.py` | Daily orchestrator: fetch → score → write. |
| `hp1_engine.py` | The backtest (yfinance → CSV). Reference record only; uses the same `hp1_factors` math. |
| `tests/` | `pytest` — pure-math + scoring + loader-mapper tests (no network). |

## Environment

| Var | Used by | Notes |
|---|---|---|
| `HP1_DATABASE_URL` | all DB ops | Postgres connection string for the standalone HP-1 project (server-only secret; never in the browser). Supabase requires SSL. |
| `FMP_API_KEY` | `load_prices.py --source fmp` | FMP `/stable/` key (same key v2 uses). |
| `HP1_DB_SSL_INSECURE=1` | `hp1_db.connect` | Escape hatch to skip TLS verification. Off by default. |

## Run

```bash
pip install -r requirements.txt        # from engine/

# one-time history backfill (free, no key):
python load_prices.py --source yfinance --full
# or via FMP:
python load_prices.py --full

# daily (incremental ~14d) — the scheduled path:
python load_prices.py                  # FMP
python run_engine.py                   # score + write a run

# inspect without touching the DB:
python load_prices.py --dry-run
python run_engine.py --dry-run         # prints top-10 combined tactical

# tests:
python -m pytest tests/ -q
```

## Schedule

`.github/workflows/hp1-engine.yml` runs `load_prices.py` then `run_engine.py` at
**23:00 UTC Mon–Fri** (6pm CT in CDT / 5pm CT in CST — post-close + settle). Needs
the `HP1_DATABASE_URL` and `FMP_API_KEY` repo secrets. `workflow_dispatch` exposes a
`source` choice and a `backfill` toggle for manual full loads.

## Output contract

`engine_ranks` grain = `(run_id, ticker, view, sleeve)`. Per-name/per-view facts
(`z_*`, `above_*`, `dist_*`, `dd_from_high`, `r3/r6/r12`, `driver_tag`, `layer`) are
identical across the two sleeve rows; only `score`, `pct`, `sleeve_eligible` differ
by sleeve. Percentages (`breadth_pct`, `dist_*`, `dd_from_high`, `r3/r6/r12`) are
0–100 numbers. `engine_runs.regime_read` is the engine's mechanical baseline; Fable
may overwrite with a richer read on its own runs.

`engine_version` pins the math that produced a row — bump `ENGINE_VERSION` in
`hp1_score.py` on any scoring change.
