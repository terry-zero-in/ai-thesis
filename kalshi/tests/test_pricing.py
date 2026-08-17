"""Pricing tests: bucket probabilities from ensemble members.

Strike semantics verified live 2026-08-17 on KXHIGHNY-26AUG17:
  less    cap=84            -> YES iff high <= 83   -> (-inf, 83.5)
  between floor=84 cap=85   -> YES iff 84<=high<=85 -> (83.5, 85.5)
  greater floor=91          -> YES iff high >= 92   -> (91.5, +inf)
Settlement is integer deg-F, so continuous bounds sit at half-integers.
"""
import random
import unittest

from kalshi_weather import pricing


class BucketBounds(unittest.TestCase):
    def test_less(self):
        self.assertEqual(pricing.bucket_bounds("less", None, 84), (float("-inf"), 83.5))

    def test_between(self):
        self.assertEqual(pricing.bucket_bounds("between", 84, 85), (83.5, 85.5))

    def test_greater(self):
        self.assertEqual(pricing.bucket_bounds("greater", 91, None), (91.5, float("inf")))


class ProbBucket(unittest.TestCase):
    def test_member_on_boundary_is_half(self):
        p = pricing.prob_bucket([83.5], 2.0, "less", None, 84)
        self.assertAlmostEqual(p, 0.5, places=6)

    def test_tiny_bandwidth_approaches_indicator(self):
        self.assertAlmostEqual(pricing.prob_bucket([80.0], 0.01, "less", None, 84), 1.0, places=6)
        self.assertAlmostEqual(pricing.prob_bucket([90.0], 0.01, "less", None, 84), 0.0, places=6)
        self.assertAlmostEqual(pricing.prob_bucket([84.7], 0.01, "between", 84, 85), 1.0, places=6)

    def test_full_ladder_partitions_to_one(self):
        # Real KXHIGHNY ladder shape: <=83, 84-85, 86-87, 88-89, 90-91, >=92
        ladder = [("less", None, 84), ("between", 84, 85), ("between", 86, 87),
                  ("between", 88, 89), ("between", 90, 91), ("greater", 91, None)]
        rng = random.Random(7)
        members = [rng.uniform(78, 96) for _ in range(82)]
        for bw in (0.5, 1.5, 3.0):
            total = sum(pricing.prob_bucket(members, bw, st, fl, cp) for st, fl, cp in ladder)
            self.assertAlmostEqual(total, 1.0, places=9, msg=f"bw={bw}")

    def test_mean_over_members(self):
        # two members, one certain-in one certain-out -> 0.5
        p = pricing.prob_bucket([70.0, 95.0], 0.01, "less", None, 84)
        self.assertAlmostEqual(p, 0.5, places=6)


class DailyMax(unittest.TestCase):
    def _series(self):
        times, temps = [], []
        for d, base in (("2026-08-16", 70.0), ("2026-08-17", 75.0)):
            for h in range(24):
                times.append(f"{d}T{h:02d}:00")
                temps.append(base + h * 0.5)  # max = base + 11.5
        return times, temps

    def test_max_for_date(self):
        times, temps = self._series()
        self.assertEqual(pricing.daily_max_from_hourly(times, temps, "2026-08-17"), 86.5)

    def test_ignores_other_dates(self):
        times, temps = self._series()
        self.assertEqual(pricing.daily_max_from_hourly(times, temps, "2026-08-16"), 81.5)

    def test_none_when_too_many_nulls(self):
        times, temps = self._series()
        temps = [None if t is not None and times[i].startswith("2026-08-17") and i % 2 == 0 else temps[i]
                 for i, t in enumerate(temps)]
        # 12 non-null hours < 18 threshold
        self.assertIsNone(pricing.daily_max_from_hourly(times, temps, "2026-08-17"))

    def test_missing_date_is_none(self):
        times, temps = self._series()
        self.assertIsNone(pricing.daily_max_from_hourly(times, temps, "2026-08-20"))


class Agreement(unittest.TestCase):
    def test_agreement_is_max_pairwise_gap(self):
        self.assertAlmostEqual(pricing.model_agreement({"gefs": 0.30, "ecmwf": 0.42}), 0.12)

    def test_single_model_agreement_zero(self):
        self.assertEqual(pricing.model_agreement({"gefs": 0.30}), 0.0)


if __name__ == "__main__":
    unittest.main()
