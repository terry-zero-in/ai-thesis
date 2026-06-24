"""HP-1 Lane C — Fable review citation validator (the orchestrator's mechanical
post-output gate, FABLE_REVIEW_RUBRIC_v1.md §5/§6/§50; red-team Finding 18).

Deterministic, pure (stdlib only — no pandas/network). The Fable pass is an LLM
skeptic that may CONFIRM / FLAG / DOWNGRADE / UPGRADE / VETO each engine-ranked
name. The rubric's law: "no citation, no effect." Every SCORE-MOVING verdict
(DOWNGRADE/UPGRADE/VETO) must trace to dated {source,date,url} citations in its
evidence array, in the counts the rubric requires; an adjustment that does not
MUST be demoted to FLAG (validation_failed). A "leak" is a score-moving verdict
that ships WITHOUT satisfying its citation requirement (i.e. an uncited
adjustment that was not demoted). Lane C drives the leak rate -> 0.

This validator enforces the OFFLINE, structural half of §50: citation
count/shape/date + the L-confidence magnitude cap. The ONLINE half (server-side
fetch of each URL — "the page must resolve and contain the claimed entity") is
the lane's live extension and is not done here. "Zero UNHANDLED failures": the
validator never throws on a well-typed review; every violation is returned as a
structured leak, and `unhandled` counts rows it could not classify (must be 0).
"""
from __future__ import annotations
import re
from dataclasses import dataclass, field

SCORE_MOVING = {"DOWNGRADE", "UPGRADE", "VETO"}
VALID_VERDICTS = {"CONFIRM", "FLAG", "DOWNGRADE", "UPGRADE", "VETO"}
# Minimum well-formed dated citations the rubric requires per verdict.
MIN_CITATIONS = {"DOWNGRADE": 1, "UPGRADE": 2, "VETO": 1}
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


@dataclass
class CitationLeak:
    ticker: str
    verdict: str
    reason: str
    demote_to: str = "FLAG"  # the rubric's required correction


@dataclass
class FableAudit:
    total_rows: int = 0
    score_moving_rows: int = 0
    leaks: list = field(default_factory=list)
    unhandled: int = 0

    @property
    def leak_rate(self) -> float:
        # leak rate over score-moving rows (the rows the citation rule governs).
        return 0.0 if self.score_moving_rows == 0 else len(self.leaks) / self.score_moving_rows

    def as_dict(self) -> dict:
        return {
            "total_rows": self.total_rows,
            "score_moving_rows": self.score_moving_rows,
            "leaks": [
                {"ticker": l.ticker, "verdict": l.verdict, "reason": l.reason, "demote_to": l.demote_to}
                for l in self.leaks
            ],
            "leak_rate": self.leak_rate,
            "unhandled": self.unhandled,
        }


def _well_formed_citation(c) -> bool:
    """A citation is admissible only if it carries a non-empty source, a
    parseable YYYY-MM-DD date, and a non-empty url (rubric §6)."""
    if not isinstance(c, dict):
        return False
    src = str(c.get("source", "")).strip()
    url = str(c.get("url", "")).strip()
    date = str(c.get("date", "")).strip()
    return bool(src) and bool(url) and bool(DATE_RE.match(date))


def validate_fable_review(rows) -> FableAudit:
    """Validate a Fable review (iterable of per-name dict rows) against the
    rubric's evidence protocol. Returns a FableAudit; never raises on a list of
    dicts. Each row: {ticker, verdict, adjustment_pct, confidence, evidence:[...]}.
    """
    audit = FableAudit()
    if rows is None:
        return audit
    try:
        rows = list(rows)
    except TypeError:
        return audit

    for row in rows:
        audit.total_rows += 1
        if not isinstance(row, dict):
            audit.unhandled += 1
            continue
        verdict = str(row.get("verdict", "")).strip().upper()
        ticker = str(row.get("ticker", "?"))
        if verdict not in VALID_VERDICTS:
            audit.unhandled += 1
            continue

        try:
            adj = float(row.get("adjustment_pct", 0) or 0)
        except (TypeError, ValueError):
            adj = 0.0
        conf = str(row.get("confidence", "")).strip().upper()
        ev = row.get("evidence", []) or []
        if not isinstance(ev, list):
            ev = []
        good = [c for c in ev if _well_formed_citation(c)]

        # L-confidence magnitude cap (rubric §6: L-confidence cannot exceed -5).
        if conf == "L" and adj < -5:
            audit.score_moving_rows += 1
            audit.leaks.append(CitationLeak(
                ticker, verdict,
                f"L-confidence finding exceeds the -5 magnitude cap (adj={adj})"))
            continue

        if verdict not in SCORE_MOVING:
            # CONFIRM / FLAG carry 0 score effect — no citation leak possible.
            continue

        audit.score_moving_rows += 1
        need = MIN_CITATIONS[verdict]
        if len(good) < need:
            audit.leaks.append(CitationLeak(
                ticker, verdict,
                f"{verdict} requires >={need} well-formed dated citation(s); "
                f"found {len(good)} of {len(ev)} (uncited adjustment must demote to FLAG)"))
    return audit
