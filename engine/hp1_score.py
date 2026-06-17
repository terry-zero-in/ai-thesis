"""HP-1 production scoring: a price matrix + universe -> one engine_runs row and
the engine_ranks rows for a single daily run.

Pure (no I/O) so it is unit-testable on synthetic data. The DB read/write lives
in `hp1_db.py`; the orchestration in `run_engine.py`. Factor math is imported
from `hp1_factors` (shared with the backtest — no drift).

Output shape mirrors the live `hp1` schema exactly (verified 2026-06-17):

  engine_runs(as_of, breadth_pct, gate_gross, regime_read, universe_n,
              data_through, engine_version)
  engine_ranks(ticker, layer, view, sleeve, score, pct, z_m, z_ram, z_dd,
               driver_tag, above_100, above_200, dist_100_pct, dist_200_pct,
               dd_from_high, sleeve_eligible, r3, r6, r12)

Grain of a rank row = (run_id, ticker, view, sleeve). The per-name/per-view facts
(z_*, above_*, dist_*, dd_from_high, r3/r6/r12, driver_tag, layer) are identical
across the two sleeve rows by design; only score, pct and sleeve_eligible differ
per sleeve. Percentages (breadth_pct, dist_*, dd_from_high, r3/r6/r12) are stored
as 0-100 numbers, matching the breadth_pct convention in the schema comment.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd

from hp1_factors import driver_tag, factors

# Engine output schema/version. Bump on any change to the scoring math or the
# emitted field set so engine_runs.engine_version pins what produced a row.
ENGINE_VERSION = "hp1-engine-1.0.0"

# Views per HP1_SPEC §2. z-scores are recomputed within each view's membership.
VIEWS = ("combined", "pure_play", "megacap")

# Breadth gate (HP1_SPEC §4): % of the universe above its 100d MA -> gross.
GATE_FULL, GATE_HALF, GATE_QUARTER = 40.0, 25.0, 0.0


def _num(x):
    """numpy/NaN -> JSON/DB-safe Python float or None."""
    if x is None:
        return None
    try:
        xf = float(x)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(xf) or math.isinf(xf) else xf


def gate_gross(breadth_pct: float) -> float:
    """Tactical gross exposure from breadth: >=40% -> 1.0, 25-40% -> 0.5, <25% -> 0.25."""
    if breadth_pct >= GATE_FULL:
        return 1.0
    if breadth_pct >= GATE_HALF:
        return 0.5
    return 0.25


def regime_read(breadth_pct: float, gross: float) -> str:
    """Concise (<=120 char) mechanical regime line for engine_runs.

    Fable may overwrite with a richer read on its own runs; this is the baseline
    the engine always writes so the Today/Regime surfaces have a value.
    """
    if breadth_pct >= GATE_FULL:
        stance = "Risk-on"
    elif breadth_pct >= GATE_HALF:
        stance = "Cautious"
    else:
        stance = "Defensive"
    return f"{stance} · breadth {breadth_pct:.0f}% · gross {gross * 100:.0f}%"


def _normalize_universe(universe) -> pd.DataFrame:
    """Accept a DataFrame or list-of-dicts; return df indexed by ticker with
    layer/category/kind columns (kind defaults to 'investable')."""
    df = pd.DataFrame(universe) if not isinstance(universe, pd.DataFrame) else universe.copy()
    if "ticker" not in df.columns:
        raise ValueError("universe needs a 'ticker' column")
    if "kind" not in df.columns:
        df["kind"] = "investable"
    for col in ("layer", "category"):
        if col not in df.columns:
            df[col] = None
    return df.drop_duplicates("ticker").set_index("ticker")


def _view_tickers(uni: pd.DataFrame, view: str) -> list[str]:
    inv = uni[uni["kind"] == "investable"]
    if view == "combined":
        return list(inv.index)
    return list(inv[inv["category"] == view].index)


def compute_engine_output(prices, universe, as_of=None, version: str = ENGINE_VERSION):
    """Compute one engine run.

    prices:   DataFrame indexed by date (sortable), columns = tickers, values =
              adjusted closes.
    universe: DataFrame / list-of-dicts with ticker[, layer, category, kind].
    as_of:    run date; defaults to the last price date (data_through).

    Returns (run: dict, ranks: list[dict]).
    """
    px = prices.sort_index()
    if px.empty:
        raise ValueError("prices is empty")
    data_through = px.index[-1]
    as_of = as_of or data_through
    uni = _normalize_universe(universe)

    # --- combined cross-section drives breadth, gross, universe_n ---
    comb_tickers = [t for t in _view_tickers(uni, "combined") if t in px.columns]
    f_comb = factors(px[comb_tickers], data_through)
    universe_n = int(len(f_comb))
    breadth = float(f_comb["above100"].astype(bool).mean() * 100) if universe_n else 0.0
    gross = gate_gross(breadth)

    run = {
        "as_of": _as_date_str(as_of),
        "breadth_pct": round(breadth, 2),
        "gate_gross": gross,
        "regime_read": regime_read(breadth, gross),
        "universe_n": universe_n,
        "data_through": _as_date_str(data_through),
        "engine_version": version,
    }

    # --- per-view × per-sleeve rank rows ---
    ranks: list[dict] = []
    for view in VIEWS:
        tks = [t for t in _view_tickers(uni, view) if t in px.columns]
        fv = factors(px[tks], data_through)
        if fv.empty:
            continue
        # Percentile of the sleeve score within the view (0-100), rank-based.
        tac_pct = (fv["tac"].rank(pct=True) * 100)
        core_pct = (fv["core"].rank(pct=True) * 100)
        for tk, row in fv.iterrows():
            above_100 = bool(row["above100"])
            above_200 = bool(row["above200"])
            base = {
                "ticker": tk,
                "layer": (None if pd.isna(uni.loc[tk, "layer"]) else uni.loc[tk, "layer"]),
                "view": view,
                "z_m": _num(row["zM"]),
                "z_ram": _num(row["zRAM"]),
                "z_dd": _num(row["zDD"]),
                "driver_tag": driver_tag(row["zM"], row["zRAM"], row["zDD"], above_100),
                "above_100": above_100,
                "above_200": above_200,
                "dist_100_pct": _num(row["dist100"] * 100),
                "dist_200_pct": _num(row["dist200"] * 100),
                "dd_from_high": _num(row["ddraw"] * 100),
                "r3": _num(row["r3"] * 100),
                "r6": _num(row["r6"] * 100),
                "r12": _num(row["r12"] * 100),
            }
            ranks.append({**base, "sleeve": "tactical", "score": _num(row["tac"]),
                          "pct": _num(tac_pct[tk]), "sleeve_eligible": above_100})
            ranks.append({**base, "sleeve": "core", "score": _num(row["core"]),
                          "pct": _num(core_pct[tk]), "sleeve_eligible": above_200})
    return run, ranks


def _as_date_str(d) -> str:
    if hasattr(d, "date"):
        return d.date().isoformat()
    return str(d)
