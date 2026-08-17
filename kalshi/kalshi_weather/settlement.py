"""Settlement truth: NWS daily-climate (CLI) highs via the Iowa Mesonet archive.

IMPORTANT PROVENANCE NOTE (found during build, 2026-08-17): effective
2026-08-14 Kalshi daily temperature markets settle via The Weather Company
(weather.com/kalshi), which "utilizes NWS as its primary underlying source".
The NWS CLI product remains the underlying and the only queryable archive,
so calibration uses it; any TWC/NWS divergence is a settlement risk the
rules-scanner flags and the paper record will expose.
"""
import json
import os
import time

from . import http

IEM_URL = "https://mesonet.agron.iastate.edu/json/cli.py"


def parse_cli(payload: dict) -> dict:
    out = {}
    for row in payload.get("results", []):
        high = row.get("high")
        if isinstance(high, bool) or not isinstance(high, (int, float)):
            continue  # "M" (missing) or null
        out[row["valid"]] = int(high)
    return out


def cache_path(cache_dir: str, station: str, year: int) -> str:
    return os.path.join(cache_dir, f"cli_{station}_{year}.json")


def write_cache(path: str, payload: dict) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(payload, f)


def read_cache(path: str):
    with open(path) as f:
        return json.load(f)


def fetch_cli(station: str, year: int) -> dict:
    return http.get_json(IEM_URL, {"station": station, "year": year})


def highs_for_station(station: str, year: int, cache_dir: str,
                      max_age_s: float = 6 * 3600) -> dict:
    """CLI highs {date: F} with a file cache; falls back to stale cache on
    fetch failure rather than fabricating anything."""
    path = cache_path(cache_dir, station, year)
    fresh = os.path.exists(path) and (time.time() - os.path.getmtime(path)) < max_age_s
    if fresh:
        return parse_cli(read_cache(path))
    try:
        payload = fetch_cli(station, year)
        write_cache(path, payload)
        return parse_cli(payload)
    except http.HttpError:
        if os.path.exists(path):
            return parse_cli(read_cache(path))
        raise
