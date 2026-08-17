"""Execution shadow: maker-side limit quotes only, simulated fills, paper ledger.

No order is ever sent anywhere. A "quote" is a ledger row describing the
resting limit order we WOULD have posted; fills are inferred conservatively
from the public trade tape:

  A resting bid at price p (size n, with `ahead` displayed size at p when we
  arrived) fills only if, after placement,
    (a) a trade prints STRICTLY better-for-counterparty than p on our side
        (the level traded through us), or
    (b) cumulative traded size AT p reaches ahead + n (the queue in front of
        us demonstrably cleared, then our size printed).
  Only trades whose taker was the OPPOSITE side count — takers on our own
  side lift the other book and can never fill us.

This under-counts fills relative to reality (we may be earlier in queue),
which biases the paper record conservative — the correct direction for a
record that gates going live.

Tail-price preference falls out of the fee model (fee ~ P(1-P) is smallest
at the tails) plus an explicit price band: we only rest bids at
<= config.max_quote_price_cents on either side.
"""
import datetime
import json
import zoneinfo

from . import bias as bias_mod
from . import fees, kalshi_api, ledger, openmeteo, pricing, regime, rules_scanner, \
    settlement, sizing
from .config import Config


def _iso(dt: datetime.datetime) -> str:
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def check_fill(quote: dict, trades: list) -> bool:
    side = quote["side"]
    opposite = "no" if side == "yes" else "yes"
    price_key = "yes_price_c" if side == "yes" else "no_price_c"
    p = quote["price_c"]
    relevant = [t for t in trades
                if t.get("taker_side") == opposite and t.get("created_time", "") > quote["ts"]]
    if any(t[price_key] is not None and t[price_key] < p for t in relevant):
        return True
    traded_at = sum(t["count"] for t in relevant if t[price_key] == p)
    return traded_at >= quote["ahead_size"] + quote["size"]


def lead_allows_quoting(lead: int, local_hour: int, cfg: Config) -> bool:
    """Same-day (lead 0) quoting stops at local noon: by afternoon the market
    is scoring the observed running high against our forecast-only model."""
    return lead >= 1 or local_hour < cfg.lead0_cutoff_hour_local


def build_candidate(cfg: Config, model_p: float, book: dict, side: str):
    """Price a maker quote on `side` given model P(YES) and the book.
    Returns {price_c, edge_net_c, fair_c} or None if no quote clears the
    gates (band, no-cross, min edge)."""
    p_side = model_p if side == "yes" else 1.0 - model_p
    fair_c = p_side * 100.0
    bb_price, _bb_size = kalshi_api.best_bid(book, side)
    ask = kalshi_api.implied_ask(book, side)
    if bb_price is None:
        return None

    candidates = []
    if ask is not None and (ask - bb_price) >= cfg.improve_spread_cents:
        candidates.append(min(bb_price + 1, ask - 1))
    candidates.append(bb_price)

    for price in candidates:
        if price < cfg.min_quote_price_cents or price > cfg.max_quote_price_cents:
            continue
        if ask is not None and price >= ask:
            continue
        edge = fair_c - price - fees.maker_fee_per_contract_cents(price)
        if edge >= cfg.min_edge_cents:
            return {"price_c": price, "edge_net_c": round(edge, 3), "fair_c": fair_c}
    return None


def _market_implied_p(m) -> float | None:
    if m.yes_bid_c is not None and m.yes_ask_c is not None:
        return (m.yes_bid_c + m.yes_ask_c) / 200.0
    if m.last_price_c is not None:
        return m.last_price_c / 100.0
    return None


