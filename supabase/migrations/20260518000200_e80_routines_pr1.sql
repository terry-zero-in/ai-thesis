-- E80 (PR 1, S4 2026-05-18) — Routines plumbing + multi-tenant schema readiness
--
-- Two bundled concerns:
--   A. Multi-tenant readiness — add user_id to per-user tables (portfolio_*,
--      alert_acks) + create public.users (mirrors auth.users with app
--      columns like subscription_tier). Backfills all existing rows to
--      Terry's auth.uid so behavior is unchanged for single-tenant use.
--   B. Routine output tables — 6 shared (engine-level) + 1 per-user
--      (position_pulse). RLS scoped to authenticated + auth.uid() = user_id
--      for the per-user table.
--
-- Idempotent: uses CREATE TABLE IF NOT EXISTS + ALTER ... IF NOT EXISTS
-- patterns + ON CONFLICT DO NOTHING for seeds. Safe to re-run.
--
-- Atomic: wrapped in BEGIN/COMMIT. If any step fails, nothing applies.
--
-- Prereq: Terry has signed in at least once (auth.users row exists for
-- terryturner2026@gmail.com). Migration raises if not.

BEGIN;

-- ============================================================================
-- A. MULTI-TENANT SCHEMA READINESS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- public.users — app-side user record. Mirrors auth.users + app columns.
-- id FKs auth.users.id with ON DELETE CASCADE so deleting an auth user
-- removes their rows everywhere.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email             text NOT NULL,
  subscription_tier text NOT NULL DEFAULT 'free'
                      CHECK (subscription_tier IN ('free','owner','pro','advisor')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.users IS
  'App user record. id FKs auth.users.id. subscription_tier reserved for monetization (PR1: unused — Terry is "owner"). Other users start at "free".';

CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);
CREATE INDEX IF NOT EXISTS users_tier_idx  ON public.users (subscription_tier);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_self_read ON public.users;
DROP POLICY IF EXISTS users_self_update ON public.users;

-- Each user can read + update only their own row.
CREATE POLICY users_self_read   ON public.users FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY users_self_update ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

GRANT SELECT, UPDATE ON public.users TO authenticated;

-- ---------------------------------------------------------------------------
-- Backfill Terry's user row + capture his user_id for downstream backfills.
-- Uses DO block so we can fail loudly if his auth.users row doesn't exist.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id
    FROM auth.users
   WHERE email = 'terryturner2026@gmail.com'
   LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No auth.users row for terryturner2026@gmail.com. Sign in to the app once before running this migration.';
  END IF;

  -- Insert Terry's public.users row at 'owner' tier (above 'free').
  INSERT INTO public.users (id, email, subscription_tier)
  VALUES (v_user_id, 'terryturner2026@gmail.com', 'owner')
  ON CONFLICT (id) DO UPDATE SET subscription_tier = 'owner';

  -- Stash for use later in this migration via a temp table (DO-block scope
  -- doesn't persist to subsequent statements). Cleaner: just re-query later.
END $$;

-- ---------------------------------------------------------------------------
-- portfolio_settings — was singleton (id=1). Becomes per-user (PK = user_id).
-- Migration shape:
--   1) Add user_id column (nullable initially so we can backfill)
--   2) Backfill existing row(s) to Terry's user_id
--   3) Drop the id=1 PK + the id column
--   4) Set user_id NOT NULL + new PK
--   5) Add FK to users(id) and RLS scoped to auth.uid()
-- ---------------------------------------------------------------------------
ALTER TABLE public.portfolio_settings
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.portfolio_settings
   SET user_id = (SELECT id FROM auth.users WHERE email = 'terryturner2026@gmail.com' LIMIT 1)
 WHERE user_id IS NULL;

-- Drop old PK (id) only if it exists. Safe re-run.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'portfolio_settings_pkey'
       AND conrelid = 'public.portfolio_settings'::regclass
  ) THEN
    ALTER TABLE public.portfolio_settings DROP CONSTRAINT portfolio_settings_pkey;
  END IF;
END $$;

ALTER TABLE public.portfolio_settings
  DROP COLUMN IF EXISTS id;

ALTER TABLE public.portfolio_settings
  ALTER COLUMN user_id SET NOT NULL;

-- New PK + FK
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'portfolio_settings_pkey'
       AND conrelid = 'public.portfolio_settings'::regclass
  ) THEN
    ALTER TABLE public.portfolio_settings
      ADD CONSTRAINT portfolio_settings_pkey PRIMARY KEY (user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'portfolio_settings_user_id_fkey'
       AND conrelid = 'public.portfolio_settings'::regclass
  ) THEN
    ALTER TABLE public.portfolio_settings
      ADD CONSTRAINT portfolio_settings_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Replace the broad authenticated-all policy with one scoped to auth.uid().
