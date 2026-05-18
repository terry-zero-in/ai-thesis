-- THS-45-followup — Weekly AIQ-score denormalization job.
-- Saturday 22:35 UTC, slotted between V (22:30) and M (22:40) so all
-- per-factor jobs land before composite at 22:45.
--
-- AIQ is the only per-factor job that doesn't compute from market data;
-- it denormalizes the latest aiq_rubric row into scores_history.aiq_score
-- + factor_breakdown.aiq so per-factor UI surfaces have data even though
-- composite reads aiq_rubric directly.

BEGIN;

DO $$
DECLARE
  has_pg_cron boolean;
  has_pg_net  boolean;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') INTO has_pg_cron;
  SELECT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net')  INTO has_pg_net;

  IF NOT has_pg_cron OR NOT has_pg_net THEN
    RAISE NOTICE 'pg_cron or pg_net not available — skipping cron schedule. Apply this migration in Supabase to take effect.';
    RETURN;
  END IF;

  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-aiq-scores-weekly';

  PERFORM cron.schedule(
    'compute-aiq-scores-weekly',
    '35 22 * * 6',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/compute-aiq-scores',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 90000
      );
    $cron$
  );
END $$;

COMMIT;
