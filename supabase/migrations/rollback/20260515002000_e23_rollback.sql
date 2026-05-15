BEGIN;
DELETE FROM public.depreciation_flags
  WHERE (ticker, flagged_at) IN (
    ('META', DATE '2026-04-29'),
    ('ORCL', DATE '2025-11-11')
  );
COMMIT;
