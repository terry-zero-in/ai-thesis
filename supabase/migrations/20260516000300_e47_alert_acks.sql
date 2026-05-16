-- THS-57 (E4.7) — Alert acknowledgements for /decisions.
--
-- Alerts (tier changes, ≥10pt drops on High-conviction names, AIQ drift
-- >10, macro gate flips, insider clusters) are DERIVED on read from
-- scores_history + macro_gauges + (eventually) Form 4 ingestion — there
-- is no separate "alerts" table. The source-of-truth time series is
-- already persisted.
--
-- The only state we need to persist is which alerts have been
-- acknowledged so the topnav unseen-count badge can dial down. We key
-- by a string composed by the app layer:
--   tier_change:<ticker>:<as_of>
--   conv_drop:<ticker>:<as_of>
--   aiq_drift:<ticker>:<as_of>
--   macro_flip:<as_of>
-- This avoids a NULLABLE ticker + composite-PK gymnastics.

BEGIN;

CREATE TABLE IF NOT EXISTS public.alert_acks (
  alert_key   text PRIMARY KEY,
  acked_at    timestamptz NOT NULL DEFAULT now(),
  acked_note  text
);

COMMENT ON TABLE public.alert_acks IS
  'Per-alert acknowledgements. alert_key encodes (kind, ticker, as_of) — alerts themselves are derived from scores_history / macro_gauges and not stored.';

ALTER TABLE public.alert_acks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_acks FORCE ROW LEVEL SECURITY;

CREATE POLICY alert_acks_authenticated_all ON public.alert_acks
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.alert_acks TO authenticated;

COMMIT;
