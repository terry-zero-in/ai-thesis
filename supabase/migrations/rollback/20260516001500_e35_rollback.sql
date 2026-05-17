BEGIN;
DELETE FROM public.universe WHERE ticker = '^VIX';
ALTER TABLE public.universe DROP CONSTRAINT IF EXISTS universe_kind_check;
ALTER TABLE public.universe
  ADD CONSTRAINT universe_kind_check CHECK (kind IN ('investable', 'benchmark'));
COMMIT;
