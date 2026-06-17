-- Rollback for 20260617000000_hp1_schema.sql
--
-- DESTRUCTIVE: drops the entire hp1 schema and everything in it (10 tables, the
-- positions view, all RLS policies, the seeded anth_state row). CASCADE handles
-- the intra-schema FKs and the view. The public.* schema is untouched (hp1 holds
-- no cross-schema FKs by design).
--
-- Only safe to run before hp1 holds real trade data you care about
-- (hp1.trades is the sole source of truth for positions).

BEGIN;
DROP SCHEMA IF EXISTS hp1 CASCADE;
COMMIT;
