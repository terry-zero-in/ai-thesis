"""Append-oriented sqlite paper ledger. Every quote, fill, forecast,
settlement, and rules-scan lands here; the calibration gate reads only this."""
import datetime
import sqlite3

_SCHEMA = """
CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    ticker TEXT NOT NULL,
    event_ticker TEXT,
    station TEXT,
    target_date TEXT,
    side TEXT CHECK(side IN ('yes','no')),
    price_c INTEGER,
    size INTEGER,
    model_p REAL,          -- P(YES) from the corrected ensemble at placement
    p_gefs REAL,
    p_ecmwf REAL,
    agreement REAL,
    mkt_yes_bid_c INTEGER,
    mkt_yes_ask_c INTEGER,
    mkt_implied_p REAL,    -- market P(YES) at placement (mid)
    edge_net_c REAL,       -- fee-adjusted expected edge per contract, cents
    ahead_size REAL,       -- displayed size ahead of us at our price
    regime TEXT,
    strike_type TEXT,
    floor_strike INTEGER,
    cap_strike INTEGER,
    status TEXT DEFAULT 'open',
    fill_ts TEXT,
    fill_fee_c INTEGER
);
CREATE TABLE IF NOT EXISTS forecasts (
    id INTEGER PRIMARY KEY,
    ts TEXT NOT NULL,
    station TEXT,
    target_date TEXT,
    lead INTEGER,
    model TEXT,            -- 'all' | 'gefs' | 'ecmwf' (raw, uncorrected stats)
    ens_mean REAL,
    ens_spread REAL,
    n_members INTEGER,
    bias REAL,             -- correction applied at pricing time
    bw REAL
);
CREATE TABLE IF NOT EXISTS settlements (
    station TEXT,
    date TEXT,
    high_f INTEGER,
    source TEXT,
    fetched_ts TEXT,
    PRIMARY KEY (station, date)
);
CREATE TABLE IF NOT EXISTS market_results (
    ticker TEXT PRIMARY KEY,
    result TEXT,
    settled_ts TEXT
);
CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY,
    ts TEXT,
    series TEXT,
    rules_hash TEXT,
    flag TEXT,
    divergence_pts REAL,
    detail TEXT,
    status TEXT
);
CREATE TABLE IF NOT EXISTS events_log (
    id INTEGER PRIMARY KEY,
    ts TEXT,
    kind TEXT,
    detail TEXT
);
"""


def _now_iso() -> str:
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def init(conn: sqlite3.Connection) -> None:
    conn.executescript(_SCHEMA)
    conn.commit()


def _rows_as_dicts(cur) -> list:
    cols = [c[0] for c in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]


def insert_quote(conn, *, ticker, event_ticker, station, target_date, side, price_c,
                 size, model_p, p_gefs, p_ecmwf, agreement, mkt_yes_bid_c,
                 mkt_yes_ask_c, mkt_implied_p, edge_net_c, ahead_size, regime,
                 strike_type, floor_strike, cap_strike, ts) -> int:
    cur = conn.execute(
        """INSERT INTO quotes (ts, ticker, event_ticker, station, target_date, side,
                               price_c, size, model_p, p_gefs, p_ecmwf, agreement,
                               mkt_yes_bid_c, mkt_yes_ask_c, mkt_implied_p, edge_net_c,
                               ahead_size, regime, strike_type, floor_strike, cap_strike,
                               status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'open')""",
        (ts, ticker, event_ticker, station, target_date, side, price_c, size, model_p,
         p_gefs, p_ecmwf, agreement, mkt_yes_bid_c, mkt_yes_ask_c, mkt_implied_p,
         edge_net_c, ahead_size, regime, strike_type, floor_strike, cap_strike))
    conn.commit()
    return cur.lastrowid


def open_quotes(conn) -> list:
    return _rows_as_dicts(conn.execute("SELECT * FROM quotes WHERE status='open'"))


