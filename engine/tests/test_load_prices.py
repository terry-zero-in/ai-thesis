# engine/tests/test_load_prices.py
"""Pure-mapper tests for the price loader (no network)."""
import hp1_db
from load_prices import _map_fmp_rows


def test_map_fmp_stable_array_shape():
    raw = [
        {"date": "2026-06-16", "open": 100.0, "high": 105.0, "low": 99.0,
         "close": 104.0, "adjClose": 103.5, "volume": 1234567},
        {"date": "2026-06-15", "open": 98.0, "high": 101.0, "low": 97.5,
         "close": 100.0, "adjClose": 99.6, "volume": 2000000},
    ]
    rows = _map_fmp_rows("NVDA", raw)
    assert len(rows) == 2
    assert set(rows[0]) == set(hp1_db.PRICE_COLS)
    r = rows[0]
    assert r["ticker"] == "NVDA"
    assert r["date"] == "2026-06-16"
    assert r["adj_close"] == 103.5  # prefers adjClose
    assert r["volume"] == 1234567


def test_map_fmp_legacy_historical_wrapper():
    raw = {"symbol": "AAPL", "historical": [
        {"date": "2026-06-16T00:00:00", "close": 210.0, "volume": 5}]}
    rows = _map_fmp_rows("AAPL", raw)
    assert len(rows) == 1
    assert rows[0]["date"] == "2026-06-16"  # trimmed to date
    assert rows[0]["adj_close"] == 210.0    # falls back to close when adjClose absent


def test_map_fmp_handles_missing_and_nulls():
    raw = [
        {"open": 1.0},  # no date -> skipped
        {"date": "2026-06-16", "close": None, "adjClose": None, "volume": None},
    ]
    rows = _map_fmp_rows("X", raw)
    assert len(rows) == 1
    assert rows[0]["close"] is None and rows[0]["adj_close"] is None
    assert rows[0]["volume"] is None
