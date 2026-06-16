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
    df["engine_version"] = "v1.2-corrected"
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
