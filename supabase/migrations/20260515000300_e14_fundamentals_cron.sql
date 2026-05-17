-- THS-38 (E1.4) — Schedule daily FMP fundamentals ingestion via pg_cron.
--
-- Runtime: Supabase-managed Postgres only. pg_cron and pg_net are Supabase
-- extensions; a vanilla local Postgres won't have them, so this migration
-- skips itself outside Supabase.
--
-- Operator prerequisites (one-time, via Supabase Dashboard or SQL editor):
--   1. Set vault secrets:
--        SELECT vault.create_secret('https://<project>.supabase.co', 'project_url');
--        SELECT vault.create_secret('<service-role-jwt>', 'service_role_key');
--        SELECT vault.create_secret('<random-string>', 'cron_invoke_secret');
--   2. Set the Edge Function secrets (Dashboard -> Edge Functions -> Secrets):
--        FMP_API_KEY            (your FMP API token)
--        CRON_INVOKE_SECRET     (same value as the vault entry above)
--        SUPABASE_URL           (provided automatically)
--        SUPABASE_SERVICE_ROLE_KEY (provided automatically)
--   3. Deploy the function:  supabase functions deploy ingest-fundamentals
--
-- Schedule: 21:15 UTC Mon-Fri ≈ 4:15 PM US/Eastern after market close.

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

  -- Remove any previous schedule with the same name so this migration is idempotent.
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ingest-fundamentals-daily';

  PERFORM cron.schedule(
    'ingest-fundamentals-daily',
    '15 21 * * 1-5',
    $cron$
      SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
               || '/functions/v1/ingest-fundamentals',
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
