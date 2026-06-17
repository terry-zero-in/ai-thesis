"""HP-1 price loader -> hp1.prices.

Pulls daily OHLCV + dividend/split-adjusted close for the HP-1 universe and
upserts on (ticker, date). The engine reads `adj_close`.

Two sources (HP1 build handoff §Phase 1: "FMP or Polygon" + yfinance bootstrap):
  --source fmp       (default) FMP /stable/historical-price-eod/full, the exact
                     endpoint v2 uses (supabase/functions/_shared/fmp.ts).
                     Needs FMP_API_KEY.
  --source yfinance  free, no key — for the one-time history backfill.

Usage:
  python load_prices.py --full                  # backfill from 2022-06-01 (FMP)
  python load_prices.py                          # daily incremental (last ~14d)
  python load_prices.py --source yfinance --full # free backfill bootstrap
  python load_prices.py --dry-run                # fetch + report, no write
"""
from __future__ import annotations

import argparse
import datetime as dt
import os
import sys
import time

import requests

import hp1_db

FMP_BASE = "https://financialmodelingprep.com/stable"
BACKFILL_START = "2022-06-01"  # matches the backtest window start


def _num(v):
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return None if f != f else f  # drop NaN


def _map_fmp_rows(ticker: str, raw) -> list[dict]:
    """Map an FMP historical-price-eod response to hp1.prices rows. Pure.

    Accepts both the /stable/ array shape and the legacy {historical:[...]} shape.
    Prefers adjClose for adj_close (corp-action-safe momentum), falls back to close.
    """
    rows = raw if isinstance(raw, list) else (raw or {}).get("historical", []) or []
    out = []
    for r in rows:
        date = r.get("date")
        if not date:
            continue
        date = str(date)[:10]
        close = _num(r.get("close"))
        adj = _num(r.get("adjClose"))
        vol = r.get("volume")
        out.append({
            "ticker": ticker,
            "date": date,
            "open": _num(r.get("open")),
            "high": _num(r.get("high")),
            "low": _num(r.get("low")),
            "close": close,
            "adj_close": adj if adj is not None else close,
            "volume": None if vol is None else int(vol),
        })
    return out


def fetch_fmp(ticker: str, from_date: str, to_date: str, api_key: str) -> list[dict]:
    url = f"{FMP_BASE}/historical-price-eod/full"
    params = {"symbol": ticker, "from": from_date, "to": to_date, "apikey": api_key}
    resp = requests.get(url, params=params, timeout=30)
    if not resp.ok:
        raise RuntimeError(f"FMP {ticker} failed: {resp.status_code} {resp.text[:200]}")
    return _map_fmp_rows(ticker, resp.json())


def fetch_yfinance(tickers: list[str], start: str) -> list[dict]:
    """Bootstrap backfill via yfinance (free). auto_adjust=False keeps raw close
    and 'Adj Close' separate so we store both."""
    import yfinance as yf  # lazy: only needed for the bootstrap path

    raw = yf.download(tickers, start=start, auto_adjust=False, progress=False,
                      group_by="ticker")
    out: list[dict] = []
    for tk in tickers:
        try:
            sub = raw[tk] if len(tickers) > 1 else raw
        except KeyError:
            print(f"  yfinance: no data for {tk}", file=sys.stderr)
            continue
        sub = sub.dropna(how="all")
        for date, row in sub.iterrows():
            close = _num(row.get("Close"))
            adj = _num(row.get("Adj Close"))
            vol = row.get("Volume")
            out.append({
                "ticker": tk,
                "date": date.date().isoformat(),
                "open": _num(row.get("Open")),
                "high": _num(row.get("High")),
                "low": _num(row.get("Low")),
                "close": close,
                "adj_close": adj if adj is not None else close,
                "volume": None if vol is None or vol != vol else int(vol),
            })
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Load HP-1 prices into hp1.prices")
    ap.add_argument("--source", choices=["fmp", "yfinance"], default="fmp")
    ap.add_argument("--full", action="store_true",
                    help=f"backfill from {BACKFILL_START} (default: last 14 days)")
    ap.add_argument("--since", help="ISO date floor (overrides --full window)")
    ap.add_argument("--dry-run", action="store_true", help="fetch + report, no DB write")
    args = ap.parse_args(argv)

    today = dt.date.today().isoformat()
    if args.since:
        from_date = args.since
    elif args.full:
        from_date = BACKFILL_START
    else:
        from_date = (dt.date.today() - dt.timedelta(days=14)).isoformat()

    conn = hp1_db.connect()
    try:
        universe = hp1_db.fetch_universe(conn, active_only=True)
        tickers = [u["ticker"] for u in universe]
        print(f"universe: {len(tickers)} active tickers | source={args.source} "
              f"| from={from_date} to={today}")

        rows: list[dict] = []
        if args.source == "yfinance":
            rows = fetch_yfinance(tickers, from_date)
        else:
            api_key = os.environ.get("FMP_API_KEY")
            if not api_key:
                print("FMP_API_KEY not set", file=sys.stderr)
                return 2
            for i, tk in enumerate(tickers, 1):
                try:
                    tk_rows = fetch_fmp(tk, from_date, today, api_key)
                    rows.extend(tk_rows)
                    print(f"  [{i}/{len(tickers)}] {tk}: {len(tk_rows)} rows")
                except Exception as e:  # one bad symbol shouldn't sink the run
                    print(f"  [{i}/{len(tickers)}] {tk}: ERROR {e}", file=sys.stderr)
                time.sleep(0.2)  # be gentle with rate limits

        print(f"fetched {len(rows)} price rows across {len({r['ticker'] for r in rows})} tickers")
        if args.dry_run:
            print("dry-run: not writing")
            return 0
        n = hp1_db.upsert_prices(conn, rows)
        print(f"upserted {n} rows into hp1.prices")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
