"""Calibration gate — the doctrine that keeps this system paper-only.

PINNED (Terry, 2026-08-17 scope): "30-day paper Brier must beat
market-implied after fees before any live-mode flag exists in the codebase.
No auto-execute path in v1."

Implementation of that sentence:
  PASS requires ALL of
    - >= gate_window_days of elapsed paper record (first fill to today)
    - >= gate_min_settled settled fills (statistical floor)
    - mean Brier(model P(YES)) < mean Brier(market-implied P(YES))
      on the same settled fills, scored at trade time
    - paper PnL after modeled maker fees > 0  (the "after fees" clause:
      the edge must survive economically, not just win a scoring rule)
A PASS changes nothing in this codebase. It is a report that earns a
conversation with Terry about designing a live mode — which does not exist
here, by construction (see tests/test_gate_containment.py).
"""
import datetime

from . import ledger
from .config import Config


def brier(p: float, outcome: int) -> float:
    return (p - outcome) ** 2


def _pnl_cents(row: dict) -> int:
    won = (row["result"] == row["side"])
    if won:
        return (100 - row["price_c"]) * row["size"] - (row["fill_fee_c"] or 0)
    return -row["price_c"] * row["size"] - (row["fill_fee_c"] or 0)


def evaluate(conn, cfg: Config, today: datetime.date | None = None) -> dict:
    today = today or datetime.date.today()
    rows = ledger.scored_rows(conn)
    report = {"n_settled": len(rows), "verdict": "NOT_YET", "reasons": [],
              "brier_ours": None, "brier_market": None, "pnl_after_fees_c": 0,
              "window_days": 0, "as_of": today.isoformat()}
    if not rows:
        report["reasons"] = ["no settled fills yet; paper window not started"]
        return report

    first_fill = min(datetime.date.fromisoformat(r["fill_ts"][:10]) for r in rows)
    report["window_days"] = (today - first_fill).days
    ours, market, pnl = [], [], 0
    for r in rows:
        y = 1 if r["result"] == "yes" else 0
        ours.append(brier(r["model_p"], y))
        market.append(brier(r["mkt_implied_p"], y))
        pnl += _pnl_cents(r)
    report["brier_ours"] = sum(ours) / len(ours)
    report["brier_market"] = sum(market) / len(market)
    report["pnl_after_fees_c"] = pnl

    if report["window_days"] < cfg.gate_window_days:
        report["reasons"].append(
            f"window {report['window_days']}d < {cfg.gate_window_days}d required")
    if len(rows) < cfg.gate_min_settled:
        report["reasons"].append(
            f"settled fills {len(rows)} < {cfg.gate_min_settled} required")
    if report["brier_ours"] >= report["brier_market"]:
        report["reasons"].append(
            f"Brier {report['brier_ours']:.4f} does not beat market "
            f"{report['brier_market']:.4f}")
    if pnl <= 0:
        report["reasons"].append(f"paper PnL after fees {pnl}c not positive")

    if not report["reasons"]:
        report["verdict"] = "PASS"
    return report
