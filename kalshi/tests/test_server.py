"""Dashboard server tests: state assembly, rendering, localhost containment."""
import os
import sqlite3
import unittest

from kalshi_weather import ledger, server
from kalshi_weather.config import Config

PKG = os.path.join(os.path.dirname(__file__), "..", "kalshi_weather")


def seeded_conn():
    conn = sqlite3.connect(":memory:")
    ledger.init(conn)
    ledger.insert_quote(conn, ticker="KXHIGHNY-26AUG17-B86.5", event_ticker="E",
                        station="KXHIGHNY", target_date="2026-08-17", side="yes",
                        price_c=2, size=100, model_p=0.169, p_gefs=0.16,
                        p_ecmwf=0.18, agreement=0.02, mkt_yes_bid_c=2,
                        mkt_yes_ask_c=3, mkt_implied_p=0.025, edge_net_c=14.8,
                        ahead_size=10.0, regime="unknown", strike_type="between",
                        floor_strike=86, cap_strike=87, ts="2026-08-17T05:45:16Z")
    return conn


class BuildState(unittest.TestCase):
    def test_state_shape(self):
        state = server.build_state(seeded_conn(), Config(), server.Runtime())
        self.assertEqual(state["gate"]["verdict"], "NOT_YET")
        self.assertEqual(len(state["open_quotes"]), 1)
        self.assertIn("cap_usd", state["config"])
        self.assertEqual(state["config"]["cap_usd"], 100.0)

    def test_priced_sorted_by_divergence(self):
        rt = server.Runtime()
        rt.priced = [
            {"ticker": "A", "p": 0.50, "p_gefs": 0.5, "p_ecmwf": 0.5,
             "agreement": 0.0, "yes_bid": 48, "yes_ask": 50},   # div ~1pt
            {"ticker": "B", "p": 0.20, "p_gefs": 0.2, "p_ecmwf": 0.2,
             "agreement": 0.0, "yes_bid": 60, "yes_ask": 62},   # div ~41pts
        ]
        state = server.build_state(seeded_conn(), Config(), rt)
        self.assertEqual(state["priced"][0]["ticker"], "B")


class RenderPage(unittest.TestCase):
    def test_page_renders_key_content(self):
        state = server.build_state(seeded_conn(), Config(), server.Runtime())
        page = server.render_page(state)
        self.assertIn("Paper mode", page)
        self.assertIn("Gate: NOT_YET", page)
        self.assertIn("KXHIGHNY-26AUG17-B86.5", page)
        self.assertIn("Run cycle now", page)

    def test_dynamic_content_is_escaped(self):
        conn = seeded_conn()
        ledger.insert_scan(conn, ts="t", series="<script>x</script>", rules_hash="h",
                           flag="changed", divergence_pts=0.0, detail="{}",
                           status="review")
        page = server.render_page(server.build_state(conn, Config(), server.Runtime()))
        self.assertNotIn("<script>x</script>", page)
        self.assertIn("&lt;script&gt;", page)


class LocalhostOnly(unittest.TestCase):
    def test_server_binds_loopback_only(self):
        with open(os.path.join(PKG, "server.py")) as f:
            src = f.read()
        self.assertIn('"127.0.0.1"', src)
        self.assertNotIn("0.0.0.0", src)


if __name__ == "__main__":
    unittest.main()
