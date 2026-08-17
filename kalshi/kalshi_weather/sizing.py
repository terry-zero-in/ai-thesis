"""Position sizing: quarter-Kelly with a hard per-market dollar cap (PINNED).

Kelly for a binary contract: stake fraction beta of bankroll at cost c per
contract (price + expected fee, as a fraction of the $1 payout) with win
probability q maximizes E[log W] at

    f* = (q - c) / (1 - c)

(derived from d/db [ q log(1 + b(1-c)/c) + (1-q) log(1-b) ] = 0; verified
against a brute-force grid search in tests/test_sizing.py).
"""
import math


def kelly_fraction(prob_win: float, cost_per_contract_cents: float) -> float:
    c = cost_per_contract_cents / 100.0
    if c <= 0.0 or c >= 1.0:
        return 0.0
    f = (prob_win - c) / (1.0 - c)
    return max(f, 0.0)


def contracts_for(prob: float, price_cents: int, fee_per_contract_cents: float,
                  bankroll_cents: int, cap_cents: int, kelly_mult: float = 0.25) -> int:
    cost = price_cents + fee_per_contract_cents
    if cost <= 0:
        return 0
    f = kelly_fraction(prob, cost)
    if f <= 0.0:
        return 0
    stake = min(kelly_mult * f * bankroll_cents, cap_cents)
    return int(math.floor(stake / cost))
