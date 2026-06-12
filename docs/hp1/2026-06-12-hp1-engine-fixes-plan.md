# HP-1 Engine Fixes Implementation Plan

> **For implementers:** Use the `executing-plans` skill to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Set up a git worktree first per `using-git-worktrees`.

**Goal:** Fix the same-day execution lookahead and three secondary defects in the HP-1 engine, then regenerate the canonical backtest record (24M + 36M, including ex-IPO-cohort variants).

**Architecture:** `hp1_backtest.py` stays the single Python reference implementation. Fixes land as small, tested changes: a deferred-weights mechanism in `simulate()`, a hardened downside-deviation estimator, a post-cap weight assertion, and a record-regeneration script whose CSV outputs become the only numbers any doc or UI may cite.

**Tech Stack:** Python 3.11+, pandas, numpy, yfinance, pytest.

**Context:** Findings F1, F2, F5, F8, F24 in `HP1_redteam_findings.md` (2026-06-12). The corrected numbers were independently verified on 2026-06-12: 24M blend 110.5%/2.43 → **93.1%/2.03** with lag; ex-IPO-cohort edge vs EW ≈ **+0.04 Sharpe**. Expect your regenerated record to land within ~1 CAGR pt / 0.05 Sharpe of those (vendor data drift), not at the old numbers.

**File structure:**

```
engine/
├── hp1_engine.py          ← renamed from hp1_backtest.py; factors/weights/simulate/metrics
├── restate_record.py      ← record regeneration script (writes data/*.csv)
├── data/
│   ├── results_24m_v2.csv ← canonical record (generated)
│   └── results_36m_v2.csv ← canonical record (generated)
└── tests/
    └── test_engine.py     ← all tests below
```

---

### Task 1: Regression test for the lookahead, then the fix

**Files:**
- Create: `engine/tests/test_engine.py`
- Modify: `engine/hp1_engine.py` (the `simulate()` function)

- [ ] **Step 1: Write the failing test**

The invariant: on the first rebalance day `d` (going from no positions to invested), the portfolio's day-`d` return must be the cash return only — new weights may not earn day-`d` asset returns.

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd engine && python -m pytest tests/test_engine.py::test_no_same_day_execution -v`
Expected: FAIL — under the current code, weights set on `first_rebal` earn that day's asset returns, so `eq.iloc[0] != 1 + RF/252`.

- [ ] **Step 3: Implement deferred execution in `simulate()`**

Replace the body of `simulate()` with the pending-weights version (verified 2026-06-12 in `hp1_audit.py`):

```python
def simulate(px, rets, start, end, mode="tac", freq=10, gate=False, equal_w=False):
    """Signals computed from closes through rebalance day d; new weights take
    effect (and turnover costs are charged) at the START of day d+1, i.e. the
    trade executes at the close of d+1's prior session. No same-day execution."""
    simulate.breadth_log = []
    simulate.daylog = []
    days = rets.loc[start:end].index
    rebal = set(days[::freq])
    w = pd.Series(dtype=float); curve = []; v = 1.0
    turn_total = 0.0; n_rebal = 0; held = []
    pending = None
    for d in days:
        # 1. Execute any pending rebalance BEFORE today's returns accrue
        if pending is not None:
            nw = pending; pending = None
            allk = w.index.union(nw.index)
            turn = (nw.reindex(allk, fill_value=0) - w.reindex(allk, fill_value=0)).abs().sum()
            v *= (1 - COST * turn); turn_total += turn; n_rebal += 1
            w = nw
        # 2. Compute today's signal (close of d) -> queues for tomorrow
        if d in rebal:
            f = factors(px, d)
            if not f.empty:
                elig = f[f["above100"]] if mode == "tac" else f[f["above200"]]
                sel = elig[mode].sort_values(ascending=False).head(10).index.tolist()
                if len(sel) >= 3:
                    nw = weights(sel, f) if not equal_w else pd.Series(1/len(sel), index=sel)
                    if gate:
                        breadth = float(f["above100"].astype(bool).mean())
                        simulate.breadth_log.append((d, breadth))
                        gross = 1.0 if breadth >= .40 else (.5 if breadth >= .25 else .25)
                        nw = nw * gross
                else:
                    nw = pd.Series(dtype=float)
                pending = nw
                held.append(len(sel))
        # 3. Accrue today's returns on CURRENT (pre-signal) weights
        r = (w * rets.loc[d].reindex(w.index).fillna(0)).sum() + (1 - w.sum()) * RF/252
        v *= (1 + r)
        simulate.daylog.append((d, r, list(w.sort_values(ascending=False).head(5).index)))
        if not w.empty:
            gw = w * (1 + rets.loc[d].reindex(w.index).fillna(0))
            w = gw / (1 + r) if (1 + r) != 0 else gw
        curve.append((d, v))
    eq = pd.Series(dict(curve))
    yrs = len(eq) / 252
    return eq, dict(ann_turnover=turn_total / yrs if yrs else 0,
                    avg_names=np.mean(held) if held else 0)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd engine && python -m pytest tests/test_engine.py::test_no_same_day_execution -v`
Expected: PASS

- [ ] **Step 5: Keep the existing selftest passing**

Run: `cd engine && python -c "from hp1_engine import selftest; selftest()"`
Expected: `SELFTEST PASS` (factor math untouched).

- [ ] **Step 6: Commit**

```bash
git add engine/hp1_engine.py engine/tests/test_engine.py
git commit -m "fix(engine): defer rebalance execution to t+1, kill same-day lookahead (F1)"
```

### Task 2: Harden the downside-deviation estimator (F8)

**Files:**
- Modify: `engine/hp1_engine.py` (`factors()`)
- Test: `engine/tests/test_engine.py`

- [ ] **Step 1: Write the failing test**

```python
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `python -m pytest tests/test_engine.py::test_dd_dev_short_history_no_synthetic_edge -v`
Expected: FAIL (dd_dev == 1e-4 for SMOOTH).

