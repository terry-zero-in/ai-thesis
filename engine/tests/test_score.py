# engine/tests/test_score.py
"""Production-scoring tests for hp1_score.compute_engine_output.

Synthetic prices + a synthetic universe (no network). Verifies the run/ranks
shapes match the live hp1 schema, the view/sleeve grain, the denormalization
invariant, the breadth gate, and the percentage scaling.
"""
import numpy as np
import pandas as pd
import pytest

from hp1_score import (ENGINE_VERSION, VIEWS, compute_engine_output,
                       gate_gross, regime_read)

RUN_FIELDS = {"as_of", "breadth_pct", "gate_gross", "regime_read",
              "universe_n", "data_through", "engine_version"}
RANK_FIELDS = {"ticker", "layer", "view", "sleeve", "score", "pct", "z_m",
               "z_ram", "z_dd", "driver_tag", "above_100", "above_200",
               "dist_100_pct", "dist_200_pct", "dd_from_high",
               "sleeve_eligible", "r3", "r6", "r12"}
DRIVER_TAGS = {"return-driven", "stability-driven", "balanced", "broken-trend"}


def _universe():
    """6 pure_play + 4 megacap investables, 1 benchmark, 1 macro."""
    rows = [
        ("PP1", "L1", "pure_play", "investable"),
        ("PP2", "L1", "pure_play", "investable"),
        ("PP3", "L3a", "pure_play", "investable"),
        ("PP4", "L3b", "pure_play", "investable"),
        ("PP5", "L4", "pure_play", "investable"),
        ("PP6", "L4", "pure_play", "investable"),
        ("MC1", "L2", "megacap", "investable"),
        ("MC2", "L2", "megacap", "investable"),
        ("MC3", "L5", "megacap", "investable"),
        ("MC4", "L5", "megacap", "investable"),
        ("SPY", None, None, "benchmark"),
        ("^VIX", None, None, "macro"),
    ]
    return pd.DataFrame(rows, columns=["ticker", "layer", "category", "kind"])


def _prices(trend=0.0008, n=320, seed=7):
    """All names get >130 obs and a mild positive drift so trend gates pass."""
    idx = pd.bdate_range("2024-01-01", periods=n)
    rng = np.random.default_rng(seed)
    uni = _universe()
    data = {}
    for i, tk in enumerate(uni["ticker"]):
        r = rng.normal(trend + 0.00005 * i, 0.012, n)
        data[tk] = 100 * np.cumprod(1 + r)
    return pd.DataFrame(data, index=idx)


def test_run_and_rank_field_shapes():
    run, ranks = compute_engine_output(_prices(), _universe())
    assert set(run) == RUN_FIELDS
    assert run["engine_version"] == ENGINE_VERSION
    assert ranks
    for r in ranks:
        assert set(r) == RANK_FIELDS, set(r) ^ RANK_FIELDS


def test_views_and_membership():
    run, ranks = compute_engine_output(_prices(), _universe())
    df = pd.DataFrame(ranks)
    assert set(df["view"].unique()) <= set(VIEWS)
    # Benchmarks/macro never get scored.
    assert "SPY" not in set(df["ticker"]) and "^VIX" not in set(df["ticker"])
    # Combined = all 10 investables; pure_play = 6; megacap = 4.
    per_view = df[df["sleeve"] == "tactical"].groupby("view")["ticker"].nunique()
    assert per_view["combined"] == 10
    assert per_view["pure_play"] == 6
    assert per_view["megacap"] == 4
    # A pure_play name appears in combined+pure_play only; megacap name in combined+megacap.
    assert set(df[df.ticker == "PP1"]["view"].unique()) == {"combined", "pure_play"}
    assert set(df[df.ticker == "MC1"]["view"].unique()) == {"combined", "megacap"}


def test_two_sleeves_per_name_view_and_denormalized_facts():
    run, ranks = compute_engine_output(_prices(), _universe())
    df = pd.DataFrame(ranks)
    grp = df.groupby(["ticker", "view"])
    # Exactly two sleeve rows per (ticker, view).
    assert (grp["sleeve"].nunique() == 2).all()
    # Per-name/per-view facts identical across the two sleeve rows.
    shared = ["z_m", "z_ram", "z_dd", "driver_tag", "above_100", "above_200",
              "dist_100_pct", "dist_200_pct", "dd_from_high", "r3", "r6", "r12", "layer"]
    for _, g in grp:
        for col in shared:
            assert g[col].nunique(dropna=False) == 1, col


def test_sleeve_eligibility_and_driver_tags():
    run, ranks = compute_engine_output(_prices(), _universe())
    for r in ranks:
        assert r["driver_tag"] in DRIVER_TAGS
        if r["sleeve"] == "tactical":
            assert r["sleeve_eligible"] == r["above_100"]
        else:
            assert r["sleeve_eligible"] == r["above_200"]


def test_breadth_gate_full_when_all_uptrend():
    run, _ = compute_engine_output(_prices(trend=0.0015), _universe())
    assert run["breadth_pct"] == 100.0
    assert run["gate_gross"] == 1.0
    assert run["universe_n"] == 10
    assert run["regime_read"].startswith("Risk-on")
    assert len(run["regime_read"]) <= 120


def test_breadth_gate_quarter_when_all_downtrend():
    # Steady decliners: every name below its 100d MA -> breadth 0 -> gross 0.25.
    idx = pd.bdate_range("2024-01-01", periods=320)
    uni = _universe()
    data = {tk: np.linspace(200, 90, 320) for tk in uni["ticker"]}
    px = pd.DataFrame(data, index=idx)
    run, ranks = compute_engine_output(px, uni)
    assert run["breadth_pct"] == 0.0
    assert run["gate_gross"] == 0.25
    # Below-trend names are broken-trend and tactically ineligible.
    df = pd.DataFrame(ranks)
    tac = df[df.sleeve == "tactical"]
    assert (~tac["sleeve_eligible"]).all()
    assert (df["driver_tag"] == "broken-trend").all()


def test_gate_gross_thresholds():
    assert gate_gross(41) == 1.0
    assert gate_gross(40) == 1.0
    assert gate_gross(39.9) == 0.5
    assert gate_gross(25) == 0.5
    assert gate_gross(24.9) == 0.25
    assert gate_gross(0) == 0.25


def test_percentages_are_0_100_scaled_not_fractions():
    run, ranks = compute_engine_output(_prices(trend=0.0015), _universe())
    # Mild uptrend over ~15 months: r12 should be a double-digit percent, not ~0.x.
    r12s = [r["r12"] for r in ranks if r["r12"] is not None]
    assert max(abs(v) for v in r12s) > 1.5, "r12 looks like a fraction, expected percent"


def test_short_history_names_excluded():
    uni = _universe()
    px = _prices()
    # Truncate one name to <130 obs by NaNing its early history.
    px = px.copy()
    px.loc[px.index[:250], "PP2"] = np.nan
    run, ranks = compute_engine_output(px, uni)
    assert "PP2" not in {r["ticker"] for r in ranks}
    assert run["universe_n"] == 9


def test_pct_is_percentile_within_view():
    run, ranks = compute_engine_output(_prices(), _universe())
    df = pd.DataFrame(ranks)
    combined_tac = df[(df.view == "combined") & (df.sleeve == "tactical")]
    pcts = combined_tac["pct"].dropna()
    assert pcts.min() >= 0 and pcts.max() <= 100
    # The top-scoring name should have the top percentile.
    top = combined_tac.sort_values("score", ascending=False).iloc[0]
    assert top["pct"] == combined_tac["pct"].max()
