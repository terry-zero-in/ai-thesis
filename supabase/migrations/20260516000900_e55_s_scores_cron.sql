-- THS-62 (E5.5) — Weekly S-score compute job. Saturday 22:42 UTC,
-- slotted between M (22:40) and composite (22:45) so the composite
-- cron picks up s_score in the same run.
-- Final lineup: Q 22:00 · G 22:15 · V 22:30 · M 22:40 · S 22:42 · composite 22:45.

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

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-s-scores-weekly';

  PERFORM cron.schedule(
    'compute-s-scores-weekly',
    '42 22 * * 6',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/compute-s-scores',
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
