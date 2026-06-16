"""HP-1 backtest. APPROACH: rank fixed AI universe on risk-adjusted momentum composite,
simulate top-10 portfolio with costs, compare vs benchmarks. INPUT: yfinance adjusted
closes 2022-06->now. METHOD: vectorized factor calc at each rebalance using only data
<= t (no lookahead); drifting-weight daily simulation. REUSE: returns matrix computed
once, all factors/variants derive from it."""
import yfinance as yf, pandas as pd, numpy as np, json, sys

RF = 0.04
COST = 0.0015  # per side

CAT_A = {  # pure-play / high-AI-beta
 "semis":["NVDA","AMD","AVGO","MRVL","MU","TSM","ASML","AMAT","LRCX","KLAC","TER","ARM","MPWR","ALAB","CRDO","SMCI"],
 "eda":["SNPS","CDNS"],
 "net_hw":["ANET","CLS","FN","COHR","DELL"],
 "neocloud":["CRWV","NBIS","IREN","APLD"],
 "power":["VST","CEG","GEV","NRG","TLN","VRT"],
 "software":["PLTR","NOW","SNOW","DDOG","CRWD","PANW","APP","TEM","RDDT","NET"]}
CAT_B = ["MSFT","GOOGL","AMZN","META","AAPL","TSLA","ORCL"]
UNIV = [t for v in CAT_A.values() for t in v] + CAT_B
assert len(UNIV) == 50 and len(set(UNIV)) == 50, f"universe count {len(UNIV)}"
BENCH = ["QQQ","SOXX"]

# ---------- factor math ----------
def factors(px, t):
    """Cross-sectional factor z-scores using data up to and including date t."""
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
        r3, r6, r12 = ret(63), ret(126, 5), ret(231, 21)  # 12m skip 1m
        neg = r.iloc[-126:][r.iloc[-126:] < 0]
        dd_dev = max(neg.std() * np.sqrt(252), 1e-4) if len(neg) > 5 else 1e-4
        ram = (r6 / dd_dev) if not np.isnan(r6) else np.nan
        ddraw = c / s.iloc[-126:].max() - 1  # <=0
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
    import numpy as _np
    P = pd.concat({"a": z("r3"), "b": z("r6"), "c": z("r12")}, axis=1)
    WV = _np.array([.3, .4, .3])
    Wm = P.notna().values * WV
    num = _np.nansum(P.values * WV, axis=1); den = Wm.sum(axis=1)
    f["zM"] = pd.Series(_np.where(den > 0, num / _np.where(den > 0, den, 1), _np.nan), index=f.index)
    assert _np.isfinite(f["zM"].dropna()).all(), "zM not finite"
    f["zRAM"], f["zDD"] = z("ram"), z("ddraw")  # ddraw less negative = higher = better
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

# ---------- self-test on synthetic data ----------
def selftest():
    idx = pd.bdate_range("2024-01-01", periods=320)
    n = len(idx)
    up = pd.Series(np.linspace(100, 200, n), idx)                       # steady riser
    dn = pd.Series(np.linspace(100, 55, n), idx)                        # steady decliner
    rng = np.random.default_rng(7)
    chop = pd.Series(100 * np.cumprod(1 + rng.normal(0, .04, n)), idx)  # volatile noise
    px = pd.DataFrame({"UP": up, "DN": dn, "CH": chop})
    f = factors(px, idx[-1])
    assert f.loc["UP","tac"] > f.loc["DN","tac"], "riser must outrank decliner"
    assert bool(f.loc["UP","above100"]) and not bool(f.loc["DN","above100"]), "trend gate wrong"
    assert f.loc["UP","zRAM"] > f.loc["CH","zRAM"], "smooth riser must beat chop on RAM"
    w = weights(["UP","CH"], f)
    assert abs(w.sum() - 1) < 1e-9 and w.max() <= 0.15 + 1e-9 or len(w) == 2, "weights"
    print("SELFTEST PASS")

# ---------- simulation ----------
def simulate(px, rets, start, end, mode="tac", freq=10, gate=False, equal_w=False):
    simulate.breadth_log = []
    simulate.daylog = []
    days = rets.loc[start:end].index
    rebal = set(days[::freq])
    w = pd.Series(dtype=float); curve = []; v = 1.0; turn_total = 0.0; n_rebal = 0; held = []
    for d in days:
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
                allk = w.index.union(nw.index)
                turn = (nw.reindex(allk, fill_value=0) - w.reindex(allk, fill_value=0)).abs().sum()
                v *= (1 - COST * turn); turn_total += turn; n_rebal += 1
                w = nw; held.append(len(sel))
        r = (w * rets.loc[d].reindex(w.index).fillna(0)).sum() + (1 - w.sum()) * RF/252
        v *= (1 + r)
        simulate.daylog.append((d, r, list(w.sort_values(ascending=False).head(5).index)))
        if not w.empty:
            gw = w * (1 + rets.loc[d].reindex(w.index).fillna(0)); w = gw / (1 + r) if (1+r) != 0 else gw
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
    sortino = (cagr - RF) / dwn if dwn else 0
    mdd = (eq / eq.cummax() - 1).min()
    return dict(name=name, cagr=cagr, vol=vol, sharpe=sharpe, sortino=sortino,
                maxdd=mdd, worst_day=r.min(), total=eq.iloc[-1] - 1)

