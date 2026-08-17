"""Quarter-Kelly sizing tests.

Kelly for a binary contract costing c (price+fee, as fraction of $1 payout)
with win prob q: f* = (q - c) / (1 - c). Proven here against a brute-force
E[log wealth] maximization rather than trusted from the closed form.
"""
import math
import unittest

from kalshi_weather import sizing


def brute_force_kelly(q: float, c: float) -> float:
    """Grid-search argmax of E[log W] for stake fraction beta."""
    best_b, best_v = 0.0, -1e18
    r = (1 - c) / c
    b = 0.0
    while b < 0.999:
        v = q * math.log(1 + b * r) + (1 - q) * math.log(1 - b)
        if v > best_v:
            best_v, best_b = v, b
        b += 0.0005
    return best_b


class KellyFraction(unittest.TestCase):
    def test_matches_log_wealth_maximum(self):
        for q, c in [(0.30, 0.20), (0.70, 0.50), (0.10, 0.05), (0.90, 0.80)]:
            closed = sizing.kelly_fraction(q, c * 100)
            brute = brute_force_kelly(q, c)
            self.assertAlmostEqual(closed, brute, delta=0.002, msg=f"q={q} c={c}")

    def test_zero_when_no_edge(self):
        self.assertEqual(sizing.kelly_fraction(0.20, 20.0), 0.0)
        self.assertEqual(sizing.kelly_fraction(0.10, 20.0), 0.0)

    def test_zero_when_cost_degenerate(self):
        self.assertEqual(sizing.kelly_fraction(0.5, 100.0), 0.0)
        self.assertEqual(sizing.kelly_fraction(0.5, 0.0), sizing.kelly_fraction(0.5, 0.0))


class Contracts(unittest.TestCase):
    def test_worked_example(self):
        # q=0.5, price 20c, fee 0.5c -> c=0.205, kelly=(0.5-0.205)/0.795=0.371069
        # quarter = 0.0927673; bankroll $1000 -> stake $92.77 -> 9277c/20.5c = 452 contracts
        # but capped at $100 -> 10000c/20.5 = 487 -> cap binds: min(9277,10000)=9277 -> 452
        n = sizing.contracts_for(prob=0.5, price_cents=20, fee_per_contract_cents=0.5,
                                 bankroll_cents=100_000, cap_cents=10_000)
        self.assertEqual(n, 452)

    def test_cap_binds(self):
        # huge bankroll: stake would exceed cap -> cap/cost floor
        n = sizing.contracts_for(prob=0.9, price_cents=20, fee_per_contract_cents=0.5,
                                 bankroll_cents=10_000_000, cap_cents=10_000)
        self.assertEqual(n, int(10_000 / 20.5))

    def test_zero_when_no_edge(self):
        n = sizing.contracts_for(prob=0.19, price_cents=20, fee_per_contract_cents=0.5,
                                 bankroll_cents=100_000, cap_cents=10_000)
        self.assertEqual(n, 0)

    def test_never_negative(self):
        n = sizing.contracts_for(prob=0.01, price_cents=90, fee_per_contract_cents=1.0,
                                 bankroll_cents=100_000, cap_cents=10_000)
        self.assertEqual(n, 0)


if __name__ == "__main__":
    unittest.main()