def run_cycle(conn, cfg: Config, client, now_utc: datetime.datetime | None = None,
              fetch_fn=openmeteo.fetch) -> dict:
    now_utc = now_utc or datetime.datetime.now(datetime.timezone.utc)
    ts = _iso(now_utc)
    allow, regime_reason = regime.allow_quotes(
        cfg.regime_path, now=now_utc, stale_hours=cfg.regime_stale_hours,
        block_states=cfg.block_states)
    bias_model = bias_mod.BiasModel.load(cfg.bias_path)
    summary = {"ts": ts, "regime": regime_reason, "priced": [], "placed": 0,
               "filled": 0, "cancelled": 0, "expired": 0, "skipped": [], "scans": []}
    model_p_by_ticker: dict = {}

    for series, st in cfg.stations.items():
        try:
            events = client.events(series)
        except Exception as e:
            summary["skipped"].append(f"{series}: events fetch failed ({e})")
            continue
        ens = None  # (times, members), fetched once per station per cycle
        scanned = False
        for ev in events:
            target = kalshi_api.target_date_from_event(ev.get("event_ticker", ""))
            if target is None:
                continue
            tz = zoneinfo.ZoneInfo(st.tz)
            today_local = now_utc.astimezone(tz).date()
            lead = (target - today_local).days
            if lead not in cfg.quote_leads:
                continue
            markets = [kalshi_api.parse_market(m) for m in ev.get("markets", [])]
            if not markets:
                continue

            # Contract-text station check: the rulebook names its own station.
            code = kalshi_api.extract_cli_code(markets[0].rules_primary)
            if code and code != st.cli_code:
                ledger.log_event(conn, "station_mismatch",
                                 f"{series}: rules say CLI{code}, registry says "
                                 f"CLI{st.cli_code}; skipping", ts)
                summary["skipped"].append(f"{series}: station mismatch CLI{code}")
                break

            if ens is None:
                try:
                    raw = fetch_fn(st.lat, st.lon, st.tz,
                                   forecast_days=max(cfg.quote_leads) + 2)
                    ens = openmeteo.parse_members(raw)
                except Exception as e:
                    summary["skipped"].append(f"{series}: ensemble fetch failed ({e})")
                    break
            times, members = ens
            by_model = openmeteo.daily_maxes_by_model(times, members, target.isoformat())
            all_maxes = [v for vs in by_model.values() for v in vs]
            if len(all_maxes) < cfg.min_members:
                summary["skipped"].append(
                    f"{series} {target}: only {len(all_maxes)} members")
                continue

            b = bias_model.bias_for(series, lead)
            bw = bias_model.bandwidth_for(series, lead, cfg)
            corrected_all = bias_model.apply(all_maxes, series, lead)
            corrected_by_model = {k: bias_model.apply(v, series, lead)
                                  for k, v in by_model.items()}

            # Log RAW ensemble stats — the bias refit needs uncorrected pairs.
            mean_raw, spread_raw = openmeteo.ens_stats(all_maxes)
            ledger.insert_forecast(conn, ts=ts, station=series,
                                   target_date=target.isoformat(), lead=lead, model="all",
                                   ens_mean=mean_raw, ens_spread=spread_raw,
                                   n_members=len(all_maxes), bias=b, bw=bw)
            for mk, vs in by_model.items():
                m_mean, m_spread = openmeteo.ens_stats(vs)
                ledger.insert_forecast(conn, ts=ts, station=series,
                                       target_date=target.isoformat(), lead=lead, model=mk,
                                       ens_mean=m_mean, ens_spread=m_spread,
                                       n_members=len(vs), bias=b, bw=bw)

            if not scanned:
                def prob_fn(strikes, _members=corrected_all, _bw=bw):
                    return pricing.prob_bucket(_members, _bw, *strikes)
                try:
                    series_meta = client.series(series)
                    summary["scans"].append(rules_scanner.scan_series(
                        conn, cfg, series_meta, markets, ts, prob_fn=prob_fn))
                except Exception as e:
                    summary["skipped"].append(f"{series}: scan failed ({e})")
                scanned = True

            for m in markets:
                if m.status != "active" or not m.strike_type:
                    continue
                p_all = pricing.prob_bucket(corrected_all, bw, m.strike_type,
                                            m.floor_strike, m.cap_strike)
                p_by = {k: pricing.prob_bucket(v, bw, m.strike_type, m.floor_strike,
                                               m.cap_strike)
                        for k, v in corrected_by_model.items()}
                agreement = pricing.model_agreement(p_by)
                model_p_by_ticker[m.ticker] = p_all
                summary["priced"].append({
                    "ticker": m.ticker, "p": round(p_all, 4),
                    "p_gefs": round(p_by.get("gefs", float("nan")), 4),
                    "p_ecmwf": round(p_by.get("ecmwf", float("nan")), 4),
                    "agreement": round(agreement, 4),
                    "yes_bid": m.yes_bid_c, "yes_ask": m.yes_ask_c})
                if not allow or agreement > cfg.agreement_max:
                    continue
                if not lead_allows_quoting(lead, now_utc.astimezone(tz).hour, cfg):
                    continue

                proxy = {"yes": [(m.yes_bid_c, 0.0)] if m.yes_bid_c is not None else [],
                         "no": [(100 - m.yes_ask_c, 0.0)] if m.yes_ask_c is not None else []}
                # $100/market cap is aggregate per ticker across sides and
                # cycles (conservative reading of the pinned "per market").
                committed = ledger.committed_cents(conn, m.ticker)
                book = None
                for side in ("yes", "no"):
                    remaining_cap = cfg.market_cap_cents - committed
                    if remaining_cap <= 0:
                        break
                    if ledger.has_open_quote(conn, m.ticker, side):
                        continue
                    if build_candidate(cfg, p_all, proxy, side) is None:
                        continue  # cheap pre-screen before an orderbook call
                    if book is None:
                        try:
                            book = client.orderbook(m.ticker)
                        except Exception:
                            break
                    cand = build_candidate(cfg, p_all, book, side)
                    if cand is None:
                        continue
                    p_side = p_all if side == "yes" else 1.0 - p_all
                    fee_pc = fees.maker_fee_per_contract_cents(cand["price_c"])
                    n = sizing.contracts_for(p_side, cand["price_c"], fee_pc,
                                             cfg.bankroll_cents, remaining_cap,
                                             cfg.kelly_mult)
                    if n < 1:
                        continue
                    ledger.insert_quote(
                        conn, ticker=m.ticker, event_ticker=m.event_ticker,
                        station=series, target_date=target.isoformat(), side=side,
                        price_c=cand["price_c"], size=n, model_p=p_all,
                        p_gefs=p_by.get("gefs"), p_ecmwf=p_by.get("ecmwf"),
                        agreement=agreement, mkt_yes_bid_c=m.yes_bid_c,
                        mkt_yes_ask_c=m.yes_ask_c, mkt_implied_p=_market_implied_p(m),
                        edge_net_c=cand["edge_net_c"],
                        ahead_size=kalshi_api.size_at(book, side, cand["price_c"]),
                        regime=regime_reason, strike_type=m.strike_type,
                        floor_strike=m.floor_strike, cap_strike=m.cap_strike, ts=ts)
                    committed += cand["price_c"] * n
                    summary["placed"] += 1

    # Fills, cancels, expiry on the open book
    for q in ledger.open_quotes(conn):
        try:
            tape = client.trades(q["ticker"], min_ts=q["ts"])
        except Exception:
            tape = []
        if check_fill(q, tape):
            fee_c = fees.maker_fee_cents(q["price_c"], q["size"])
            ledger.mark_filled(conn, q["id"], fill_ts=ts, fill_fee_c=fee_c)
            summary["filled"] += 1
            continue
        p_now = model_p_by_ticker.get(q["ticker"])
        if p_now is not None:
            p_side = p_now if q["side"] == "yes" else 1.0 - p_now
            edge_now = p_side * 100.0 - q["price_c"] - \
                fees.maker_fee_per_contract_cents(q["price_c"])
            if edge_now < 0:
                ledger.mark_status(conn, q["id"], "cancelled")
                summary["cancelled"] += 1
                continue
        if q["target_date"] and q["target_date"] < now_utc.date().isoformat():
            ledger.mark_status(conn, q["id"], "expired")
            summary["expired"] += 1

    ledger.log_event(conn, "cycle", json.dumps(
        {k: v for k, v in summary.items() if k != "priced"}), ts)
    return summary


