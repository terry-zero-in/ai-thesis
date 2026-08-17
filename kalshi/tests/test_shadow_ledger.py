"""Ledger round-trips and the maker-fill simulator (the money-state machine).

Fill rule (conservative, documented in shadow.py): a resting bid at price p
fills only if, after placement,
  (a) a trade on our side prints STRICTLY better-for-counterparty (below p), or
  (b) cumulative traded size AT p reaches displayed size ahead of us + our size
and only trades whose taker was the opposite side count.
"""
import sqlite3
import unittest

from kalshi_weather import ledger, shadow
from kalshi_weather.config import Config


def make_conn():
    conn = sqlite3.connect(":memory:")
    ledger.init(conn)
    return conn


def trade(yes_c, count, taker_side, ts="2026-08-17T12:00:00Z"):
    return {"yes_price_c": yes_c, "no_price_c": 100 - yes_c, "count": count,
            "taker_side": taker_side, "created_time": ts}


class LedgerRoundTrip(unittest.TestCase):
    def test_quote_lifecycle(self):
        conn = make_conn()
        qid = ledger.insert_quote(conn, ticker="T-1", event_ticker="E-1", station="KXHIGHNY",
                                  target_date="2026-08-17", side="yes", price_c=20, size=10,
                                  model_p=0.31, p_gefs=0.30, p_ecmwf=0.33, agreement=0.03,
                                  mkt_yes_bid_c=19, mkt_yes_ask_c=22, mkt_implied_p=0.205,
                                  edge_net_c=10.2, ahead_size=40.0, regime="unknown",
                                  strike_type="less", floor_strike=None, cap_strike=84,
                                  ts="2026-08-17T11:00:00Z")
        open_q = ledger.open_quotes(conn)
        self.assertEqual(len(open_q), 1)
        self.assertEqual(open_q[0]["price_c"], 20)
        ledger.mark_filled(conn, qid, fill_ts="2026-08-17T12:30:00Z", fill_fee_c=1)
        self.assertEqual(ledger.open_quotes(conn), [])
        row = conn.execute("SELECT status, fill_fee_c FROM quotes WHERE id=?", (qid,)).fetchone()
        self.assertEqual(tuple(row), ("filled", 1))

    def test_settlement_upsert(self):
        conn = make_conn()
        ledger.upsert_settlement(conn, "KXHIGHNY", "2026-08-16", 80, "IEM_CLI", "t1")
        ledger.upsert_settlement(conn, "KXHIGHNY", "2026-08-16", 81, "IEM_CLI", "t2")
        row = conn.execute("SELECT high_f FROM settlements WHERE station='KXHIGHNY'").fetchall()
        self.assertEqual(row, [(81,)])

    def test_scan_hash_tracking(self):
        conn = make_conn()
        self.assertIsNone(ledger.latest_scan_hash(conn, "KXHIGHNY"))
        ledger.insert_scan(conn, ts="t", series="KXHIGHNY", rules_hash="abc",
                           flag="baseline", divergence_pts=0.0, detail="{}", status="ok")
        self.assertEqual(ledger.latest_scan_hash(conn, "KXHIGHNY"), "abc")


class FillSimulator(unittest.TestCase):
    def _quote(self, side="yes", price_c=20, size=10, ahead=40.0):
        return {"id": 1, "side": side, "price_c": price_c, "size": size,
                "ahead_size": ahead, "ts": "2026-08-17T11:00:00Z"}

    def test_strict_price_through_fills(self):
        q = self._quote()
        fills = shadow.check_fill(q, [trade(19, 1.0, "no")])
        self.assertTrue(fills)

    def test_equal_price_insufficient_volume_stays_open(self):
        q = self._quote()
        self.assertFalse(shadow.check_fill(q, [trade(20, 30.0, "no")]))  # 30 < 40+10

    def test_equal_price_queue_cleared_fills(self):
        q = self._quote()
        self.assertTrue(shadow.check_fill(q, [trade(20, 30.0, "no"), trade(20, 25.0, "no")]))

    def test_wrong_taker_side_ignored(self):
        q = self._quote()
        # takers buying YES lift asks; they never fill our resting YES bid
        self.assertFalse(shadow.check_fill(q, [trade(19, 100.0, "yes")]))

    def test_no_side_quote_uses_no_prices(self):
        q = self._quote(side="no", price_c=23)
        # taker buys YES at 77 -> no_price 23 == our bid; needs queue clear
        self.assertFalse(shadow.check_fill(q, [trade(77, 10.0, "yes")]))
        # trade at yes 75 -> no_price 25... that is WORSE for us (higher no price).
        # strictly better-for-counterparty on NO side = no_price < 23 -> yes_price > 77
        self.assertTrue(shadow.check_fill(q, [trade(78, 1.0, "yes")]))

    def test_trades_before_placement_ignored(self):
        q = self._quote()
        old = trade(19, 100.0, "no", ts="2026-08-17T10:00:00Z")
        self.assertFalse(shadow.check_fill(q, [old]))


