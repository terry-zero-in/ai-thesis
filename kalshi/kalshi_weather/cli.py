"""Command-line entry points. All commands are paper-mode/read-only."""
import argparse
import json
import os
import sqlite3

from . import gate, kalshi_api, ledger, shadow
from .config import Config


def _conn(cfg: Config) -> sqlite3.Connection:
    os.makedirs(cfg.data_dir, exist_ok=True)
    conn = sqlite3.connect(cfg.ledger_path)
    ledger.init(conn)
    return conn


def cmd_discover(cfg: Config, _args) -> int:
    client = kalshi_api.Client()
    series = client.discover_kxhigh()
    mapped = [s["ticker"] for s in series if s["ticker"] in cfg.stations]
    unmapped = [s["ticker"] for s in series if s["ticker"] not in cfg.stations]
    print(f"KXHIGH series live on Kalshi: {len(series)}")
    print(f"mapped to stations ({len(mapped)}): {', '.join(sorted(mapped))}")
    print(f"unmapped ({len(unmapped)}) — priced only after a station is added "
          f"and verified: {', '.join(sorted(unmapped))}")
    return 0


def cmd_cycle(cfg: Config, _args) -> int:
    conn = _conn(cfg)
    summary = shadow.run_cycle(conn, cfg, kalshi_api.Client())
    print(f"cycle {summary['ts']}  regime: {summary['regime']}")
    print(f"priced {len(summary['priced'])} markets | placed {summary['placed']} "
          f"| filled {summary['filled']} | cancelled {summary['cancelled']} "
          f"| expired {summary['expired']}")
    for row in summary["priced"]:
        print(f"  {row['ticker']:<28} model {row['p']:.3f} "
              f"(gefs {row['p_gefs']:.3f} / ecmwf {row['p_ecmwf']:.3f}, "
              f"gap {row['agreement']:.3f})  book {row['yes_bid']}/{row['yes_ask']}c")
    for s in summary["scans"]:
        print(f"  scan {s['series']}: {s.get('flag')} ({s.get('llm_status', '-')})")
    for s in summary["skipped"]:
        print(f"  skipped: {s}")
    return 0


def cmd_settle(cfg: Config, _args) -> int:
    conn = _conn(cfg)
    summary = shadow.settle_cycle(conn, cfg, kalshi_api.Client())
    print(f"settlements recorded: {summary['settlements']}  "
          f"market results: {summary['results']}  bias refit: {summary['refit']}")
    return 0


def cmd_report(cfg: Config, _args) -> int:
    conn = _conn(cfg)
    rep = gate.evaluate(conn, cfg)
    print(f"CALIBRATION GATE — {rep['verdict']}  (as of {rep['as_of']})")
    print(f"  settled fills: {rep['n_settled']}   window: {rep['window_days']}d "
          f"of {cfg.gate_window_days}d required")
    if rep["brier_ours"] is not None:
        print(f"  Brier ours {rep['brier_ours']:.4f}  vs market {rep['brier_market']:.4f}")
        print(f"  paper PnL after fees: {rep['pnl_after_fees_c'] / 100:.2f} USD")
    for r in rep["reasons"]:
        print(f"  - {r}")
    open_q = ledger.open_quotes(conn)
    print(f"  open paper quotes: {len(open_q)}")
    pending = ledger.pending_scans(conn)
    if pending:
        print(f"  rules-review queue: {len(pending)} item(s)")
        for p in pending[:5]:
            print(f"    [{p['status']}] {p['series']} {p['flag']} "
                  f"({p['divergence_pts']:.1f}pts) {p['ts']}")
    return 0


def cmd_quotes(cfg: Config, _args) -> int:
    conn = _conn(cfg)
    rows = conn.execute(
        """SELECT ts, ticker, side, price_c, size, model_p, mkt_implied_p, edge_net_c,
                  status FROM quotes ORDER BY id DESC LIMIT 40""").fetchall()
    for ts, ticker, side, price, size, mp, ip, edge, status in rows:
        print(f"{ts}  {ticker:<28} {side:<3} {price:>3}c x{size:<4} "
              f"model {mp:.3f} mkt {ip if ip is None else round(ip, 3)} "
              f"edge {edge:.1f}c  [{status}]")
    if not rows:
        print("no quotes yet — run `cycle` during market hours")
    return 0


def cmd_scan(cfg: Config, _args) -> int:
    from . import rules_scanner
    import datetime
    conn = _conn(cfg)
    client = kalshi_api.Client()
    ts = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for series in cfg.stations:
        try:
            meta = client.series(series)
            events = client.events(series)
            markets = []
            for ev in events:
                markets = [kalshi_api.parse_market(m) for m in ev.get("markets", [])]
                if markets:
                    break
            out = rules_scanner.scan_series(conn, cfg, meta, markets, ts)
            print(f"{series}: {out.get('flag')} "
                  f"{'(' + out.get('llm_status', '') + ')' if out.get('llm_status') else ''}")
            for mm in out.get("mismatches", []):
                print(f"  ! {mm}")
        except Exception as e:
            print(f"{series}: scan failed ({e})")
    return 0


def cmd_dashboard(cfg: Config, args) -> int:
    from . import server
    server.serve(cfg, port=args.port,
                 cycle_interval_s=args.cycle_minutes * 60,
                 settle_interval_s=args.settle_hours * 3600)
    return 0


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        prog="kalshi_weather",
        description="Paper-mode Kalshi weather system: pricing, rules-scanner, "
                    "execution-shadow. No live trading path exists.")
    sub = parser.add_subparsers(dest="cmd", required=True)
    for name, fn in [("discover", cmd_discover), ("cycle", cmd_cycle),
                     ("settle", cmd_settle), ("report", cmd_report),
                     ("quotes", cmd_quotes), ("scan", cmd_scan)]:
        p = sub.add_parser(name)
        p.set_defaults(fn=fn)
    d = sub.add_parser("dashboard", help="live local server: scheduler + dashboard")
    d.add_argument("--port", type=int, default=8765)
    d.add_argument("--cycle-minutes", type=float, default=30)
    d.add_argument("--settle-hours", type=float, default=6)
    d.set_defaults(fn=cmd_dashboard)
    args = parser.parse_args(argv)
    return args.fn(Config(), args)


if __name__ == "__main__":
    raise SystemExit(main())
