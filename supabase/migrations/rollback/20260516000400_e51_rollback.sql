-- Rollback for THS-58 compute-m-scores cron.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-m-scores-weekly';
  END IF;
END $$;
COMMIT;
