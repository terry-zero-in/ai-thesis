# HP-1 engine

Ranks the fixed 50-name AI universe on risk-adjusted momentum and writes the
result to the standalone HP-1 Supabase project (`uetclnhbubmkwbherwkw`, schema
`hp1`). The factor math lives in `hp1_engine.py` (also the source for the
backtest record); everything else here fetches data, shapes rows, and writes.

## Layout

| File | Role |
|---|---|
| `hp1_engine.py` | Factor math + backtest (`factors`, `weights`, `simulate`). Spec §3. Imported, never rewritten. |
| `hp1_db.py` | Postgres I/O (psycopg). Connection from `HP1_DB_URL`. Reads `hp1.universe`/`hp1.prices`; writes `hp1.engine_runs`/`hp1.engine_ranks`/`hp1.prices`. |
| `hp1_price_loader.py` | Bootstrap price source: yfinance → `hp1.prices` (idempotent upsert). Source-swappable (FMP/Polygon) at `fetch_yf` only. |
| `hp1_daily_run.py` | Engine run: prices → per-view × per-sleeve ranks → `engine_runs` + `engine_ranks`. Pure `compute_run()` is unit-tested. |
| `restate_record.py` | Regenerates the canonical `data/results_*_v2.csv` backtest record. |
| `tests/` | `pytest` — factor math + engine-run shaping (no DB, no network). |

## Engine contract (HP1_SPEC_v1.1 §2–§4)

- **Views**: `combined` (all investable) / `pure_play` (L1+L3+L4) / `megacap` (L2+L5).
  z-scores are recomputed **within each view**. Each name lands in `combined` +
  its one category view → 4 rank rows/name (2 views × 2 sleeves), ~200 rows/run.
- **Sleeves**: `tactical` (.45·zM+.35·zRAM+.20·zDD, gate price>100dMA),
  `core` (gate price>200dMA).
- **pct**: percentile (0–100) of the sleeve score within the view's *scored* set
  (names with ≥130d history). The trend gate is carried separately by
  `sleeve_eligible` / `above_100` / `above_200`.
- **breadth_pct / gate_gross** (§4): breadth = % of combined scored set above its
  100d MA; gate = 1.00 (≥40%) / 0.50 (25–40%) / 0.25 (<25%).

### Known deviation — Core overlay (documented)

Spec §3 Core = price-only core ×0.75 + fundamental Overlay (§5 Q/G/V/AIQ) ×0.25.
The §5 overlay is live-only/unbacktested and its Tier-A inputs are not yet in
`hp1.*`, so Phase 1 writes the **price-only core** (`engine_version`
`v1.2-priceonly-core`). The ×0.75/×0.25 blend lands when the overlay data does;
the version string bumps so records stay distinguishable.

## Running

```bash
pip install -r requirements.txt
python -m pytest tests/ -q            # no DB needed

# Against the live DB (needs HP1_DB_URL):
export HP1_DB_URL='postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres'
python hp1_price_loader.py --period 3y   # FIRST RUN: backfill history
python hp1_daily_run.py                   # rank + write a run
```

`HP1_DB_URL` is the standalone project's **pooler** connection string (the
service/owner role — bypasses RLS, the documented loader/engine write path).

## Automation

`.github/workflows/hp1-engine.yml` runs post-close on weekdays (22:30 UTC): load
prices → run engine. **Set the repo secret `HP1_DB_URL`**, then trigger the
workflow once manually with `period=3y` to backfill (the engine needs ≥253
trading days) before the daily `5d` appends take over.
