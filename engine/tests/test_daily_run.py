# engine/tests/test_daily_run.py
"""Engine-run shaping tests: pure compute_run() on synthetic prices + the
gate/regime/tag helpers. No DB, no network."""
import numpy as np
import pandas as pd
import pytest

from hp1_daily_run import compute_run, gate_gross, regime_read, driver_tag

VALID_VIEWS = {"combined", "pure_play", "megacap"}
VALID_SLEEVES = {"tactical", "core"}
VALID_TAGS = {"return-driven", "stability-driven", "balanced", "broken-trend"}


def make_universe():
    """5 pure_play + 3 megacap investables, plus a benchmark (must be excluded)."""
    return pd.DataFrame(
        [
            ("P0", "p0", "L1", "pure_play", "investable"),
            ("P1", "p1", "L3a", "pure_play", "investable"),
            ("P2", "p2", "L4", "pure_play", "investable"),
            ("P3", "p3", "L1", "pure_play", "investable"),
            ("P4", "p4", "L3b", "pure_play", "investable"),
            ("M0", "m0", "L2", "megacap", "investable"),
            ("M1", "m1", "L5", "megacap", "investable"),
            ("M2", "m2", "L2", "megacap", "investable"),
            ("SPY", "spy", None, None, "benchmark"),
        ],
        columns=["ticker", "name", "layer", "category", "kind"],
    )


def make_prices(n=300, seed=7):
    """≥253 trading days so r12 is finite. P0/M0 clean risers, P4/M2 clean
    decliners (below MA → broken trend); the rest gentle positive drift."""
    idx = pd.bdate_range("2023-01-02", periods=n)
    rng = np.random.default_rng(seed)

    def drift(mu, vol):
        return 100 * np.cumprod(1 + rng.normal(mu, vol, n))

    data = {
        "P0": np.linspace(100, 320, n),
        "P1": drift(0.0010, 0.012),
        "P2": drift(0.0007, 0.013),
        "P3": drift(0.0008, 0.011),
        "P4": np.linspace(220, 90, n),
        "M0": np.linspace(100, 240, n),
        "M1": drift(0.0006, 0.010),
        "M2": np.linspace(210, 110, n),
        "SPY": drift(0.0004, 0.008),
    }
    return pd.DataFrame(data, index=idx)


@pytest.fixture
def run_output():
    px, uni = make_prices(), make_universe()
    return compute_run(px, uni), px


def test_run_row_shape(run_output):
    (run, _), px = run_output
    assert run["universe_n"] == 8  # all 8 investables scored; SPY excluded
    assert 0 <= run["breadth_pct"] <= 100
    assert run["gate_gross"] in (1.00, 0.50, 0.25)
    assert run["regime_read"] == regime_read(run["gate_gross"])
    assert run["data_through"] == px.index[-1].date()
    assert run["as_of"] == px.index[-1].date()
    assert run["engine_version"]


def test_each_investable_has_4_rows_two_views(run_output):
    (_, ranks), _ = run_output
    df = pd.DataFrame(ranks)
    assert "SPY" not in set(df["ticker"])  # benchmark never scored
    # each investable: combined + its one category view, × 2 sleeves = 4 rows
    for tk in ["P0", "P1", "P4", "M0", "M2"]:
        rows = df[df["ticker"] == tk]
        assert len(rows) == 4, f"{tk} -> {len(rows)} rows"
        assert set(rows["view"]) == {"combined", _expected_cat_view(tk)}
        assert set(rows["sleeve"]) == VALID_SLEEVES
    assert len(ranks) == 8 * 4  # 32 rows total


def _expected_cat_view(tk):
    return "pure_play" if tk.startswith("P") else "megacap"


def test_view_membership_and_enums(run_output):
    (_, ranks), _ = run_output
    df = pd.DataFrame(ranks)
    assert set(df["view"]) == VALID_VIEWS
    assert set(df["sleeve"]) == VALID_SLEEVES
    assert set(df["driver_tag"]).issubset(VALID_TAGS)
    # category views contain only their own names
    assert set(df[df["view"] == "pure_play"]["ticker"]) == {"P0", "P1", "P2", "P3", "P4"}
    assert set(df[df["view"] == "megacap"]["ticker"]) == {"M0", "M1", "M2"}
    # pct within [0,100] (or None); percentile population is the view's scored set
    pct = df["pct"].dropna()
    assert (pct >= 0).all() and (pct <= 100).all()


