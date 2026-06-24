#!/usr/bin/env python3
"""HP-1 autoresearch lane scorer. Produces autoresearch/lane-<x>/score.json +
appends the append-only ledger. REUSES the live HP-1 engine (engine/hp1_engine.py,
the corrected t+1 simulator) as the held-out scorer — it never reimplements the
factor math (AUTORESEARCH_DOCTRINE.md Part I).

Usage (from repo root, in the HP-1 venv):
  python autoresearch/lib/run_lane.py <A|B|C> [--label <tag>]

HARD GATE (SEC 206(4)-1): every number here is a harness/test metric on the
corrected backtest record. It is NOT live performance and never ships as a track
record. Per HP-1's own red-team (docs/hp1/HP1_redteam_findings.md), the published
110.5%/2.43 record was inflated by a now-fixed execution lookahead, and the
risk-adjusted edge over equal-weighting the same universe is ~0. Lane B's HEADLINE
is therefore the HONEST EDGE (vs equal-weight, with a bootstrap CI), NOT raw Sharpe.
"""
import sys, os, json, argparse, subprocess
from datetime import datetime, timezone

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ENGINE = os.path.join(REPO, "engine")
sys.path.insert(0, ENGINE)
sys.path.insert(0, os.path.dirname(__file__))


def git_sha():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=REPO).decode().strip()
    except Exception:
        return "UNKNOWN"


def stamp():
    return os.environ.get("SCORE_TS") or datetime.now(timezone.utc).isoformat()


def run_pytest(paths, cwd=None):
    """Run pytest on paths; return {passed,total,green} parsed from the summary.
    cwd defaults to the repo root; engine tests must run from engine/ so the
    `import hp1_engine` resolves."""
    try:
        out = subprocess.run(
            [sys.executable, "-m", "pytest", "-q", *paths],
            cwd=cwd or REPO, capture_output=True, text=True, timeout=300,
        )
        text = out.stdout + out.stderr
    except Exception as e:
        return {"passed": None, "total": None, "green": False, "error": str(e)}
    import re
    passed = int(m.group(1)) if (m := re.search(r"(\d+) passed", text)) else 0
    failed = int(m.group(1)) if (m := re.search(r"(\d+) failed", text)) else 0
    return {"passed": passed, "failed": failed, "total": passed + failed,
            "green": out.returncode == 0 and failed == 0 and passed > 0}


# ── LANE A — engine determinism + factor invariants (offline, synthetic) ──────
def lane_a():
    import numpy as np, pandas as pd
    import hp1_engine as eng

    # Deterministic synthetic panel (fixed seed). No network.
    idx = pd.bdate_range("2024-01-01", periods=340)
    n = len(idx)
    rng = np.random.default_rng(7)
    cols = {}
    cols["UP"] = pd.Series(np.linspace(100, 220, n), idx)            # steady riser
    cols["DN"] = pd.Series(np.linspace(100, 52, n), idx)             # steady decliner
    cols["CH"] = pd.Series(100 * np.cumprod(1 + rng.normal(0, .04, n)), idx)  # chop
    for k in range(9):  # extra names so z-scores have a real cross-section
        drift = rng.uniform(-0.0004, 0.0009)
        cols[f"N{k}"] = pd.Series(100 * np.cumprod(1 + rng.normal(drift, .02, n)), idx)
    px = pd.DataFrame(cols)

    f1 = eng.factors(px, idx[-1])
    f2 = eng.factors(px, idx[-1])
    deterministic = f1.equals(f2)

    inv = {
        "riser_outranks_decliner": bool(f1.loc["UP", "tac"] > f1.loc["DN", "tac"]),
        "trend_gate_riser_above100": bool(f1.loc["UP", "above100"]),
        "trend_gate_decliner_below100": bool(not f1.loc["DN", "above100"]),
        "smooth_riser_beats_chop_on_RAM": bool(f1.loc["UP", "zRAM"] > f1.loc["CH", "zRAM"]),
        "zM_finite": bool(np.isfinite(f1["zM"].dropna()).all()),
    }
    # weights single-name cap holds on a feasible (>=7-name) book
    sel = f1[f1["above100"]].sort_values("tac", ascending=False).head(10).index.tolist()
    wcap_ok = True
    if len(sel) >= 7:
        w = eng.weights(sel, f1)
        wcap_ok = bool(w.max() <= 0.15 + 1e-6 and abs(w.sum() - 1) < 1e-9)
    inv["weights_cap_<=0.15_on_feasible_book"] = wcap_ok

    reg = run_pytest(["tests/"], cwd=ENGINE)
    invariants_pass = all(inv.values())
    return {
        "metric": {
            "name": "engine_determinism_and_factor_invariants",
            "deterministic": deterministic,
            "invariants": inv,
            "invariants_pass": invariants_pass,
            "universe_n": len(eng.UNIV),
        },
        "regression": reg,
        "runnable_offline": True,
        "pass": bool(deterministic and invariants_pass and reg["green"]),
    }


