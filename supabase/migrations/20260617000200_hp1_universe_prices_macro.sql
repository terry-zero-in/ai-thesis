-- HP-1 Phase 1 (standalone topology) — the three tables the canonical schema
-- migration (20260617000000) assumed from v2's public.* but the standalone
-- project lacks. Per the 2026-06-16 topology revision (design §2.2): HP-1 owns
-- its own universe + price + macro data; it never reads a v2 public schema.
--
--   hp1.universe      — the fixed 50 (HP1_SPEC_v1.1 §2) + layer + view-category,
--                       plus SPY/QQQ benchmarks and ^VIX (the SPY -5% / VIX>=25
--                       triggers, spec §4/D4, and the QQQ/EW-50 benchmark line §5.4).
--   hp1.prices        — adjusted daily closes; the engine cannot score without these.
--   hp1.macro_gauges  — NAAIM / AAII / F&G for the Regime surface (§5.6).
--
-- Views (spec §2): pure_play = L1+L3+L4, megacap = L2+L5, combined = all. Stored
-- as `category` (each investable is in exactly one of pure_play/megacap; combined
-- is everyone). Engine re-ranks within each view.
--
-- RLS matches the hardened hp1 pattern: authenticated is READ-ONLY; the price +
-- macro loaders write via service_role. Idempotent (IF NOT EXISTS / ON CONFLICT).

BEGIN;

-- ===========================================================================
-- hp1.universe — fixed 50 + benchmarks/macro
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.universe (
  ticker     text PRIMARY KEY,
  name       text NOT NULL,
  layer      text CHECK (layer IS NULL OR layer IN ('L1','L2','L3a','L3b','L4','L5')),
  category   text CHECK (category IS NULL OR category IN ('pure_play','megacap')),
  kind       text NOT NULL DEFAULT 'investable' CHECK (kind IN ('investable','benchmark','macro')),
  is_active  boolean NOT NULL DEFAULT true,
  added_at   timestamptz NOT NULL DEFAULT now(),
  notes      text
);

COMMENT ON TABLE hp1.universe IS
  'HP-1 fixed universe (HP1_SPEC §2): 50 investables across L1-L5 with view-category (pure_play=L1+L3+L4, megacap=L2+L5), plus SPY/QQQ benchmarks and ^VIX macro. Changes only at quarterly review (Terry).';

CREATE INDEX IF NOT EXISTS universe_kind_active_idx ON hp1.universe (kind) WHERE is_active;
CREATE INDEX IF NOT EXISTS universe_category_idx    ON hp1.universe (category) WHERE is_active;

INSERT INTO hp1.universe (ticker, name, layer, category, kind) VALUES
  -- L1 Compute (semis, semicap, EDA, networking/optics, AI hardware) — pure_play
  ('NVDA','Nvidia','L1','pure_play','investable'),
  ('AMD','Advanced Micro Devices','L1','pure_play','investable'),
  ('AVGO','Broadcom','L1','pure_play','investable'),
  ('MRVL','Marvell Technology','L1','pure_play','investable'),
  ('MU','Micron Technology','L1','pure_play','investable'),
  ('TSM','Taiwan Semiconductor','L1','pure_play','investable'),
  ('ASML','ASML Holding','L1','pure_play','investable'),
  ('AMAT','Applied Materials','L1','pure_play','investable'),
  ('LRCX','Lam Research','L1','pure_play','investable'),
  ('KLAC','KLA Corporation','L1','pure_play','investable'),
  ('TER','Teradyne','L1','pure_play','investable'),
  ('ARM','Arm Holdings','L1','pure_play','investable'),
  ('MPWR','Monolithic Power Systems','L1','pure_play','investable'),
  ('ALAB','Astera Labs','L1','pure_play','investable'),
  ('CRDO','Credo Technology','L1','pure_play','investable'),
  ('SMCI','Super Micro Computer','L1','pure_play','investable'),
  ('SNPS','Synopsys','L1','pure_play','investable'),
  ('CDNS','Cadence Design Systems','L1','pure_play','investable'),
  ('ANET','Arista Networks','L1','pure_play','investable'),
  ('CLS','Celestica','L1','pure_play','investable'),
  ('FN','Fabrinet','L1','pure_play','investable'),
  ('COHR','Coherent','L1','pure_play','investable'),
  ('DELL','Dell Technologies','L1','pure_play','investable'),
  -- L2 Hyperscaler — megacap
  ('MSFT','Microsoft','L2','megacap','investable'),
  ('GOOGL','Alphabet','L2','megacap','investable'),
  ('AMZN','Amazon','L2','megacap','investable'),
  ('META','Meta Platforms','L2','megacap','investable'),
  ('ORCL','Oracle','L2','megacap','investable'),
  -- L3a AI-Native software — pure_play
  ('PLTR','Palantir','L3a','pure_play','investable'),
  ('SNOW','Snowflake','L3a','pure_play','investable'),
  ('DDOG','Datadog','L3a','pure_play','investable'),
  ('CRWD','CrowdStrike','L3a','pure_play','investable'),
  ('PANW','Palo Alto Networks','L3a','pure_play','investable'),
  ('APP','AppLovin','L3a','pure_play','investable'),
  ('TEM','Tempus AI','L3a','pure_play','investable'),
  ('RDDT','Reddit','L3a','pure_play','investable'),
  ('NET','Cloudflare','L3a','pure_play','investable'),
  -- L3b Neocloud / AI DC — pure_play
  ('CRWV','CoreWeave','L3b','pure_play','investable'),
  ('NBIS','Nebius Group','L3b','pure_play','investable'),
  ('IREN','IREN Limited','L3b','pure_play','investable'),
  ('APLD','Applied Digital','L3b','pure_play','investable'),
  -- L4 Power & infra — pure_play
  ('VST','Vistra','L4','pure_play','investable'),
  ('CEG','Constellation Energy','L4','pure_play','investable'),
  ('GEV','GE Vernova','L4','pure_play','investable'),
  ('NRG','NRG Energy','L4','pure_play','investable'),
  ('TLN','Talen Energy','L4','pure_play','investable'),
  ('VRT','Vertiv','L4','pure_play','investable'),
  -- L5 Incumbent AI-driver — megacap
  ('AAPL','Apple','L5','megacap','investable'),
  ('TSLA','Tesla','L5','megacap','investable'),
  ('NOW','ServiceNow','L5','megacap','investable'),
  -- Benchmarks + macro (for breadth-relative lines + SPY/VIX triggers)
  ('SPY','SPDR S&P 500 ETF Trust',NULL,NULL,'benchmark'),
  ('QQQ','Invesco QQQ Trust',NULL,NULL,'benchmark'),
  ('^VIX','CBOE Volatility Index',NULL,NULL,'macro')
