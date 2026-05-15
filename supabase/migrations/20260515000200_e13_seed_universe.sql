-- THS-37 (E1.3) — Seed the universe with the hand-curated investable list
-- Source: THS-37 ticket body, with ANET reclassified to L1 per the algorithm
-- spec's deployment-slate table. The "70 names" wording in the ticket title
-- was a typo; the authoritative count is 50 (Terry-confirmed).
--
-- Layer counts after the ANET fix:
--   L1 Compute     14  (added ANET — Arista is Ethernet-for-AI hardware, not an app)
--   L2 Hyperscaler  7
--   L3 App          9  (lost ANET)
--   L4 Power       14
--   L5 Incumbent    6
--   Total          50
--
-- Idempotent: ON CONFLICT DO UPDATE so re-running the seed refreshes name /
-- layer_label / is_active without disturbing added_at on existing rows.

BEGIN;

INSERT INTO public.universe (ticker, name, layer, layer_label) VALUES
  -- L1 Compute (14)
  ('NVDA',  'NVIDIA',                              1, 'Compute'),
  ('AVGO',  'Broadcom',                            1, 'Compute'),
  ('AMD',   'Advanced Micro Devices',              1, 'Compute'),
  ('TSM',   'Taiwan Semiconductor Manufacturing',  1, 'Compute'),
  ('ASML',  'ASML Holding',                        1, 'Compute'),
  ('AMAT',  'Applied Materials',                   1, 'Compute'),
  ('LRCX',  'Lam Research',                        1, 'Compute'),
  ('KLAC',  'KLA Corporation',                     1, 'Compute'),
  ('MRVL',  'Marvell Technology',                  1, 'Compute'),
  ('ARM',   'Arm Holdings',                        1, 'Compute'),
  ('SNPS',  'Synopsys',                            1, 'Compute'),
  ('CDNS',  'Cadence Design Systems',              1, 'Compute'),
  ('MU',    'Micron Technology',                   1, 'Compute'),

  -- L2 Hyperscaler (7)
  ('MSFT',  'Microsoft',                           2, 'Hyperscaler'),
  ('GOOGL', 'Alphabet',                            2, 'Hyperscaler'),
  ('AMZN',  'Amazon',                              2, 'Hyperscaler'),
  ('META',  'Meta Platforms',                      2, 'Hyperscaler'),
  ('ORCL',  'Oracle',                              2, 'Hyperscaler'),
  ('IBM',   'IBM',                                 2, 'Hyperscaler'),
  ('CRM',   'Salesforce',                          2, 'Hyperscaler'),

  -- ANET (Arista Networks) lives in L1 with the rest of compute hardware;
  -- see migration 20260515000900. L3 below is 9 names, not 10.
  ('ANET',  'Arista Networks',                     1, 'Compute'),

  -- L3 App (9)
  ('PLTR',  'Palantir Technologies',               3, 'App'),
  ('SNOW',  'Snowflake',                           3, 'App'),
  ('CRWD',  'CrowdStrike Holdings',                3, 'App'),
  ('S',     'SentinelOne',                         3, 'App'),
  ('DDOG',  'Datadog',                             3, 'App'),
  ('MDB',   'MongoDB',                             3, 'App'),
  ('NET',   'Cloudflare',                          3, 'App'),
  ('ESTC',  'Elastic',                             3, 'App'),
  ('AI',    'C3.ai',                               3, 'App'),

  -- L4 Power (14)
  ('VST',   'Vistra',                              4, 'Power'),
  ('CEG',   'Constellation Energy',                4, 'Power'),
  ('GEV',   'GE Vernova',                          4, 'Power'),
  ('ETR',   'Entergy',                             4, 'Power'),
  ('NRG',   'NRG Energy',                          4, 'Power'),
  ('TLN',   'Talen Energy',                        4, 'Power'),
  ('NEE',   'NextEra Energy',                      4, 'Power'),
  ('AES',   'AES Corporation',                     4, 'Power'),
  ('ETN',   'Eaton',                               4, 'Power'),
  ('PWR',   'Quanta Services',                     4, 'Power'),
  ('BE',    'Bloom Energy',                        4, 'Power'),
  ('EQIX',  'Equinix',                             4, 'Power'),
  ('DLR',   'Digital Realty Trust',                4, 'Power'),
  ('VRT',   'Vertiv Holdings',                     4, 'Power'),

  -- L5 Incumbent (6)
  ('ADBE',  'Adobe',                               5, 'Incumbent'),
  ('NOW',   'ServiceNow',                          5, 'Incumbent'),
  ('INTU',  'Intuit',                              5, 'Incumbent'),
  ('WDAY',  'Workday',                             5, 'Incumbent'),
  ('ZS',    'Zscaler',                             5, 'Incumbent'),
  ('SAP',   'SAP SE',                              5, 'Incumbent')
ON CONFLICT (ticker) DO UPDATE SET
  name        = EXCLUDED.name,
  layer       = EXCLUDED.layer,
  layer_label = EXCLUDED.layer_label;

-- Sanity check: insist on 50 rows after this migration. If the ticket gets
-- updated to the full 70-name list, update this assertion accordingly.
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.universe;
  IF n <> 50 THEN
    RAISE EXCEPTION 'universe seed expected 50 rows, found %', n;
  END IF;
END $$;

COMMIT;
