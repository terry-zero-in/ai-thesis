"""Regime quote/pull filter (Lead-Lag Radar export consumer, permissive by default)."""
import datetime
import json
import os
import tempfile
import unittest

from kalshi_weather import regime

NOW = datetime.datetime(2026, 8, 17, 12, 0, tzinfo=datetime.timezone.utc)


def write(d, payload):
    path = os.path.join(d, "regime.json")
    with open(path, "w") as f:
        json.dump(payload, f)
    return path


class Regime(unittest.TestCase):
    def test_missing_file_permissive(self):
        ok, reason = regime.allow_quotes("/nonexistent/regime.json", now=NOW)
        self.assertTrue(ok)
        self.assertIn("unknown", reason)

    def test_fresh_calm_allows(self):
        with tempfile.TemporaryDirectory() as d:
            p = write(d, {"state": "calm", "asof": "2026-08-17T11:30:00+00:00"})
            ok, reason = regime.allow_quotes(p, now=NOW)
            self.assertTrue(ok)
            self.assertIn("calm", reason)

    def test_fresh_stress_blocks(self):
        with tempfile.TemporaryDirectory() as d:
            p = write(d, {"state": "stress", "asof": "2026-08-17T11:30:00+00:00"})
            ok, reason = regime.allow_quotes(p, now=NOW)
            self.assertFalse(ok)
            self.assertIn("stress", reason)

    def test_stale_export_permissive(self):
        with tempfile.TemporaryDirectory() as d:
            p = write(d, {"state": "stress", "asof": "2026-08-16T00:00:00+00:00"})
            ok, reason = regime.allow_quotes(p, now=NOW)
            self.assertTrue(ok)
            self.assertIn("stale", reason)

    def test_malformed_permissive(self):
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "regime.json")
            with open(path, "w") as f:
                f.write("not json{")
            ok, reason = regime.allow_quotes(path, now=NOW)
            self.assertTrue(ok)
            self.assertIn("unreadable", reason)


if __name__ == "__main__":
    unittest.main()
