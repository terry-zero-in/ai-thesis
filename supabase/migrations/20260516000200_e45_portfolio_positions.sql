-- THS-55 (E4.5) — Portfolio positions tracker.
--
-- Tracks the live $100K deployment. Schema is single-tenant — there is
-- one portfolio (the owner's). Positions are FK'd to universe, so only
-- investable names can be entered. Close a position by setting closed_at
-- (soft delete) rather than DELETEing the row, so historical P&L remains
-- queryable.
--
-- portfolio_settings is a singleton (id=1) holding total capital and
-- target reserve. Stored in the DB rather than hard-coded in app code so
-- the editor can adjust them later (THS-55b follow-on) without a redeploy.

BEGIN;

-- ---------------------------------------------------------------------------
-- portfolio_settings — singleton row pinned to id=1.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_settings (
  id              smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_capital   numeric NOT NULL CHECK (total_capital > 0),
  target_reserve  numeric NOT NULL CHECK (target_reserve >= 0),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_settings_reserve_le_total CHECK (target_reserve <= total_capital)
);

COMMENT ON TABLE public.portfolio_settings IS
  'Singleton settings row for the v1 single-tenant portfolio. id is locked to 1.';

INSERT INTO public.portfolio_settings (id, total_capital, target_reserve)
VALUES (1, 100000, 20000)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- portfolio_positions — one row per ticker held (or previously held).
-- shares + cost_basis are at the per-share level; market value derives from
-- latest prices_raw.close in the app layer.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.portfolio_positions (
  ticker        text PRIMARY KEY REFERENCES public.universe(ticker) ON DELETE RESTRICT,
  shares        numeric NOT NULL CHECK (shares > 0),
  cost_basis    numeric NOT NULL CHECK (cost_basis > 0),
  opened_at     date NOT NULL DEFAULT CURRENT_DATE,
  closed_at     date,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_positions_closed_after_opened
    CHECK (closed_at IS NULL OR closed_at >= opened_at)
);

COMMENT ON TABLE public.portfolio_positions IS
  'Live + historical portfolio positions. closed_at NULL = open position. shares & cost_basis are per-share quantities.';

CREATE INDEX IF NOT EXISTS portfolio_positions_open_idx
  ON public.portfolio_positions (ticker) WHERE closed_at IS NULL;

-- ---------------------------------------------------------------------------
-- updated_at trigger so the app can show last-touched timestamps without
-- having to set them explicitly on every UPSERT.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS portfolio_positions_set_updated_at ON public.portfolio_positions;
CREATE TRIGGER portfolio_positions_set_updated_at
  BEFORE UPDATE ON public.portfolio_positions
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

DROP TRIGGER IF EXISTS portfolio_settings_set_updated_at ON public.portfolio_settings;
CREATE TRIGGER portfolio_settings_set_updated_at
  BEFORE UPDATE ON public.portfolio_settings
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-Level Security — authenticated-only for both read and write.
-- The portfolio is private to the operator; anon visitors should not see
-- positions even though scores are public.
-- ---------------------------------------------------------------------------
ALTER TABLE public.portfolio_settings  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_settings  FORCE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_positions FORCE ROW LEVEL SECURITY;

CREATE POLICY portfolio_settings_authenticated_all ON public.portfolio_settings
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY portfolio_positions_authenticated_all ON public.portfolio_positions
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- No SELECT grant to anon — portfolio is private. authenticated inherits
-- SELECT via the policy above and the default authenticated role grants.
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.portfolio_settings,
  public.portfolio_positions
TO authenticated;

COMMIT;
