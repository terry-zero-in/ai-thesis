"""HP-1 price loader — bootstrap source: yfinance → hp1.prices.

Loads daily OHLCV + adjusted close for the full hp1.universe (the 50 investables
plus the SPY/QQQ benchmarks and ^VIX) into the standalone HP-1 Postgres. Idempotent
upsert on (ticker, date), so it both backfills history (first run, --period 3y) and
appends the latest close (daily Action run). adj_close is dividend/split adjusted
and is what the engine reads.

yfinance is the chosen bootstrap source (zero key). The loader is intentionally
source-agnostic at the DB boundary (hp1_db.upsert_prices takes plain dict records),
so swapping in FMP/Polygon later is a drop-in replacement of fetch_yf() only.

Run:  HP1_DB_URL=... python hp1_price_loader.py [--period 3y]
"""
from __future__ import annotations

import argparse
import sys

import pandas as pd
import yfinance as yf

import hp1_db


def _f(x) -> float | None:
    return None if x is None or pd.isna(x) else float(x)


def _i(x) -> int | None:
    return None if x is None or pd.isna(x) else int(x)


def _records_for(ticker: str, sub: pd.DataFrame) -> list[dict]:
    """One ticker's yfinance sub-frame → hp1.prices records (skips no-close rows)."""
    recs: list[dict] = []
    for idx, r in sub.iterrows():
        close = r.get("Close")
        if close is None or pd.isna(close):
            continue
        adj = r.get("Adj Close")
        if adj is None or pd.isna(adj):  # indices (^VIX) have no adj close → use close
            adj = close
        recs.append(dict(
            ticker=ticker,
            date=idx.date(),
            open=_f(r.get("Open")), high=_f(r.get("High")), low=_f(r.get("Low")),
            close=_f(close), adj_close=_f(adj), volume=_i(r.get("Volume")),
        ))
    return recs


def fetch_yf(tickers: list[str], period: str = "3y") -> dict[str, pd.DataFrame]:
    """Download `tickers` from yfinance → {ticker: OHLCV frame}. auto_adjust=False
    keeps raw Close and adjusted Adj Close as separate columns."""
    raw = yf.download(
        tickers, period=period, auto_adjust=False,
        group_by="ticker", progress=False, threads=True,
    )
    out: dict[str, pd.DataFrame] = {}
    if isinstance(raw.columns, pd.MultiIndex):
        for tk in tickers:
            if tk in raw.columns.get_level_values(0):
                out[tk] = raw[tk].dropna(how="all")
    else:  # single ticker → flat columns
        out[tickers[0]] = raw.dropna(how="all")
    return out


def load(period: str = "3y") -> int:
    conn = hp1_db.connect()
    try:
        universe = hp1_db.fetch_universe(conn)
        tickers = universe["ticker"].tolist()
        frames = fetch_yf(tickers, period=period)
        missing = [t for t in tickers if t not in frames or frames[t].empty]
        if missing:
            print(f"WARNING: no price data for {len(missing)}: {missing}", file=sys.stderr)
        records: list[dict] = []
        for tk, sub in frames.items():
            records.extend(_records_for(tk, sub))
        written = hp1_db.upsert_prices(conn, records)
    finally:
        conn.close()
    span = ""
    if records:
        dates = [r["date"] for r in records]
        span = f" ({min(dates)} → {max(dates)})"
    print(f"hp1.prices upsert: {written} rows across {len(frames)} tickers{span}")
    return 0 if written else 3


def main() -> int:
    ap = argparse.ArgumentParser(description="Load yfinance prices into hp1.prices")
    ap.add_argument("--period", default="3y",
                    help="yfinance period (e.g. 5d for daily append, 3y for backfill)")
    args = ap.parse_args()
    return load(period=args.period)


if __name__ == "__main__":
    raise SystemExit(main())