- [ ] **Step 3: Implement**

In `factors()`, replace the `dd_dev` lines:

```python
        neg = r.iloc[-126:][r.iloc[-126:] < 0]
        if len(neg) >= 20:
            dd_dev = max(neg.std() * np.sqrt(252), 1e-4)
        else:
            # insufficient downside sample -> fall back to total volatility
            dd_dev = max(r.iloc[-126:].std() * np.sqrt(252), 1e-4)
```

- [ ] **Step 4: Run both tests; expect PASS. Commit.**

```bash
git add engine/hp1_engine.py engine/tests/test_engine.py
git commit -m "fix(engine): dd_dev falls back to total vol below 20 negative obs (F8)"
```

### Task 3: Weight-cap invariant (F24)

**Files:**
- Modify: `engine/hp1_engine.py` (`weights()`)
- Test: `engine/tests/test_engine.py`

- [ ] **Step 1: Write the test**

```python
def test_weight_cap_invariant():
    idx = pd.bdate_range("2024-01-01", periods=200)
    rng = np.random.default_rng(5)
    px = pd.DataFrame({f"T{i}": 100 * np.cumprod(1 + rng.normal(0.001, 0.005 + 0.004*i, 200))
                       for i in range(10)}, index=idx)
    f = factors(px, idx[-1])
    w = weights(list(f.index), f)
    assert abs(w.sum() - 1) < 1e-9
    assert w.max() <= 0.15 + 1e-6, f"cap breached: {w.max():.4f}"
```

- [ ] **Step 2: Run it** — likely passes already with 10 names; the assertion in code is the deliverable. If it passes, proceed (the test still locks the invariant).

- [ ] **Step 3: Add the runtime assertion at the end of `weights()`**

```python
    w = w / w.sum()
    assert w.max() <= 0.15 + 1e-6, f"single-name cap breached after renorm: {w.max():.4f}"
    return w
```

- [ ] **Step 4: Run all tests; expect PASS. Commit.**

```bash
git add engine/hp1_engine.py engine/tests/test_engine.py
git commit -m "fix(engine): assert 15% single-name cap holds after redistribution (F24)"
```

### Task 4: Regenerate the canonical record (F2, F5)

**Files:**
- Create: `engine/restate_record.py`

- [ ] **Step 1: Write the script**

