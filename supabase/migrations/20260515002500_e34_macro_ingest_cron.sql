-- THS-49 (E3.4) — Daily macro gauges ingest cron.
--
-- Runs every day at 21:45 UTC: after prices (21:00) and consensus (21:30)
-- so the macro snapshot is current by the time the Saturday composite job
-- (22:45) reads it. Pulls NAAIM (weekly Wednesday reading via page scrape)
-- and CNN Fear & Greed (daily JSON) live; AAII spread is operator-curated
-- and forward-fills from the previous macro_gauges row.

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

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-macro-daily';

  PERFORM cron.schedule(
    'ingest-macro-daily',
    '45 21 * * *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/ingest-macro',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 60000
      );
    $cron$
  );
END $$;

COMMIT;
