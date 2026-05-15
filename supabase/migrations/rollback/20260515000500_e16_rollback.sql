-- Rollback for 20260515000500_e16_universe_kind_and_spy.sql (THS-40 part 1).

BEGIN;

DELETE FROM public.universe WHERE kind = 'benchmark';

ALTER TABLE public.universe DROP CONSTRAINT IF EXISTS universe_layer_check;
ALTER TABLE public.universe
  ADD CONSTRAINT universe_layer_check CHECK (layer BETWEEN 1 AND 5);

DROP INDEX IF EXISTS public.universe_kind_active_idx;

ALTER TABLE public.universe DROP COLUMN IF EXISTS kind;

COMMIT;
