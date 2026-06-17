-- HP-1 Phase 1 — create the `hp1.*` schema (engine, Fable, book, ANTH, record).
--
-- Context: HP-1 is the real-money AI-equity decision tool (separate workstream
-- from AI-Thesis v2). Locked topology (S33, Terry 2026-06-16): SAME Supabase
-- project as v2, all HP-1 objects under a new `hp1` schema. HP-1 reads v2's
-- public.* market-data tables READ-ONLY and writes only inside `hp1`.
--
-- Authoritative sources for this schema:
--   - docs/hp1/2026-06-12-hp1-dashboard-design.md  §2.5 (table list), §5 (surfaces)
--   - docs/hp1/HP1_SPEC_v1.1.md                     §2 (universe/layers/views), §3-§5 (engine)
--   - docs/hp1/FABLE_REVIEW_RUBRIC_v1.md            §7/§8/§9 (the JSON the UI consumes verbatim)
--   - docs/hp1/2026-06-12-hp1-build-handoff.md      Decisions table (OPEN-1..4, D5-D10)
--
-- §2.5 is column-level only (no types/PKs/FKs). The type/PK/FK/grain decisions
-- below are this migration's responsibility; each non-obvious one is commented.
--
-- DECISIONS MADE HERE (flagged for the engine-Action / orchestrator authors):
--   1. engine_ranks grain = (run_id, ticker, view, sleeve). The two-sleeve x
--      three-view engine produces a score/pct/eligibility per (view, sleeve);
--      per-name and per-view facts are denormalized across the 2 sleeve rows.
--      This is the only lossless single-table shape and keeps §2.5's exact
--      column names (score / pct / sleeve_eligible). Volume is trivial
--      (50 names x 3 views x 2 sleeves ~= 300 rows/run).
--   2. No cross-schema FKs into public.*. ticker is stored as text (layer is
--      denormalized) so hp1 stays self-contained and portable, and so HP-1
--      never takes a write-blocking dependency on a public-schema row. The
--      design treats public.* as an external read-only data source.
--   3. RLS: authenticated-only CRUD now (Terry is the single effective user).
--      mom's READ-ONLY restriction (design §2.5) is a per-identity policy that
--      needs the two provisioned auth uids/emails — DEFERRED to the auth-wiring
--      step. See the RLS section footnote.
--   4. fable_calibration VIEW (design §2.5, System surface §5.8) is DEFERRED to a
--      later migration authored once real fable_runs exist. It computes forward
--      5/10/21-trading-day return separation by verdict and is "sparse until ~60
--      runs" (rubric §11) — not needed at launch, and authoring complex
--      forward-return SQL with zero data to test against invites rework.
--
-- Idempotent: IF NOT EXISTS / ON CONFLICT throughout; safe to re-run.

BEGIN;

-- ===========================================================================
-- Schema
-- ===========================================================================
CREATE SCHEMA IF NOT EXISTS hp1;

COMMENT ON SCHEMA hp1 IS
  'HP-1 real-money decision tool. Engine ranks, Fable reviews, manual book, ANTH state, corrected backtest record. Reads public.* read-only; writes only here.';

GRANT USAGE ON SCHEMA hp1 TO anon, authenticated, service_role;