DROP POLICY IF EXISTS portfolio_settings_authenticated_all ON public.portfolio_settings;
DROP POLICY IF EXISTS portfolio_settings_self_all        ON public.portfolio_settings;

CREATE POLICY portfolio_settings_self_all ON public.portfolio_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- portfolio_positions — was PK=ticker (single-tenant). Becomes (user_id, ticker).
-- ---------------------------------------------------------------------------
ALTER TABLE public.portfolio_positions
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.portfolio_positions
   SET user_id = (SELECT id FROM auth.users WHERE email = 'terryturner2026@gmail.com' LIMIT 1)
 WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'portfolio_positions_pkey'
       AND conrelid = 'public.portfolio_positions'::regclass
  ) THEN
    ALTER TABLE public.portfolio_positions DROP CONSTRAINT portfolio_positions_pkey;
  END IF;
END $$;

ALTER TABLE public.portfolio_positions
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'portfolio_positions_pkey'
       AND conrelid = 'public.portfolio_positions'::regclass
  ) THEN
    ALTER TABLE public.portfolio_positions
      ADD CONSTRAINT portfolio_positions_pkey PRIMARY KEY (user_id, ticker);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'portfolio_positions_user_id_fkey'
       AND conrelid = 'public.portfolio_positions'::regclass
  ) THEN
    ALTER TABLE public.portfolio_positions
      ADD CONSTRAINT portfolio_positions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS portfolio_positions_user_open_idx
  ON public.portfolio_positions (user_id, ticker) WHERE closed_at IS NULL;

DROP POLICY IF EXISTS portfolio_positions_authenticated_all ON public.portfolio_positions;
DROP POLICY IF EXISTS portfolio_positions_self_all          ON public.portfolio_positions;

CREATE POLICY portfolio_positions_self_all ON public.portfolio_positions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- alert_acks — was PK=alert_key (single-tenant). Becomes (user_id, alert_key).
-- ---------------------------------------------------------------------------
ALTER TABLE public.alert_acks
  ADD COLUMN IF NOT EXISTS user_id uuid;

UPDATE public.alert_acks
   SET user_id = (SELECT id FROM auth.users WHERE email = 'terryturner2026@gmail.com' LIMIT 1)
 WHERE user_id IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'alert_acks_pkey'
       AND conrelid = 'public.alert_acks'::regclass
  ) THEN
    ALTER TABLE public.alert_acks DROP CONSTRAINT alert_acks_pkey;
  END IF;
END $$;

ALTER TABLE public.alert_acks
  ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'alert_acks_pkey'
       AND conrelid = 'public.alert_acks'::regclass
  ) THEN
    ALTER TABLE public.alert_acks
      ADD CONSTRAINT alert_acks_pkey PRIMARY KEY (user_id, alert_key);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'alert_acks_user_id_fkey'
       AND conrelid = 'public.alert_acks'::regclass
  ) THEN
    ALTER TABLE public.alert_acks
      ADD CONSTRAINT alert_acks_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DROP POLICY IF EXISTS alert_acks_authenticated_all ON public.alert_acks;
DROP POLICY IF EXISTS alert_acks_self_all          ON public.alert_acks;

CREATE POLICY alert_acks_self_all ON public.alert_acks
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- B. ROUTINE OUTPUT TABLES (6 shared + 1 per-user)
--
-- "Shared" = engine-level output. Anon SELECT permitted (the dashboard reads
-- without an auth dance), service_role/authenticated writes. Routines write
-- via Supabase MCP connector which uses service_role.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- aiq_draft_queue — work list for the daily-batch routine.
-- App inserts when (a) ticker added to universe, (b) drift threshold tripped,
-- (c) AIQ draft older than 30 days. Routine reads status='queued', writes
-- back status='processing' → 'done' (or 'failed'). One row per outstanding
-- request; (ticker, requested_at) uniqueness avoids duplicate enqueues.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.aiq_draft_queue (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker        text NOT NULL REFERENCES public.universe(ticker) ON DELETE CASCADE,
  reason        text NOT NULL CHECK (reason IN ('new_universe','drift','stale','manual')),
  status        text NOT NULL DEFAULT 'queued'
                  CHECK (status IN ('queued','processing','done','failed')),
  requested_at  timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz,
  failed_reason text,
  UNIQUE (ticker, status)  -- prevents duplicate queued rows for same ticker
);

COMMENT ON TABLE public.aiq_draft_queue IS
  'Work-list for daily-batch routine. App inserts requests; routine processes status=queued → done.';

CREATE INDEX IF NOT EXISTS aiq_draft_queue_status_idx
  ON public.aiq_draft_queue (status, requested_at);

ALTER TABLE public.aiq_draft_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aiq_draft_queue FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aiq_draft_queue_all_auth_select ON public.aiq_draft_queue;
DROP POLICY IF EXISTS aiq_draft_queue_authenticated_write ON public.aiq_draft_queue;

