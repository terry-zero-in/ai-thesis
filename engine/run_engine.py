"""HP-1 daily engine run: read hp1.universe + hp1.prices, score, write
hp1.engine_runs + hp1.engine_ranks.

Scheduled post-close by .github/workflows/hp1-engine.yml after the price loader.
Math is in hp1_factors/hp1_score; DB I/O in hp1_db. Keep this a thin orchestrator.

  python run_engine.py            # compute + write one run
  python run_engine.py --dry-run  # compute + print summary, no write
"""
from __future__ import annotations

import argparse
import sys

import pandas as pd

import hp1_db
from hp1_score import compute_engine_output


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Run the HP-1 engine for one day")
    ap.add_argument("--dry-run", action="store_true", help="compute + print, no DB write")
    ap.add_argument("--since", default=None,
                    help="ISO date floor for price history (default: full history)")
    args = ap.parse_args(argv)

    conn = hp1_db.connect()
    try:
        universe = hp1_db.fetch_universe(conn, active_only=True)
        uni_df = pd.DataFrame(universe)
        tickers = [u["ticker"] for u in universe]
        prices = hp1_db.fetch_prices(conn, tickers, since=args.since)
        if prices.empty:
            print("no prices in hp1.prices — run load_prices.py first", file=sys.stderr)
            return 2

        run, ranks = compute_engine_output(prices, uni_df)
        print(f"as_of={run['as_of']} data_through={run['data_through']} "
              f"universe_n={run['universe_n']} breadth={run['breadth_pct']}% "
              f"gross={run['gate_gross']} | {run['regime_read']}")
        print(f"engine_ranks rows: {len(ranks)} "
              f"({len(ranks) // 2 if ranks else 0} name-views × 2 sleeves)")

        if args.dry_run:
            top = sorted(
                (r for r in ranks if r["view"] == "combined" and r["sleeve"] == "tactical"
                 and r["score"] is not None),
                key=lambda r: r["score"], reverse=True)[:10]
            print("top-10 combined tactical:")
            for r in top:
                print(f"  {r['ticker']:6} score={r['score']:.2f} pct={r['pct']:.0f} "
                      f"{r['driver_tag']:16} elig={r['sleeve_eligible']}")
            print("dry-run: not writing")
            return 0

        run_id = hp1_db.write_engine_run(conn, run, ranks)
        print(f"wrote engine_run {run_id} + {len(ranks)} engine_ranks rows")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
