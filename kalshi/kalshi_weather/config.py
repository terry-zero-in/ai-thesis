"""Configuration: station registry and tunables.

Terry-pinned parameters (2026-08-17 scope) are marked PINNED — do not tune
them without a ruling. Everything else is an engineering default.
"""
import os
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Station:
    series_ticker: str
    cli_code: str      # code that appears in rules_primary as (CLI<code>)
    iem_station: str   # Iowa Mesonet station id for the NWS CLI product
    name: str
    lat: float
    lon: float
    tz: str            # IANA timezone of the settlement calendar day


# Seed registry for the core US KXHIGH series. The cli_code is cross-checked
# at runtime against each contract's own rules_primary text ("(CLINYC)" etc.);
# on mismatch the series is skipped and queued for review, so a wrong entry
# here fails safe. Coordinates are airport/park coords; the ensemble grid is
# 0.25 deg (~25 km) so small offsets are immaterial.
STATIONS: dict[str, Station] = {s.series_ticker: s for s in [
    Station("KXHIGHNY",   "NYC", "KNYC", "NYC Central Park",   40.783,  -73.967, "America/New_York"),
    Station("KXHIGHCHI",  "MDW", "KMDW", "Chicago Midway",     41.786,  -87.752, "America/Chicago"),
    Station("KXHIGHAUS",  "AUS", "KAUS", "Austin Bergstrom",   30.183,  -97.680, "America/Chicago"),
    Station("KXHIGHDEN",  "DEN", "KDEN", "Denver Intl",        39.847, -104.656, "America/Denver"),
    Station("KXHIGHLAX",  "LAX", "KLAX", "Los Angeles Intl",   33.938, -118.389, "America/Los_Angeles"),
    Station("KXHIGHMIA",  "MIA", "KMIA", "Miami Intl",         25.788,  -80.317, "America/New_York"),
    Station("KXHIGHPHIL", "PHL", "KPHL", "Philadelphia Intl",  39.868,  -75.231, "America/New_York"),
]}


def _default_data_dir() -> str:
    env = os.environ.get("KALSHI_DATA_DIR")
    if env:
        return env
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


@dataclass
class Config:
    # Fee rates live in fees.py (single source; PINNED formula + provenance there).

    # --- sizing (PINNED) ---
    kelly_mult: float = 0.25         # PINNED: quarter-Kelly
    market_cap_cents: int = 10_000   # PINNED: $100 per market
    bankroll_cents: int = int(os.environ.get("KALSHI_PAPER_BANKROLL_CENTS", "100000"))  # $1k paper default

    # --- quoting ---
    min_edge_cents: float = 3.0      # net-of-fee edge required to post
    max_quote_price_cents: int = 40  # tail-price preference band (maker side)
    min_quote_price_cents: int = 2
    improve_spread_cents: int = 3    # improve best bid by 1c only if spread >= this
    agreement_max: float = 0.10      # max |P_gefs - P_ecmwf| to quote
    min_members: int = 60            # of 82 (31 GEFS + 51 ECMWF)
    quote_leads: tuple = (0, 1)      # days ahead we price/quote
    lead0_cutoff_hour_local: int = 12  # stop QUOTING same-day markets after local
                                       # noon: the market sees the running observed
                                       # high, a pure-forecast model does not
                                       # (adverse selection). Pricing/logging
                                       # continues all day.

    # --- bias/bandwidth priors (uncalibrated fallback) ---
    uncal_bw_base: float = 3.0       # deg F kernel bandwidth at lead 0, uncalibrated
    bw_lead_growth: float = 0.8      # deg F per day of lead
    min_bw: float = 1.0
    min_cal_n: int = 8               # pairs needed before a fit is trusted

    # --- rules scanner ---
    divergence_flag_pts: float = 5.0  # PINNED: flag rule/headline divergence > 5pts

    # --- regime filter ---
    regime_stale_hours: float = 6.0
    block_states: tuple = ("stress", "panic")

    # --- calibration gate (PINNED: 30-day paper Brier must beat market) ---
    gate_window_days: int = 30
    gate_min_settled: int = 20

    data_dir: str = field(default_factory=_default_data_dir)

    @property
    def ledger_path(self) -> str:
        return os.path.join(self.data_dir, "ledger.db")

    @property
    def bias_path(self) -> str:
        return os.path.join(self.data_dir, "bias.json")

    @property
    def regime_path(self) -> str:
        return os.path.join(self.data_dir, "regime.json")

    @property
    def cache_dir(self) -> str:
        return os.path.join(self.data_dir, "cache")

    @property
    def stations(self) -> dict[str, Station]:
        return STATIONS
