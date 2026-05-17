BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron' AND installed_version IS NOT NULL) THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-v-scores-weekly';
  END IF;
END $$;
COMMIT;
