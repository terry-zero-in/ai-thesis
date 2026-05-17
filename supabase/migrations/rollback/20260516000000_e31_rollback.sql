-- Rollback for 20260516000000_e31_aiq_rubric_seed.sql (THS-46).
-- Deletes only the 18 rows seeded by that migration (scored_at=2026-05-14).

BEGIN;

DELETE FROM public.aiq_rubric
  WHERE scored_at = '2026-05-14'
    AND ticker IN (
      'TSM', 'NVDA', 'AVGO', 'VST', 'GEV', 'GOOGL', 'ANET', 'PLTR', 'ORCL', 'META',
      'CEG', 'VRT', 'MSFT', 'AMZN', 'CRWD', 'SNOW', 'ASML', 'LRCX'
    );

COMMIT;
