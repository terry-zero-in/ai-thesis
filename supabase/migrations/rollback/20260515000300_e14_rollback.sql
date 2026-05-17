-- Rollback for 20260515000300_e14_fundamentals_cron.sql (THS-38).

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-fundamentals-daily';
  END IF;
END $$;

COMMIT;
