-- THS-43 (E2.3) — Seed depreciation_flags from the two names the spec
-- cites with explicit disclosures + Burry-overstatement estimates.
-- Algorithm spec §Fix 5 (scaled depreciation penalty) + §Part 3 rationale.
--
-- penalty_v is the FINAL applied penalty (extension + Burry, capped at −12
-- per §Fix 5). burry_overstatement_pct is informational.
--
-- Seeding two rows here is the v1 minimum; operator adds the rest of the
-- §Part 3 slate after disclosure validation.

BEGIN;

INSERT INTO public.depreciation_flags
  (ticker, flagged_at, extension_years, penalty_v, burry_overstatement_pct, source_url)
VALUES
  (
    'META',
    DATE '2026-04-29',
    1.5, -- non-AI servers 6→7 yr + AI servers 4→5.5 yr; two extensions in 12 months
    -12, -- spec §Fix 5: >1.5 yr ext (−10) + Burry 20.8% (−3) = −13 → capped at −12
    20.8,
    'https://www.wsj.com/tech/meta-will-run-some-servers-longer-in-response-to-memory-shortage-9bb75737'
  ),
  (
    'ORCL',
    DATE '2025-11-11',
    NULL, -- extension cited in spec but exact years not quantified there
    -7,   -- "other named hyperscaler with disclosed extension" (−2) + Burry 26.9% (−5) = −7
    26.9,
    'https://www.cnbc.com/2025/11/11/big-short-investor-michael-burry-accuses-ai-hyperscalers-of-artificially-boosting-earnings.html'
  )
ON CONFLICT (ticker, flagged_at) DO NOTHING;

COMMIT;
