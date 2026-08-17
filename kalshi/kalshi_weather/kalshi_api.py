"""Kalshi public market-data client. READ-ONLY by design.

This client speaks only to unauthenticated public endpoints (series, events,
markets, orderbook, trades). It carries no credentials and has no order
methods; tests/test_gate_containment.py enforces that structurally.

Wire facts verified live 2026-08-17:
- prices arrive as dollar strings ("0.7700"); sizes/counts as float strings
- orderbook arrays are BIDS per side, ascending (best = last);
  implied ask on a side = 100c - best bid of the opposite side
- event tickers embed the target date as YYMMMDD (KXHIGHNY-26AUG17)
"""
import datetime
import re
import time
from typing import NamedTuple

from . import http

BASE = "https://api.elections.kalshi.com/trade-api/v2"
_CLI_RE = re.compile(r"\(CLI([A-Z0-9]{2,5})\)")
_MONTHS = {m: i + 1 for i, m in enumerate(
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"])}


def dollars_to_cents(s):
    if s is None:
        return None
    return int(round(float(s) * 100))


class Market(NamedTuple):
    ticker: str
    event_ticker: str
    strike_type: str
    floor_strike: object
    cap_strike: object
    yes_bid_c: object
    yes_ask_c: object
    last_price_c: object
    status: str
    close_time: str
    rules_primary: str
    rules_secondary: str
    yes_sub_title: str
    title: str


def parse_market(d: dict) -> Market:
    return Market(
        ticker=d["ticker"],
        event_ticker=d.get("event_ticker", ""),
        strike_type=d.get("strike_type", ""),
        floor_strike=d.get("floor_strike"),
        cap_strike=d.get("cap_strike"),
        yes_bid_c=dollars_to_cents(d.get("yes_bid_dollars")),
        yes_ask_c=dollars_to_cents(d.get("yes_ask_dollars")),
        last_price_c=dollars_to_cents(d.get("last_price_dollars")),
        status=d.get("status", ""),
        close_time=d.get("close_time", ""),
        rules_primary=d.get("rules_primary", "") or "",
        rules_secondary=d.get("rules_secondary", "") or "",
        yes_sub_title=d.get("yes_sub_title", "") or "",
        title=d.get("title", "") or "",
    )


def extract_cli_code(rules_text: str):
    m = _CLI_RE.search(rules_text or "")
    return m.group(1) if m else None


def target_date_from_event(event_ticker: str):
    try:
        suffix = event_ticker.split("-")[1]
        yy, mon, dd = int(suffix[:2]), _MONTHS[suffix[2:5].upper()], int(suffix[5:7])
        return datetime.date(2000 + yy, mon, dd)
    except (IndexError, KeyError, ValueError):
        return None


def parse_orderbook(payload: dict) -> dict:
    ob = payload.get("orderbook_fp") or payload.get("orderbook") or {}
    out = {}
    for side, key in (("yes", "yes_dollars"), ("no", "no_dollars")):
        levels = ob.get(key) or []
        out[side] = [(dollars_to_cents(p), float(sz)) for p, sz in levels]
    return out


def best_bid(book: dict, side: str):
    levels = book.get(side) or []
    return levels[-1] if levels else (None, 0.0)


def implied_ask(book: dict, side: str):
    opp = "no" if side == "yes" else "yes"
    price, _sz = best_bid(book, opp)
    return None if price is None else 100 - price


def size_at(book: dict, side: str, price_c: int) -> float:
    return sum(sz for p, sz in (book.get(side) or []) if p == price_c)


class Client:
    def __init__(self, base: str = BASE, pause_s: float = 0.15):
        self.base = base
        self.pause_s = pause_s  # polite spacing between paged calls

    def _get(self, path: str, params: dict | None = None):
        return http.get_json(self.base + path, params)

    def series_list(self, category: str = "Climate and Weather") -> list:
        return self._get("/series", {"category": category}).get("series", [])

    def discover_kxhigh(self) -> list:
        return [s for s in self.series_list() if s.get("ticker", "").startswith("KXHIGH")]

    def series(self, ticker: str) -> dict:
        return self._get(f"/series/{ticker}").get("series", {})

    def events(self, series_ticker: str, status: str = "open") -> list:
        out, cursor = [], None
        while True:
            params = {"series_ticker": series_ticker, "status": status,
                      "with_nested_markets": "true", "limit": 100}
            if cursor:
                params["cursor"] = cursor
            resp = self._get("/events", params)
            out.extend(resp.get("events", []))
            cursor = resp.get("cursor")
            if not cursor:
                return out
            time.sleep(self.pause_s)

    def markets(self, event_ticker: str) -> list:
        resp = self._get("/markets", {"event_ticker": event_ticker, "limit": 100})
        return [parse_market(m) for m in resp.get("markets", [])]

    def market(self, ticker: str) -> dict:
        return self._get(f"/markets/{ticker}").get("market", {})

    def orderbook(self, ticker: str) -> dict:
        return parse_orderbook(self._get(f"/markets/{ticker}/orderbook", {"depth": 12}))

    def trades(self, ticker: str, min_ts: str | None = None, max_pages: int = 5) -> list:
        """Normalized executed-trade tape, newest first from the API; we return
        all trades with created_time > min_ts (ISO compare) across pages."""
        out, cursor = [], None
        for _ in range(max_pages):
            params = {"ticker": ticker, "limit": 100}
            if cursor:
                params["cursor"] = cursor
            resp = self._get("/markets/trades", params)
            page = resp.get("trades", [])
            for t in page:
                row = {
                    "yes_price_c": dollars_to_cents(t.get("yes_price_dollars")),
                    "no_price_c": dollars_to_cents(t.get("no_price_dollars")),
                    "count": float(t.get("count_fp", 0.0)),
                    "taker_side": t.get("taker_side"),
                    "created_time": t.get("created_time", ""),
                }
                out.append(row)
            if page and min_ts and page[-1]["created_time"] <= min_ts:
                break
            cursor = resp.get("cursor")
            if not cursor or not page:
                break
            time.sleep(self.pause_s)
        if min_ts:
            out = [t for t in out if t["created_time"] > min_ts]
        return out
