"""HP-1 daily engine run — reads hp1.prices, ranks the universe per view × per
sleeve, writes one hp1.engine_runs row + ~200 hp1.engine_ranks rows.

Topology: standalone HP-1 Supabase project `uetclnhbubmkwbherwkw` (see hp1_db.py).
Scheduled post-close by .github/workflows/hp1-engine.yml; writes via service_role
(direct Postgres). The factor math is `hp1_engine.factors()` verbatim — this module
only fetches prices, recomputes z-scores within each view, shapes the rows, and
writes them. No math is duplicated (spec §3: no TS/other rewrite of the engine).

Engine contract (HP1_SPEC_v1.1 §2-§4):
  • Views: combined (all investable) / pure_play (L1+L3+L4) / megacap (L2+L5).
    z-scores are recomputed WITHIN each view (§3). Each investable name therefore
    appears in `combined` + its one category view → 4 rank rows (2 views × 2 sleeves).
  • Sleeves: tactical (score = .45zM+.35zRAM+.20zDD, gate price>100dMA) and
    core (price-only core, gate price>200dMA).
  • pct = percentile (0-100) of the sleeve score within the view's *scored* set
    (names with ≥130d history — "eligible" per §2). The trend gate is carried
    separately by `sleeve_eligible` / above_100 / above_200.
  • breadth_pct = % of the combined investable scored set above its 100d MA.
    gate_gross = 1.00 (≥40%) / 0.50 (25–40%) / 0.25 (<25%) (§4 regime gate).

DEVIATION (documented, honest): spec §3 Core = price-only core ×0.75 +
fundamental Overlay (§5 Q/G/V/AIQ) ×0.25. The §5 overlay is live-only, unbacktested,
and its Tier-A inputs are not yet in `hp1.*`, so Phase 1 writes the **price-only
core** (the ×0.75/×0.25 blend is applied once the overlay lands). engine_version
is bumped when that changes so downstream can tell the records apart.
"""
from __future__ import annotations

import sys

import pandas as pd

from hp1_engine import factors
import hp1_db

ENGINE_VERSION = "v1.2-priceonly-core"

# view name -> universe.category to filter on (None = all investable / combined)
VIEW_DEFS: dict[str, str | None] = {
    "combined": None,
    "pure_play": "pure_play",
    "megacap": "megacap",
}


def gate_gross(breadth_frac: float) -> float:
    """Breadth → Tactical gross multiplier (HP1_SPEC §4). breadth_frac in [0,1]."""
    if breadth_frac >= 0.40:
        return 1.00
    if breadth_frac >= 0.25:
        return 0.50
    return 0.25


def regime_read(gate: float) -> str:
    """Mechanical regime label off the gross gate (engine's read; Fable writes prose)."""
    return {1.00: "risk-on", 0.50: "neutral", 0.25: "risk-off"}[gate]


def driver_tag(z_m: float, z_ram: float, z_dd: float, above100: bool) -> str:
    """Tactical-composite decomposition → hp1.engine_ranks.driver_tag enum.
    Mirrors the backtest's current-rank tag, hyphenated to the DB CHECK values
    ('return-driven' / 'stability-driven' / 'balanced' / 'broken-trend')."""
    cm = 0.45 * z_m
    cs = 0.35 * z_ram + 0.20 * z_dd
    if not above100:
        return "broken-trend"
    if cm > cs * 1.4 and cm > 0.25:
        return "return-driven"
    if cs > cm * 1.4 and cs > 0.25:
        return "stability-driven"
    return "balanced"


def _num(x) -> float | None:
    """numpy/NaN → native float/None so psycopg binds NULL (not float('nan'))."""
    if x is None:
        return None
    try:
        if pd.isna(x):
            return None
    except (TypeError, ValueError):
        pass
    return float(x)


def compute_run(
    px: pd.DataFrame,
    universe: pd.DataFrame,
    as_of=None,
    engine_version: str = ENGINE_VERSION,
) -> tuple[dict, list[dict]]:
    """Pure: from wide adj_close `px` (index=date, cols=ticker) and a universe
    frame (ticker, layer, category, kind), produce (engine_runs row, engine_ranks
    rows). No DB I/O — the unit-testable heart of the engine run."""
    inv = universe[universe["kind"] == "investable"]
    layer_of = dict(zip(inv["ticker"], inv["layer"]))
    cat_of = dict(zip(inv["ticker"], inv["category"]))
    inv_tickers = [t for t in inv["ticker"] if t in px.columns]
    if not inv_tickers:
        raise ValueError("no investable universe tickers present in price frame")

    as_of_ts = px.index[-1] if as_of is None else pd.Timestamp(as_of)
    data_through = px.index[-1]

    ranks: list[dict] = []
    view_frames: dict[str, pd.DataFrame] = {}
    for view, cat in VIEW_DEFS.items():
        cols = (
            inv_tickers if cat is None
            else [t for t in inv_tickers if cat_of.get(t) == cat]
        )
        if len(cols) < 2:  # need ≥2 names to z-score within the view
            continue
        f = factors(px[cols], as_of_ts)  # z-scores recomputed within this view (§3)
        if f.empty:
            continue
        view_frames[view] = f
        tac_pct = f["tac"].rank(pct=True) * 100.0
        core_pct = f["core"].rank(pct=True) * 100.0
        for tk in f.index:
            row = f.loc[tk]
            above100, above200 = bool(row.above100), bool(row.above200)
            shared = dict(
                ticker=tk,
                layer=layer_of.get(tk),
                view=view,
                z_m=_num(row.zM), z_ram=_num(row.zRAM), z_dd=_num(row.zDD),
                driver_tag=driver_tag(row.zM, row.zRAM, row.zDD, above100),
                above_100=above100, above_200=above200,
                dist_100_pct=_num(row.dist100), dist_200_pct=_num(row.dist200),
                dd_from_high=_num(row.ddraw),
                r3=_num(row.r3), r6=_num(row.r6), r12=_num(row.r12),
            )
            ranks.append({
                **shared, "sleeve": "tactical",
                "score": _num(row.tac), "pct": _num(tac_pct[tk]),
                "sleeve_eligible": above100,
            })
            ranks.append({
                **shared, "sleeve": "core",
                "score": _num(row.core), "pct": _num(core_pct[tk]),
                "sleeve_eligible": above200,
            })

    f_comb = view_frames.get("combined")
    if f_comb is None or f_comb.empty:
        raise ValueError("combined view has no scorable names (need ≥130d history)")
    breadth_frac = float(f_comb["above100"].astype(bool).mean())
    gate = gate_gross(breadth_frac)

    run = dict(
        as_of=as_of_ts.date(),
        breadth_pct=round(breadth_frac * 100.0, 2),
        gate_gross=gate,
        regime_read=regime_read(gate),
        universe_n=int(len(f_comb)),
        data_through=data_through.date(),
        engine_version=engine_version,
    )
    return run, ranks


def main() -> int:
    conn = hp1_db.connect()
    try:
        universe = hp1_db.fetch_universe(conn)
        px = hp1_db.fetch_prices_wide(conn)
        if px.empty:
            print("hp1.prices is empty — run the price loader first.", file=sys.stderr)
            return 2
        run, ranks = compute_run(px, universe)
        run_id = hp1_db.write_run(conn, run, ranks)
    finally:
        conn.close()
    print(
        f"engine run {run_id} | as_of={run['as_of']} data_through={run['data_through']} "
        f"breadth={run['breadth_pct']}% gate={run['gate_gross']} "
        f"regime={run['regime_read']} universe_n={run['universe_n']} ranks={len(ranks)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
