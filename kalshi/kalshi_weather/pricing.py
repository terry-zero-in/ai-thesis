"""Distributional pricing: corrected ensemble members -> P(bucket).

Strike semantics (verified live against KXHIGHNY-26AUG17, 2026-08-17):
    less    cap=C            YES iff high <  C   (i.e. <= C-1)
    between floor=F cap=C    YES iff F <= high <= C
    greater floor=F          YES iff high >  F   (i.e. >= F+1)
Settlement is a whole-degree-F integer, so on the continuous forecast scale
buckets are half-integer intervals; adjacent Kalshi buckets share bounds, so
a full ladder partitions probability exactly to 1 (tested).

P(bucket) = mean over debiased members m of the Gaussian-kernel mass
Phi((hi-m)/bw) - Phi((lo-m)/bw). The kernel bandwidth carries the residual
uncertainty not explained by ensemble spread (see bias.py).

Confidence = cross-model agreement: |P_GEFS - P_ECMWF|. Two independent
modeling systems agreeing is the scope's definition of confidence.
"""
import math


def norm_cdf(x: float) -> float:
    return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def bucket_bounds(strike_type: str, floor_strike, cap_strike) -> tuple:
    if strike_type == "less":
        return (float("-inf"), cap_strike - 0.5)
    if strike_type == "between":
        return (floor_strike - 0.5, cap_strike + 0.5)
    if strike_type == "greater":
        return (floor_strike + 0.5, float("inf"))
    raise ValueError(f"unknown strike_type {strike_type!r}")


def prob_bucket(members: list, bw: float, strike_type: str, floor_strike, cap_strike) -> float:
    lo, hi = bucket_bounds(strike_type, floor_strike, cap_strike)
    bw = max(bw, 1e-9)
    total = 0.0
    for m in members:
        upper = 1.0 if hi == float("inf") else norm_cdf((hi - m) / bw)
        lower = 0.0 if lo == float("-inf") else norm_cdf((lo - m) / bw)
        total += upper - lower
    return total / len(members)


def daily_max_from_hourly(times: list, temps: list, date_str: str, min_hours: int = 18):
    """Max temp over hours whose local timestamp starts with date_str.

    Returns None when fewer than min_hours non-null hours exist for that
    calendar day (partial model runs must not masquerade as a daily max).
    Note: the market settles on the NWS climate-day high; local-midnight
    bucketing here is an approximation the bias fit absorbs.
    """
    vals = [v for t, v in zip(times, temps) if t.startswith(date_str) and v is not None]
    if len(vals) < min_hours:
        return None
    return max(vals)


def model_agreement(p_by_model: dict) -> float:
    """Max pairwise gap between per-model probabilities (0 = full agreement)."""
    ps = list(p_by_model.values())
    if len(ps) < 2:
        return 0.0
    return max(abs(a - b) for i, a in enumerate(ps) for b in ps[i + 1:])