CREATE POLICY aiq_draft_queue_all_auth_select
  ON public.aiq_draft_queue FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY aiq_draft_queue_authenticated_write
  ON public.aiq_draft_queue FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.aiq_draft_queue TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aiq_draft_queue TO authenticated;

-- ---------------------------------------------------------------------------
-- weekly_summary — written by weekly-rescore. One row per Saturday rescore.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.weekly_summary (
  week_of       date PRIMARY KEY,             -- Saturday date the rescore covers
  narrative     text NOT NULL,                -- "what changed this week" prose
  top_movers    jsonb NOT NULL DEFAULT '[]',  -- [{ticker, delta, reason}, ...]
  regime_state  text,                         -- snapshot of macro_state at rescore time
  multiplier    numeric,                      -- multiplier applied to ≥75 names
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.weekly_summary IS
  'Saturday rescore output. One row per week. narrative is Claude prose; top_movers + regime tag are structured.';

CREATE INDEX IF NOT EXISTS weekly_summary_week_of_desc_idx
  ON public.weekly_summary (week_of DESC);

ALTER TABLE public.weekly_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summary FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS weekly_summary_all_select ON public.weekly_summary;
CREATE POLICY weekly_summary_all_select ON public.weekly_summary
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.weekly_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- insider_summary — written by daily-batch. One row per day.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insider_summary (
  as_of            date PRIMARY KEY,
  summary          text NOT NULL,                  -- one-paragraph digest
  flagged_tickers  text[] NOT NULL DEFAULT '{}',   -- tickers with notable activity
  buy_count        int NOT NULL DEFAULT 0,
  sell_count       int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.insider_summary IS
  'Daily insider Form 4 digest. One row per trading day. flagged_tickers surfaces tickers worth a closer look.';

CREATE INDEX IF NOT EXISTS insider_summary_as_of_desc_idx
  ON public.insider_summary (as_of DESC);

ALTER TABLE public.insider_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insider_summary FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insider_summary_all_select ON public.insider_summary;
CREATE POLICY insider_summary_all_select ON public.insider_summary
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.insider_summary TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insider_summary TO authenticated;

-- ---------------------------------------------------------------------------
-- macro_log — written by daily-batch. One row per day. Interprets the
-- macro_state delta vs. yesterday.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.macro_log (
  as_of           date PRIMARY KEY,
  regime_state    text NOT NULL,                   -- 'neutral'|'tightened'|'cautious'|'defensive'
  gates_hit       int NOT NULL DEFAULT 0,
  multiplier      numeric NOT NULL DEFAULT 1.0,
  narrative       text NOT NULL,                   -- Claude-written one-paragraph interpretation
  delta_summary   text,                            -- "yesterday's regime was X, today's is Y because Z"
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.macro_log IS
  'Daily macro state log + Claude-written interpretation. delta_summary explains transitions vs prior day.';

CREATE INDEX IF NOT EXISTS macro_log_as_of_desc_idx
  ON public.macro_log (as_of DESC);

ALTER TABLE public.macro_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.macro_log FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS macro_log_all_select ON public.macro_log;
CREATE POLICY macro_log_all_select ON public.macro_log
  FOR SELECT TO anon, authenticated USING (true);

GRANT SELECT ON public.macro_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.macro_log TO authenticated;

-- ---------------------------------------------------------------------------
-- memo_proposals — written by daily-batch (drift-detected). status machine:
-- pending → approved (becomes a real memo) | dismissed.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memo_proposals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker          text NOT NULL REFERENCES public.universe(ticker) ON DELETE CASCADE,
  drift_delta     numeric NOT NULL,                -- composite score change that triggered
  suggested_memo  text NOT NULL,                   -- Claude-drafted memo body
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','dismissed')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  resolved_at     timestamptz,
  resolved_by     uuid REFERENCES public.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.memo_proposals IS
  'Drift-detected memo suggestions. App UI approves (→ creates memo row) or dismisses.';

CREATE INDEX IF NOT EXISTS memo_proposals_status_idx
  ON public.memo_proposals (status, created_at DESC);

ALTER TABLE public.memo_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memo_proposals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS memo_proposals_all_select ON public.memo_proposals;
DROP POLICY IF EXISTS memo_proposals_auth_write ON public.memo_proposals;

CREATE POLICY memo_proposals_all_select ON public.memo_proposals
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY memo_proposals_auth_write ON public.memo_proposals
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.memo_proposals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memo_proposals TO authenticated;

-- ---------------------------------------------------------------------------
-- universe_proposals — written by monthly-curator. ADD + TRIM suggestions
-- for the 50-name universe.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.universe_proposals (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_of     date NOT NULL,                    -- first of month the proposal covers
  adds         jsonb NOT NULL DEFAULT '[]',      -- [{ticker, name, reason}, ...]
  trims        jsonb NOT NULL DEFAULT '[]',      -- [{ticker, reason}, ...]
  reasoning    text NOT NULL,                    -- overall thematic context
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','partially_accepted','accepted','dismissed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz,
  resolved_by  uuid REFERENCES public.users(id) ON DELETE SET NULL,
  UNIQUE (month_of)
);

COMMENT ON TABLE public.universe_proposals IS
  'Monthly curator suggestions. One row per month. App UI accepts subset of adds/trims and writes universe table updates.';

CREATE INDEX IF NOT EXISTS universe_proposals_status_idx
  ON public.universe_proposals (status, created_at DESC);

ALTER TABLE public.universe_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universe_proposals FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS universe_proposals_all_select ON public.universe_proposals;
DROP POLICY IF EXISTS universe_proposals_auth_write ON public.universe_proposals;

CREATE POLICY universe_proposals_all_select ON public.universe_proposals
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY universe_proposals_auth_write ON public.universe_proposals
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.universe_proposals TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.universe_proposals TO authenticated;

-- ---------------------------------------------------------------------------
-- position_pulse — PER-USER. Written by position-pulse routine. Weekly
-- thesis-intact check for each held position.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.position_pulse (
  user_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticker      text NOT NULL,
  as_of       date NOT NULL,
  verdict     text NOT NULL CHECK (verdict IN ('intact','weakening','broken')),
  reasoning   text NOT NULL,
  score_delta numeric,                            -- composite change since position opened
  insider_signal text,                            -- 'buy_cluster'|'sell_cluster'|'none'
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ticker, as_of)
);

COMMENT ON TABLE public.position_pulse IS
  'Weekly position thesis check. Broken verdict triggers a /decisions alert insertion.';

CREATE INDEX IF NOT EXISTS position_pulse_user_asof_idx
  ON public.position_pulse (user_id, as_of DESC);

ALTER TABLE public.position_pulse ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.position_pulse FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS position_pulse_self_select ON public.position_pulse;
DROP POLICY IF EXISTS position_pulse_self_write  ON public.position_pulse;

-- Per-user: only the position's owner can read or modify. Routines write via
-- service_role which bypasses RLS.
CREATE POLICY position_pulse_self_select ON public.position_pulse
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY position_pulse_self_write ON public.position_pulse
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.position_pulse TO authenticated;

-- ============================================================================
-- C. SEED — give daily-batch work on first fire
-- ============================================================================

-- Seed aiq_draft_queue with up to 5 universe tickers that don't yet have an
-- aiq_draft row. If aiq_drafts is empty, takes the first 5 active tickers.
INSERT INTO public.aiq_draft_queue (ticker, reason)
SELECT u.ticker, 'new_universe'
  FROM public.universe u
 WHERE u.is_active = true
   AND NOT EXISTS (
     SELECT 1 FROM public.aiq_drafts d WHERE d.ticker = u.ticker
   )
   AND NOT EXISTS (
     SELECT 1 FROM public.aiq_draft_queue q WHERE q.ticker = u.ticker AND q.status = 'queued'
   )
 ORDER BY u.ticker
 LIMIT 5
ON CONFLICT (ticker, status) DO NOTHING;

-- ---------------------------------------------------------------------------
-- updated_at trigger reuse — public.tg_set_updated_at already exists from
-- the e45 portfolio_positions migration. Bind it to new tables that mutate.
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS users_set_updated_at ON public.users;
CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

COMMIT;

-- ============================================================================
-- POST-APPLY VERIFICATION
-- ============================================================================
-- Expected after first apply (Terry as the only auth user):
SELECT
  (SELECT count(*) FROM public.users)               AS users_count,            -- 1
  (SELECT subscription_tier FROM public.users LIMIT 1) AS terry_tier,          -- owner
  (SELECT count(*) FROM public.portfolio_positions WHERE user_id IS NOT NULL) AS positions_backfilled,
  (SELECT count(*) FROM public.alert_acks WHERE user_id IS NOT NULL) AS acks_backfilled,
  (SELECT count(*) FROM public.aiq_draft_queue WHERE status = 'queued') AS queue_seeded,   -- up to 5
  (SELECT count(*) FROM public.weekly_summary)      AS weekly_rows,            -- 0
  (SELECT count(*) FROM public.insider_summary)     AS insider_rows,           -- 0
  (SELECT count(*) FROM public.macro_log)           AS macro_rows,             -- 0
  (SELECT count(*) FROM public.memo_proposals)      AS memo_proposal_rows,     -- 0
  (SELECT count(*) FROM public.universe_proposals)  AS universe_proposal_rows, -- 0
  (SELECT count(*) FROM public.position_pulse)      AS pulse_rows;             -- 0
