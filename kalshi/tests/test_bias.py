"""Bias-correction tests: per (station, lead) affine mean debias + spread-aware bandwidth."""
import os
import sqlite3
import tempfile
import unittest

from kalshi_weather import bias, ledger
from kalshi_weather.config import Config


class Fit(unittest.TestCase):
    def test_recovers_known_bias(self):
        # forecasts systematically read 2F high vs actuals -> bias = median(actual - fcst) = -2
        pairs = [(80.0 + i, 1.0, 78.0 + i) for i in range(10)]
        entry = bias.fit_pairs(pairs)
        self.assertAlmostEqual(entry["bias"], -2.0)
        self.assertEqual(entry["n"], 10)

    def test_resid_std_after_debias(self):
        # residuals after bias removal alternate +1/-1 -> stdev ~ 1.026 (sample)
        pairs = []
        for i in range(10):
            actual = 80.0 + (1.0 if i % 2 == 0 else -1.0)
            pairs.append((80.0, 1.5, actual))
        entry = bias.fit_pairs(pairs)
        self.assertAlmostEqual(entry["bias"], 0.0, places=6)
        self.assertGreater(entry["resid_std"], 0.9)
        self.assertLess(entry["resid_std"], 1.2)


class Model(unittest.TestCase):
    def setUp(self):
        self.cfg = Config()

    def test_uncalibrated_defaults(self):
        m = bias.BiasModel({})
        self.assertEqual(m.bias_for("KXHIGHNY", 1), 0.0)
        bw0 = m.bandwidth_for("KXHIGHNY", 0, self.cfg)
        bw2 = m.bandwidth_for("KXHIGHNY", 2, self.cfg)
        self.assertAlmostEqual(bw0, self.cfg.uncal_bw_base)
        self.assertAlmostEqual(bw2, self.cfg.uncal_bw_base + 2 * self.cfg.bw_lead_growth)

    def test_calibrated_bandwidth_spread_adjusted(self):
        # resid_std=3, mean member spread=2 -> bw = sqrt(9-4) = sqrt(5)
        m = bias.BiasModel({"KXHIGHNY|0": {"bias": -1.5, "resid_std": 3.0,
                                           "ens_spread": 2.0, "n": 20}})
        self.assertAlmostEqual(m.bias_for("KXHIGHNY", 0), -1.5)
        self.assertAlmostEqual(m.bandwidth_for("KXHIGHNY", 0, self.cfg), 5 ** 0.5)

    def test_bandwidth_floor(self):
        # overdispersed ensemble: resid < spread -> floor at min_bw
        m = bias.BiasModel({"KXHIGHNY|0": {"bias": 0.0, "resid_std": 1.0,
                                           "ens_spread": 3.0, "n": 20}})
        self.assertAlmostEqual(m.bandwidth_for("KXHIGHNY", 0, self.cfg), self.cfg.min_bw)

    def test_insufficient_n_falls_back(self):
        m = bias.BiasModel({"KXHIGHNY|0": {"bias": 5.0, "resid_std": 3.0,
                                           "ens_spread": 1.0, "n": 3}})
        self.assertEqual(m.bias_for("KXHIGHNY", 0), 0.0)
        self.assertAlmostEqual(m.bandwidth_for("KXHIGHNY", 0, self.cfg), self.cfg.uncal_bw_base)

    def test_apply_adds_bias(self):
        m = bias.BiasModel({"KXHIGHNY|0": {"bias": -2.0, "resid_std": 3.0,
                                           "ens_spread": 1.0, "n": 20}})
        self.assertEqual(m.apply([80.0, 82.0], "KXHIGHNY", 0), [78.0, 80.0])

    def test_persist_round_trip(self):
        m = bias.BiasModel({"KXHIGHNY|1": {"bias": 0.7, "resid_std": 2.0,
                                           "ens_spread": 1.0, "n": 12}})
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "bias.json")
            m.save(path)
            m2 = bias.BiasModel.load(path)
            self.assertAlmostEqual(m2.bias_for("KXHIGHNY", 1), 0.7)

    def test_load_missing_file_is_empty(self):
        m = bias.BiasModel.load("/nonexistent/bias.json")
        self.assertEqual(m.bias_for("KXHIGHNY", 0), 0.0)


class RefitDedupe(unittest.TestCase):
    def test_intraday_reruns_count_as_one_pair(self):
        """Regression (ship-gate 2026-08-17): hourly forecast reruns of the
        same (station, date, lead) must not fake calibration depth."""
        conn = sqlite3.connect(":memory:")
        ledger.init(conn)
        # 7 intraday reruns of ONE day
        for h in range(7):
            ledger.insert_forecast(conn, ts=f"2026-08-10T{h:02d}:00:00Z",
                                   station="KXHIGHNY", target_date="2026-08-10",
                                   lead=0, model="all", ens_mean=80.0 + h * 0.1,
                                   ens_spread=1.5, n_members=82, bias=0.0, bw=3.0)
        ledger.upsert_settlement(conn, "KXHIGHNY", "2026-08-10", 82, "NWS_CLI_via_IEM", "t")
        with tempfile.TemporaryDirectory() as d:
            out = bias.refit_from_ledger(conn, os.path.join(d, "bias.json"), Config())
        self.assertEqual(out["pairs"], 1)
        self.assertEqual(out["groups"], 1)

    def test_first_forecast_of_day_is_the_pair(self):
        conn = sqlite3.connect(":memory:")
        ledger.init(conn)
        ledger.insert_forecast(conn, ts="2026-08-10T06:00:00Z", station="KXHIGHNY",
                               target_date="2026-08-10", lead=0, model="all",
                               ens_mean=80.0, ens_spread=1.5, n_members=82,
                               bias=0.0, bw=3.0)
        ledger.insert_forecast(conn, ts="2026-08-10T11:00:00Z", station="KXHIGHNY",
                               target_date="2026-08-10", lead=0, model="all",
                               ens_mean=84.0, ens_spread=1.0, n_members=82,
                               bias=0.0, bw=3.0)
        ledger.upsert_settlement(conn, "KXHIGHNY", "2026-08-10", 82, "NWS_CLI_via_IEM", "t")
        with tempfile.TemporaryDirectory() as d:
            path = os.path.join(d, "bias.json")
            bias.refit_from_ledger(conn, path, Config())
            m = bias.BiasModel.load(path)
        # pair uses the 06:00 mean (80): bias = 82 - 80 = +2
        self.assertAlmostEqual(m.entries["KXHIGHNY|0"]["bias"], 2.0)


if __name__ == "__main__":
    unittest.main()
