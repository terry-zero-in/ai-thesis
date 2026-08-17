"""Kalshi API parsing tests against recorded live fixtures (2026-08-17)."""
import datetime
import json
import os
import unittest

from kalshi_weather import kalshi_api

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, name)) as f:
        return json.load(f)


class Dollars(unittest.TestCase):
    def test_to_cents(self):
        self.assertEqual(kalshi_api.dollars_to_cents("0.7700"), 77)
        self.assertEqual(kalshi_api.dollars_to_cents("0.0100"), 1)
        self.assertEqual(kalshi_api.dollars_to_cents("1.0000"), 100)
        self.assertEqual(kalshi_api.dollars_to_cents(None), None)


class MarketParsing(unittest.TestCase):
    def setUp(self):
        self.markets = [kalshi_api.parse_market(m) for m in load("markets_nyc.json")["markets"]]

    def test_all_markets_parsed(self):
        self.assertEqual(len(self.markets), 6)

    def test_strike_fields(self):
        by_ticker = {m.ticker: m for m in self.markets}
        less = by_ticker["KXHIGHNY-26AUG17-T84"]
        self.assertEqual((less.strike_type, less.floor_strike, less.cap_strike), ("less", None, 84))
        between = by_ticker["KXHIGHNY-26AUG17-B84.5"]
        self.assertEqual((between.strike_type, between.floor_strike, between.cap_strike), ("between", 84, 85))
        greater = by_ticker["KXHIGHNY-26AUG17-T91"]
        self.assertEqual((greater.strike_type, greater.floor_strike, greater.cap_strike), ("greater", 91, None))

    def test_prices_in_cents(self):
        m = {x.ticker: x for x in self.markets}["KXHIGHNY-26AUG17-T84"]
        self.assertEqual(m.yes_bid_c, 75)
        self.assertEqual(m.yes_ask_c, 77)
        self.assertEqual(m.last_price_c, 75)

    def test_rules_carried(self):
        m = self.markets[0]
        self.assertIn("The Weather Company", m.rules_primary + m.rules_secondary)


class CliCode(unittest.TestCase):
    def test_extracts_station_from_rules(self):
        rules = ("If the maximum temperature recorded at New York City (CLINYC) for "
                 "Aug 17, 2026, is less than 84° fahrenheit...")
        self.assertEqual(kalshi_api.extract_cli_code(rules), "NYC")

    def test_none_when_absent(self):
        self.assertIsNone(kalshi_api.extract_cli_code("no station here"))


class EventDate(unittest.TestCase):
    def test_parse_event_ticker_date(self):
        self.assertEqual(kalshi_api.target_date_from_event("KXHIGHNY-26AUG17"),
                         datetime.date(2026, 8, 17))
        self.assertEqual(kalshi_api.target_date_from_event("KXHIGHCHI-26DEC01"),
                         datetime.date(2026, 12, 1))

    def test_bad_ticker_returns_none(self):
        self.assertIsNone(kalshi_api.target_date_from_event("KXHIGHNY"))


class Orderbook(unittest.TestCase):
    def test_parse_and_bests(self):
        book = kalshi_api.parse_orderbook(load("orderbook.json"))
        # bids ascending per side; best = last. Fixture: yes best 75, no best 23.
        self.assertEqual(kalshi_api.best_bid(book, "yes"), (75, 2.0))
        self.assertEqual(kalshi_api.best_bid(book, "no"), (23, 1.0))
        # implied yes ask = 100 - best no bid
        self.assertEqual(kalshi_api.implied_ask(book, "yes"), 77)
        self.assertEqual(kalshi_api.implied_ask(book, "no"), 25)

    def test_size_at_price(self):
        book = kalshi_api.parse_orderbook(load("orderbook.json"))
        self.assertEqual(kalshi_api.size_at(book, "yes", 74), 539.11)
        self.assertEqual(kalshi_api.size_at(book, "yes", 71), 0.0)


class Trades(unittest.TestCase):
    def test_trade_fields(self):
        trades = load("trades.json")["trades"]
        t = trades[0]
        self.assertIn(t["taker_side"], ("yes", "no"))
        self.assertEqual(kalshi_api.dollars_to_cents(t["yes_price_dollars"]), 75)
        self.assertEqual(kalshi_api.dollars_to_cents(t["no_price_dollars"]), 25)
        self.assertGreater(float(t["count_fp"]), 0)


if __name__ == "__main__":
    unittest.main()
