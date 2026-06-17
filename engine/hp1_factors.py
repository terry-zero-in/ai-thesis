"""HP-1 factor math — the SINGLE source of truth for the engine.

Both the backtest (`hp1_engine.py`) and the production daily run (`hp1_score.py`)
import `factors`/`weights`/`driver_tag` from here so the scoring math can never
drift between the two. Lineage and definitions: `docs/hp1/HP1_SPEC_v1.1.md` §3.

Pure, no I/O. Operates on a price matrix (DataFrame indexed by date, columns =
tickers, values = dividend/split-adjusted closes) and uses only data <= the
scoring date `t` (no lookahead).
"""
import numpy as np
import pandas as pd

RF = 0.04
COST = 0.0015  # per side


def factors(px, t):
    """Cross-sectional factor z-scores using data up to and including date t.

    Returns a DataFrame indexed by ticker with the raw facts (r3/r6/r12, ram,
    ddraw, trend gates, dd_dev, dist100/dist200) plus the within-frame z-scores
    (zM/zRAM/zDD) and the two sleeve composites (tac/core). z-scores are computed
    across whatever names are present in `px` — so callers control the
    cross-section by slicing `px` to a view's membership before calling.
    """
    p = px.loc[:t]
    out = {}
    for tk in p.columns:
        s = p[tk].dropna()
        if len(s) < 130:
            continue
        c = s.iloc[-1]
        r = s.pct_change().dropna()

        def ret(lb, skip=0):
            if len(s) < lb + skip + 1:
                return np.nan
            return s.iloc[-1 - skip] / s.iloc[-1 - skip - lb] - 1

        r3, r6, r12 = ret(63), ret(126, 5), ret(231, 21)  # 12m skip 1m
        neg = r.iloc[-126:][r.iloc[-126:] < 0]
        if len(neg) >= 20:
            dd_dev = max(neg.std() * np.sqrt(252), 1e-4)
        else:
            # insufficient downside sample -> fall back to total volatility
            dd_dev = max(r.iloc[-126:].std() * np.sqrt(252), 1e-4)
        ram = (r6 / dd_dev) if not np.isnan(r6) else np.nan
        ddraw = c / s.iloc[-126:].max() - 1  # <=0
        ma100 = s.iloc[-100:].mean()
        ma200 = s.iloc[-200:].mean() if len(s) >= 200 else ma100
        out[tk] = dict(
            r3=r3, r6=r6, r12=r12, ram=ram, ddraw=ddraw,
            above100=c > ma100, above200=c > ma200, dd_dev=dd_dev,
            dist100=c / ma100 - 1, dist200=c / ma200 - 1,
        )
    f = pd.DataFrame(out).T
    if f.empty:
        return f

    def z(col):
        v = f[col].astype(float)
        zz = (v - v.mean()) / (v.std() + 1e-9)
        return zz.clip(-3, 3)

    P = pd.concat({"a": z("r3"), "b": z("r6"), "c": z("r12")}, axis=1)
    WV = np.array([.3, .4, .3])
    Wm = P.notna().values * WV
    num = np.nansum(P.values * WV, axis=1)
    den = Wm.sum(axis=1)
    f["zM"] = pd.Series(np.where(den > 0, num / np.where(den > 0, den, 1), np.nan), index=f.index)
    assert np.isfinite(f["zM"].dropna()).all(), "zM not finite"
    f["zRAM"], f["zDD"] = z("ram"), z("ddraw")  # ddraw less negative = higher = better
    f["tac"] = .45 * f.zM + .35 * f.zRAM + .20 * f.zDD
    f["core"] = .40 * z("r12") + .35 * f.zRAM + .25 * f.zDD
    return f


def weights(sel, f):
    """Inverse-downside-deviation weights with the 15% single-name cap.

    Feasibility-aware: the cap binds at 0.15 when achievable (>=7 names), else
    collapses to equal weight (the projection of any allocation onto
    {sum=1, w_i<=cap} when n*cap<1). Water-fills the cap to convergence. (F24)
    """
    w = (1 / f.loc[sel, "dd_dev"]).astype(float)
    w /= w.sum()
    cap = 0.15
    n = len(w)
    if n * cap < 1.0:
        w = pd.Series(1.0 / n, index=w.index)
    else:
        for _ in range(50):
            over = w > cap
            if not over.any():
                break
            excess = (w[over] - cap).sum()
            w[over] = cap
            under = ~over
            if w[under].sum() > 0:
                w[under] += excess * w[under] / w[under].sum()
            else:
                break
        w = w / w.sum()
    assert w.max() <= max(cap, 1.0 / n) + 1e-6, \
        f"single-name cap breached after renorm: {w.max():.4f} (n={n})"
    return w


def driver_tag(z_m, z_ram, z_dd, above_100):
    """Descriptive tag for what is carrying a name's tactical score.

    Returns the hyphenated enum the DB stores (hp1.engine_ranks.driver_tag check):
    'return-driven' | 'stability-driven' | 'balanced' | 'broken-trend'. A name
    below its 100d MA is 'broken-trend' regardless of factor split. NaN factors
    compare False and fall through to 'balanced'. (HP1_SPEC §3)
    """
    if not above_100:
        return "broken-trend"
    cm = .45 * z_m
    cs = .35 * z_ram + .20 * z_dd
    if cm > cs * 1.4 and cm > .25:
        return "return-driven"
    if cs > cm * 1.4 and cs > .25:
        return "stability-driven"
    return "balanced"
