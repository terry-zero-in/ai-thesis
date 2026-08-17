"""Open-Meteo ensemble parsing + IEM CLI settlement parsing (recorded fixtures)."""
import json
import os
import tempfile
import unittest

from kalshi_weather import openmeteo, settlement

FIX = os.path.join(os.path.dirname(__file__), "fixtures")


def load(name):
    with open(os.path.join(FIX, name)) as f:
        return json.load(f)


class EnsembleParsing(unittest.TestCase):
    def setUp(self):
        self.raw = load("ensemble_trim.json")
        self.times, self.members = openmeteo.parse_members(self.raw)

    def test_two_models_present(self):
        models = {m.model for m in self.members}
        self.assertEqual(models, {"gefs", "ecmwf"})

    def test_member_counts_in_trimmed_fixture(self):
        # fixture trimmed to control + member01 + member02 per model
        gefs = [m for m in self.members if m.model == "gefs"]
        ecmwf = [m for m in self.members if m.model == "ecmwf"]
        self.assertEqual(len(gefs), 3)
        self.assertEqual(len(ecmwf), 3)

    def test_daily_max_matches_fixture_data(self):
        date = self.times[0][:10]
        m = self.members[0]
        expected = max(v for t, v in zip(self.times, m.temps)
                       if t.startswith(date) and v is not None)
        got = openmeteo.member_daily_max(self.times, m.temps, date)
        self.assertEqual(got, expected)

    def test_ens_stats(self):
        mean, spread = openmeteo.ens_stats([80.0, 82.0, 84.0])
        self.assertAlmostEqual(mean, 82.0)
        self.assertAlmostEqual(spread, 2.0)
        mean1, spread1 = openmeteo.ens_stats([80.0])
        self.assertEqual((mean1, spread1), (80.0, 0.0))


class Settlement(unittest.TestCase):
    def test_parse_cli_fixture(self):
        highs = settlement.parse_cli(load("cli_knyc.json"))
        self.assertEqual(highs["2026-08-16"], 80)
        self.assertGreaterEqual(len(highs), 10)

    def test_missing_values_skipped(self):
        data = {"results": [{"valid": "2026-01-01", "high": "M"},
                            {"valid": "2026-01-02", "high": None},
                            {"valid": "2026-01-03", "high": 41}]}
        highs = settlement.parse_cli(data)
        self.assertEqual(highs, {"2026-01-03": 41})

    def test_cache_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            payload = load("cli_knyc.json")
            path = settlement.cache_path(d, "KNYC", 2026)
            settlement.write_cache(path, payload)
            cached = settlement.read_cache(path)
            self.assertEqual(settlement.parse_cli(cached)["2026-08-16"], 80)


if __name__ == "__main__":
    unittest.main()