-- ===========================================================================
-- engine_runs — one row per engine run (post-close daily GH Action, §2.3/§6)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.engine_runs (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  as_of           date NOT NULL,                 -- the trading day the run scores
  breadth_pct     numeric,                       -- % of universe above 100d MA (0-100); gates at 40/25
  gate_gross      numeric,                        -- 1.00 / 0.50 / 0.25 exposure multiplier from breadth
  regime_read     text,                           -- engine mechanical regime label (Fable's prose read lives on fable_runs)
  universe_n      int,                            -- eligible names scored this run
  data_through    date,                           -- latest price date the run consumed
  engine_version  text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hp1.engine_runs IS
  'One row per engine run. breadth_pct is a percentage (0-100). Multiple runs per as_of are allowed (re-runs/corrections); newest by created_at wins for display.';

CREATE INDEX IF NOT EXISTS engine_runs_as_of_desc_idx
  ON hp1.engine_runs (as_of DESC, created_at DESC);

-- ===========================================================================
-- engine_ranks — per (run, ticker, view, sleeve); see grain DECISION #1 above
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.engine_ranks (
  run_id          uuid NOT NULL REFERENCES hp1.engine_runs(run_id) ON DELETE CASCADE,
  ticker          text NOT NULL,                  -- no FK to public.universe (DECISION #2)
  layer           text NOT NULL,                  -- 'L1','L2','L3a','L3b','L4','L5' (text: L3 splits a/b for cluster caps)
  view            text NOT NULL CHECK (view IN ('combined','pure_play','megacap')),
  sleeve          text NOT NULL CHECK (sleeve IN ('tactical','core')),
  score           numeric,                        -- this sleeve's composite score within this view
  pct             numeric,                        -- percentile (0-100) of score within the view's eligible set
  z_m             numeric,                        -- per-view momentum z (same across sleeves within a view)
  z_ram           numeric,                        -- per-view risk-adjusted-momentum z
  z_dd            numeric,                        -- per-view drawdown z
  driver_tag      text CHECK (driver_tag IN ('return-driven','stability-driven','balanced','broken-trend')),
  above_100       boolean,                        -- price > 100d MA (Tactical trend gate)
  above_200       boolean,                        -- price > 200d MA (Core trend gate)
  dist_100_pct    numeric,                        -- signed % distance to 100d MA
  dist_200_pct    numeric,                        -- signed % distance to 200d MA
  dd_from_high    numeric,                        -- drawdown from 126d high (negative)
  sleeve_eligible boolean,                        -- eligible to ENTER this sleeve (trend gate + >=130d history)
  r3              numeric,                         -- trailing 3-month total return
  r6              numeric,                         -- trailing 6-month total return
  r12             numeric,                         -- trailing 12-month total return
  PRIMARY KEY (run_id, ticker, view, sleeve)
);

COMMENT ON TABLE hp1.engine_ranks IS
  'Per-run engine output, grain (run_id, ticker, view, sleeve). Views = combined/pure_play/megacap (z-scores recomputed within each per spec §3). Per-name and per-view facts are denormalized across the 2 sleeve rows by design.';

CREATE INDEX IF NOT EXISTS engine_ranks_run_view_pct_idx
  ON hp1.engine_ranks (run_id, view, sleeve, pct DESC);

CREATE INDEX IF NOT EXISTS engine_ranks_ticker_idx
  ON hp1.engine_ranks (ticker);

-- ===========================================================================
-- fable_runs — one row per Fable orchestrator run (§2.4, rubric §8)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.fable_runs (
  run_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine_run_id   uuid REFERENCES hp1.engine_runs(run_id) ON DELETE SET NULL,
  trigger_type    text NOT NULL DEFAULT 'scheduled'
                    CHECK (trigger_type IN (
                      'scheduled','hard_exit','name_drop_8pct','circuit_breaker',
                      'spy_5pct','vix_streak','anth_news','migration_flag','manual')),
  model           text,                            -- e.g. claude-fable-5
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz,
  status          text NOT NULL DEFAULT 'running'
                    CHECK (status IN ('running','ok','failed')),  -- 'engine-only' UI state is derived from a failed latest run
  review_set_n    int,                             -- names reviewed this run (§5.7)
  cost_usd        numeric,                         -- run cost (§5.7)
  duration_ms     int,                             -- wall-clock (§5.7)
  raw_json        jsonb,                           -- raw model output; always kept (esp. on failure, rubric §11)
  portfolio_block jsonb,                           -- rubric §8 portfolio block (regime/concentration/migrations)
  anth_block      jsonb,                           -- rubric §9 ANTH block, every run (status/reasons_against/evidence)
  decisions       jsonb,                           -- rubric §8 decisions[] (also expanded into decisions_log rows)
  cash_note       text
);

COMMENT ON TABLE hp1.fable_runs IS
  'One row per Fable review run. raw_json is preserved verbatim; a schema-invalid run is stored with status=failed and the engine output is never blocked (rubric §11). anth_block holds the every-cycle ANTH review (rubric §9).';

CREATE INDEX IF NOT EXISTS fable_runs_started_desc_idx
  ON hp1.fable_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS fable_runs_engine_run_idx
  ON hp1.fable_runs (engine_run_id);

-- ===========================================================================
-- fable_reviews — per-name review, mirrors rubric §7 JSON (UI consumes verbatim)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.fable_reviews (
  run_id          uuid NOT NULL REFERENCES hp1.fable_runs(run_id) ON DELETE CASCADE,
  ticker          text NOT NULL,
  layer           text,                            -- 'L1'..'L5' as emitted by Fable (§7)
  sleeve          text CHECK (sleeve IN ('TACTICAL','CORE','NONE')),  -- Fable contract casing (§7)
  held            boolean,
  engine_rank     int,
  engine_pct      numeric,                          -- 0-100, engine percentile (base for adjustment)
  driver_tag      text,
  verdict         text NOT NULL CHECK (verdict IN ('CONFIRM','FLAG','DOWNGRADE','UPGRADE','VETO')),
  adjustment      int NOT NULL DEFAULT 0
                    CHECK (adjustment BETWEEN -20 AND 5),  -- HARD floor -20; orchestrator enforces operational [-10,+5] (D6) and widens only post-calibration
  adjusted_pct    numeric,                          -- clamp(engine_pct + adjustment, 0, 100); display only, never reorders selection (D5)
  action          text CHECK (action IN ('HOLD','ADD','TRIM','EXIT','ENTER','MIGRATE_T2C','MIGRATE_C2T','NONE')),
  action_reason   text,                             -- <=140 chars, the one line Terry reads (§7)
  flags           text[] NOT NULL DEFAULT '{}',
  confidence      text CHECK (confidence IN ('H','M','L')),  -- L-confidence findings cap at -5 (rubric §6)
  evidence        jsonb NOT NULL DEFAULT '[]',       -- [{claim,source,date,url,validated}] — validated set by server-side citation check (D6/P0-4)
  next_event      jsonb,                            -- {type,date}
  reviewed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, ticker)
);

COMMENT ON TABLE hp1.fable_reviews IS
  'Per-name Fable review = the rubric §7 object stored relationally. evidence[].validated is set by the orchestrator citation check (D6); a failed citation on a DOWNGRADE/UPGRADE/VETO row demotes that verdict to FLAG.';

CREATE INDEX IF NOT EXISTS fable_reviews_ticker_reviewed_desc_idx
  ON hp1.fable_reviews (ticker, reviewed_at DESC);

CREATE INDEX IF NOT EXISTS fable_reviews_verdict_idx
  ON hp1.fable_reviews (verdict);

CREATE INDEX IF NOT EXISTS fable_reviews_evidence_gin_idx
  ON hp1.fable_reviews USING gin (evidence jsonb_path_ops);

-- ===========================================================================
-- tranches — staged deployment of new capital (spec §4 D3, design §5.1)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.tranches (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label              text NOT NULL,                 -- 'Tranche 1' ...
  amount             numeric NOT NULL,
  planned_date       date NOT NULL,
  released_at        timestamptz,
  breadth_at_release numeric,                        -- breadth_pct when released (gate is >=40)
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','released','held','skipped')),
  note               text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hp1.tranches IS
  'New-capital deployment tranches. Tranche N+1 releases at planned_date only if breadth >= 40 (else held at T-bill, re-checked each run). Drives the Today deployment tracker.';

CREATE INDEX IF NOT EXISTS tranches_planned_date_idx
  ON hp1.tranches (planned_date);

-- ===========================================================================
-- trades — manual fills; the ONLY write path for positions (design §2.5/§5.4)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.trades (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account      text NOT NULL CHECK (account IN ('terry','mom')),  -- OPEN-3 locked: account label per trade
  ticker       text NOT NULL,
  side         text NOT NULL CHECK (side IN ('buy','sell')),
  qty          numeric NOT NULL CHECK (qty > 0),
  price        numeric NOT NULL CHECK (price >= 0),
  fee          numeric NOT NULL DEFAULT 0,
  executed_at  timestamptz NOT NULL,
  sleeve       text CHECK (sleeve IN ('tactical','core')),       -- nullable for non-sleeve lots
  tranche_id   uuid REFERENCES hp1.tranches(id) ON DELETE SET NULL,
  note         text,
  entered_by   text,                                              -- who logged it
  created_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hp1.trades IS
  'Manually logged broker fills. Positions are derived from trades only (no separate positions write path). account drives per-person P&L and tax-lot attribution (OPEN-3). FIFO lot matching for sells is computed in the app/tax panel, not stored.';

CREATE INDEX IF NOT EXISTS trades_ticker_executed_desc_idx
  ON hp1.trades (ticker, executed_at DESC);

CREATE INDEX IF NOT EXISTS trades_account_idx
  ON hp1.trades (account);

CREATE INDEX IF NOT EXISTS trades_tranche_idx
  ON hp1.trades (tranche_id);

-- ===========================================================================
-- anth_state — singleton ANTH conviction/ceiling state (design §5.5, OPEN-2/D8)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.anth_state (
  id                   int PRIMARY KEY DEFAULT 1 CHECK (id = 1),   -- singleton
  ceiling_multiple     numeric,                       -- max EV / verified run-rate; editable by Terry only (D8)
  ceiling_set_at       date,
  terry_reconfirmed_at timestamptz,                    -- OPEN-2: the one number Terry should personally re-confirm
  verified_run_rate    numeric,                        -- USD (e.g. 47000000000)
  run_rate_source      text,
  run_rate_date        date,
  run_rate_verified    boolean NOT NULL DEFAULT false,
  latest_mark          numeric,                        -- USD; latest reported private mark (§5.5 "vs ceiling")
  latest_mark_source   text,
  latest_mark_date     date,
  independent_check_at  timestamptz,                   -- D8: GO is inert until Terry records this each time status->GO
  status               text NOT NULL DEFAULT 'WAIT'
                         CHECK (status IN ('GO','WAIT','STOP')),
  history              jsonb NOT NULL DEFAULT '[]',     -- ceiling edits + independent-check events
  updated_at           timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hp1.anth_state IS
  'Singleton ANTH state. ceiling moves ONLY on Terry edits with a third-party diligence ref (never on Fable output, D8). A GO status renders "GO (pending independent check)" and is inert until independent_check_at is set after the status last became GO.';

-- Seed the singleton with the locked OPEN-2 values (idempotent; never clobbers a later Terry edit).
INSERT INTO hp1.anth_state (
  id, ceiling_multiple, ceiling_set_at,
  verified_run_rate, run_rate_source, run_rate_date, run_rate_verified,
  latest_mark, latest_mark_source, latest_mark_date,
  status, history
) VALUES (
  1, 15, DATE '2026-06-16',
  47000000000, 'Anthropic Series H', DATE '2026-05-28', true,
  965000000000, 'Anthropic Series H (implied)', DATE '2026-05-28',
  'WAIT',  -- Series H mark $965B = 20.5x > 15x ceiling -> WAIT (OPEN-2)
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ===========================================================================
-- decisions_log — the Today ack-log; decisions[] expanded to rows (design §5.1)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.decisions_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fable_run_id  uuid REFERENCES hp1.fable_runs(run_id) ON DELETE SET NULL,  -- null = engine-only mechanical alert
  priority      int,
  text          text NOT NULL,                  -- <=140 chars (UI-enforced)
  kind          text,                            -- rebalance/exit/entry/migration/anth/trigger/...
  acked_at      timestamptz,
  acked_by      text,
  outcome_note  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE hp1.decisions_log IS
  'Decision ack-log surfaced on Today. Rows come from the latest Fable run decisions[] (or engine-only mechanical alerts when a run failed). Acked rows collapse to history.';

CREATE INDEX IF NOT EXISTS decisions_log_open_idx
  ON hp1.decisions_log (created_at DESC) WHERE acked_at IS NULL;

CREATE INDEX IF NOT EXISTS decisions_log_run_idx
  ON hp1.decisions_log (fable_run_id);

-- ===========================================================================
-- backtest_record — corrected record only; matches engine/data/results_*_v2.csv
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.backtest_record (
  variant        text NOT NULL,                  -- 'V1 Tactical' / 'EW-50' / ex-cohort variants ...
  window_label   text NOT NULL CHECK (window_label IN ('24M','36M')),  -- 'window' is a reserved keyword; renamed
  cagr           numeric,
  vol            numeric,
  sharpe         numeric,
  sortino        numeric,
  maxdd          numeric,
  worst_day      numeric,
  total          numeric,                         -- total return multiple
  engine_version text,
  is_canonical   boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (variant, window_label)
);

COMMENT ON TABLE hp1.backtest_record IS
  'Corrected (t+1 execution) backtest record only — the void same-day-lookahead record is NEVER stored or displayed (D2). Loaded from engine/data/results_24m_v2.csv + results_36m_v2.csv in a Phase 4 seed step.';

-- ===========================================================================
-- aiq_scores — HP-1 copy of v2's aiq_rubric shape (design §2.5); 20 ports + 30 drafts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS hp1.aiq_scores (
  ticker             text NOT NULL,
  scored_at          date NOT NULL,
  disclosure_pts     int  NOT NULL CHECK (disclosure_pts     BETWEEN 0 AND 20),
  defensibility_pts  int  NOT NULL CHECK (defensibility_pts  BETWEEN 0 AND 20),
  concentration_pts  int  NOT NULL CHECK (concentration_pts  BETWEEN 0 AND 15),
  capex_eff_pts      int  NOT NULL CHECK (capex_eff_pts      BETWEEN 0 AND 15),
  indep_demand_pts   int  NOT NULL CHECK (indep_demand_pts   BETWEEN 0 AND 15),
  accounting_pts     int  NOT NULL CHECK (accounting_pts     BETWEEN 0 AND 15),
  total              int  GENERATED ALWAYS AS (
    disclosure_pts + defensibility_pts + concentration_pts +
    capex_eff_pts + indep_demand_pts + accounting_pts
  ) STORED,
  disclosure_note    text,
  defensibility_note text,
  concentration_note text,
  capex_eff_note     text,
  indep_demand_note  text,
  accounting_note    text,
  source_url         text,
  sources            jsonb,                          -- per-dimension citation set (mirrors v2 e44 sources jsonb)
  status             text NOT NULL DEFAULT 'draft'
                       CHECK (status IN ('ratified','draft')),  -- 20 ported = ratified, 30 = draft for Terry's Aug ratification
  scored_by          text,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, scored_at)
);

COMMENT ON TABLE hp1.aiq_scores IS
  'HP-1 copy of v2 aiq_rubric (6 dims sum to 100, total GENERATED). status distinguishes ported/ratified seeds from Fable-assisted drafts awaiting Terry ratification (next: Aug 2026).';

CREATE INDEX IF NOT EXISTS aiq_scores_ticker_scored_desc_idx
  ON hp1.aiq_scores (ticker, scored_at DESC);

CREATE INDEX IF NOT EXISTS aiq_scores_total_idx
  ON hp1.aiq_scores (total);

CREATE INDEX IF NOT EXISTS aiq_scores_status_idx
  ON hp1.aiq_scores (status);

-- ===========================================================================
-- positions — VIEW over trades (design §2.5). security_invoker so RLS applies.
-- ===========================================================================
-- v1 scope: net position + average-cost basis per (account, ticker, sleeve).
-- FIFO tax lots (§5.4 tax panel) and position_high / exit-trigger proximity
-- (engine-computed, §2.3) are intentionally NOT in this view — they belong to
-- the app/engine and would otherwise ship as untested complex SQL.
CREATE OR REPLACE VIEW hp1.positions
  WITH (security_invoker = true) AS
SELECT
  account,
  ticker,
  sleeve,
  sum(CASE WHEN side = 'buy' THEN qty ELSE -qty END)                              AS qty,
  sum(CASE WHEN side = 'buy' THEN qty * price + fee ELSE 0 END)                   AS gross_buy_cost,
  sum(CASE WHEN side = 'sell' THEN qty * price - fee ELSE 0 END)                  AS gross_sell_proceeds,
  CASE WHEN sum(CASE WHEN side = 'buy' THEN qty ELSE 0 END) > 0
       THEN sum(CASE WHEN side = 'buy' THEN qty * price ELSE 0 END)
            / sum(CASE WHEN side = 'buy' THEN qty ELSE 0 END)
       END                                                                        AS avg_buy_price,
  min(CASE WHEN side = 'buy' THEN executed_at END)                                AS entry_date,
  max(executed_at)                                                                AS last_trade_at
FROM hp1.trades
GROUP BY account, ticker, sleeve
HAVING sum(CASE WHEN side = 'buy' THEN qty ELSE -qty END) <> 0;

COMMENT ON VIEW hp1.positions IS
  'Open positions derived from hp1.trades, grain (account, ticker, sleeve). cost_basis = avg_buy_price * qty (average-cost approximation; FIFO lots computed in the tax panel). position_high and trigger proximity are engine-computed, not here.';

-- ===========================================================================
-- Row Level Security  (pattern mirrors v2 public.* — see e11/e12 migrations)
-- ===========================================================================
-- Strategy: enable + FORCE RLS on every table; authenticated role gets full
-- CRUD; anon gets SELECT grant but no policy (=> empty result, not error);
-- service_role bypasses RLS (engine GH Action + Fable orchestrator write paths).
--
-- DEFERRED (DECISION #3): mom is read-only (design §2.5). That is a per-identity
-- policy keyed on the two provisioned auth users; implement it in the auth-wiring
-- step by replacing the *_authenticated_all WITH CHECK with a writer-identity
-- predicate (e.g. auth.jwt()->>'email' = <terry>) and a SELECT-only policy for mom.
-- Until both users exist, authenticated-all is correct (Terry is the only user).

ALTER TABLE hp1.engine_runs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.engine_ranks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.fable_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.fable_reviews   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.tranches        ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.trades          ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.anth_state      ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.decisions_log   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.backtest_record ENABLE ROW LEVEL SECURITY;
ALTER TABLE hp1.aiq_scores      ENABLE ROW LEVEL SECURITY;

ALTER TABLE hp1.engine_runs     FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.engine_ranks    FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.fable_runs      FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.fable_reviews   FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.tranches        FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.trades          FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.anth_state      FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.decisions_log   FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.backtest_record FORCE ROW LEVEL SECURITY;
ALTER TABLE hp1.aiq_scores      FORCE ROW LEVEL SECURITY;

CREATE POLICY engine_runs_authenticated_all ON hp1.engine_runs
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY engine_ranks_authenticated_all ON hp1.engine_ranks
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fable_runs_authenticated_all ON hp1.fable_runs
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY fable_reviews_authenticated_all ON hp1.fable_reviews
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY tranches_authenticated_all ON hp1.tranches
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY trades_authenticated_all ON hp1.trades
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY anth_state_authenticated_all ON hp1.anth_state
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY decisions_log_authenticated_all ON hp1.decisions_log
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY backtest_record_authenticated_all ON hp1.backtest_record
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY aiq_scores_authenticated_all ON hp1.aiq_scores
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ===========================================================================
-- Privilege grants (mirrors v2 e11/e12 pattern; self-contained)
-- ===========================================================================
GRANT SELECT ON ALL TABLES IN SCHEMA hp1 TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hp1 TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA hp1 TO service_role;

-- The positions view (and any future view) inherits SELECT for app reads.
GRANT SELECT ON hp1.positions TO anon, authenticated, service_role;

COMMIT;
