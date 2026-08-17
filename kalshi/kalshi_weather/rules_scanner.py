"""Rules scanner: rulebook ingestion, structural + LLM extraction, divergence flags.

Scope (Terry, 2026-08-17): ingest every new contract rulebook, extract
settlement source / edge cases via an LLM pass, and flag contracts where the
rule-implied and headline-implied probabilities diverge by more than 5 points.
Flags land in the scans table (the review queue); nothing auto-acts on them.

Validation of the thesis, found during the build: on 2026-08-14 Kalshi's
daily temperature markets switched settlement source from NWS to The Weather
Company — announced only inside series product_metadata.important_info,
which this scanner hashes and surfaces.
"""
import hashlib
import json
import os
import re

from . import kalshi_api, ledger, pricing
from .config import Config

_BELOW_RE = re.compile(r"(\d+)°? or below")
_ABOVE_RE = re.compile(r"(\d+)°? or above")
_RANGE_RE = re.compile(r"(\d+)°? to (\d+)°?")

LLM_SCHEMA = {
    "type": "object",
    "properties": {
        "settlement_source": {"type": "string"},
        "station_or_location": {"type": "string"},
        "measurement_window": {"type": "string"},
        "rounding_or_tie_rules": {"type": "string"},
        "correction_policy": {"type": "string"},
        "edge_cases": {"type": "array", "items": {"type": "string"}},
        "divergence_risk_notes": {"type": "string"},
    },
    "required": ["settlement_source", "station_or_location", "measurement_window",
                 "rounding_or_tie_rules", "correction_policy", "edge_cases",
                 "divergence_risk_notes"],
    "additionalProperties": False,
}

LLM_SYSTEM = (
    "You extract settlement-critical facts from prediction-market rulebooks for a "
    "risk reviewer. Report only what the text supports; for anything the rulebook "
    "does not specify, write 'unspecified'. Pay particular attention to the exact "
    "settlement data source, the measurement station and time window, rounding and "
    "tie handling, data-correction windows, and any way the headline market title "
    "could settle differently than a casual reader would expect."
)


def parse_headline_bucket(sub_title: str):
    """Map a yes_sub_title like '83° or below' to strike semantics."""
    s = sub_title.strip()
    m = _BELOW_RE.fullmatch(s)
    if m:
        return ("less", None, int(m.group(1)) + 1)
    m = _ABOVE_RE.fullmatch(s)
    if m:
        return ("greater", int(m.group(1)) - 1, None)
    m = _RANGE_RE.fullmatch(s)
    if m:
        return ("between", int(m.group(1)), int(m.group(2)))
    return None


def structural_scan(series_meta: dict, markets: list) -> dict:
    sources = series_meta.get("settlement_sources", []) or []
    important = ((series_meta.get("product_metadata") or {})
                 .get("important_info") or {}).get("markdown", "") or ""
    cli_code = None
    for m in markets:
        cli_code = kalshi_api.extract_cli_code(m.rules_primary)
        if cli_code:
            break
    mismatches = []
    for m in markets:
        headline = parse_headline_bucket(m.yes_sub_title)
        strikes = (m.strike_type, m.floor_strike, m.cap_strike)
        if headline is not None and headline != strikes:
            mismatches.append(f"{m.ticker}: headline {m.yes_sub_title!r} implies "
                              f"{headline}, strike fields say {strikes}")
    return {
        "settlement_sources": [{"name": s.get("name"), "url": s.get("url")} for s in sources],
        "important_info": important,
        "cli_code": cli_code,
        "fee_type": series_meta.get("fee_type"),
        "fee_multiplier": series_meta.get("fee_multiplier"),
        "mismatches": mismatches,
    }


def rulebook_hash(series_meta: dict, market) -> str:
    basis = json.dumps({
        "rules_primary": re.sub(r"\b\w{3} \d{1,2}, \d{4}\b", "<DATE>", market.rules_primary),
        "rules_secondary": market.rules_secondary,
        "sources": series_meta.get("settlement_sources", []),
        "important": ((series_meta.get("product_metadata") or {})
                      .get("important_info") or {}).get("markdown", ""),
    }, sort_keys=True)
    return hashlib.sha256(basis.encode()).hexdigest()


def llm_extract(rulebook_text: str, series_ticker: str):
    """LLM pass over a rulebook. Optional dependency + key; degrades to a
    pending_llm queue status rather than failing the scan."""
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return None, "pending_llm:no_api_key"
    try:
        import anthropic
    except ImportError:
        return None, "pending_llm:sdk_not_installed"
    try:
        client = anthropic.Anthropic()
        resp = client.messages.create(
            model=os.environ.get("KALSHI_LLM_MODEL", "claude-opus-5"),
            # max_tokens caps thinking + text together on models where
            # thinking is on by default — keep generous headroom
            max_tokens=16000,
            system=LLM_SYSTEM,
            output_config={"format": {"type": "json_schema", "schema": LLM_SCHEMA}},
            messages=[{"role": "user", "content":
                       f"Series {series_ticker}. Rulebook and metadata:\n\n{rulebook_text}"}],
        )
        if resp.stop_reason == "refusal":
            return None, "llm_refusal"
        text = next(b.text for b in resp.content if b.type == "text")
        return json.loads(text), "llm_done"
    except Exception as e:  # queue it, never crash a cycle on the LLM leg
        return None, f"llm_error:{type(e).__name__}"


def scan_series(conn, cfg: Config, series_meta: dict, markets: list, ts: str,
                prob_fn=None) -> dict:
    """One scan of a series' current rulebook state. prob_fn, when supplied by
    the pricing cycle, maps (strike_type, floor, cap) -> model P(YES) so a
    headline/rule mismatch can be expressed in probability points."""
    series_ticker = series_meta.get("ticker", "")
    if not markets:
        return {"series": series_ticker, "flag": "no_markets"}
    h = rulebook_hash(series_meta, markets[0])
    prev = ledger.latest_scan_hash(conn, series_ticker)
    scan = structural_scan(series_meta, markets)

    div_pts = 0.0
    if scan["mismatches"] and prob_fn is not None:
        for m in markets:
            headline = parse_headline_bucket(m.yes_sub_title)
            strikes = (m.strike_type, m.floor_strike, m.cap_strike)
            if headline is not None and headline != strikes:
                div_pts = max(div_pts, abs(prob_fn(strikes) - prob_fn(headline)) * 100.0)

    if scan["mismatches"]:
        flag = "divergence"
        status = "review" if (prob_fn is None or div_pts > cfg.divergence_flag_pts) else "ok"
    elif prev is None:
        flag, status = "baseline", "ok"
    elif h != prev:
        flag, status = "changed", "review"
    else:
        return {"series": series_ticker, "flag": "unchanged"}

    llm_result, llm_status = llm_extract(
        json.dumps({"rules_primary": markets[0].rules_primary,
                    "rules_secondary": markets[0].rules_secondary,
                    "settlement_sources": scan["settlement_sources"],
                    "important_info": scan["important_info"]}, indent=1),
        series_ticker)
    if status == "ok" and llm_status.startswith("pending_llm"):
        status = "pending_llm"

    detail = json.dumps({"structural": scan, "llm": llm_result, "llm_status": llm_status})
    ledger.insert_scan(conn, ts=ts, series=series_ticker, rules_hash=h, flag=flag,
                       divergence_pts=div_pts, detail=detail, status=status)
    return {"series": series_ticker, "flag": flag, "status": status,
            "divergence_pts": div_pts, "llm_status": llm_status,
            "mismatches": scan["mismatches"]}
