-- THS-37 follow-up: reclassify ANET from L3 App to L1 Compute.
-- Reason: Arista Networks makes high-performance Ethernet switches for
-- hyperscale data centers (Meta + Microsoft are ~35-40% of revenue).
-- It's network hardware, not a software app. The spec's deployment-slate
-- table (docs/AI-Thesis-v2-Algorithm-and-Deployment.md lines 208/211)
-- classifies ANET as L1; the ticket body listing it under L3 was a typo.

BEGIN;

UPDATE public.universe
SET layer = 1, layer_label = 'Compute'
WHERE ticker = 'ANET';

-- Confirm the update landed.
DO $$
DECLARE r record;
BEGIN
  SELECT * INTO r FROM public.universe WHERE ticker = 'ANET';
  IF r.layer <> 1 OR r.layer_label <> 'Compute' THEN
    RAISE EXCEPTION 'ANET reclassification failed: layer=% label=%', r.layer, r.layer_label;
  END IF;
END $$;

COMMIT;