def settle_cycle(conn, cfg: Config, client, now_utc: datetime.datetime | None = None) -> dict:
    """Pull NWS CLI actuals + Kalshi market results for past target dates,
    then refit the bias model from the accumulated (forecast, actual) pairs."""
    now_utc = now_utc or datetime.datetime.now(datetime.timezone.utc)
    ts = _iso(now_utc)
    summary = {"settlements": 0, "results": 0, "refit": None}

    pairs = conn.execute(
        """SELECT DISTINCT station, target_date FROM quotes
           UNION SELECT DISTINCT station, target_date FROM forecasts""").fetchall()
    highs_cache: dict = {}
    for station, date in pairs:
        st = cfg.stations.get(station)
        if st is None or date is None:
            continue
        today_local = now_utc.astimezone(zoneinfo.ZoneInfo(st.tz)).date().isoformat()
        if date >= today_local:
            continue
        year = int(date[:4])
        key = (st.iem_station, year)
        if key not in highs_cache:
            try:
                highs_cache[key] = settlement.highs_for_station(
                    st.iem_station, year, cfg.cache_dir)
            except Exception as e:
                ledger.log_event(conn, "settle_fetch_failed", f"{st.iem_station} {e}", ts)
                highs_cache[key] = {}
        high = highs_cache[key].get(date)
        if high is not None:
            ledger.upsert_settlement(conn, station, date, high, "NWS_CLI_via_IEM", ts)
            summary["settlements"] += 1

    tickers = conn.execute(
        """SELECT DISTINCT ticker FROM quotes
           WHERE status IN ('filled','open','expired')
             AND ticker NOT IN (SELECT ticker FROM market_results)""").fetchall()
    for (ticker,) in tickers:
        try:
            md = client.market(ticker)
        except Exception:
            continue
        result = (md.get("result") or "").lower()
        if result in ("yes", "no"):
            ledger.upsert_market_result(conn, ticker, result, ts)
            summary["results"] += 1

    summary["refit"] = bias_mod.refit_from_ledger(conn, cfg.bias_path, cfg)
    ledger.log_event(conn, "settle", json.dumps(summary), ts)
    return summary