def test_sleeve_eligible_tracks_trend_gate(run_output):
    (_, ranks), _ = run_output
    for r in ranks:
        gate_flag = r["above_100"] if r["sleeve"] == "tactical" else r["above_200"]
        assert r["sleeve_eligible"] is gate_flag


def test_riser_outranks_decliner(run_output):
    (_, ranks), _ = run_output
    df = pd.DataFrame(ranks)
    comb_tac = df[(df["view"] == "combined") & (df["sleeve"] == "tactical")].set_index("ticker")
    assert comb_tac.loc["P0", "score"] > comb_tac.loc["P4", "score"]
    assert comb_tac.loc["P0", "pct"] > comb_tac.loc["P4", "pct"]
    # clean riser is above its 100d MA; clean decliner is below → broken trend
    assert comb_tac.loc["P0", "above_100"]
    assert not comb_tac.loc["P4", "above_100"]
    assert comb_tac.loc["P4", "driver_tag"] == "broken-trend"


def test_within_view_zscores_differ_from_combined(run_output):
    """z-scores are recomputed within each view (§3): a name's megacap-view z_m
    generally differs from its combined-view z_m."""
    (_, ranks), _ = run_output
    df = pd.DataFrame(ranks)
    m0_comb = df[(df["ticker"] == "M0") & (df["view"] == "combined")]["z_m"].iloc[0]
    m0_mega = df[(df["ticker"] == "M0") & (df["view"] == "megacap")]["z_m"].iloc[0]
    assert m0_comb != pytest.approx(m0_mega)


def test_stale_ticker_excluded_from_ranking(capsys):
    """A ticker with no close on the run date is excluded (tracked, ineligible),
    not scored on its last stale close, and is warned about on stderr."""
    px, uni = make_prices(), make_universe()
    px.loc[px.index[-3:], "P4"] = np.nan  # loader failed to refresh P4 for 3 sessions
    run, ranks = compute_run(px, uni)
    df = pd.DataFrame(ranks)
    assert "P4" not in set(df["ticker"])             # excluded entirely
    assert run["universe_n"] == 7                     # 8 investable - 1 stale
    assert {"P0", "M0", "M2"}.issubset(set(df["ticker"]))  # fresh names still ranked
    assert "P4" in capsys.readouterr().err            # warned


def test_all_stale_raises():
    """If nothing has a current close, the run fails loudly rather than publish."""
    px, uni = make_prices(), make_universe()
    px.loc[px.index[-1]] = np.nan  # whole latest session missing
    with pytest.raises(ValueError, match="current close"):
        compute_run(px, uni)


# ---- helper unit tests ----
@pytest.mark.parametrize("breadth,expected", [
    (1.00, 1.00), (0.41, 1.00), (0.40, 1.00),
    (0.399, 0.50), (0.25, 0.50), (0.249, 0.25), (0.0, 0.25),
])
def test_gate_gross_thresholds(breadth, expected):
    assert gate_gross(breadth) == expected


def test_regime_read_mapping():
    assert regime_read(1.00) == "risk-on"
    assert regime_read(0.50) == "neutral"
    assert regime_read(0.25) == "risk-off"


def test_driver_tag_logic():
    assert driver_tag(2.0, 0.0, 0.0, above100=False) == "broken-trend"
    assert driver_tag(2.0, 0.0, 0.0, above100=True) == "return-driven"
    assert driver_tag(0.0, 2.0, 1.0, above100=True) == "stability-driven"
    assert driver_tag(0.10, 0.10, 0.10, above100=True) == "balanced"


def test_smoke_universe_matches_spec():
    """The offline preview universe mirrors the hp1.universe seed: 50 investable
    (42 pure_play / 8 megacap) + SPY/QQQ + ^VIX (HP1_SPEC §2)."""
    from hp1_smoke import build_universe
    u = build_universe()
    inv = u[u["kind"] == "investable"]
    assert len(inv) == 50
    assert (inv["category"] == "pure_play").sum() == 42
    assert (inv["category"] == "megacap").sum() == 8
    assert set(u[u["kind"] == "benchmark"]["ticker"]) == {"SPY", "QQQ"}
    assert set(u[u["kind"] == "macro"]["ticker"]) == {"^VIX"}
