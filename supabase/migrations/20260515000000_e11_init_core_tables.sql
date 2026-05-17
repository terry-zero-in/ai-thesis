-- THS-35 (E1.1) — Core schema: universe, fundamentals_raw, prices_raw, consensus, revisions
-- Refs: docs/AI-Thesis-v2-Algorithm-and-Deployment.md Part 4 (Supabase schema)
--
-- Conventions:
--   - All PKs explicit; FKs target universe(ticker) with ON DELETE RESTRICT so we
--     can't drop a ticker that still has data attached.
--   - RLS enabled on every table. Anon role gets zero rows (no policy granted).
--     Authenticated role (Terry) has full CRUD. service_role bypasses RLS.
--   - Indexes biased toward "latest snapshot" queries (ticker, date DESC).

BEGIN;

-- ---------------------------------------------------------------------------
-- universe: hand-curated list of 70 names across 5 layers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe (
  ticker        text PRIMARY KEY,
  name          text NOT NULL,
  layer         int  NOT NULL CHECK (layer BETWEEN 1 AND 5),
  layer_label   text NOT NULL,
  is_active     boolean NOT NULL DEFAULT true,
  added_at      timestamptz NOT NULL DEFAULT now(),
  notes         text
);

COMMENT ON TABLE public.universe IS
  'Hand-curated investable universe. 70 names across L1 Compute / L2 Hyperscaler / L3 App / L4 Power / L5 Incumbent.';

CREATE INDEX IF NOT EXISTS universe_layer_idx
  ON public.universe (layer) WHERE is_active;

-- ---------------------------------------------------------------------------
-- fundamentals_raw: FMP fundamentals, one row per ticker per fiscal period
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fundamentals_raw (
  ticker              text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  period_end          date NOT NULL,
  period_type         text NOT NULL CHECK (period_type IN ('Q', 'A')),
  revenue             numeric,
  gross_profit        numeric,
  operating_income    numeric,
  net_income          numeric,
  fcf                 numeric,
  total_assets        numeric,
  total_debt          numeric,
  shareholders_equity numeric,
  capex               numeric,
  shares_diluted      numeric,
  ingested_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, period_end, period_type)
);

COMMENT ON TABLE public.fundamentals_raw IS
  'Quarterly (Q) and annual (A) financial fundamentals from FMP. Idempotent on (ticker, period_end, period_type).';

CREATE INDEX IF NOT EXISTS fundamentals_raw_ticker_period_desc_idx
  ON public.fundamentals_raw (ticker, period_end DESC, period_type);

-- ---------------------------------------------------------------------------
-- consensus: daily snapshot of NTM / FY estimates and analyst ratings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.consensus (
  ticker        text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  as_of         date NOT NULL,
  ntm_revenue   numeric,
  ntm_eps       numeric,
  fy1_eps       numeric,
  fy2_eps       numeric,
  num_analysts  int,
  rating_avg    numeric,        -- 1 strong buy, 5 strong sell
  target_price  numeric,
  PRIMARY KEY (ticker, as_of)
);

COMMENT ON TABLE public.consensus IS
  'Daily consensus snapshot from FMP. rating_avg is 1=strong buy ... 5=strong sell.';

CREATE INDEX IF NOT EXISTS consensus_ticker_asof_desc_idx
  ON public.consensus (ticker, as_of DESC);

-- ---------------------------------------------------------------------------
-- prices_raw: daily OHLCV for momentum + valuation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.prices_raw (
  ticker   text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  date     date NOT NULL,
  open     numeric,
  high     numeric,
  low      numeric,
  close    numeric,
  volume   bigint,
  PRIMARY KEY (ticker, date)
);

COMMENT ON TABLE public.prices_raw IS
  'Daily OHLCV from FMP. Used for 12-1 momentum precompute and own-history valuation z-scores.';

CREATE INDEX IF NOT EXISTS prices_raw_ticker_date_desc_idx
  ON public.prices_raw (ticker, date DESC);

-- ---------------------------------------------------------------------------
-- revisions: derived from day-over-day consensus diffs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.revisions (
  ticker                   text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  as_of                    date NOT NULL,
  fy1_eps_30d_pct_change   numeric,
  fy1_eps_90d_pct_change   numeric,
  upward_breadth_pct       numeric,  -- % of analysts revising up in 30d
  PRIMARY KEY (ticker, as_of)
);

COMMENT ON TABLE public.revisions IS
  'Derived analyst-revision deltas. Computed nightly from consensus diffs (see THS-39).';

CREATE INDEX IF NOT EXISTS revisions_ticker_asof_desc_idx
  ON public.revisions (ticker, as_of DESC);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
-- Strategy: single-tenant app (Terry only). Enable RLS on every table; grant
-- authenticated role full CRUD; grant anon nothing. service_role bypasses RLS
-- automatically and is what edge-function ingestion uses.

ALTER TABLE public.universe         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fundamentals_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consensus        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prices_raw       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revisions        ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners — defense in depth so a misconfigured
-- connection role can't accidentally bypass it. service_role still bypasses.
ALTER TABLE public.universe         FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fundamentals_raw FORCE ROW LEVEL SECURITY;
ALTER TABLE public.consensus        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.prices_raw       FORCE ROW LEVEL SECURITY;
ALTER TABLE public.revisions        FORCE ROW LEVEL SECURITY;

-- Authenticated-only CRUD. auth.uid() is NULL for anon, set for logged-in users.
CREATE POLICY universe_authenticated_all ON public.universe
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY fundamentals_raw_authenticated_all ON public.fundamentals_raw
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY consensus_authenticated_all ON public.consensus
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY prices_raw_authenticated_all ON public.prices_raw
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY revisions_authenticated_all ON public.revisions
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- No anon policies = anon role returns zero rows (matches THS-35 acceptance).

-- ---------------------------------------------------------------------------
-- Privilege grants
-- ---------------------------------------------------------------------------
-- Supabase typically configures default privileges out of the box, but we make
-- them explicit here so the migration is self-contained and any non-Supabase
-- Postgres can apply it cleanly.
--
-- anon gets SELECT but no policy → PostgREST returns an empty array (clean 200
-- with []), which is what the acceptance criteria call for. service_role
-- bypasses RLS for ingestion. authenticated has full CRUD subject to RLS.

GRANT SELECT ON
  public.universe,
  public.fundamentals_raw,
  public.consensus,
  public.prices_raw,
  public.revisions
TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.universe,
  public.fundamentals_raw,
  public.consensus,
  public.prices_raw,
  public.revisions
TO authenticated;

GRANT ALL ON
  public.universe,
  public.fundamentals_raw,
  public.consensus,
  public.prices_raw,
  public.revisions
TO service_role;

COMMIT;