```python
# engine/restate_record.py
"""Regenerates the canonical HP-1 backtest record with corrected execution
timing. Outputs: data/results_24m_v2.csv, data/results_36m_v2.csv.
Variants per window: V1 tac, V2 tac+gate, V3 eq-weight, V4 monthly, V5 core,
BLEND, plus EW-50, EW ex-IPO-cohort, BLEND ex-IPO-cohort, QQQ/SOXX/NVDA B&H."""
import pandas as pd, numpy as np, yfinance as yf
from hp1_engine import UNIV, BENCH, simulate, metrics

IPO_COHORT = ["CRWV", "NBIS", "IREN", "APLD", "ALAB", "ARM", "RDDT", "TEM"]  # 2023+ listings

def run_window(px, rets, upx, urets, start, end, out_path):
    rows = []
    v1, s1 = simulate(upx, urets, start, end, "tac", 10, gate=False)
    v2, s2 = simulate(upx, urets, start, end, "tac", 10, gate=True)
    v3, _ = simulate(upx, urets, start, end, "tac", 10, gate=False, equal_w=True)
    v4, _ = simulate(upx, urets, start, end, "tac", 21, gate=False)
    v5, s5 = simulate(upx, urets, start, end, "core", 21, gate=False)
    blend = (1 + 0.5*v2.pct_change().fillna(0) + 0.5*v5.pct_change().fillna(0)).cumprod()
    ex = [c for c in upx.columns if c not in IPO_COHORT]
    v2x, _ = simulate(upx[ex], urets[ex], start, end, "tac", 10, gate=True)
    v5x, _ = simulate(upx[ex], urets[ex], start, end, "core", 21, gate=False)
    blendx = (1 + 0.5*v2x.pct_change().fillna(0) + 0.5*v5x.pct_change().fillna(0)).cumprod()
    ew = (1 + urets.loc[start:end].mean(axis=1).fillna(0)).cumprod()
    ewx = (1 + urets[ex].loc[start:end].mean(axis=1).fillna(0)).cumprod()
    for nm, eq in [("V1 Tactical", v1), ("V2 Tactical+gate", v2), ("V3 eq-weight", v3),
                   ("V4 monthly", v4), ("V5 Core(price)", v5), ("BLEND 50/50", blend),
                   ("BLEND ex-IPO-cohort", blendx), ("EW-50 universe", ew),
                   ("EW ex-IPO-cohort", ewx)]:
        rows.append(metrics(eq, nm))
    for b in ["QQQ", "SOXX", "NVDA"]:
        s = px[b].loc[start:end]; rows.append(metrics(s / s.iloc[0], b + " B&H"))
    df = pd.DataFrame(rows).set_index("name")
    df["engine_version"] = "v1.1-lag1"
    df.to_csv(out_path)
    print(f"{out_path}\n", df.round(3).to_string(), "\n")
    print("V2 ann turnover %.1fx" % s2["ann_turnover"])

if __name__ == "__main__":
    raw = yf.download(UNIV + BENCH, start="2022-06-01", end=None,
                      auto_adjust=True, progress=False)
    px = raw["Close"].dropna(axis=1, how="all")
    rets = px.pct_change()
    upx = px[[c for c in UNIV if c in px.columns]]
    urets = rets[[c for c in UNIV if c in px.columns]]
    assert upx.shape[1] == 50, f"universe incomplete: {upx.shape[1]}"
    run_window(px, rets, upx, urets, "2024-06-10", "2026-06-10", "data/results_24m_v2.csv")
    run_window(px, rets, upx, urets, "2023-06-12", "2026-06-10", "data/results_36m_v2.csv")
```

- [ ] **Step 2: Run it**

Run: `cd engine && mkdir -p data && python restate_record.py`
Expected: two CSVs; 24M BLEND lands near 93% CAGR / 2.03 Sharpe (±1pt/±0.05 vendor drift). If it lands near the OLD record (110/2.4), the Task-1 fix is not active — stop and debug.

- [ ] **Step 3: Sanity-diff against the independent audit**

Compare against `docs/hp1/hp1_audit_results.csv` (Perplexity, 2026-06-12). Tolerances above. Record the diff in the commit message.

- [ ] **Step 4: Commit**

```bash
git add engine/restate_record.py engine/data/results_24m_v2.csv engine/data/results_36m_v2.csv
git commit -m "feat(engine): regenerate canonical record with t+1 execution (F2); add ex-IPO-cohort variants (F5)"
```

### Task 5: Propagate the restated record into the docs

**Files:**
- Modify: `docs/hp1/HP1_SPEC_v1.1.md` → apply `HP1_SPEC_v1.2_deltas.md` (separate doc, exact replacement text included there)
- Modify: any README/handoff lines quoting 110.5 / 2.43 / +31–42 pts

- [ ] **Step 1: Apply the deltas doc verbatim** (it contains exact old-text → new-text replacements).
- [ ] **Step 2: Grep guard**

Run: `grep -rn "110.5\|2\.43\|+31–42\|31-42" docs/ engine/ --include="*.md"`
Expected: zero hits outside `HP1_redteam_findings.md` (which documents the correction) and the deltas doc itself.

- [ ] **Step 3: Commit**

```bash
git add docs/
git commit -m "docs: restate record to corrected v1.2 numbers everywhere (F2)"
```

---

## Self-review checklist (done during plan authoring)

- Spec coverage: F1→Task 1, F8→Task 2, F24→Task 3, F2/F5→Tasks 4–5. F6 (tax) is a UI/spec concern → build handoff doc. ✓
- No placeholders; every step has complete code or an exact command + expected output. ✓
- Type consistency: `simulate()` signature unchanged except behavior; `metrics`/`factors` untouched by Task 1. ✓
