"""Kalshi fee model.

Provenance:
- Taker formula 0.07 x C x P x (1-P) dollars: PINNED by Terry (2026-08-17
  scope). Series metadata cross-checked live 2026-08-17: KXHIGHNY reports
  fee_type="quadratic", fee_multiplier=1, consistent with the formula.
- Maker fee ~25% of taker: PINNED by Terry. NOT verified against the live
  fee schedule (kalshi.com fee PDF returned HTTP 429 during the build);
  override with KALSHI_MAKER_FRACTION if the published rate differs.
- Rounding: fees round UP to the next cent per order (Kalshi convention).

Every edge calculation in this package must go through this module — the
scope requires fees modeled into every edge calc.
"""
import math
import os

TAKER_RATE = 0.07
MAKER_FRACTION = float(os.environ.get("KALSHI_MAKER_FRACTION", "0.25"))


def _fee_cents(price_cents: int, contracts: float, rate: float, multiplier: float) -> int:
    p = price_cents / 100.0
    dollars = rate * multiplier * contracts * p * (1.0 - p)
    # round(x, 9) guards float dust before the ceil (e.g. 175.00000000001)
    return math.ceil(round(dollars * 100.0, 9))


def taker_fee_cents(price_cents: int, contracts: float, multiplier: float = 1.0) -> int:
    return _fee_cents(price_cents, contracts, TAKER_RATE, multiplier)


def maker_fee_cents(price_cents: int, contracts: float, multiplier: float = 1.0) -> int:
    return _fee_cents(price_cents, contracts, TAKER_RATE * MAKER_FRACTION, multiplier)


def maker_fee_per_contract_cents(price_cents: int, multiplier: float = 1.0) -> float:
    """Unrounded expected maker fee per contract, in cents (for edge math)."""
    p = price_cents / 100.0
    return TAKER_RATE * MAKER_FRACTION * multiplier * p * (1.0 - p) * 100.0