class AggregateMarketCap(unittest.TestCase):
    def test_committed_cents_sums_open_and_filled_both_sides(self):
        """$100/market is an aggregate per-ticker cap (ship-gate 2026-08-17;
        conservative reading of the pinned 'per market')."""
        conn = make_conn()
        common = dict(event_ticker="E", station="KXHIGHNY", target_date="2026-08-17",
                      model_p=0.3, p_gefs=0.3, p_ecmwf=0.3, agreement=0.0,
                      mkt_yes_bid_c=30, mkt_yes_ask_c=35, mkt_implied_p=0.325,
                      edge_net_c=5.0, ahead_size=0.0, regime="unknown",
                      strike_type="less", floor_strike=None, cap_strike=84,
                      ts="2026-08-17T11:00:00Z")
        q1 = ledger.insert_quote(conn, ticker="T-1", side="yes", price_c=40, size=200,
                                 **common)  # $80
        ledger.insert_quote(conn, ticker="T-1", side="no", price_c=10, size=50,
                            **common)       # $5
        ledger.insert_quote(conn, ticker="T-2", side="yes", price_c=40, size=200,
                            **common)       # other ticker, excluded
        self.assertEqual(ledger.committed_cents(conn, "T-1"), 8500)
        ledger.mark_filled(conn, q1, fill_ts="2026-08-17T12:00:00Z", fill_fee_c=5)
        self.assertEqual(ledger.committed_cents(conn, "T-1"), 8500)  # filled still counts
        ledger.mark_status(conn, q1, "cancelled")
        self.assertEqual(ledger.committed_cents(conn, "T-1"), 500)   # cancelled freed


class Lead0Cutoff(unittest.TestCase):
    def test_lead0_quotes_only_before_local_noon(self):
        cfg = Config()
        self.assertTrue(shadow.lead_allows_quoting(0, 0, cfg))
        self.assertTrue(shadow.lead_allows_quoting(0, 11, cfg))
        self.assertFalse(shadow.lead_allows_quoting(0, 12, cfg))
        self.assertFalse(shadow.lead_allows_quoting(0, 20, cfg))

    def test_lead1_always_quotable(self):
        cfg = Config()
        self.assertTrue(shadow.lead_allows_quoting(1, 23, cfg))


class CandidateSelection(unittest.TestCase):
    def setUp(self):
        self.cfg = Config()

    def _book(self, yes_bid=19, no_bid=76):
        return {"yes": [(yes_bid, 50.0)], "no": [(no_bid, 50.0)]}

    def test_positive_edge_yes_candidate(self):
        # model says 31%, market yes bid 19 / ask 24: joining bid at 19 with
        # fair 31 -> net edge ~ 31 - 19 - fee > min_edge
        c = shadow.build_candidate(self.cfg, model_p=0.31, book=self._book(yes_bid=19, no_bid=76),
                                   side="yes")
        self.assertIsNotNone(c)
        self.assertLessEqual(c["price_c"], 24 - 1)  # never crosses implied ask

    def test_no_cross(self):
        # implied yes ask = 100-76 = 24; candidate price must be < 24
        c = shadow.build_candidate(self.cfg, model_p=0.90, book=self._book(yes_bid=23, no_bid=76),
                                   side="yes")
        self.assertIsNotNone(c)
        self.assertLess(c["price_c"], 24)

    def test_tail_band_rejects_expensive(self):
        c = shadow.build_candidate(self.cfg, model_p=0.80, book=self._book(yes_bid=60, no_bid=35),
                                   side="yes")
        self.assertIsNone(c)  # 60c > max_quote_price_cents band

    def test_insufficient_edge_rejected(self):
        c = shadow.build_candidate(self.cfg, model_p=0.21, book=self._book(yes_bid=19, no_bid=76),
                                   side="yes")
        self.assertIsNone(c)

    def test_no_side_candidate(self):
        # model p(yes)=0.70 -> p(no)=0.30; no bid 25, no implied ask = 100-yes_bid
        c = shadow.build_candidate(self.cfg, model_p=0.70, book=self._book(yes_bid=68, no_bid=25),
                                   side="no")
        self.assertIsNotNone(c)
        self.assertLess(c["price_c"], 100 - 68)


if __name__ == "__main__":
    unittest.main()
