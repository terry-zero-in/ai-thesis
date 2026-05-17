-- THS-65 (E6.3) — Daily memo persistence.
--
-- One row per cron run. `kind` distinguishes daily vs weekly memos
-- (weekly = THS-66). `body` is the rendered markdown for /memos. `sections`
-- is the parsed structure (top_movers / insiders / macro / data_gaps).
-- `model` records which Claude model produced the memo for cost / quality
-- attribution. `failed` + `error` capture cron failures so /memos shows
-- WHY a memo is missing instead of silently empty.

BEGIN;

CREATE TABLE IF NOT EXISTS public.memos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('daily', 'weekly')),
  as_of         date NOT NULL,
  headline      text,
  body          text,
  sections      jsonb,
  model         text,
  generated_at  timestamptz NOT NULL DEFAULT now(),
  failed        boolean NOT NULL DEFAULT false,
  error         text,
  UNIQUE (kind, as_of)
);

COMMENT ON TABLE public.memos IS
  'Daily (8am CT) and weekly (Sun evening) memos produced by the Sonnet/Opus crons. One row per (kind, as_of). failed=true rows record cron failures so /memos surfaces the gap.';

CREATE INDEX IF NOT EXISTS memos_kind_asof_desc_idx
  ON public.memos (kind, as_of DESC);

CREATE INDEX IF NOT EXISTS memos_generated_at_desc_idx
  ON public.memos (generated_at DESC);

ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memos FORCE ROW LEVEL SECURITY;

CREATE POLICY memos_authenticated_all ON public.memos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT ON public.memos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.memos TO authenticated;
GRANT ALL ON public.memos TO service_role;

COMMIT;
