-- Rollback for 20260617000100_hp1_rls_harden.sql
-- Restores the base migration's FOR ALL authenticated policies + write grants.
-- (Reverts the hardening; only do this if you intend authenticated-all again.)

BEGIN;

DROP POLICY IF EXISTS engine_runs_authenticated_read     ON hp1.engine_runs;
CREATE POLICY engine_runs_authenticated_all ON hp1.engine_runs
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS engine_ranks_authenticated_read    ON hp1.engine_ranks;
CREATE POLICY engine_ranks_authenticated_all ON hp1.engine_ranks
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS fable_runs_authenticated_read      ON hp1.fable_runs;
CREATE POLICY fable_runs_authenticated_all ON hp1.fable_runs
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS fable_reviews_authenticated_read   ON hp1.fable_reviews;
CREATE POLICY fable_reviews_authenticated_all ON hp1.fable_reviews
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS tranches_authenticated_read        ON hp1.tranches;
CREATE POLICY tranches_authenticated_all ON hp1.tranches
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS trades_authenticated_read          ON hp1.trades;
CREATE POLICY trades_authenticated_all ON hp1.trades
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS anth_state_authenticated_read      ON hp1.anth_state;
CREATE POLICY anth_state_authenticated_all ON hp1.anth_state
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS decisions_log_authenticated_read   ON hp1.decisions_log;
CREATE POLICY decisions_log_authenticated_all ON hp1.decisions_log
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS backtest_record_authenticated_read ON hp1.backtest_record;
CREATE POLICY backtest_record_authenticated_all ON hp1.backtest_record
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS aiq_scores_authenticated_read      ON hp1.aiq_scores;
CREATE POLICY aiq_scores_authenticated_all ON hp1.aiq_scores
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hp1 TO authenticated;

COMMIT;
