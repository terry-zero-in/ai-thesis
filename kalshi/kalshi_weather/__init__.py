"""kalshi_weather — paper-mode Kalshi weather-market research system.

Three modules per the 2026-08-17 scope (Terry):
  pricing          Open-Meteo GFS/ECMWF ensembles -> P(threshold) with
                   per-station bias correction vs NWS climatological history
  rules-scanner    rulebook ingestion + LLM extraction + divergence flags
  execution-shadow maker-only paper quotes, quarter-Kelly, $100/market cap,
                   Brier-scored ledger vs market at trade time

PAPER MODE ONLY. There is no live-trading code path in this package and no
flag to enable one; the 30-day calibration gate (gate.py) merely reports
whether the paper record has earned a conversation about building one.
"""

__version__ = "0.1.0"
