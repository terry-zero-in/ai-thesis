-- Rollback for 20260515001100_e21_q_scores_cron.sql.
-- Removes the weekly Q-score cron entry. Idempotent.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron' AND installed_version IS NOT NULL) THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-q-scores-weekly';
  END IF;
END $$;

COMMIT;
