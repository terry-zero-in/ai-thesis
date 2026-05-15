-- Rollback for 20260515000800_e16_prices_cron.sql (THS-40 part 4).

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-prices-daily';
  END IF;
END $$;

COMMIT;
