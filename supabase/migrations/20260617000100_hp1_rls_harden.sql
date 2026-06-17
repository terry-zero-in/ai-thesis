-- HP-1 Phase 1 — harden hp1 RLS: authenticated is READ-ONLY; writes via service_role.
--
-- Why (Codex P1 on PR #22): the base schema migration (20260617000000) created
-- `FOR ALL TO authenticated` policies. HP-1 shares the v2 Supabase project, which
-- may already have non-Terry auth users (mom/dad, provisioned for v2 read access).
-- `FOR ALL` would let ANY authenticated user INSERT/UPDATE/DELETE — including on
-- hp1.trades, the SOLE source of live real-money positions, and hp1.anth_state /
-- hp1.aiq_scores. The locked HP-1 decision is "Terry write, mom read-only"
-- (design §2.5). Until the identity-specific auth wiring exists, the safe default
-- for a real-money ledger is: authenticated can only READ; all writes go through
-- service_role (the engine GH Action, the Fable orchestrator, and Terry-gated
-- server actions).
--
-- Upgrade path (auth-wiring step, once Terry's + mom's uids are provisioned):
--   add a writer policy, e.g.
--     CREATE POLICY <t>_terry_write ON hp1.<t> FOR ALL TO authenticated
--       USING  (auth.jwt()->>'email' = '<terry-email>')
--       WITH CHECK (auth.jwt()->>'email' = '<terry-email>');
--   and re-GRANT INSERT, UPDATE, DELETE ON the relevant tables TO authenticated.
--   mom keeps SELECT-only (this migration's policy) — no extra work for her.
--
-- Idempotent: DROP POLICY IF EXISTS (both old + new names) then CREATE; REVOKE is
-- a no-op if the privilege is already absent. Safe to apply before OR after the
-- base migration has been applied (the base must exist first — same Phase 1 batch).

BEGIN;

-- Replace every FOR ALL authenticated policy with a SELECT-only one.
DROP POLICY IF EXISTS engine_runs_authenticated_all      ON hp1.engine_runs;
DROP POLICY IF EXISTS engine_runs_authenticated_read     ON hp1.engine_runs;
CREATE POLICY engine_runs_authenticated_read ON hp1.engine_runs
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS engine_ranks_authenticated_all     ON hp1.engine_ranks;
DROP POLICY IF EXISTS engine_ranks_authenticated_read    ON hp1.engine_ranks;
CREATE POLICY engine_ranks_authenticated_read ON hp1.engine_ranks
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fable_runs_authenticated_all       ON hp1.fable_runs;
DROP POLICY IF EXISTS fable_runs_authenticated_read      ON hp1.fable_runs;
CREATE POLICY fable_runs_authenticated_read ON hp1.fable_runs
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS fable_reviews_authenticated_all    ON hp1.fable_reviews;
DROP POLICY IF EXISTS fable_reviews_authenticated_read   ON hp1.fable_reviews;
CREATE POLICY fable_reviews_authenticated_read ON hp1.fable_reviews
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS tranches_authenticated_all         ON hp1.tranches;
DROP POLICY IF EXISTS tranches_authenticated_read        ON hp1.tranches;
CREATE POLICY tranches_authenticated_read ON hp1.tranches
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS trades_authenticated_all           ON hp1.trades;
DROP POLICY IF EXISTS trades_authenticated_read          ON hp1.trades;
CREATE POLICY trades_authenticated_read ON hp1.trades
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS anth_state_authenticated_all       ON hp1.anth_state;
DROP POLICY IF EXISTS anth_state_authenticated_read      ON hp1.anth_state;
CREATE POLICY anth_state_authenticated_read ON hp1.anth_state
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS decisions_log_authenticated_all    ON hp1.decisions_log;
DROP POLICY IF EXISTS decisions_log_authenticated_read   ON hp1.decisions_log;
CREATE POLICY decisions_log_authenticated_read ON hp1.decisions_log
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS backtest_record_authenticated_all  ON hp1.backtest_record;
DROP POLICY IF EXISTS backtest_record_authenticated_read ON hp1.backtest_record;
CREATE POLICY backtest_record_authenticated_read ON hp1.backtest_record
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS aiq_scores_authenticated_all       ON hp1.aiq_scores;
DROP POLICY IF EXISTS aiq_scores_authenticated_read      ON hp1.aiq_scores;
CREATE POLICY aiq_scores_authenticated_read ON hp1.aiq_scores
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

-- Match table privileges to the policy: authenticated keeps SELECT, loses writes.
-- service_role retains ALL (write path for engine/Fable/admin actions); anon
-- keeps its SELECT grant (no policy => empty result).
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hp1 FROM authenticated;

COMMIT;
