-- HP-1 Phase 1 — extend universe.kind to allow 'hp1' and seed the 19
-- HP-1-only tickers as data-only rows.
--
-- Context: HP-1 (the real-money AI-equity trading engine, a separate
-- workstream from AI-Thesis v2) shares this Supabase project read-only for
-- market data. Its 50-name universe overlaps v2's investable 50 on 31 names;
-- the other 19 are not in v2 and must be ingested so HP-1's price/fundamental
-- history exists.
--
-- Mechanism (zero ingest-function duplication): add the 19 as kind='hp1'.
-- `ingest-prices` pulls kind:'all', so these rows are picked up for prices
-- automatically. They are NOT kind='investable', so v2's scored composite
-- (locked at 50) is untouched — no factor scores, no portal scoring.
--
-- layer=0 / layer_label='HP-1' mirrors the ^VIX macro-row convention
-- (migration 20260516001500): non-scored reference rows sit at layer 0.
--
-- The constraint extension MUST precede the insert (caught in PR #19 review):
-- universe_kind_check currently allows only
-- ('investable','benchmark','macro'), so a kind='hp1' insert fails until the
-- constraint is widened. Both happen in one transaction below.
--
-- Idempotent: ON CONFLICT DO UPDATE; safe to re-run.

BEGIN;

-- 1. Widen the kind check to add 'hp1'.
ALTER TABLE public.universe DROP CONSTRAINT IF EXISTS universe_kind_check;
ALTER TABLE public.universe
  ADD CONSTRAINT universe_kind_check
  CHECK (kind IN ('investable', 'benchmark', 'macro', 'hp1'));

-- 2. Seed the 19 HP-1-only tickers as data-only rows.
INSERT INTO public.universe (ticker, name, layer, layer_label, kind) VALUES
  ('AAPL', 'Apple',                     0, 'HP-1', 'hp1'),
  ('ALAB', 'Astera Labs',               0, 'HP-1', 'hp1'),
  ('APLD', 'Applied Digital',           0, 'HP-1', 'hp1'),
  ('APP',  'AppLovin',                  0, 'HP-1', 'hp1'),
  ('CLS',  'Celestica',                 0, 'HP-1', 'hp1'),
  ('COHR', 'Coherent',                  0, 'HP-1', 'hp1'),
  ('CRDO', 'Credo Technology',          0, 'HP-1', 'hp1'),
  ('CRWV', 'CoreWeave',                 0, 'HP-1', 'hp1'),
  ('DELL', 'Dell Technologies',         0, 'HP-1', 'hp1'),
  ('FN',   'Fabrinet',                  0, 'HP-1', 'hp1'),
  ('IREN', 'IREN Limited',              0, 'HP-1', 'hp1'),
  ('MPWR', 'Monolithic Power Systems',  0, 'HP-1', 'hp1'),
  ('NBIS', 'Nebius Group',              0, 'HP-1', 'hp1'),
  ('PANW', 'Palo Alto Networks',        0, 'HP-1', 'hp1'),
  ('RDDT', 'Reddit',                    0, 'HP-1', 'hp1'),
  ('SMCI', 'Super Micro Computer',      0, 'HP-1', 'hp1'),
  ('TEM',  'Tempus AI',                 0, 'HP-1', 'hp1'),
  ('TER',  'Teradyne',                  0, 'HP-1', 'hp1'),
  ('TSLA', 'Tesla',                     0, 'HP-1', 'hp1')
ON CONFLICT (ticker) DO UPDATE SET
  name        = EXCLUDED.name,
  layer       = EXCLUDED.layer,
  layer_label = EXCLUDED.layer_label,
  kind        = EXCLUDED.kind;

-- Sanity: exactly the 19 HP-1 rows present after this migration.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.universe WHERE kind = 'hp1';
  IF n <> 19 THEN
    RAISE EXCEPTION 'hp1 universe seed expected 19 rows, found %', n;
  END IF;
END $$;

COMMIT;
