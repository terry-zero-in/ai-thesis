-- THS-61 (E5.4) — Insider Form 4 raw filings.
--
-- One row per insider transaction (a single Form 4 filing can contain
-- multiple transactions; we flatten them out). Keyed on
-- (ticker, transaction_date, insider_name, transaction_code, shares) so
-- duplicate ingest is idempotent.
--
-- is_10b5_1 is a NULLABLE boolean — null when we couldn't read the
-- footnote / form annotation that flags pre-planned trades. The cluster-
-- detection logic treats null conservatively (sell side: counted; buy
-- side: counted — 10b5-1 doesn't apply to buys typically).
--
-- Override semantics live in the helper (`factor-insider.ts`), not in
-- the schema; this table is just the persisted feed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.insider_form4_raw (
  ticker            text NOT NULL REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  transaction_date  date NOT NULL,
  insider_name      text NOT NULL,
  insider_title     text,                       -- role at filing time
  transaction_code  text NOT NULL,              -- e.g. 'P', 'S', 'M', 'F'
  acquired_disposed text CHECK (acquired_disposed IN ('A', 'D')),
  shares            numeric,
  price_per_share   numeric,
  transaction_value numeric,                    -- shares * price_per_share when available
  is_10b5_1         boolean,                    -- NULL when undetermined
  source_url        text,                       -- link to the SEC filing
  filing_date       date,
  raw               jsonb,                      -- full FMP row for audit
  ingested_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, transaction_date, insider_name, transaction_code, shares)
);

COMMENT ON TABLE public.insider_form4_raw IS
  'SEC Form 4 transactions ingested from FMP. One row per insider per transaction. transaction_code follows SEC Table I: P=open-market purchase, S=open-market sale, M=exercise, F=tax withholding, etc.';

CREATE INDEX IF NOT EXISTS insider_form4_ticker_date_desc_idx
  ON public.insider_form4_raw (ticker, transaction_date DESC);

CREATE INDEX IF NOT EXISTS insider_form4_filing_date_idx
  ON public.insider_form4_raw (filing_date DESC) WHERE filing_date IS NOT NULL;

ALTER TABLE public.insider_form4_raw ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insider_form4_raw FORCE ROW LEVEL SECURITY;

CREATE POLICY insider_form4_authenticated_all ON public.insider_form4_raw
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.insider_form4_raw TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insider_form4_raw TO authenticated;
GRANT ALL ON public.insider_form4_raw TO service_role;

COMMIT;
