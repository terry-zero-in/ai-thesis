-- Rollback for 20260515000400_e15_consensus_cron.sql (THS-39).

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-consensus-daily';
  END IF;
END $$;

COMMIT;