ON CONFLICT (ticker) DO UPDATE SET
  name = EXCLUDED.name, layer = EXCLUDED.layer,
  category = EXCLUDED.category, kind = EXCLUDED.kind;

-- Sanity: 50 investables, partitioned 42 pure_play / 8 megacap.
DO $$
DECLARE inv int; pp int; mc int;
BEGIN
  SELECT count(*) INTO inv FROM hp1.universe WHERE kind='investable';
  SELECT count(*) INTO pp  FROM hp1.universe WHERE category='pure_play';
  SELECT count(*) INTO mc  FROM hp1.universe WHERE category='megacap';
  IF inv <> 50 OR pp <> 42 OR mc <> 8 THEN
    RAISE EXCEPTION 'hp1.universe seed expected 50 investable / 42 pure_play / 8 megacap, got % / % / %', inv, pp, mc;
  END IF;
END $$;

-- ===========================================================================
-- hp1.prices — adjusted daily closes (engine input)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.prices (
  ticker     text NOT NULL REFERENCES hp1.universe(ticker) ON DELETE RESTRICT,
  date       date NOT NULL,
  open       numeric,
  high       numeric,
  low        numeric,
  close      numeric,
  adj_close  numeric,   -- dividend + split adjusted; the engine scores on this
  volume     bigint,
  PRIMARY KEY (ticker, date)
);

COMMENT ON TABLE hp1.prices IS
  'Daily OHLCV + adjusted close for the HP-1 universe (50 + benchmarks/macro). adj_close is dividend/split adjusted and is what the engine reads for momentum/MA/drawdown. Loaded by HP-1''s own daily price loader (FMP/Polygon) via service_role.';

CREATE INDEX IF NOT EXISTS prices_ticker_date_desc_idx ON hp1.prices (ticker, date DESC);

-- ===========================================================================
-- hp1.macro_gauges — NAAIM / AAII / F&G (Regime surface, downgrade-only flags)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.macro_gauges (
  as_of         date PRIMARY KEY,
  naaim         numeric,   -- NAAIM Exposure Index
  aaii_bullish  numeric,   -- AAII % bullish
  aaii_bearish  numeric,   -- AAII % bearish
  aaii_spread   numeric,   -- bullish - bearish
  fear_greed    int,       -- CNN Fear & Greed (0-100)
  source        text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hp1.macro_gauges IS
  'Weekly sentiment gauges for the Regime surface (§5.6). Downgrade-only flags in Fable, never single-name score mechanics. Breadth is engine-computed from hp1.prices, not stored here.';

CREATE INDEX IF NOT EXISTS macro_gauges_as_of_desc_idx ON hp1.macro_gauges (as_of DESC);

-- ===========================================================================
-- RLS — authenticated read-only; loaders write via service_role (hardened pattern)
-- ===========================================================================
ALTER TABLE hp1.universe     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.prices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.macro_gauges ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.universe     FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.prices       FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.macro_gauges FORCE ROW LEVEL SECURITY;

CREATE POLICY universe_authenticated_read ON hp1.universe
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY prices_authenticated_read ON hp1.prices
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY macro_gauges_authenticated_read ON hp1.macro_gauges
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

GRANT SELECT ON hp1.universe, hp1.prices, hp1.macro_gauges TO anon, authenticated;
GRANT ALL    ON hp1.universe, hp1.prices, hp1.macro_gauges TO service_role;

COMMIT;
