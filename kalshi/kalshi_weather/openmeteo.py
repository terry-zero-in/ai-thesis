"""Open-Meteo ensemble client: GFS (GEFS, 31 members) + ECMWF IFS (51 members).

Wire facts verified live 2026-08-17: one merged response object; member
series keyed like temperature_2m_member07_ncep_gefs025 and
temperature_2m_member31_ecmwf_ifs025_ensemble, with the control member
carrying no memberNN token. Times arrive in the requested (station-local)
timezone, so calendar-day bucketing is a string prefix match.
"""
from typing import NamedTuple

from . import http, pricing

ENSEMBLE_URL = "https://ensemble-api.open-meteo.com/v1/ensemble"
MODELS_PARAM = "gfs025,ecmwf_ifs025"


class Member(NamedTuple):
    model: str   # "gefs" | "ecmwf"
    label: str   # raw response key
    temps: list


def fetch(lat: float, lon: float, tz: str, forecast_days: int = 3, past_days: int = 0) -> dict:
    return http.get_json(ENSEMBLE_URL, {
        "latitude": round(lat, 4), "longitude": round(lon, 4),
        "hourly": "temperature_2m", "models": MODELS_PARAM,
        "temperature_unit": "fahrenheit", "timezone": tz,
        "forecast_days": forecast_days, "past_days": past_days,
    })


def parse_members(raw: dict):
    hourly = raw.get("hourly", {})
    times = hourly.get("time", [])
    members = []
    for key, series in hourly.items():
        if key == "time":
            continue
        if "gefs" in key:
            model = "gefs"
        elif "ifs" in key:
            model = "ecmwf"
        else:
            continue
        members.append(Member(model, key, series))
    return times, members


def member_daily_max(times: list, temps: list, date_str: str):
    return pricing.daily_max_from_hourly(times, temps, date_str)


def daily_maxes_by_model(times: list, members: list, date_str: str) -> dict:
    out: dict = {}
    for m in members:
        v = member_daily_max(times, m.temps, date_str)
        if v is not None:
            out.setdefault(m.model, []).append(v)
    return out


def ens_stats(maxes: list):
    import statistics
    mean = statistics.fmean(maxes)
    spread = statistics.stdev(maxes) if len(maxes) >= 2 else 0.0
    return mean, spread
