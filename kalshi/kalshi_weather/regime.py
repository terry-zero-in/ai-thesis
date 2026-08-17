"""Regime quote/pull filter.

Consumes a JSON export {"state": str, "asof": ISO-8601} that a Lead-Lag
Radar session may write to data/regime.json. Per the 2026-08-17 scope the
classifier is a QUOTE/PULL filter only — never a directional signal.

Wiring status: the leadlag-radar repo (separate, local-only) does not export
this file yet; until a session in THAT repo adds the export, this filter is
permissive and every quote records regime="unknown". This module must not
reach into leadlag-radar internals — file-drop interface only.
"""
import datetime
import json
import os

DEFAULT_STALE_HOURS = 6.0
DEFAULT_BLOCK_STATES = ("stress", "panic")


def allow_quotes(path: str, now: datetime.datetime | None = None,
                 stale_hours: float = DEFAULT_STALE_HOURS,
                 block_states: tuple = DEFAULT_BLOCK_STATES):
    now = now or datetime.datetime.now(datetime.timezone.utc)
    if not os.path.exists(path):
        return True, f"regime=unknown (no export at {path}; leadlag-radar wiring pending)"
    try:
        with open(path) as f:
            payload = json.load(f)
        state = str(payload["state"])
        asof = datetime.datetime.fromisoformat(payload["asof"])
        if asof.tzinfo is None:
            asof = asof.replace(tzinfo=datetime.timezone.utc)
    except (OSError, KeyError, ValueError, json.JSONDecodeError):
        return True, "regime=unreadable (malformed export; permissive)"
    age_h = (now - asof).total_seconds() / 3600.0
    if age_h > stale_hours:
        return True, f"regime=stale({state}, {age_h:.1f}h old; permissive)"
    if state in block_states:
        return False, f"regime={state} (fresh export; quotes blocked)"
    return True, f"regime={state}"
