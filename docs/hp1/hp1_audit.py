"""Audit of hp1_backtest.py: reproduce published results, then quantify
(1) same-day execution lookahead, (2) selection-vs-weighting attribution,
(3) contribution of post-2023 IPO names, (4) simple significance check."""
import yfinance as yf, pandas as pd, numpy as np, sys

RF = 0.04
COST = 0.0015

CAT_A = {
 "semis":["NVDA","AMD","AVGO","MRVL","MU","TSM","ASML","AMAT","LRCX","KLAC","TER","ARM","MPWR","ALAB","CRDO","SMCI"],
 "eda":["SNPS","CDNS"],
 "net_hw":["ANET","CLS","FN","COHR","DELL"],
 "neocloud":["CRWV","NBIS","IREN","APLD"],
 "power":["VST","CEG","GEV","NRG","TLN","VRT"],
 "software":["PLTR","NOW","SNOW","DDOG","CRWD","PANW","APP","TEM","RDDT","NET"]}
CAT_B = ["MSFT","GOOGL","AMZN","META","AAPL","TSLA","ORCL"]
UNIV = [t for v in CAT_A.values() for t in v] + CAT_B
BENCH = ["QQQ","SOXX"]
IPO_NAMES = ["CRWV","NBIS","IREN","APLD","ALAB","ARM","RDDT","TEM"]  # listed/relisted 2023+

def factors(px, t):
    p = px.loc[:t]
    out = {}
    for tk in p.columns:
        s = p[tk].dropna()
        if len(s) < 130: continue
        c = s.iloc[-1]
        r = s.pct_change().dropna()
        def ret(lb, skip=0):
            if len(s) < lb + skip + 1: return np.nan
            return s.iloc[-1-skip] / s.iloc[-1-skip-lb] - 1
        r3, r6, r12 = ret(63), ret(126, 5), ret(231, 21)
        neg = r.iloc[-126:][r.iloc[-126:] < 0]
        dd_dev = max(neg.std() * np.sqrt(252), 1e-4) if len(neg) > 5 else 1e-4
        ram = (r6 / dd_dev) if not np.isnan(r6) else np.nan
        ddraw = c / s.iloc[-126:].max() - 1
        ma100 = s.iloc[-100:].mean()
        ma200 = s.iloc[-200:].mean() if len(s) >= 200 else ma100
        out[tk] = dict(r3=r3, r6=r6, r12=r12, ram=ram, ddraw=ddraw,
                       above100=c > ma100, above200=c > ma200, dd_dev=dd_dev)
    f = pd.DataFrame(out).T
    if f.empty: return f
    def z(col):
        v = f[col].astype(float)
        zz = (v - v.mean()) / (v.std() + 1e-9)
        return zz.clip(-3, 3)
    P = pd.concat({"a": z("r3"), "b": z("r6"), "c": z("r12")}, axis=1)
    WV = np.array([.3, .4, .3])
    Wm = P.notna().values * WV
    num = np.nansum(P.values * WV, axis=1); den = Wm.sum(axis=1)
    f["zM"] = pd.Series(np.where(den > 0, num / np.where(den > 0, den, 1), np.nan), index=f.index)
    assert np.isfinite(f["zM"].dropna()).all(), "zM not finite"
    f["zRAM"], f["zDD"] = z("ram"), z("ddraw")
    f["tac"] = .45*f.zM + .35*f.zRAM + .20*f.zDD
    f["core"] = .40*z("r12") + .35*f.zRAM + .25*f.zDD
    return f

def weights(sel, f):
    w = (1 / f.loc[sel, "dd_dev"]).astype(float)
    w /= w.sum()
    for _ in range(6):
        over = w > 0.15
        if not over.any(): break
        excess = (w[over] - 0.15).sum(); w[over] = 0.15
        under = ~over
        if w[under].sum() > 0: w[under] += excess * w[under] / w[under].sum()
    return w / w.sum()

