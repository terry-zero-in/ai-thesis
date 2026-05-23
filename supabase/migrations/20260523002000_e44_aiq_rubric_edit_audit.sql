-- THS-75 (E4.4) — AIQ cockpit edit-audit columns.
--
-- Lightweight per-row audit fields:
--   * confidence — operator's qualitative confidence in the scoring
--     (High / Medium / Low). Free text by convention; no enum so we
--     can evolve the rubric without a migration.
--   * last_change_reason — free-text rationale for the most-recent
--     edit to this row. Versioning is already captured by the PK
--     (ticker, scored_at); this column gives the operator a place to
--     record *why* a same-day re-save happened.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS so re-running the migration
-- is safe.
BEGIN;

ALTER TABLE public.aiq_rubric
  ADD COLUMN IF NOT EXISTS confidence text,
  ADD COLUMN IF NOT EXISTS last_change_reason text;

COMMENT ON COLUMN public.aiq_rubric.confidence IS
  'Operator confidence in this scoring (High/Medium/Low). Surfaced as a chip on the /aiq/[ticker] cockpit.';
COMMENT ON COLUMN public.aiq_rubric.last_change_reason IS
  'Free-text rationale for the most-recent edit to this row (THS-75 cockpit). Audit-only — versioning is captured by (ticker, scored_at).';

COMMIT;
