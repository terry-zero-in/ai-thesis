-- Rollback for 20260515000000_e11_init_core_tables.sql (THS-35).
-- Run manually via `psql $DATABASE_URL -f <this file>` to undo the migration.
-- Order: drop children before universe so FK constraints don't block.

BEGIN;

DROP TABLE IF EXISTS public.revisions        CASCADE;
DROP TABLE IF EXISTS public.prices_raw       CASCADE;
DROP TABLE IF EXISTS public.consensus        CASCADE;
DROP TABLE IF EXISTS public.fundamentals_raw CASCADE;
DROP TABLE IF EXISTS public.universe         CASCADE;

COMMIT;
