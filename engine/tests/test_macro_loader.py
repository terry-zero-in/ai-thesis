# engine/tests/test_macro_loader.py
"""Macro-loader parser + assembly tests. Pure — no network, no DB."""
from datetime import date

import pandas as pd
import pytest

from hp1_macro_loader import (
    parse_fear_greed,
    aaii_from_frame,
    parse_naaim,
    assemble_row,
)


def test_parse_fear_greed():
    assert parse_fear_greed({"fear_and_greed": {"score": 32.7, "rating": "fear"}}) == pytest.approx(32.7)


def test_aaii_from_frame_3wk_spread():
    """Latest week's bull/bear (%) + the 3-week average bull-bear (pp). Mirrors the
    live .xls shape (fractions); the last 3 weeks here average to -8.0pp."""
    df = pd.DataFrame({
        "Date": ["2026-05-28", "2026-06-04", "2026-06-11"],
        "Bullish": [0.3556, 0.3626, 0.3037],
        "Neutral": [0.2259, 0.2674, 0.2196],
        "Bearish": [0.4185, 0.3700, 0.4766],
    })
    out = aaii_from_frame(df)
    assert out["as_of"] == date(2026, 6, 11)
    assert out["bullish"] == pytest.approx(30.37, abs=0.01)
    assert out["bearish"] == pytest.approx(47.66, abs=0.01)
    # ((.3556-.4185)+(.3626-.37)+(.3037-.4766))/3 * 100 ≈ -8.1
    assert out["spread"] == pytest.approx(-8.1, abs=0.2)


def test_aaii_picks_latest_unordered():
    df = pd.DataFrame({  # out of order; latest is 2026-06-11
        "Date": ["2026-06-11", "2026-05-28", "2026-06-04"],
        "Bullish": [0.30, 0.40, 0.35],
        "Neutral": [0.20, 0.25, 0.25],
        "Bearish": [0.50, 0.35, 0.40],
    })
    assert aaii_from_frame(df)["as_of"] == date(2026, 6, 11)


def test_parse_naaim_picks_latest():
    html = ("noise 04/29/2026 foo 93.79 bar "
            "05/06/2026 96.67 "
            "06/10/2026</td><td>79.27</td> tail")
    out = parse_naaim(html)
    assert out["as_of"] == date(2026, 6, 10)
    assert out["exposure"] == pytest.approx(79.27)


def test_assemble_all_live():
    row = assemble_row(
        date(2026, 6, 17),
        fng={"as_of": date(2026, 6, 17), "score": 32.7},
        aaii={"as_of": date(2026, 6, 11), "bullish": 30.4, "bearish": 47.7, "spread": -8.1},
        naaim={"as_of": date(2026, 6, 10), "exposure": 79.27},
        last_good=None,
    )
    assert row["as_of"] == date(2026, 6, 17)
    assert row["fear_greed"] == 33          # int column, rounded
    assert row["aaii_spread"] == -8.1
    assert row["naaim"] == 79.27
    assert "STALE" not in row["source"] and "MISSING" not in row["source"]


def test_assemble_carries_last_good_on_failure():
    last_good = {"as_of": date(2026, 6, 16), "naaim": 80.0, "aaii_bullish": 31.0,
                 "aaii_bearish": 46.0, "aaii_spread": -7.0, "fear_greed": 35}
    row = assemble_row(
        date(2026, 6, 17),
        fng={"as_of": date(2026, 6, 17), "score": 30.0},  # only F&G live
        aaii=None, naaim=None, last_good=last_good,
    )
    assert row["fear_greed"] == 30                  # live
    assert row["aaii_spread"] == -7.0               # carried
    assert row["naaim"] == 80.0                     # carried
    assert "aaii=STALE" in row["source"]
    assert "naaim=STALE" in row["source"]
    assert "fng=30.0" in row["source"]


def test_assemble_missing_when_no_history():
    row = assemble_row(date(2026, 6, 17), fng=None, aaii=None, naaim=None, last_good=None)
    assert row["fear_greed"] is None and row["naaim"] is None and row["aaii_spread"] is None
    assert row["source"] == "fng=MISSING; aaii=MISSING; naaim=MISSING"