# ── LANE B — reproduce corrected v2 record + HONEST edge (bootstrap CI) ────────
def _sharpe(daily, rf=0.04):
    import numpy as np
    if len(daily) < 2:
        return 0.0
    ann_ret = (1 + daily).prod() ** (252 / len(daily)) - 1
    vol = daily.std() * np.sqrt(252)
    return float((ann_ret - rf) / vol) if vol else 0.0


def lane_b(windows=None):
    import numpy as np, pandas as pd, yfinance as yf
    import hp1_engine as eng
    from restate_record import IPO_COHORT

    windows = windows or [("24M", "2024-06-10"), ("36M", "2023-06-12")]
    end = "2026-06-10"

    raw = yf.download(eng.UNIV + eng.BENCH, start="2022-06-01", end=None,
                      auto_adjust=True, progress=False)
    px = raw["Close"].dropna(axis=1, how="all")
    rets = px.pct_change()
    upx = px[[c for c in eng.UNIV if c in px.columns]]
    urets = rets[[c for c in eng.UNIV if c in px.columns]]
    names_loaded = int(upx.shape[1])

    # committed corrected-record tie-out targets
    committed = {}
    for label in ("24M", "36M"):
        p = os.path.join(ENGINE, "data", f"results_{label.lower()}_v2.csv")
        if os.path.exists(p):
            committed[label] = pd.read_csv(p).set_index("name")

    rng = np.random.default_rng(0)  # deterministic bootstrap

    per_window = {}
    for label, start in windows:
        v2, _ = eng.simulate(upx, urets, start, end, "tac", 10, gate=True)
        ew = (1 + urets.loc[start:end].mean(axis=1).fillna(0)).cumprod()
        ex = [c for c in upx.columns if c not in IPO_COHORT]
        v2x, _ = eng.simulate(upx[ex], urets[ex], start, end, "tac", 10, gate=True)
        ewx = (1 + urets[ex].loc[start:end].mean(axis=1).fillna(0)).cumprod()

        s_v2, s_ew = _sharpe(v2.pct_change().dropna()), _sharpe(ew.pct_change().dropna())
        s_v2x, s_ewx = _sharpe(v2x.pct_change().dropna()), _sharpe(ewx.pct_change().dropna())

        # tie-out vs committed corrected record
        tie = None
        if label in committed and "V2 Tactical+gate" in committed[label].index:
            s_committed = float(committed[label].loc["V2 Tactical+gate", "sharpe"])
            denom = abs(s_committed) if s_committed else 1.0
            tie = {
                "v2_sharpe_live": round(s_v2, 3),
                "v2_sharpe_committed": round(s_committed, 3),
                "pct_diff": round(abs(s_v2 - s_committed) / denom, 4),
                "within_10pct": abs(s_v2 - s_committed) / denom <= 0.10,
            }

        # HONEST edge: bootstrap CI on the Sharpe-delta of (V2 - EW) daily returns.
        d = (v2.pct_change() - ew.pct_change()).dropna().values
        boot = []
        for _ in range(2000):
            samp = rng.choice(d, size=len(d), replace=True)
            mu, sd = samp.mean(), samp.std()
            boot.append((mu * 252) / (sd * np.sqrt(252)) if sd else 0.0)
        boot.sort()
        ci_lo, ci_hi = float(boot[49]), float(boot[1949])  # 2.5% / 97.5%

        per_window[label] = {
            "v2_sharpe": round(s_v2, 3),
            "ew50_sharpe": round(s_ew, 3),
            "edge_vs_ew_sharpe": round(s_v2 - s_ew, 3),
            "edge_vs_ew_ex_ipo_sharpe": round(s_v2x - s_ewx, 3),
            "edge_bootstrap_ci95": [round(ci_lo, 3), round(ci_hi, 3)],
            "edge_distinguishable_from_zero": bool(ci_lo > 0 or ci_hi < 0),
            "tie_out": tie,
        }

    tie_ok = all(w["tie_out"] and w["tie_out"]["within_10pct"] for w in per_window.values() if w["tie_out"])
    return {
        "metric": {
            "name": "v2_record_reproduction_and_honest_edge",
            "anchor": "HP-1's own corrected (t+1) record, engine/data/results_*_v2.csv (V2 Tactical+gate). The headline is the HONEST EDGE vs equal-weight, not raw Sharpe.",
            "names_loaded": names_loaded,
            "windows": per_window,
            "redteam_note": "Per docs/hp1/HP1_redteam_findings.md: honest risk-adjusted edge over equal-weighting the same universe is ~0 (+0.05 24m / -0.01 36m ex-IPO). If the bootstrap CI straddles 0, the edge is statistically indistinguishable from zero — that is the expected, honest result, not a failure.",
        },
        "regression": {"note": "tie-out IS the regression for Lane B"},
        "runnable_offline": False,
        "tie_out_within_10pct": tie_ok,
        "pass": None,  # Lane B's job is honest measurement, not a pass/fail target
    }


