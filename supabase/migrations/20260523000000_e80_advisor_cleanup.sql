-- E80 advisor cleanup (THS-96, S27 follow-up 2026-05-22)
--
-- Three concerns, all perf/hygiene (no correctness impact):
--   A. Wrap auth.uid() direct calls in RLS policies as (select auth.uid())
--      so Postgres caches the result per query instead of re-evaluating
--      per row. Applies to all 10 e80-introduced policies.
--   B. Consolidate "multiple permissive policies" on tables where a
--      catch-all _all_select policy collides with a FOR ALL _auth_write
--      policy (both add a permissive SELECT on authenticated). Split the
--      write policy into INSERT/UPDATE/DELETE so only the _all_select
--      provides SELECT.
--   C. Add missing FK covering indexes on memo_proposals + universe_proposals.
--
-- Idempotent: every DROP uses IF EXISTS; every CREATE INDEX uses IF NOT EXISTS.
-- Atomic: single BEGIN/COMMIT.
--
-- Out of scope (separate tickets if pursued):
--   - Pre-existing Epic 1-3 auth.uid() warnings on ~20 other tables
--   - tg_set_updated_at + tg_ai_segment_overrides_set_updated_at search_path
--   - pg_net in public schema
--   - Materialized views exposed to anon API
--   - refresh_forward_pe_history / refresh_momentum_12_1 SECURITY DEFINER
--   - Auth leaked-password protection toggle

BEGIN;

-- ============================================================================
-- A. WRAP auth.uid() DIRECT CALLS ON e80 TABLES
-- ============================================================================

-- public.users — 2 policies
DROP POLICY IF EXISTS users_self_read   ON public.users;
DROP POLICY IF EXISTS users_self_update ON public.users;

CREATE POLICY users_self_read   ON public.users
  FOR SELECT TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY users_self_update ON public.users
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

-- public.portfolio_settings — 1 policy
DROP POLICY IF EXISTS portfolio_settings_self_all ON public.portfolio_settings;

CREATE POLICY portfolio_settings_self_all ON public.portfolio_settings
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- public.portfolio_positions — 1 policy
DROP POLICY IF EXISTS portfolio_positions_self_all ON public.portfolio_positions;

CREATE POLICY portfolio_positions_self_all ON public.portfolio_positions
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- public.alert_acks — 1 policy
DROP POLICY IF EXISTS alert_acks_self_all ON public.alert_acks;

CREATE POLICY alert_acks_self_all ON public.alert_acks
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- B. CONSOLIDATE MULTIPLE-PERMISSIVE-POLICY PATTERNS (+ wrap auth.uid())
-- ============================================================================
-- Pattern: each of these tables has _all_select (FOR SELECT, anon+authenticated, USING true)
-- plus _auth_write (FOR ALL, authenticated, USING auth.uid() IS NOT NULL).
-- FOR ALL implicitly includes SELECT, so authenticated gets two permissive SELECT policies.
-- Fix: drop the FOR ALL, recreate as three separate INSERT/UPDATE/DELETE policies
-- so _all_select remains the only SELECT policy.

-- aiq_draft_queue
DROP POLICY IF EXISTS aiq_draft_queue_authenticated_write ON public.aiq_draft_queue;

CREATE POLICY aiq_draft_queue_authenticated_insert ON public.aiq_draft_queue
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY aiq_draft_queue_authenticated_update ON public.aiq_draft_queue
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY aiq_draft_queue_authenticated_delete ON public.aiq_draft_queue
  FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- memo_proposals
DROP POLICY IF EXISTS memo_proposals_auth_write ON public.memo_proposals;

CREATE POLICY memo_proposals_auth_insert ON public.memo_proposals
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY memo_proposals_auth_update ON public.memo_proposals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY memo_proposals_auth_delete ON public.memo_proposals
  FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- universe_proposals
DROP POLICY IF EXISTS universe_proposals_auth_write ON public.universe_proposals;

CREATE POLICY universe_proposals_auth_insert ON public.universe_proposals
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY universe_proposals_auth_update ON public.universe_proposals
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) IS NOT NULL) WITH CHECK ((select auth.uid()) IS NOT NULL);
CREATE POLICY universe_proposals_auth_delete ON public.universe_proposals
  FOR DELETE TO authenticated USING ((select auth.uid()) IS NOT NULL);

-- position_pulse — different pattern: both policies share the same predicate
-- (auth.uid() = user_id), the SELECT-only is fully subsumed by FOR ALL. Drop both,
-- recreate one FOR ALL with the wrapped predicate.
DROP POLICY IF EXISTS position_pulse_self_select ON public.position_pulse;
DROP POLICY IF EXISTS position_pulse_self_write  ON public.position_pulse;

CREATE POLICY position_pulse_self_all ON public.position_pulse
  FOR ALL TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ============================================================================
-- C. ADD MISSING FK COVERING INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS memo_proposals_resolved_by_idx
  ON public.memo_proposals (resolved_by);

CREATE INDEX IF NOT EXISTS memo_proposals_ticker_idx
  ON public.memo_proposals (ticker);

CREATE INDEX IF NOT EXISTS universe_proposals_resolved_by_idx
  ON public.universe_proposals (resolved_by);

COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION (run separately in SQL Editor or via execute_sql)
-- ============================================================================
-- 1. Confirm all e80-introduced auth.uid() warnings cleared:
--      mcp__Supabase__get_advisors  type = performance
--    Expected: zero auth_rls_initplan advisories on users/portfolio_settings/
--    portfolio_positions/alert_acks/aiq_draft_queue/memo_proposals/
--    universe_proposals/position_pulse.
--
-- 2. Confirm multiple_permissive_policies cleared on aiq_draft_queue,
--    memo_proposals, universe_proposals, position_pulse.
--
-- 3. Confirm new FK indexes:
--      SELECT indexname FROM pg_indexes
--       WHERE tablename IN ('memo_proposals', 'universe_proposals')
--         AND indexname LIKE '%_resolved_by_idx' OR indexname = 'memo_proposals_ticker_idx';
--
-- 4. Sanity check: per-user RLS still works after policy rewrites.
--      SET LOCAL role authenticated;
--      SET LOCAL request.jwt.claims TO '{"sub":"77631cb5-93bf-4b2b-b992-eae1ca0d271c"}';
--      SELECT count(*) FROM public.portfolio_positions;
--      -- Expected: 13 (Terry sees only his rows; with 1 user, count = total).
