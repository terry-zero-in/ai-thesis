"""HP-1 standalone Postgres I/O (psycopg3). Shared by the price loader and the
daily engine run.

WHY direct Postgres (not supabase-py / PostgREST): HP-1's tables live in the
`hp1` schema, which is NOT exposed over PostgREST (only `public` is by default).
An engine/ETL job is naturally a direct-DB client, so we connect straight to the
standalone project's Postgres with psycopg. The connection role (the project's
`postgres` owner / service role, via the pooler connection string) bypasses RLS,
which is exactly the documented write path for `hp1.*` (authenticated = read-only;
loaders/engine write via service_role — see 20260617000100_hp1_rls_harden.sql).

Connection string comes from env `HP1_DB_URL` (fallback `DATABASE_URL`), e.g. the
Supabase pooler URI:
  postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
Set it as the GitHub Action secret `HP1_DB_URL` for the standalone project
`uetclnhbubmkwbherwkw`.
"""
from __future__ import annotations

import os

import pandas as pd
import psycopg

# Longest factor lookback is r12 = 231-day return skip 21 days (~253 trading days);
# 600 calendar days (~410 trading days) covers that plus the 200-day MA with margin.
DEFAULT_LOOKBACK_DAYS = 600


def connect() -> psycopg.Connection:
    """Open a connection to the standalone HP-1 Postgres. Raises if unconfigured."""
    dsn = os.environ.get("HP1_DB_URL") or os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "HP1_DB_URL is not set. Provide the standalone HP-1 project's Postgres "
            "connection string (Supabase pooler URI) — see hp1_db.py docstring."
        )
    # prepare_threshold=None disables psycopg's client-side prepared statements so
    # the connection works through Supabase's connection pooler in BOTH transaction
    # (6543) and session (5432) modes — transaction pooling otherwise breaks
    # auto-prepared statements across the shared backends. GitHub Actions reaches
    # the DB only via the pooler (the direct host is IPv6-only).
    return psycopg.connect(dsn, prepare_threshold=None)


def fetch_universe(conn: psycopg.Connection) -> pd.DataFrame:
    """Active universe rows: ticker, name, layer, category, kind. Includes the
    SPY/QQQ benchmarks and ^VIX (kind != 'investable') — the loader prices them
    all; the engine scores only kind='investable'."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT ticker, name, layer, category, kind "
            "FROM hp1.universe WHERE is_active ORDER BY ticker"
        )
        rows = cur.fetchall()
        cols = [d.name for d in cur.description]
    return pd.DataFrame(rows, columns=cols)


def fetch_prices_wide(
    conn: psycopg.Connection, lookback_days: int = DEFAULT_LOOKBACK_DAYS
) -> pd.DataFrame:
    """adj_close as a wide frame (index=DatetimeIndex, columns=ticker), sorted by
    date. This is exactly the shape `hp1_engine.factors()` expects."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT ticker, date, adj_close FROM hp1.prices "
            "WHERE date >= (CURRENT_DATE - %s::int) ORDER BY date",
            (lookback_days,),
        )
        rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["ticker", "date", "adj_close"])
    wide = df.pivot(index="date", columns="ticker", values="adj_close").astype(float)
    wide.index = pd.to_datetime(wide.index)
    return wide.sort_index()


def upsert_prices(conn: psycopg.Connection, records: list[dict]) -> int:
    """Idempotent upsert into hp1.prices. Each record: ticker, date, open, high,
    low, close, adj_close, volume. Returns row count written."""
    if not records:
        return 0
    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO hp1.prices (ticker, date, open, high, low, close, adj_close, volume)
            VALUES (%(ticker)s, %(date)s, %(open)s, %(high)s, %(low)s, %(close)s,
                    %(adj_close)s, %(volume)s)
            ON CONFLICT (ticker, date) DO UPDATE SET
              open = EXCLUDED.open, high = EXCLUDED.high, low = EXCLUDED.low,
              close = EXCLUDED.close, adj_close = EXCLUDED.adj_close,
              volume = EXCLUDED.volume
            """,
            records,
        )
    conn.commit()
    return len(records)


# Column order for the engine_ranks insert (run_id is supplied separately).
_RANK_COLS = [
    "ticker", "layer", "view", "sleeve", "score", "pct", "z_m", "z_ram", "z_dd",
    "driver_tag", "above_100", "above_200", "dist_100_pct", "dist_200_pct",
    "dd_from_high", "sleeve_eligible", "r3", "r6", "r12",
]


def write_run(conn: psycopg.Connection, run: dict, ranks: list[dict]) -> str:
    """Insert one hp1.engine_runs row + its hp1.engine_ranks rows in a single
    transaction. Returns the new run_id (uuid str)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO hp1.engine_runs
              (as_of, breadth_pct, gate_gross, regime_read, universe_n, data_through, engine_version)
            VALUES
              (%(as_of)s, %(breadth_pct)s, %(gate_gross)s, %(regime_read)s,
               %(universe_n)s, %(data_through)s, %(engine_version)s)
            RETURNING run_id
            """,
            run,
        )
        run_id = cur.fetchone()[0]
        placeholders = ", ".join(f"%({c})s" for c in ["run_id", *_RANK_COLS])
        collist = ", ".join(["run_id", *_RANK_COLS])
        cur.executemany(
            f"INSERT INTO hp1.engine_ranks ({collist}) VALUES ({placeholders})",
            [{"run_id": run_id, **{c: r.get(c) for c in _RANK_COLS}} for r in ranks],
        )
    conn.commit()
    return str(run_id)


def fetch_latest_macro(conn: psycopg.Connection) -> dict | None:
    """Most recent hp1.macro_gauges row (for the loader's carry-forward), or None."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT as_of, naaim, aaii_bullish, aaii_bearish, aaii_spread, fear_greed, source "
            "FROM hp1.macro_gauges ORDER BY as_of DESC LIMIT 1"
        )
        row = cur.fetchone()
        if row is None:
            return None
        cols = [d.name for d in cur.description]
    return dict(zip(cols, row))


def upsert_macro_gauges(conn: psycopg.Connection, row: dict) -> int:
    """Idempotent upsert of one macro_gauges row keyed by as_of."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO hp1.macro_gauges
              (as_of, naaim, aaii_bullish, aaii_bearish, aaii_spread, fear_greed, source)
            VALUES
              (%(as_of)s, %(naaim)s, %(aaii_bullish)s, %(aaii_bearish)s,
               %(aaii_spread)s, %(fear_greed)s, %(source)s)
            ON CONFLICT (as_of) DO UPDATE SET
              naaim = EXCLUDED.naaim, aaii_bullish = EXCLUDED.aaii_bullish,
              aaii_bearish = EXCLUDED.aaii_bearish, aaii_spread = EXCLUDED.aaii_spread,
              fear_greed = EXCLUDED.fear_greed, source = EXCLUDED.source
            """,
            row,
        )
    conn.commit()
    return 1
