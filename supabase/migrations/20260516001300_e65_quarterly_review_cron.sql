-- THS-67 — Quarterly review checklist cron.
--
-- Fires on the 5th of Feb / May / Aug / Nov at 23:00 UTC. By that point
-- the bulk of large-cap US earnings have reported for the prior cycle
-- and dep-flag / AIQ updates should be in. February run also fires the
-- annual walk-forward trigger (gated inside the checklist helper).
-- Choosing day-of-month (5th) rather than first-Saturday lets us use
-- a single deterministic cron expression — pg_cron's day-of-month +
-- day-of-week semantics aren't worth contorting around for a 4x/year
-- job.

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

  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'compute-quarterly-review';

  PERFORM cron.schedule(
    'compute-quarterly-review',
    '0 23 5 2,5,8,11 *',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/compute-quarterly-review',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_invoke_secret')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 120000
      );
    $cron$
  );
END $$;

COMMIT;
