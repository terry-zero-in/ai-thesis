"""Rules-scanner tests: structural extraction, headline/rule consistency, change detection."""
import json
import os
import unittest

from kalshi_weather import kalshi_api, rules_scanner

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, name)) as f:
        return json.load(f)


class HeadlineParsing(unittest.TestCase):
    def test_below(self):
        self.assertEqual(rules_scanner.parse_headline_bucket("83° or below"), ("less", None, 84))

    def test_above(self):
        self.assertEqual(rules_scanner.parse_headline_bucket("92° or above"), ("greater", 91, None))

    def test_range(self):
        self.assertEqual(rules_scanner.parse_headline_bucket("84° to 85°"), ("between", 84, 85))

    def test_unparseable(self):
        self.assertIsNone(rules_scanner.parse_headline_bucket("something odd"))


class StructuralScan(unittest.TestCase):
    def setUp(self):
        self.series = load("series_nyc.json")["series"]
        self.markets = [kalshi_api.parse_market(m) for m in load("markets_nyc.json")["markets"]]

    def test_captures_settlement_source(self):
        scan = rules_scanner.structural_scan(self.series, self.markets)
        self.assertEqual(scan["settlement_sources"], [{"name": "The Weather Company",
                                                      "url": "https://weather.com/kalshi"}])

    def test_captures_important_info(self):
        # The Aug-14-2026 NWS -> TWC settlement-source transition rides in
        # product_metadata.important_info; the scanner must surface it.
        scan = rules_scanner.structural_scan(self.series, self.markets)
        self.assertIn("The Weather Company", scan["important_info"])

    def test_cli_code_extracted(self):
        scan = rules_scanner.structural_scan(self.series, self.markets)
        self.assertEqual(scan["cli_code"], "NYC")

    def test_real_fixture_is_consistent(self):
        scan = rules_scanner.structural_scan(self.series, self.markets)
        self.assertEqual(scan["mismatches"], [])

    def test_seeded_mismatch_detected(self):
        bad = self.markets[0]._replace(yes_sub_title="90° or above")
        scan = rules_scanner.structural_scan(self.series, [bad] + self.markets[1:])
        self.assertEqual(len(scan["mismatches"]), 1)
        self.assertIn(bad.ticker, scan["mismatches"][0])


class ChangeDetection(unittest.TestCase):
    def test_hash_stable_and_sensitive(self):
        series = load("series_nyc.json")["series"]
        markets = [kalshi_api.parse_market(m) for m in load("markets_nyc.json")["markets"]]
        h1 = rules_scanner.rulebook_hash(series, markets[0])
        h2 = rules_scanner.rulebook_hash(series, markets[0])
        self.assertEqual(h1, h2)
        changed = markets[0]._replace(rules_primary=markets[0].rules_primary + " AMENDED")
        self.assertNotEqual(h1, rules_scanner.rulebook_hash(series, changed))


class LlmPass(unittest.TestCase):
    def test_no_key_returns_pending(self):
        old = os.environ.pop("ANTHROPIC_API_KEY", None)
        try:
            result, status = rules_scanner.llm_extract("some rulebook text", "KXHIGHNY")
            self.assertIsNone(result)
            self.assertEqual(status, "pending_llm:no_api_key")
        finally:
            if old is not None:
                os.environ["ANTHROPIC_API_KEY"] = old


if __name__ == "__main__":
    unittest.main()
