-- THS-69 (E3.5) — VIX daily ingestion.
--
-- Loosen `universe.kind` to include 'macro' for non-equity reference
-- series (VIX, treasury yields if we add them later) and seed `^VIX`
-- so the daily prices ingest picks it up. `prices_raw` already
-- references `universe.ticker`; the `^VIX` row makes that FK satisfied
-- once price rows start flowing.
--
-- FMP exposes the symbol as `^VIX`. We keep that exact spelling as the
-- universe.ticker so the ingest path can pass it straight through to
-- the FMP API without a translation table. Investable / benchmark
-- queries filter by kind so the caret never reaches the scoring jobs
-- or the portal UI.

BEGIN;

-- Loosen the kind check to add 'macro'.
ALTER TABLE public.universe DROP CONSTRAINT IF EXISTS universe_kind_check;
ALTER TABLE public.universe
  ADD CONSTRAINT universe_kind_check CHECK (kind IN ('investable', 'benchmark', 'macro'));

-- Seed ^VIX.
INSERT INTO public.universe (ticker, name, layer, layer_label, kind) VALUES
  ('^VIX', 'CBOE Volatility Index', 0, 'Macro', 'macro')
ON CONFLICT (ticker) DO UPDATE SET
  name        = EXCLUDED.name,
  layer       = EXCLUDED.layer,
  layer_label = EXCLUDED.layer_label,
  kind        = EXCLUDED.kind;

COMMIT;
