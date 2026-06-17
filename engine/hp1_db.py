"""Database I/O for the HP-1 engine and loaders.

Talks directly to the standalone HP-1 Postgres (schema-qualified `hp1.*`) over a
connection string, which is the robust path for ETL into a non-`public` schema
(no dependency on PostgREST schema exposure). The connection string is a
server-only secret (`HP1_DATABASE_URL`) — never shipped to the browser, which
satisfies the spec's "writes through server jobs only" rule (HP1 build handoff
"Do NOT": expose the service_role key to the browser).

Pure-Python driver (pg8000) so the GitHub Action needs no system libpq.
"""
from __future__ import annotations

import os
import ssl
from urllib.parse import unquote, urlparse

import pandas as pd
import pg8000.dbapi

ENGINE_RUN_COLS = ["as_of", "breadth_pct", "gate_gross", "regime_read",
                   "universe_n", "data_through", "engine_version"]
ENGINE_RANK_COLS = ["run_id", "ticker", "layer", "view", "sleeve", "score", "pct",
                    "z_m", "z_ram", "z_dd", "driver_tag", "above_100", "above_200",
                    "dist_100_pct", "dist_200_pct", "dd_from_high",
                    "sleeve_eligible", "r3", "r6", "r12"]
PRICE_COLS = ["ticker", "date", "open", "high", "low", "close", "adj_close", "volume"]


def connect(url: str | None = None):
    """Connect to the HP-1 Postgres from HP1_DATABASE_URL (or `url`).

    Supabase requires SSL. Set HP1_DB_SSL_INSECURE=1 only as a last-resort escape
    hatch (e.g. a proxy with a self-signed cert) — verification is on by default.
    """
    url = url or os.environ.get("HP1_DATABASE_URL")
    if not url:
        raise RuntimeError("HP1_DATABASE_URL is not set")
    p = urlparse(url)
    ctx = ssl.create_default_context()
    if os.environ.get("HP1_DB_SSL_INSECURE") == "1":
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
    return pg8000.dbapi.connect(
        user=unquote(p.username or ""),
        password=unquote(p.password or ""),
        host=p.hostname,
        port=p.port or 5432,
        database=(p.path or "/postgres").lstrip("/") or "postgres",
        ssl_context=ctx,
    )


def fetch_universe(conn, active_only: bool = True) -> list[dict]:
    """Return the HP-1 universe rows (ticker, name, layer, category, kind)."""
    sql = "select ticker, name, layer, category, kind, is_active from hp1.universe"
    if active_only:
        sql += " where is_active = true"
    sql += " order by ticker"
    cur = conn.cursor()
    cur.execute(sql)
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def fetch_prices(conn, tickers: list[str], since: str | None = None) -> pd.DataFrame:
    """Return adjusted closes as a wide DataFrame (index=date, columns=ticker).

    `since` (ISO date) optionally floors the history pulled; the engine needs
    ~12 months + buffer, so callers typically pass None (full history) or a
    ~500-day floor for speed once the table is large.
    """
    if not tickers:
        return pd.DataFrame()
    placeholders = ", ".join(["%s"] * len(tickers))
    sql = (f"select ticker, date, adj_close from hp1.prices "
           f"where ticker in ({placeholders}) and adj_close is not null")
    params = list(tickers)
    if since:
        sql += " and date >= %s"
        params.append(since)
    sql += " order by date"
    cur = conn.cursor()
    cur.execute(sql, params)
    rows = cur.fetchall()
    if not rows:
        return pd.DataFrame()
    df = pd.DataFrame(rows, columns=["ticker", "date", "adj_close"])
    df["date"] = pd.to_datetime(df["date"])
    df["adj_close"] = df["adj_close"].astype(float)
    return df.pivot(index="date", columns="ticker", values="adj_close").sort_index()


def write_engine_run(conn, run: dict, ranks: list[dict]) -> str:
    """Insert one engine_runs row + its engine_ranks rows in a single transaction.

    Returns the generated run_id (str). Rolls back on any error.
    """
    cur = conn.cursor()
    try:
        run_sql = (f"insert into hp1.engine_runs ({', '.join(ENGINE_RUN_COLS)}) "
                   f"values ({', '.join(['%s'] * len(ENGINE_RUN_COLS))}) returning run_id")
        cur.execute(run_sql, [run.get(c) for c in ENGINE_RUN_COLS])
        run_id = str(cur.fetchone()[0])
        if ranks:
            rank_sql = (f"insert into hp1.engine_ranks ({', '.join(ENGINE_RANK_COLS)}) "
                        f"values ({', '.join(['%s'] * len(ENGINE_RANK_COLS))})")
            cur.executemany(rank_sql, [
                [run_id if c == "run_id" else r.get(c) for c in ENGINE_RANK_COLS]
                for r in ranks
            ])
        conn.commit()
        return run_id
    except Exception:
        conn.rollback()
        raise


def upsert_prices(conn, rows: list[dict]) -> int:
    """Upsert daily price rows into hp1.prices on (ticker, date). Returns count."""
    if not rows:
        return 0
    cur = conn.cursor()
    try:
        sql = (f"insert into hp1.prices ({', '.join(PRICE_COLS)}) "
               f"values ({', '.join(['%s'] * len(PRICE_COLS))}) "
               f"on conflict (ticker, date) do update set "
               + ", ".join(f"{c} = excluded.{c}" for c in PRICE_COLS if c not in ("ticker", "date")))
        cur.executemany(sql, [[r.get(c) for c in PRICE_COLS] for r in rows])
        conn.commit()
        return len(rows)
    except Exception:
        conn.rollback()
        raise
