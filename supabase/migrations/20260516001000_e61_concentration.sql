-- THS-63 (E6.1) — Concentration tax: schema + supply-chain seed.
--
-- Two new tables:
--   supply_chain_deps — hand-curated dependency edges
--   concentration_history — per-(ticker, as_of) tax + breakdown
--
-- Supply-chain seed reflects the AI-stack dependencies documented in
-- the algorithm spec: foundry / EUV → compute; compute → hyperscaler;
-- hyperscaler → power; etc. Each edge represents a "depends-on"
-- relationship. Degree (used by the tax) is the count of edges where a
-- ticker appears on either side.

BEGIN;

CREATE TABLE IF NOT EXISTS public.supply_chain_deps (
  dependent_ticker text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  vendor_ticker    text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  edge_weight      numeric NOT NULL DEFAULT 1,  -- 1=normal; >1=tight coupling
  rationale        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (dependent_ticker, vendor_ticker),
  CHECK (dependent_ticker <> vendor_ticker)
);

COMMENT ON TABLE public.supply_chain_deps IS
  'Curated AI-stack dependency edges. Read by the concentration tax job. Edges are directed: dependent_ticker depends on vendor_ticker.';

CREATE INDEX IF NOT EXISTS supply_chain_deps_vendor_idx
  ON public.supply_chain_deps (vendor_ticker);

ALTER TABLE public.supply_chain_deps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supply_chain_deps FORCE ROW LEVEL SECURITY;

CREATE POLICY supply_chain_deps_read ON public.supply_chain_deps
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY supply_chain_deps_write ON public.supply_chain_deps
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.supply_chain_deps TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.supply_chain_deps TO authenticated;
GRANT ALL ON public.supply_chain_deps TO service_role;

-- ---------------------------------------------------------------------------
-- Per-week concentration tax history.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.concentration_history (
  ticker      text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  as_of       date NOT NULL,
  tax         numeric NOT NULL,                  -- in [-15, 0]
  breakdown   jsonb,                             -- signals + ranks
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, as_of)
);

CREATE INDEX IF NOT EXISTS concentration_history_asof_desc_idx
  ON public.concentration_history (as_of DESC);

ALTER TABLE public.concentration_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concentration_history FORCE ROW LEVEL SECURITY;

CREATE POLICY concentration_history_read ON public.concentration_history
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY concentration_history_write ON public.concentration_history
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.concentration_history TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.concentration_history TO authenticated;
GRANT ALL ON public.concentration_history TO service_role;

-- ---------------------------------------------------------------------------
-- Supply-chain seed — AI-stack dependencies per algorithm spec.
-- ---------------------------------------------------------------------------
INSERT INTO public.supply_chain_deps (dependent_ticker, vendor_ticker, edge_weight, rationale) VALUES
  -- Compute layer (L1) depends on foundry + lithography vendors
  ('NVDA', 'TSM',  1, 'GPU fabbed exclusively at TSMC leading-edge'),
  ('AVGO', 'TSM',  1, 'Custom ASIC fabrication'),
  ('AMD',  'TSM',  1, 'CPU + GPU fabrication'),
  ('ARM',  'TSM',  1, 'Indirect — licensees fab at TSMC'),
  ('TSM',  'ASML', 1, 'EUV lithography monopoly'),
  ('TSM',  'AMAT', 1, 'Etch + deposition equipment'),
  ('TSM',  'LRCX', 1, 'Etch equipment'),
  ('TSM',  'KLAC', 1, 'Process control / metrology'),
  -- Hyperscaler layer (L2) depends on GPUs + networking
  ('MSFT',  'NVDA', 1, 'Azure AI infra'),
  ('AMZN',  'NVDA', 1, 'AWS GPU instances + Trainium fallback'),
  ('GOOGL', 'NVDA', 1, 'Cloud + ad-stack GPUs (TPU is partial offset)'),
  ('META',  'NVDA', 1, 'Llama training infra'),
  ('ORCL',  'NVDA', 1, 'OCI GPU offering — OpenAI demand'),
  ('MSFT',  'AVGO', 1, 'Custom networking ASICs'),
  ('META',  'AVGO', 1, 'Custom MTIA + networking ASICs'),
  ('GOOGL', 'AVGO', 1, 'TPU networking'),
  ('ANET',  'NVDA', 1, 'Spectrum-X partner; deep architectural integration'),
  -- AI-native L3 names depend on hyperscaler infrastructure
  ('PLTR',  'AMZN', 1, 'AWS-hosted commercial deployments'),
  ('CRWD',  'AMZN', 1, 'AWS-hosted Falcon platform'),
  ('SNOW',  'AMZN', 1, 'AWS Snowflake region; also Azure/GCP'),
  -- Power L4 names depend on hyperscaler offtake
  ('VST', 'MSFT',  1, 'Datacenter PPA backlog'),
  ('VST', 'AMZN',  1, 'Datacenter PPA backlog'),
  ('CEG', 'MSFT',  2, 'Three Mile Island Unit 1 → Microsoft, 20yr'),
  ('CEG', 'AMZN',  1, 'Talen datacenter campus PPA'),
  ('GEV', 'MSFT',  1, 'Gas turbines + grid for data-center build-out'),
  ('GEV', 'AMZN',  1, 'Gas turbines + grid for data-center build-out'),
  ('GEV', 'GOOGL', 1, 'Gas turbines + grid for data-center build-out')
ON CONFLICT (dependent_ticker, vendor_ticker) DO NOTHING;

COMMIT;
