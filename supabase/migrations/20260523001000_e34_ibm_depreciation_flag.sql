-- THS-48 followup (S27 2026-05-22) — IBM depreciation flag
--
-- THS-48 acceptance asked for "all 6 hyperscalers" — at ticket-write time the
-- universe contained 6 L2 hyperscalers. By 2026-05-22 the universe contains
-- 7 (META, MSFT, GOOGL, AMZN, ORCL, IBM, CRM); IBM was the only one of the
-- six "true" hyperscalers (own data centers / own compute fleet) still
-- missing a flag row. CRM is a SaaS company running on third-party hyper-
-- scaler infrastructure — not depreciation-exposed in the same way; tracked
-- as a follow-up universe-classification question rather than a flag row.
--
-- Source: IBM 2025 Annual Report (https://www.ibm.com/downloads/documents/us-en/15db52348fc203a4)
-- IBM extended estimated total useful life of assets:
--   2021 → 5y
--   2022 → 8y
--   2023 → 9y  (peak)
--   2024–2025 → stabilized at 8y
-- Net effect: +3.0y vs the 5y baseline, providing material ongoing
-- depreciation-expense savings vs the pre-2022 policy. Penalty assigned
-- at −10 (operator boundary call, matches GOOGL's 2y/−10 with an extra
-- year of leniency for IBM since the most recent change is 2023 — outside
-- the spec's strict 24-month freshness window, but per the e24 precedent
-- ("the GAAP benefit was realized... is not erased by the calendar")
-- we apply the penalty regardless).
--
-- Burry overstatement: not flagged. IBM CEO Arvind Krishna has publicly
-- challenged hyperscaler depreciation policy (Dec 2025), arguing GPUs
-- must be useful within 5 years. IBM itself does not appear in the
-- Burry list. Leaving NULL.
--
-- Idempotent: uses NOT EXISTS guard so re-applies are no-ops.

BEGIN;

INSERT INTO public.depreciation_flags
  (ticker, flagged_at, extension_years, penalty_v, burry_overstatement_pct, source_url)
SELECT
  'IBM',
  DATE '2026-05-22',
  3.0,
  -10,
  NULL,
  'https://www.ibm.com/downloads/documents/us-en/15db52348fc203a4'
WHERE NOT EXISTS (
  SELECT 1 FROM public.depreciation_flags
   WHERE ticker = 'IBM' AND flagged_at = DATE '2026-05-22'
);

COMMIT;
