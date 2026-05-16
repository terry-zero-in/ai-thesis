-- Rollback for THS-57 alert_acks.
BEGIN;
DROP TABLE IF EXISTS public.alert_acks;
COMMIT;
