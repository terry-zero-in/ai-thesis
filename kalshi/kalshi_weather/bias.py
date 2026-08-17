"""Per-(station, lead) bias correction fitted against NWS climatological history.

EMOS-lite, chosen for a thin-data bootstrap (Open-Meteo's free ensemble
archive only retains perturbed members ~5 days back, verified 2026-08-17):

  bias      = median(actual_high - ensemble_mean_high)       [robust shift]
  resid_std = stdev(actual - (ensemble_mean + bias))         [total error]
  bandwidth = sqrt(max(resid_std^2 - ens_spread^2, min_bw^2))

The kernel bandwidth supplies exactly the predictive variance the raw member
spread fails to explain: averaging kernel mass over members yields total
variance ~ spread^2 + bw^2, matched to observed residual variance. Under-
dispersed ensembles widen; overdispersed ones floor at min_bw.

Self-calibration loop: every cycle logs its forecasts (ledger.forecasts);
every settle joins them to NWS CLI actuals and refits via refit_from_ledger.
The system therefore starts with wide priors (config.uncal_bw_base) and
converges during the 30-day paper window — which is what the window is for.
"""
import json
import os
import statistics

from . import ledger as ledger_mod
from .config import Config

_ALL = "all"  # forecasts row model-tag used for fitting


def fit_pairs(pairs: list) -> dict:
    """pairs: [(ens_mean, ens_spread, actual_high), ...] for one (station, lead)."""
    biases = [a - m for m, _s, a in pairs]
    b = statistics.median(biases)
    resids = [a - (m + b) for m, _s, a in pairs]
    resid_std = statistics.stdev(resids) if len(resids) >= 3 else None
    spread = statistics.fmean(s for _m, s, _a in pairs) if pairs else 0.0
    return {"bias": b, "resid_std": resid_std, "ens_spread": spread, "n": len(pairs)}


class BiasModel:
    def __init__(self, entries: dict):
        self.entries = entries  # {"SERIES|lead": {bias, resid_std, ens_spread, n}}

    @staticmethod
    def _key(station: str, lead: int) -> str:
        return f"{station}|{lead}"

    def _entry(self, station: str, lead: int, cfg: Config | None = None):
        e = self.entries.get(self._key(station, lead))
        min_n = (cfg or Config()).min_cal_n
        if e and e.get("n", 0) >= min_n:
            return e
        return None

    def bias_for(self, station: str, lead: int) -> float:
        e = self._entry(station, lead)
        return e["bias"] if e else 0.0

    def bandwidth_for(self, station: str, lead: int, cfg: Config) -> float:
        e = self._entry(station, lead, cfg)
        if e and e.get("resid_std"):
            var = e["resid_std"] ** 2 - e.get("ens_spread", 0.0) ** 2
            return max(var, cfg.min_bw ** 2) ** 0.5
        return cfg.uncal_bw_base + lead * cfg.bw_lead_growth

    def apply(self, members: list, station: str, lead: int) -> list:
        b = self.bias_for(station, lead)
        return [m + b for m in members]

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w") as f:
            json.dump(self.entries, f, indent=1, sort_keys=True)

    @classmethod
    def load(cls, path: str) -> "BiasModel":
        try:
            with open(path) as f:
                return cls(json.load(f))
        except (OSError, json.JSONDecodeError):
            return cls({})


def refit_from_ledger(conn, path: str, cfg: Config) -> dict:
    """Rebuild the bias model from logged forecasts joined to settlements.

    One calibration pair per (station, target_date, lead): the FIRST forecast
    row of the day for that key. Intraday reruns are near-duplicates, not
    independent samples — counting them would fake calibration depth and
    collapse the bandwidth (ship-gate finding, 2026-08-17). First-of-day is
    also the conservative choice: it carries the largest genuine forecast
    error, so bandwidths stay honest for the morning quotes we actually place.
    """
    rows = conn.execute(
        """SELECT f.station, f.lead, f.ens_mean, f.ens_spread, s.high_f
           FROM forecasts f
           JOIN settlements s ON s.station = f.station AND s.date = f.target_date
           WHERE f.model = ? AND f.id IN (
               SELECT MIN(id) FROM forecasts WHERE model = ?
               GROUP BY station, target_date, lead)""", (_ALL, _ALL)).fetchall()
    grouped: dict = {}
    for station, lead, mean, spread, high in rows:
        grouped.setdefault((station, lead), []).append((mean, spread, float(high)))
    entries = {BiasModel._key(st, ld): fit_pairs(p) for (st, ld), p in grouped.items()}
    model = BiasModel(entries)
    model.save(path)
    ledger_mod.log_event(conn, kind="bias_refit",
                         detail=json.dumps({k: v["n"] for k, v in entries.items()}))
    return {"groups": len(entries), "pairs": sum(v["n"] for v in entries.values())}
