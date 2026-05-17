-- Rollback for 20260515000900_e13_reclassify_anet_l1.sql.
-- Restores ANET to its original ticket-body classification (L3 App).

BEGIN;

UPDATE public.universe
SET layer = 3, layer_label = 'App'
WHERE ticker = 'ANET';

COMMIT;