# ── LANE C — Fable review citation validation ─────────────────────────────────
def lane_c():
    from fable_citations import validate_fable_review
    CITE = {"claim": "guidance cut", "source": "Reuters", "date": "2026-06-20", "url": "https://r.com/x"}
    CITE2 = {"claim": "contract", "source": "8-K", "date": "2026-06-21", "url": "https://sec.gov/y"}
    clean = [
        {"ticker": "NVDA", "verdict": "CONFIRM", "adjustment_pct": 0, "evidence": []},
        {"ticker": "TSM", "verdict": "DOWNGRADE", "adjustment_pct": -10, "confidence": "H", "evidence": [CITE]},
        {"ticker": "VRT", "verdict": "UPGRADE", "adjustment_pct": 5, "confidence": "H", "evidence": [CITE, CITE2]},
    ]
    audit = validate_fable_review(clean)
    reg = run_pytest(["autoresearch/lib/fable_citations_test.py"])
    return {
        "metric": {
            "name": "fable_review_citation_leak_rate",
            "validator": "autoresearch/lib/fable_citations.py (validate_fable_review)",
            "contract": "FABLE_REVIEW_RUBRIC_v1.md §5/§6/§50: every DOWNGRADE/UPGRADE/VETO must carry the required dated {source,date,url} citations; uncited adjustments demote to FLAG. L-confidence findings cannot exceed -5.",
            "clean_fixture_leak_rate": audit.leak_rate,
            "clean_fixture_unhandled": audit.unhandled,
            "status": "VALIDATOR_BUILT_LIVE_PENDING",
            "live_pending": "URL-liveness (§50 server-side fetch: page resolves + contains the claimed entity/date) + wiring as the Fable orchestrator's post-output gate. Offline half (count/shape/date/magnitude) is enforced + unit-green here.",
        },
        "regression": reg,
        "runnable_offline": True,
        "pass": bool(audit.leak_rate == 0.0 and audit.unhandled == 0 and reg["green"]),
    }


LANES = {
    "A": ("Engine determinism + factor invariants (50-name HP-1 universe)", lane_a),
    "B": ("Reproduce corrected v2 record + honest edge vs equal-weight (bootstrap CI)", lane_b),
    "C": ("Fable review citation-validation leak rate -> 0 (rubric §6/§50)", lane_c),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("lane", choices=["A", "B", "C"])
    ap.add_argument("--label", default="run")
    args = ap.parse_args()

    title, fn = LANES[args.lane]
    body = fn()
    score = {
        "schema": "autoresearch/score.v2-hp1",
        "engine": "HP-1 (engine/hp1_engine.py — corrected t+1 simulator)",
        "lane": args.lane,
        "title": title,
        "label": args.label,
        "commit": git_sha(),
        "generated_at": stamp(),
        "python": sys.version.split()[0],
        **body,
    }
    out_dir = os.path.join(REPO, "autoresearch", f"lane-{args.lane.lower()}")
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "score.json"), "w") as fh:
        json.dump(score, fh, indent=2)
        fh.write("\n")

    # append-only ledger
    if args.lane == "A":
        head = {"deterministic": body["metric"]["deterministic"],
                "invariants_pass": body["metric"]["invariants_pass"],
                "tests": body["regression"].get("passed")}
    elif args.lane == "B":
        head = {"windows": {k: {"edge_vs_ew": v["edge_vs_ew_sharpe"],
                                "edge_ci95": v["edge_bootstrap_ci95"],
                                "distinguishable": v["edge_distinguishable_from_zero"],
                                "tie_out_10pct": (v["tie_out"] or {}).get("within_10pct")}
                            for k, v in body["metric"]["windows"].items()}}
    else:
        head = {"clean_leak_rate": body["metric"]["clean_fixture_leak_rate"],
                "status": body["metric"]["status"], "tests": body["regression"].get("passed")}
    row = {"ts": score["generated_at"], "lane": args.lane, "label": args.label,
           "commit": score["commit"], "pass": score["pass"], "headline": head}
    with open(os.path.join(REPO, "autoresearch", "score_ledger.jsonl"), "a") as fh:
        fh.write(json.dumps(row) + "\n")

    print(f"lane {args.lane} ({args.label}) -> autoresearch/lane-{args.lane.lower()}/score.json")
    print(json.dumps(head, indent=2))


if __name__ == "__main__":
    main()