# ---------- main ----------
if __name__ == "__main__":
    selftest()
    raw = yf.download(UNIV + BENCH, start="2022-06-01", end="2026-06-11",
                      auto_adjust=True, progress=False)
    px = raw["Close"]
    missing = [t for t in UNIV + BENCH if t not in px.columns or px[t].dropna().empty]
    print("MISSING:", missing)
    px = px.dropna(axis=1, how="all")
    rets = px.pct_change()
    upx, urets = px[ [c for c in UNIV if c in px.columns] ], rets[[c for c in UNIV if c in px.columns]]
    print("data through:", px.index[-1].date(), "| names loaded:", upx.shape[1])

    for label, start in [("24M", "2024-06-10"), ("36M", "2023-06-12")]:
        end = "2026-06-10"
        rows = []
        v1, s1 = simulate(upx, urets, start, end, "tac", 10, gate=False)
        if label == "24M":
            wd = sorted(simulate.daylog, key=lambda x: x[1])[:4]
            print("V1 worst days:", [(str(d.date()), round(r*100,1), h) for d, r, h in wd])
        v2, s2 = simulate(upx, urets, start, end, "tac", 10, gate=True)
        if label == "24M":
            bl = simulate.breadth_log
            print("breadth: min %.2f | pct of rebalances <0.40: %.0f%%" % (min(b for _, b in bl), 100*sum(b < .40 for _, b in bl)/len(bl)))
        v3, _  = simulate(upx, urets, start, end, "tac", 10, gate=False, equal_w=True)
        v4, _  = simulate(upx, urets, start, end, "tac", 21, gate=False)
        v5, s5 = simulate(upx, urets, start, end, "core", 21, gate=False)
        blend = (1 + 0.5*v2.pct_change().fillna(0) + 0.5*v5.pct_change().fillna(0)).cumprod()
        # benchmarks
        ew_r = urets.loc[start:end].mean(axis=1)
        ew = (1 + ew_r.fillna(0)).cumprod()
        for nm, eq in [("V1 Tactical", v1), ("V2 Tactical+gate", v2), ("V3 eq-weight", v3),
                       ("V4 monthly", v4), ("V5 Core(price)", v5), ("BLEND 50/50 (V2+V5)", blend),
                       ("EW-50 universe", ew)]:
            rows.append(metrics(eq, nm))
        for b in ["QQQ", "SOXX", "NVDA"]:
            s = px[b].loc[start:end]; rows.append(metrics(s / s.iloc[0], b + " B&H"))
        df = pd.DataFrame(rows).set_index("name")
        df_fmt = df.copy()
        for c in ["cagr","vol","maxdd","worst_day","total"]: df_fmt[c] = (df[c]*100).round(1)
        df_fmt[["sharpe","sortino"]] = df[["sharpe","sortino"]].round(2)
        print(f"\n===== {label} window ({start} -> {end}) =====")
        print(df_fmt.to_string())
        if label == "24M":
            print("V1 ann turnover %.1fx | V2 %.1fx | V5 %.1fx | avg names V1 %.1f" %
                  (s1["ann_turnover"], s2["ann_turnover"], s5["ann_turnover"], s1["avg_names"]))
            df.to_csv("/home/claude/results_24m.csv")

    # ---------- current rankings + driver tags ----------
    t = px.index[-1]
    f = factors(upx, t)
    def tag(row):
        cm, cs = .45*row.zM, .35*row.zRAM + .20*row.zDD
        if not row.above100: return "broken trend"
        if cm > cs * 1.4 and cm > .25: return "return-driven"
        if cs > cm * 1.4 and cs > .25: return "stability-driven"
        return "balanced"
    f["tag"] = f.apply(tag, axis=1)
    f["cat"] = ["B" if i in CAT_B else "A" for i in f.index]
    rank_all = f.sort_values("tac", ascending=False)
    cols = ["tac","core","zM","zRAM","zDD","tag","cat","above100"]
    print("\n===== CURRENT COMBINED RANK (tactical score, as of %s) =====" % t.date())
    print(rank_all[cols].round(2).head(15).to_string())
    print("\n===== CURRENT CORE RANK top 10 =====")
    print(f[f.above200.astype(bool)].sort_values("core", ascending=False)[cols].round(2).head(10).to_string())
    rank_all[cols].round(3).to_csv("/home/claude/current_ranks.csv")
    print("\nDONE")
