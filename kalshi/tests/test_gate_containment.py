"""Calibration gate + structural containment.

Gate doctrine (Terry, 2026-08-17 scope): 30-day paper Brier must beat
market-implied after fees before any live-mode flag EXISTS in the codebase.
The containment test enforces the second clause mechanically.
"""
import datetime
import glob
import os
import sqlite3
import unittest

from kalshi_weather import gate, ledger
from kalshi_weather.config import Config

PKG_DIR = os.path.join(os.path.dirname(__file__), "..", "kalshi_weather")


def make_conn():
    conn = sqlite3.connect(":memory:")
    ledger.init(conn)
    return conn


def seed_filled_quote(conn, ts, side, price_c, model_p, mkt_p, ticker, result,
                      size=10, fee_c=1):
    qid = ledger.insert_quote(conn, ticker=ticker, event_ticker=ticker.rsplit("-", 1)[0],
                              station="KXHIGHNY", target_date=ts[:10], side=side,
                              price_c=price_c, size=size, model_p=model_p, p_gefs=model_p,
                              p_ecmwf=model_p, agreement=0.0, mkt_yes_bid_c=price_c,
                              mkt_yes_ask_c=price_c + 2, mkt_implied_p=mkt_p,
                              edge_net_c=5.0, ahead_size=0.0, regime="unknown",
                              strike_type="less", floor_strike=None, cap_strike=84, ts=ts)
    ledger.mark_filled(conn, qid, fill_ts=ts, fill_fee_c=fee_c)
    ledger.upsert_market_result(conn, ticker, result, ts)
    return qid


class Brier(unittest.TestCase):
    def test_known_values(self):
        self.assertAlmostEqual(gate.brier(0.8, 1), 0.04)
        self.assertAlmostEqual(gate.brier(0.8, 0), 0.64)
        self.assertEqual(gate.brier(1.0, 1), 0.0)


class Evaluate(unittest.TestCase):
    def test_not_yet_when_window_short(self):
        conn = make_conn()
        seed_filled_quote(conn, "2026-08-10T12:00:00Z", "yes", 20, 0.9, 0.2, "A-1", "yes")
        rep = gate.evaluate(conn, Config(), today=datetime.date(2026, 8, 17))
        self.assertEqual(rep["verdict"], "NOT_YET")
        self.assertIn("window", " ".join(rep["reasons"]))

    def test_pass_when_all_conditions_met(self):
        conn = make_conn()
        cfg = Config()
        # 35 days of settled fills where model was right (p=0.9 -> yes) and
        # market was wrong-ish (implied 0.4): ours brier lower, pnl positive.
        start = datetime.date(2026, 7, 1)
        for i in range(35):
            d = start + datetime.timedelta(days=i)
            ts = f"{d.isoformat()}T12:00:00Z"
            seed_filled_quote(conn, ts, "yes", 40, 0.9, 0.4, f"A-{i}", "yes")
        rep = gate.evaluate(conn, cfg, today=datetime.date(2026, 8, 17))
        self.assertEqual(rep["verdict"], "PASS")
        self.assertLess(rep["brier_ours"], rep["brier_market"])
        self.assertGreater(rep["pnl_after_fees_c"], 0)

    def test_fail_brier_when_market_better(self):
        conn = make_conn()
        start = datetime.date(2026, 7, 1)
        for i in range(35):
            d = start + datetime.timedelta(days=i)
            ts = f"{d.isoformat()}T12:00:00Z"
            # our model confident-wrong (0.9 on markets that resolve no),
            # market implied 0.3 (closer to truth)
            seed_filled_quote(conn, ts, "yes", 40, 0.9, 0.3, f"B-{i}", "no")
        rep = gate.evaluate(conn, Config(), today=datetime.date(2026, 8, 17))
        self.assertEqual(rep["verdict"], "NOT_YET")
        self.assertGreater(rep["brier_ours"], rep["brier_market"])

    def test_pnl_math(self):
        conn = make_conn()
        seed_filled_quote(conn, "2026-08-10T12:00:00Z", "yes", 20, 0.9, 0.2, "C-1", "yes",
                          size=10, fee_c=1)
        rep = gate.evaluate(conn, Config(), today=datetime.date(2026, 8, 17))
        # win: (100-20)*10 - 1 = 799 cents
        self.assertEqual(rep["pnl_after_fees_c"], 799)


class Containment(unittest.TestCase):
    """No order-placement capability may exist anywhere in the package."""

    def _sources(self):
        for path in glob.glob(os.path.join(PKG_DIR, "*.py")):
            with open(path) as f:
                yield path, f.read()

    def test_no_trading_endpoints_or_live_flags(self):
        banned = ["portfolio", "place_order", "create_order", "live_mode",
                  "LIVE_MODE", "KALSHI_API_KEY", "KALSHI_PRIVATE_KEY"]
        for path, src in self._sources():
            for term in banned:
                self.assertNotIn(term, src, f"{term!r} found in {path}")

    def test_no_auth_headers_anywhere(self):
        # no module may construct auth headers — covers http.py, not just the
        # kalshi client (ship-gate finding, 2026-08-17)
        for path, src in self._sources():
            self.assertNotIn("Authorization", src, path)
            self.assertNotIn("Bearer", src, path)


if __name__ == "__main__":
    unittest.main()