def committed_cents(conn, ticker: str) -> int:
    """Cents already staked on a market across open+filled quotes (both sides).
    The $100/market cap is enforced against this aggregate."""
    row = conn.execute(
        """SELECT COALESCE(SUM(price_c * size), 0) FROM quotes
           WHERE ticker=? AND status IN ('open','filled')""", (ticker,)).fetchone()
    return int(row[0])


def has_open_quote(conn, ticker: str, side: str) -> bool:
    row = conn.execute("SELECT 1 FROM quotes WHERE status='open' AND ticker=? AND side=?",
                       (ticker, side)).fetchone()
    return row is not None


def mark_filled(conn, quote_id: int, fill_ts: str, fill_fee_c: int) -> None:
    conn.execute("UPDATE quotes SET status='filled', fill_ts=?, fill_fee_c=? WHERE id=?",
                 (fill_ts, fill_fee_c, quote_id))
    conn.commit()


def mark_status(conn, quote_id: int, status: str) -> None:
    conn.execute("UPDATE quotes SET status=? WHERE id=?", (status, quote_id))
    conn.commit()


def insert_forecast(conn, *, ts, station, target_date, lead, model, ens_mean,
                    ens_spread, n_members, bias, bw) -> None:
    conn.execute(
        """INSERT INTO forecasts (ts, station, target_date, lead, model, ens_mean,
                                  ens_spread, n_members, bias, bw)
           VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (ts, station, target_date, lead, model, ens_mean, ens_spread, n_members, bias, bw))
    conn.commit()


def upsert_settlement(conn, station, date, high_f, source, fetched_ts) -> None:
    conn.execute(
        """INSERT INTO settlements (station, date, high_f, source, fetched_ts)
           VALUES (?,?,?,?,?)
           ON CONFLICT(station, date) DO UPDATE SET
             high_f=excluded.high_f, source=excluded.source, fetched_ts=excluded.fetched_ts""",
        (station, date, high_f, source, fetched_ts))
    conn.commit()


def upsert_market_result(conn, ticker, result, settled_ts) -> None:
    conn.execute(
        """INSERT INTO market_results (ticker, result, settled_ts) VALUES (?,?,?)
           ON CONFLICT(ticker) DO UPDATE SET result=excluded.result,
             settled_ts=excluded.settled_ts""",
        (ticker, result, settled_ts))
    conn.commit()


def insert_scan(conn, *, ts, series, rules_hash, flag, divergence_pts, detail, status) -> None:
    conn.execute(
        """INSERT INTO scans (ts, series, rules_hash, flag, divergence_pts, detail, status)
           VALUES (?,?,?,?,?,?,?)""",
        (ts, series, rules_hash, flag, divergence_pts, detail, status))
    conn.commit()


def latest_scan_hash(conn, series: str):
    row = conn.execute("SELECT rules_hash FROM scans WHERE series=? ORDER BY id DESC LIMIT 1",
                       (series,)).fetchone()
    return row[0] if row else None


def pending_scans(conn) -> list:
    return _rows_as_dicts(conn.execute(
        "SELECT * FROM scans WHERE status IN ('review','pending_llm') ORDER BY id DESC"))


def scored_rows(conn) -> list:
    """Filled quotes joined to their market result — the gate's raw material."""
    return _rows_as_dicts(conn.execute(
        """SELECT q.id, q.ticker, q.side, q.price_c, q.size, q.model_p, q.mkt_implied_p,
                  q.fill_ts, q.fill_fee_c, r.result
           FROM quotes q JOIN market_results r ON r.ticker = q.ticker
           WHERE q.status='filled' AND r.result IN ('yes','no')"""))


def log_event(conn, kind: str, detail: str, ts: str | None = None) -> None:
    conn.execute("INSERT INTO events_log (ts, kind, detail) VALUES (?,?,?)",
                 (ts or _now_iso(), kind, detail))
    conn.commit()
