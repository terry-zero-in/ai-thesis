"""HP-1 macro-gauge loader — NAAIM / AAII / CNN Fear & Greed -> hp1.macro_gauges.

Sources (public, undocumented endpoints; verified live 2026-06-17 with Terry):
  • CNN Fear & Greed — production.dataviz.cnn.io graphdata JSON. Needs browser
    headers (a bare request 418s). Reads fear_and_greed.score (0-100), daily.
  • AAII Sentiment   — the legacy .xls (the .xlsx mirror lags ~3 months). Weekly
    Bullish/Neutral/Bearish fractions. aaii_spread is the 3-WEEK average bull-bear
    in percentage points per HP1_SPEC regime (Terry 2026-06-17: current ≈ -8; do
    NOT anchor to v2's +5.4, which was placeholder). bullish/bearish are the latest
    week.
  • NAAIM Exposure   — parsed from the program page's recent-readings table.

Each source is wrapped behind a pure parser + a fetch_*() provider fn. The loader
caches daily (upsert keyed by the run date) and applies a per-gauge STALE GUARD —
mirroring the price loader: a source that fails today carries its last-good DB
value forward, flagged in `source`, and NEVER blocks. The gauges are Fable
downgrade-only flags, not engine mechanics (HP1_SPEC §4), so a miss must not break
anything. Swapping a source = replacing its fetch_*()/parser only.

Run:  HP1_DB_URL=... python hp1_macro_loader.py
"""
from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
from datetime import date, datetime

import pandas as pd

import hp1_db

_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
_FNG_URL = "https://production.dataviz.cnn.io/index/fearandgreed/graphdata"
_AAII_URL = "https://www.aaii.com/files/surveys/sentiment.xls"
_NAAIM_URL = "https://naaim.org/programs/naaim-exposure-index/"


def _get(url: str, headers: dict, timeout: int = 25) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": _UA, **headers})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# ---------- parsers (pure, unit-tested) ----------
def parse_fear_greed(payload: dict) -> float:
    return float(payload["fear_and_greed"]["score"])


def aaii_from_frame(df: pd.DataFrame) -> dict:
    """Latest weekly bull/bear (%) + the 3-week average bull-bear spread (pp).
    Expects the post-`skiprows=3` AAII frame (cols Date/Bullish/Neutral/Bearish,
    values as fractions)."""
    df = df.rename(columns={df.columns[0]: "Date"})
    df["Date"] = pd.to_datetime(df["Date"], errors="coerce")
    bull = pd.to_numeric(df["Bullish"], errors="coerce")
    bear = pd.to_numeric(df["Bearish"], errors="coerce")
    df = df.assign(_b=bull, _e=bear).dropna(subset=["Date", "_b", "_e"]).sort_values("Date")
    if df.empty:
        raise ValueError("AAII: no parseable rows")
    latest = df.iloc[-1]
    spread_3wk = float((df["_b"] - df["_e"]).tail(3).mean() * 100.0)
    return {
        "as_of": latest["Date"].date(),
        "bullish": round(float(latest["_b"]) * 100.0, 2),
        "bearish": round(float(latest["_e"]) * 100.0, 2),
        "spread": round(spread_3wk, 2),
    }


def parse_naaim(html: str) -> dict:
    """Latest NAAIM exposure reading from the program page's date/value table."""
    rows = re.findall(r"(\d{1,2}/\d{1,2}/\d{4})[^0-9\-]{0,40}(-?\d{1,3}\.\d{1,2})", html)
    parsed = [(datetime.strptime(d, "%m/%d/%Y").date(), float(v)) for d, v in rows]
    if not parsed:
        raise ValueError("NAAIM: no parseable rows")
    as_of, val = max(parsed, key=lambda x: x[0])
    return {"as_of": as_of, "exposure": round(val, 2)}


# ---------- fetchers (I/O) ----------
def fetch_fear_greed() -> dict:
    body = _get(_FNG_URL, {
        "Accept": "application/json, text/plain, */*",
        "Referer": "https://www.cnn.com/markets/fear-and-greed",
        "Origin": "https://www.cnn.com",
    })
    return {"as_of": date.today(), "score": parse_fear_greed(json.loads(body))}


def fetch_aaii() -> dict:
    body = _get(_AAII_URL, {"Referer": "https://www.aaii.com/sentimentsurvey"})
    return aaii_from_frame(pd.read_excel(io.BytesIO(body), skiprows=3))


def fetch_naaim() -> dict:
    return parse_naaim(_get(_NAAIM_URL, {}).decode("utf-8", "ignore"))


# ---------- assembly (pure, unit-tested) ----------
def assemble_row(today: date, fng, aaii, naaim, last_good) -> dict:
    """Build one hp1.macro_gauges row, carrying last-good values forward for any
    source that failed (flagged in `source`)."""
    row = {"as_of": today, "naaim": None, "aaii_bullish": None,
           "aaii_bearish": None, "aaii_spread": None, "fear_greed": None}
    lg = last_good or {}
    prov: list[str] = []

    if fng is not None:
        row["fear_greed"] = round(fng["score"])
        prov.append(f"fng={fng['score']:.1f}@{fng['as_of']}")
    elif lg.get("fear_greed") is not None:
        row["fear_greed"] = lg["fear_greed"]
        prov.append(f"fng=STALE(carried {lg.get('as_of')})")
    else:
        prov.append("fng=MISSING")

    if aaii is not None:
        row["aaii_bullish"], row["aaii_bearish"], row["aaii_spread"] = (
            aaii["bullish"], aaii["bearish"], aaii["spread"])
        prov.append(f"aaii_spread={aaii['spread']:.1f}@{aaii['as_of']}")
    elif lg.get("aaii_spread") is not None:
        row["aaii_bullish"], row["aaii_bearish"], row["aaii_spread"] = (
            lg.get("aaii_bullish"), lg.get("aaii_bearish"), lg.get("aaii_spread"))
        prov.append(f"aaii=STALE(carried {lg.get('as_of')})")
    else:
        prov.append("aaii=MISSING")

    if naaim is not None:
        row["naaim"] = naaim["exposure"]
        prov.append(f"naaim={naaim['exposure']:.1f}@{naaim['as_of']}")
    elif lg.get("naaim") is not None:
        row["naaim"] = lg["naaim"]
        prov.append(f"naaim=STALE(carried {lg.get('as_of')})")
    else:
        prov.append("naaim=MISSING")

    row["source"] = "; ".join(prov)
    return row


# ---------- orchestration (I/O) ----------
def _try(fn, name):
    try:
        return fn()
    except Exception as e:  # network/parse failures must never block the engine
        print(f"WARNING: {name} fetch failed: {type(e).__name__}: {str(e)[:140]}",
              file=sys.stderr)
        return None


def load() -> int:
    conn = hp1_db.connect()
    try:
        last_good = hp1_db.fetch_latest_macro(conn)
        fng = _try(fetch_fear_greed, "fear_greed")
        aaii = _try(fetch_aaii, "aaii")
        naaim = _try(fetch_naaim, "naaim")
        if fng is None and aaii is None and naaim is None and not last_good:
            print("all macro sources failed and no last-good row — nothing written",
                  file=sys.stderr)
            return 3
        row = assemble_row(date.today(), fng, aaii, naaim, last_good)
        hp1_db.upsert_macro_gauges(conn, row)
    finally:
        conn.close()
    print(f"hp1.macro_gauges upsert as_of {row['as_of']}: naaim={row['naaim']} "
          f"aaii_spread={row['aaii_spread']} fear_greed={row['fear_greed']} | {row['source']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(load())
