-- THS-66 — Opus weekly ranking cron.
--
-- Sunday 23:00 UTC = 6pm CDT / 5pm CST. Lands after Saturday's full
-- scoring chain (Q 22:00 ... composite 22:45) so the Opus job has the
-- fresh weekly scores to rank. Reads `concentration_history` for tax
-- + mean_corr signals, derives insider clusters on read via the
-- THS-61 helper.

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

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-weekly-ranking';

  PERFORM cron.schedule(
    'compute-weekly-ranking',
    '0 23 * * 0',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/compute-weekly-ranking',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 300000
      );
    $cron$
  );
END $$;

COMMIT;