def simulate(px, rets, start, end, mode="tac", freq=10, gate=False, equal_w=False,
             lag=False, exclude=None):
    """lag=False reproduces the original (new weights earn day-d return).
       lag=True: new weights take effect the NEXT trading day (trade at close of d).
       exclude: list of tickers removed from selection (still in z-score universe? no - fully removed)."""
    upx = px if exclude is None else px[[c for c in px.columns if c not in exclude]]
    urets = rets if exclude is None else rets[[c for c in rets.columns if c not in exclude]]
    days = urets.loc[start:end].index
    rebal = set(days[::freq])
    w = pd.Series(dtype=float); curve = []; v = 1.0; turn_total = 0.0; held = []
    pending = None
    for d in days:
        if lag and pending is not None:
            nw = pending; pending = None
            allk = w.index.union(nw.index)
            turn = (nw.reindex(allk, fill_value=0) - w.reindex(allk, fill_value=0)).abs().sum()
            v *= (1 - COST * turn); turn_total += turn
            w = nw
        if d in rebal:
            f = factors(upx, d)
            if not f.empty:
                elig = f[f["above100"]] if mode == "tac" else f[f["above200"]]
                sel = elig[mode].sort_values(ascending=False).head(10).index.tolist()
                if len(sel) >= 3:
                    nw = weights(sel, f) if not equal_w else pd.Series(1/len(sel), index=sel)
                    if gate:
                        breadth = float(f["above100"].astype(bool).mean())
                        gross = 1.0 if breadth >= .40 else (.5 if breadth >= .25 else .25)
                        nw = nw * gross
                else:
                    nw = pd.Series(dtype=float)
                held.append(len(sel))
                if lag:
                    pending = nw
                else:
                    allk = w.index.union(nw.index)
                    turn = (nw.reindex(allk, fill_value=0) - w.reindex(allk, fill_value=0)).abs().sum()
                    v *= (1 - COST * turn); turn_total += turn
                    w = nw
        r = (w * urets.loc[d].reindex(w.index).fillna(0)).sum() + (1 - w.sum()) * RF/252
        v *= (1 + r)
        if not w.empty:
            gw = w * (1 + urets.loc[d].reindex(w.index).fillna(0)); w = gw / (1 + r) if (1+r) != 0 else gw
        curve.append((d, v))
    eq = pd.Series(dict(curve))
    yrs = len(eq) / 252
    return eq, dict(ann_turnover=turn_total / yrs if yrs else 0, avg_names=np.mean(held) if held else 0)

def metrics(eq, name):
    r = eq.pct_change().dropna()
    yrs = len(r) / 252
    cagr = eq.iloc[-1] ** (1/yrs) - 1
    vol = r.std() * np.sqrt(252)
    dwn = r[r < 0].std() * np.sqrt(252)
    sharpe = (cagr - RF) / vol if vol else 0
    mdd = (eq / eq.cummax() - 1).min()
    return dict(name=name, cagr=round(cagr*100,1), vol=round(vol*100,1),
                sharpe=round(sharpe,2), maxdd=round(mdd*100,1), total=round((eq.iloc[-1]-1)*100,1))

if __name__ == "__main__":
    raw = yf.download(UNIV + BENCH, start="2022-06-01", end="2026-06-11",
                      auto_adjust=True, progress=False)
    px = raw["Close"].dropna(axis=1, how="all")
    rets = px.pct_change()
    upx = px[[c for c in UNIV if c in px.columns]]
    urets = rets[[c for c in UNIV if c in px.columns]]
    print("data through:", px.index[-1].date(), "| names:", upx.shape[1])

    start, end = "2024-06-10", "2026-06-10"
    rows = []
    # 1. Reproduce original
    v2, s2 = simulate(upx, urets, start, end, "tac", 10, gate=True)
    v5, _ = simulate(upx, urets, start, end, "core", 21, gate=False)
    blend = (1 + 0.5*v2.pct_change().fillna(0) + 0.5*v5.pct_change().fillna(0)).cumprod()
    rows += [metrics(v2, "ORIG V2 Tactical+gate"), metrics(v5, "ORIG V5 Core"), metrics(blend, "ORIG BLEND")]
    # 2. Lagged execution
    v2L, s2L = simulate(upx, urets, start, end, "tac", 10, gate=True, lag=True)
    v5L, _ = simulate(upx, urets, start, end, "core", 21, gate=False, lag=True)
    blendL = (1 + 0.5*v2L.pct_change().fillna(0) + 0.5*v5L.pct_change().fillna(0)).cumprod()
    rows += [metrics(v2L, "LAG1 V2 Tactical+gate"), metrics(v5L, "LAG1 V5 Core"), metrics(blendL, "LAG1 BLEND")]
    # 3. Exclude 2023+ IPO names (lagged, honest variant)
    v2X, _ = simulate(upx, urets, start, end, "tac", 10, gate=True, lag=True, exclude=IPO_NAMES)
    v5X, _ = simulate(upx, urets, start, end, "core", 21, gate=False, lag=True, exclude=IPO_NAMES)
    blendX = (1 + 0.5*v2X.pct_change().fillna(0) + 0.5*v5X.pct_change().fillna(0)).cumprod()
    rows += [metrics(blendX, "LAG1 BLEND ex-IPO names")]
    # 4. EW benchmarks
    ew = (1 + urets.loc[start:end].mean(axis=1).fillna(0)).cumprod()
    exc = [c for c in urets.columns if c not in IPO_NAMES]
    ewX = (1 + urets[exc].loc[start:end].mean(axis=1).fillna(0)).cumprod()
    rows += [metrics(ew, "EW-50"), metrics(ewX, "EW ex-IPO names")]
    for b in ["QQQ", "SOXX"]:
        s = px[b].loc[start:end]; rows.append(metrics(s/s.iloc[0], b+" B&H"))
    df = pd.DataFrame(rows).set_index("name")
    print(df.to_string())
    df.to_csv("/home/user/workspace/hp1_audit_results.csv")
    print("turnover orig %.1fx lag %.1fx" % (s2["ann_turnover"], s2L["ann_turnover"]))
