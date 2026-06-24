"""pytest for the HP-1 Lane C Fable citation validator."""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from fable_citations import validate_fable_review  # noqa: E402

CITE = {"claim": "guidance cut", "source": "Reuters", "date": "2026-06-20", "url": "https://r.com/x"}
CITE2 = {"claim": "signed contract", "source": "8-K", "date": "2026-06-21", "url": "https://sec.gov/y"}


def test_clean_review_zero_leaks():
    rows = [
        {"ticker": "NVDA", "verdict": "CONFIRM", "adjustment_pct": 0, "evidence": []},
        {"ticker": "TSM", "verdict": "DOWNGRADE", "adjustment_pct": -10, "confidence": "H", "evidence": [CITE]},
        {"ticker": "VRT", "verdict": "UPGRADE", "adjustment_pct": 5, "confidence": "H", "evidence": [CITE, CITE2]},
        {"ticker": "AMD", "verdict": "FLAG", "adjustment_pct": 0, "evidence": [CITE]},
    ]
    a = validate_fable_review(rows)
    assert a.unhandled == 0
    assert a.leaks == []
    assert a.leak_rate == 0.0
    assert a.score_moving_rows == 2  # the DOWNGRADE + UPGRADE


def test_uncited_downgrade_leaks():
    rows = [{"ticker": "PLTR", "verdict": "DOWNGRADE", "adjustment_pct": -8, "confidence": "H", "evidence": []}]
    a = validate_fable_review(rows)
    assert len(a.leaks) == 1
    assert a.leaks[0].demote_to == "FLAG"
    assert a.leak_rate == 1.0


def test_upgrade_with_one_citation_leaks():
    # UPGRADE needs >=2 independent hard citations.
    rows = [{"ticker": "GEV", "verdict": "UPGRADE", "adjustment_pct": 3, "confidence": "H", "evidence": [CITE]}]
    a = validate_fable_review(rows)
    assert len(a.leaks) == 1
    assert ">=2" in a.leaks[0].reason


def test_veto_uncited_leaks():
    rows = [{"ticker": "SMCI", "verdict": "VETO", "adjustment_pct": 0, "confidence": "H", "evidence": []}]
    a = validate_fable_review(rows)
    assert len(a.leaks) == 1  # VETO is score-moving (name ineligible) and needs a citation


def test_malformed_citation_does_not_count():
    bad = {"claim": "x", "source": "blog", "date": "yesterday", "url": "http://z"}  # bad date
    rows = [{"ticker": "MU", "verdict": "DOWNGRADE", "adjustment_pct": -5, "confidence": "H", "evidence": [bad]}]
    a = validate_fable_review(rows)
    assert len(a.leaks) == 1  # malformed date -> not admissible -> uncited


def test_l_confidence_magnitude_cap():
    rows = [{"ticker": "ARM", "verdict": "DOWNGRADE", "adjustment_pct": -8, "confidence": "L", "evidence": [CITE]}]
    a = validate_fable_review(rows)
    assert len(a.leaks) == 1
    assert "magnitude cap" in a.leaks[0].reason


def test_confirm_needs_no_citation():
    rows = [{"ticker": "AAPL", "verdict": "CONFIRM", "adjustment_pct": 0, "evidence": []}]
    a = validate_fable_review(rows)
    assert a.score_moving_rows == 0
    assert a.leak_rate == 0.0


def test_robust_empty_and_garbage():
    assert validate_fable_review([]).leak_rate == 0.0
    assert validate_fable_review(None).total_rows == 0
    a = validate_fable_review([{"ticker": "X", "verdict": "NONSENSE"}, "notadict", 42])
    assert a.unhandled == 3  # unknown verdict + non-dict + non-dict
    assert a.leaks == []
