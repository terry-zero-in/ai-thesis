BEGIN;
DELETE FROM public.depreciation_flags
  WHERE flagged_at = DATE '2026-05-17'
    AND ticker IN ('ORCL', 'MSFT', 'GOOGL', 'AMZN');
COMMIT;
