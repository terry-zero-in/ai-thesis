"""Offline end-to-end smoke / preview of the HP-1 engine.

Fetches live yfinance adjusted closes for the fixed universe and runs
`compute_run()` — the exact production path the daily Action uses — with NO
database. Two purposes:

  1. See what the engine ranks *today*, before `HP1_DB_URL` is wired.
  2. A real-data check on `compute_run()` (the unit tests use synthetic prices).

The universe here mirrors the `hp1.universe` seed (migration 20260617000200) /
HP1_SPEC §2 and is preview-only — the production loader + engine read the DB.

Run:  python hp1_smoke.py [--period 2y] [--csv ranks.csv]
"""
from __future__ import annotations

import argparse

import pandas as pd
import yfinance as yf

from hp1_daily_run import compute_run

# Fixed investable universe by layer (mirrors hp1.universe seed / HP1_SPEC §2).
_INVESTABLE = {
    "L1": ["NVDA", "AMD", "AVGO", "MRVL", "MU", "TSM", "ASML", "AMAT", "LRCX",
           "KLAC", "TER", "ARM", "MPWR", "ALAB", "CRDO", "SMCI", "SNPS", "CDNS",
           "ANET", "CLS", "FN", "COHR", "DELL"],
    "L2": ["MSFT", "GOOGL", "AMZN", "META", "ORCL"],
    "L3a": ["PLTR", "SNOW", "DDOG", "CRWD", "PANW", "APP", "TEM", "RDDT", "NET"],
    "L3b": ["CRWV", "NBIS", "IREN", "APLD"],
    "L4": ["VST", "CEG", "GEV", "NRG", "TLN", "VRT"],
    "L5": ["AAPL", "TSLA", "NOW"],
}
_CATEGORY = {"L1": "pure_play", "L2": "megacap", "L3a": "pure_play",
             "L3b": "pure_play", "L4": "pure_play", "L5": "megacap"}
_BENCH = ["SPY", "QQQ"]
_MACRO = ["^VIX"]


def build_universe() -> pd.DataFrame:
    rows = []
    for layer, tickers in _INVESTABLE.items():
        for t in tickers:
            rows.append((t, layer, _CATEGORY[layer], "investable"))
    for t in _BENCH:
        rows.append((t, None, None, "benchmark"))
    for t in _MACRO:
        rows.append((t, None, None, "macro"))
    return pd.DataFrame(rows, columns=["ticker", "layer", "category", "kind"])


def fetch_adj_close(tickers: list[str], period: str) -> pd.DataFrame:
    raw = yf.download(tickers, period=period, auto_adjust=False,
                      progress=False, threads=True)
    level0 = raw.columns.get_level_values(0)
    field = "Adj Close" if "Adj Close" in level0 else "Close"
    px = raw[field] if isinstance(raw.columns, pd.MultiIndex) else raw[[field]]
    return px.dropna(axis=1, how="all").sort_index()


def main() -> int:
    ap = argparse.ArgumentParser(description="Offline HP-1 engine preview (yfinance)")
    ap.add_argument("--period", default="2y", help="yfinance history (need ≥~14mo for r12)")
    ap.add_argument("--csv", help="optional path to write the full rank table")
    args = ap.parse_args()

    uni = build_universe()
    px = fetch_adj_close(uni["ticker"].tolist(), args.period)
    run, ranks = compute_run(px, uni)

    print(f"\nHP-1 engine preview — as_of {run['as_of']} (data_through {run['data_through']})")
    print(f"breadth {run['breadth_pct']}%  gate {run['gate_gross']}  "
          f"regime {run['regime_read']}  universe_n {run['universe_n']}  "
          f"ranks {len(ranks)}  [{run['engine_version']}]")

    df = pd.DataFrame(ranks)
    cols = ["ticker", "layer", "score", "pct", "driver_tag",
            "above_100", "above_200", "r3", "r6", "r12"]
    for view in ("combined", "pure_play", "megacap"):
        for sleeve in ("tactical", "core"):
            sub = df[(df["view"] == view) & (df["sleeve"] == sleeve)]
            if sub.empty:
                continue
            top = sub.sort_values("pct", ascending=False).head(10)
            print(f"\n===== {view} / {sleeve} — top 10 by pct =====")
            print(top[cols].round(3).to_string(index=False))

    if args.csv:
        df.round(4).to_csv(args.csv, index=False)
        print(f"\nwrote {len(df)} rows -> {args.csv}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
