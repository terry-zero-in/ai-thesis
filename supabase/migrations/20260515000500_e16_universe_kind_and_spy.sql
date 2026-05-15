-- THS-40 (E1.6) — Add `kind` column to universe so we can mix investable
-- names with benchmark tickers (SPY) under one FK target for prices_raw,
-- while keeping the fundamentals/consensus ingestion focused on investables.

BEGIN;

-- 1. Add the discriminator column.
ALTER TABLE public.universe
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'investable'
  CHECK (kind IN ('investable', 'benchmark'));

-- 2. Loosen the layer check so benchmark rows can use layer=0.
ALTER TABLE public.universe DROP CONSTRAINT IF EXISTS universe_layer_check;
ALTER TABLE public.universe
  ADD CONSTRAINT universe_layer_check CHECK (layer BETWEEN 0 AND 5);

-- 3. Index by kind for the common "active investables" query.
CREATE INDEX IF NOT EXISTS universe_kind_active_idx
  ON public.universe (kind) WHERE is_active;

-- 4. Seed SPY benchmark.
INSERT INTO public.universe (ticker, name, layer, layer_label, kind) VALUES
  ('SPY', 'SPDR S&P 500 ETF Trust', 0, 'Benchmark', 'benchmark')
ON CONFLICT (ticker) DO UPDATE SET
  name        = EXCLUDED.name,
  layer       = EXCLUDED.layer,
  layer_label = EXCLUDED.layer_label,
  kind        = EXCLUDED.kind;

COMMIT;
