-- THS-48 (E2.4) — Extend depreciation_flags seed with the rest of the spec
-- band, per Terry's 2026-05-17 quarterly review.
--
-- This migration adds 4 new rows and supersedes the prior ORCL row. The
-- factor reader (supabase.ts::loadCompositeInputs) picks the LATEST
-- flagged_at per ticker, so an insert with today's date is the canonical
-- "current view" — the old ORCL row stays for audit.
--
-- Source verification (per Terry's rule: "Confirm the band reads against
-- actual filing language before committing"):
--
--   ORCL  FY25 10-K (filed 2025-06-18):
--     "...increased the estimate of the useful lives from five years to
--     six years, effective at the beginning of fiscal 2025."
--     → +1.0y extension. Per spec §Fix 5 the boundary case (0.5–1.0 → −5,
--     1.0–1.5 → −7) is operator-resolved at −5 + Burry −5 = −10.
--
--   MSFT  FY25 10-K (filed 2025-07-30): policy note states "computer
--     equipment, two to six years". The 6→6.5 extension Terry references
--     was in FY24 10-K (not re-pulled here). Operator-confirmed at −3 per
--     spec band "≤ 0.5y". Flagged for re-verification in next quarterly
--     review.
--
--   GOOGL FY25 10-K (filed 2026-02-05): "We depreciate servers and network
--     equipment generally over a period of six years." Change from 4→6 in
--     2023 is outside the spec's strict 24-month window, but operator
--     elected to apply the penalty regardless ("Universe is for ranking,
--     not filtering" — accounting risk that existed is not erased by the
--     calendar). Penalty −10 per ">1.5y" band.
--
--   AMZN  FY25 10-K (filed 2026-02-06): documents BOTH the 2024 extension
--     (5→6) AND the 2025 reversal (6→5). Operator elected to apply the
--     1.0y penalty regardless of subsequent reversal — same rationale as
--     GOOGL (the GAAP benefit was realized in 2024). Penalty −7 per spec
--     band "1.0–1.5y" (operator's boundary call; same delta as ORCL
--     resolved differently — asymmetry is intentional).
--
--   META  unchanged. FY25 10-K (filed 2026-01-29) confirms one change to
--     5.5y effective Jan 2025. Existing row at −12 (capped) stands; the
--     larger "5→7y range" Terry referenced is treated as an aggregate
--     view (two extensions in 12 months) and not re-litigated here.

BEGIN;

INSERT INTO public.depreciation_flags
  (ticker, flagged_at, extension_years, penalty_v, burry_overstatement_pct, source_url)
VALUES
  (
    'ORCL',
    DATE '2026-05-17',
    1.0, -- 5→6 years per FY25 10-K
    -10, -- spec band 0.5–1.0 → −5; Burry 26.9% → −5; total −10
    26.9,
    'https://www.sec.gov/Archives/edgar/data/1341439/000095017025087926/orcl-20250531.htm'
  ),
  (
    'MSFT',
    DATE '2026-05-17',
    0.5, -- 6→6.5 years per FY24 10-K (operator-cited; not in FY25 excerpt)
    -3,  -- spec band ≤ 0.5y → −3; no Burry overstatement
    NULL,
    'https://www.sec.gov/Archives/edgar/data/789019/000095017025100235/msft-20250630.htm'
  ),
  (
    'GOOGL',
    DATE '2026-05-17',
    2.0, -- 4→6 years in 2023 per operator; FY25 10-K confirms current 6y policy
    -10, -- spec band >1.5y → −10; no Burry overstatement
    NULL,
    'https://www.sec.gov/Archives/edgar/data/1652044/000165204426000018/goog-20251231.htm'
  ),
  (
    'AMZN',
    DATE '2026-05-17',
    1.0, -- 5→6 in Jan 2024, then 6→5 in Jan 2025 — operator applies 1.0y penalty regardless
    -7,  -- spec band 1.0–1.5y → −7 (operator's boundary call); no Burry overstatement
    NULL,
    'https://www.sec.gov/Archives/edgar/data/1018724/000101872426000004/amzn-20251231.htm'
  )
ON CONFLICT (ticker, flagged_at) DO UPDATE SET
  extension_years         = EXCLUDED.extension_years,
  penalty_v               = EXCLUDED.penalty_v,
  burry_overstatement_pct = EXCLUDED.burry_overstatement_pct,
  source_url              = EXCLUDED.source_url;

-- Assert each new row landed with the expected penalty (catches typos /
-- accidental overwrites in re-runs).
DO $$
DECLARE
  expected jsonb := jsonb_build_object(
    'ORCL', -10, 'MSFT', -3, 'GOOGL', -10, 'AMZN', -7
  );
  k text;
  observed int;
BEGIN
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    SELECT penalty_v INTO observed
      FROM public.depreciation_flags
      WHERE ticker = k AND flagged_at = DATE '2026-05-17';
    IF observed IS NULL THEN
      RAISE EXCEPTION 'depreciation_flags row missing for ticker=%', k;
    END IF;
    IF observed <> (expected ->> k)::int THEN
      RAISE EXCEPTION 'depreciation_flags penalty mismatch for ticker=%: expected %, got %',
        k, expected ->> k, observed;
    END IF;
  END LOOP;
END $$;

COMMIT;
