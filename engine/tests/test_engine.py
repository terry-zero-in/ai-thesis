# engine/tests/test_engine.py
import numpy as np
import pandas as pd
import pytest
from hp1_engine import simulate, factors, weights, RF


def make_px(jump_ticker="JMP", jump_day_idx=200, n=260, n_names=12, seed=3):
    """Synthetic universe: gentle risers so all pass the 100d MA gate and
    have >130 obs; one name jumps +25% on a known day."""
    idx = pd.bdate_range("2024-01-01", periods=n)
    rng = np.random.default_rng(seed)
    data = {}
    for i in range(n_names):
        drift = 0.0006 + 0.0002 * i
        r = rng.normal(drift, 0.01, n)
        data[f"T{i:02d}"] = 100 * np.cumprod(1 + r)
    jump = np.full(n, 0.0008)
    jump[jump_day_idx] = 0.25
    data[jump_ticker] = 100 * np.cumprod(1 + jump)
    px = pd.DataFrame(data, index=idx)
    return px


def test_no_same_day_execution():
    px = make_px()
    rets = px.pct_change()
    days = rets.loc["2024-08-01":"2024-12-31"].index
    first_rebal = days[0]
    eq, _ = simulate(px, rets, "2024-08-01", "2024-12-31", "tac", 10, gate=False)
    day1_ret = eq.iloc[1] / eq.iloc[0] - 1 if len(eq) > 1 else None
    # Day of first rebalance: portfolio must earn ONLY cash (weights pend until next day).
    # eq index: eq.iloc[0] is end of first_rebal day.
    cash_day = RF / 252
    turn_cost = 0.0015 * 1.0  # full buy of 100% gross costs 15bps... charged on execution day
    # value at end of first day = (1 + cash) — no asset returns, no cost yet (trade executes next day)
    assert abs(eq.iloc[0] - (1 + cash_day)) < 1e-9, (
        f"first-day value {eq.iloc[0]:.6f} shows same-day execution; expected pure cash day")


def test_dd_dev_short_history_no_synthetic_edge():
    """A name with <20 negative days must fall back to total vol, not floor
    at 1e-4 (which guaranteed top-decile RAM and max pre-cap weight)."""
    idx = pd.bdate_range("2024-01-01", periods=150)
    rng = np.random.default_rng(11)
    smooth = pd.Series(100 * np.cumprod(1 + np.abs(rng.normal(0.002, 0.004, 150))), idx)  # ~no down days
    normal = pd.Series(100 * np.cumprod(1 + rng.normal(0.001, 0.02, 150)), idx)
    other = pd.Series(100 * np.cumprod(1 + rng.normal(0.001, 0.015, 150)), idx)
    px = pd.DataFrame({"SMOOTH": smooth, "NORM": normal, "OTH": other})
    f = factors(px, idx[-1])
    assert f.loc["SMOOTH", "dd_dev"] > 1e-3, "dd_dev floored at 1e-4 -> synthetic RAM edge"


def test_weight_cap_invariant():
    idx = pd.bdate_range("2024-01-01", periods=200)
    rng = np.random.default_rng(5)
    px = pd.DataFrame({f"T{i}": 100 * np.cumprod(1 + rng.normal(0.001, 0.005 + 0.004*i, 200))
                       for i in range(10)}, index=idx)
    f = factors(px, idx[-1])
    w = weights(list(f.index), f)
    assert abs(w.sum() - 1) < 1e-9
    assert w.max() <= 0.15 + 1e-6, f"cap breached: {w.max():.4f}"


def test_weight_cap_infeasible_small_book():
    """With <7 names the 15% cap is infeasible (n*0.15 < 1); weights must fall
    back to equal weight (the min-max projection), never the redistribution
    loop's degenerate >>cap output (up to 0.70 for a 3-name book)."""
    idx = pd.bdate_range("2024-01-01", periods=160)
    sel = ["A", "B", "C", "D", "E", "F"]  # 6 names -> cap infeasible
    rng = np.random.default_rng(2)
    data = {}
    for i, t in enumerate(sel):
        vol = 0.004 if i == 0 else 0.03  # A very low vol -> would dominate inverse-vol
        data[t] = 100 * np.cumprod(1 + rng.normal(0.001, vol, 160))
    px = pd.DataFrame(data, index=idx)
    f = factors(px, idx[-1])
    w = weights(list(f.index), f)
    assert abs(w.sum() - 1) < 1e-9
    assert w.max() <= 1.0 / len(sel) + 1e-6, f"infeasible-cap book not equal-weighted: max={w.max():.4f}"
