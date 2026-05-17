-- THS-61 — Daily Form-4 ingestion cron. Mon-Fri 22:50 UTC (after the
-- per-factor scoring chain at 22:00-22:40 and before composite at 22:45,
-- though it doesn't affect this Saturday's composite since it runs
-- weekdays-only). Insider data is largely a back-look signal — the
-- daily cadence keeps it fresh for the next Saturday run.

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

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-form4-daily';

  PERFORM cron.schedule(
    'ingest-form4-daily',
    '50 22 * * 1-5',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/ingest-form4',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 180000
      );
    $cron$
  );
END $$;

COMMIT;
