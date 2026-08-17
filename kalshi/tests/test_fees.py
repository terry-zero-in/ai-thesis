"""Fee model tests.

Fee spec (Terry, 2026-08-17 scope): taker = 0.07 x C x P x (1-P) dollars,
maker ~= 25% of taker. Series metadata verified live 2026-08-17:
fee_type="quadratic", fee_multiplier=1 on KXHIGHNY. Rounding: up to the
next cent per order (Kalshi convention).
"""
import unittest

from kalshi_weather import fees


class TakerFee(unittest.TestCase):
    def test_worked_example_midprice(self):
        # 100 contracts at 50c: 0.07 * 100 * 0.5 * 0.5 = $1.75 -> 175c
        self.assertEqual(fees.taker_fee_cents(50, 100), 175)

    def test_worked_example_tail(self):
        # 100 contracts at 5c: 0.07 * 100 * 0.05 * 0.95 = $0.3325 -> ceil 34c
        self.assertEqual(fees.taker_fee_cents(5, 100), 34)

    def test_tail_cheaper_than_mid(self):
        self.assertLess(fees.taker_fee_cents(10, 50), fees.taker_fee_cents(50, 50))

    def test_rounds_up(self):
        # 1 contract at 50c: 0.07 * 0.25 = $0.0175 -> 2c (never rounds down)
        self.assertEqual(fees.taker_fee_cents(50, 1), 2)

    def test_zero_contracts(self):
        self.assertEqual(fees.taker_fee_cents(50, 0), 0)

    def test_extreme_prices_zero_fee(self):
        self.assertEqual(fees.taker_fee_cents(0, 100), 0)
        self.assertEqual(fees.taker_fee_cents(100, 100), 0)

    def test_multiplier_scales(self):
        self.assertEqual(fees.taker_fee_cents(50, 100, multiplier=2.0), 350)


class MakerFee(unittest.TestCase):
    def test_quarter_of_taker_pre_rounding(self):
        # 100 contracts at 50c: 0.0175 * 100 * 0.25 = $0.4375 -> ceil 44c
        self.assertEqual(fees.maker_fee_cents(50, 100), 44)

    def test_maker_leq_taker(self):
        for p in (5, 20, 50, 80, 95):
            self.assertLessEqual(fees.maker_fee_cents(p, 100), fees.taker_fee_cents(p, 100))

    def test_per_contract_unrounded(self):
        # per-contract expected maker fee at 50c = 0.0175 * 0.25 dollars = 0.4375c
        self.assertAlmostEqual(fees.maker_fee_per_contract_cents(50), 0.4375)
        # at 10c: 0.0175 * 0.1 * 0.9 * 100 = 0.1575c
        self.assertAlmostEqual(fees.maker_fee_per_contract_cents(10), 0.1575)


if __name__ == "__main__":
    unittest.main()
