-- THS-46 (E3.1) — Seed aiq_rubric with the hand-scored slate from spec doc Part 3
-- Ref: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §"Tier-A composite table"
-- (lines 196-217) and the "Scoring rationale (compressed)" detail per name.
--
-- The 6-dimension rubric (caps: 20+20+15+15+15+15=100) maps to:
--   disclosure_pts    — clarity of AI-revenue disclosure in filings
--   defensibility_pts — durability of the AI competitive position
--   concentration_pts — customer-concentration risk on the AI revenue
--   capex_eff_pts     — capital-efficiency of the AI build (layer-aware)
--   indep_demand_pts  — diversity of AI demand drivers
--   accounting_pts    — accounting hygiene around AI economics
--
-- The `total` column is GENERATED ALWAYS AS the sum and is asserted at the
-- end of this migration against the spec table.
--
-- ─── Scope deviations from ticket "20-name hand-score" ─────────────────────
--
-- 1. Two of the 20 hand-scored names are NOT in the active universe seed
--    (`20260515000200_e13_seed_universe.sql`): NOW (ServiceNow) and INTU
--    (Intuit). The aiq_rubric.ticker → universe.ticker FK rejects both. They
--    appear in the spec doc's Part 3 hand-score table but were not in the
--    final deployment slate of 50 names. This seed therefore ships 18 rows,
--    not 20. Adding NOW/INTU to the universe is out of scope here — track
--    via THS-46-followup if Terry wants them included.
--
-- 2. The spec doc has two arithmetic inconsistencies between the table
--    composite (column "AIQ") and the per-dimension breakdown in the
--    rationale paragraphs:
--      - GOOGL: table=74, dims=14+18+12+10+13+8=75
--      - ORCL:  table=60, dims=10+14+5+8+9+6=52
--    This seed uses the documented per-dimension scores (the rationale
--    text has more rigor than the rolled-up table). The aiq_rubric.total
--    GENERATED column therefore lands at 75 / 52 respectively. Flagged
--    for next quarterly review (the AIQ editor / THS-54 will be the
--    canonical place to reconcile).
--
-- 3. The remaining 8 names with no explicit per-dimension breakdown in the
--    spec doc rationale (CEG, VRT, MSFT, AMZN, CRWD, SNOW, ASML, LRCX) get
--    derived breakdowns that sum to the spec-table total, distributed
--    roughly in proportion to dimension caps (20/20/15/15/15/15). Each
--    such row's `notes` column flags it as "derived from spec total —
--    refine in next quarterly review."

BEGIN;

-- scored_at = 2026-05-14 per ticket acceptance criteria.

-- ─── Names with documented per-dimension scores from spec rationale ───
-- (10 of 18 — TSM, NVDA, AVGO, VST, GEV, GOOGL, ANET, PLTR, ORCL, META)

INSERT INTO public.aiq_rubric
  (ticker, scored_at, disclosure_pts, defensibility_pts, concentration_pts,
   capex_eff_pts, indep_demand_pts, accounting_pts, notes)
VALUES
  -- TSM (92) — disclosure 18, defensibility 18, concentration 12, capex 15, indep 14, acct 15
  ('TSM', '2026-05-14', 18, 18, 12, 15, 14, 15,
   'HPC segment explicit (61%) → 18. EUV monopoly + leading-edge moat → 18. Diversified across hyperscalers + NVDA + AAPL → 12. Excellent capex → 15. Hyperscaler + Apple + automotive base → 14. Clean accounting → 15. Spec: §1.'),

  -- NVDA (87) — 20, 20, 8, 15, 12, 12
  ('NVDA', '2026-05-14', 20, 20, 8, 15, 12, 12,
   'Data center 88%+ of revenue → 20. CUDA moat → 20. Top customer ~25% → 8. Capex eff leader → 15. Limited beyond hyperscalers → 12. Clean but inventory concerns flagged → 12. Spec: §2.'),

  -- AVGO (84) — 18, 18, 8, 14, 12, 14
  ('AVGO', '2026-05-14', 18, 18, 8, 14, 12, 14,
   'AI segment broken out → 18. Custom silicon + networking + VMware → 18. Top 2 customers ~50% → 8. Capex eff → 14. Indep demand → 12. Accounting → 14. Spec: §3.'),

  -- VST (78) — 12, 16, 10, 13, 13, 14
  ('VST', '2026-05-14', 12, 16, 10, 13, 13, 14,
   'PPA structure → 12. Dispatchable generation + nuclear fleet → 16. Diversified across hyperscalers → 10. Capex eff → 13. Indep demand → 13. Clean accounting → 14. Spec: §4.'),

  -- GEV (78) — 12, 16, 11, 13, 13, 13
  ('GEV', '2026-05-14', 12, 16, 11, 13, 13, 13,
   'Grid + electrification = AI proxies (not explicit) → 12. Heavy industrial moat → 16. Concentration good → 11. Capex eff → 13. Utilities + data center → 13. Solid accounting → 13. Spec: §5.'),

  -- GOOGL (table=74, dims=75) — 14, 18, 12, 10, 13, 8 → total computes to 75
  ('GOOGL', '2026-05-14', 14, 18, 12, 10, 13, 8,
   'Cloud growth as AI proxy reasonable → 14. Gemini + TPU + search distribution → 18. Highly diversified → 12. Mid-teens FCF yield (50% maint capex) → 10. Indep demand strong → 13. No useful-life extension in 24mo → 8. Spec: §6. NOTE: dims sum to 75 vs spec table 74 — arithmetic discrepancy in source doc.'),

  -- ANET (85) — 18, 16, 10, 14, 12, 15
  ('ANET', '2026-05-14', 18, 16, 10, 14, 12, 15,
   'Explicit AI target $3.5B → 18. Ethernet-for-AI moat solidifying → 16. Meta + Microsoft top 2 → 10. Capex eff → 14. Growing enterprise → 12. Accounting → 15. Spec: §8.'),

  -- PLTR (69) — 18, 16, 8, 10, 9, 8
  ('PLTR', '2026-05-14', 18, 16, 8, 10, 9, 8,
   'Foundry/AIP disclosure → 18. Government moat → 16. Top customer large → 8. Capital-light → 10. Strong demand → 9. SBC-heavy + related-party risk → 8. Spec: §12.'),

  -- ORCL (table=60, dims=52) — 10, 14, 5, 8, 9, 6 → total computes to 52
  ('ORCL', '2026-05-14', 10, 14, 5, 8, 9, 6,
   'Disclosure OK but OpenAI concentration → 10. OCI GPU access → 14. OpenAI 30%+ of OCI revenue → 5. Capex eff → 8. Limited beyond OpenAI → 9. Extended useful life + RPO question → 6. Spec: §15. NOTE: dims sum to 52 vs spec table 60 — arithmetic discrepancy in source doc, flagged for next quarterly review.'),

  -- META (54) — 10, 14, 10, 6, 8, 6
  ('META', '2026-05-14', 10, 14, 10, 6, 8, 6,
   'No AI revenue line → 10. Llama + ad ML + Reality Labs sunk cost → 14. Ad customers diverse → 10. Reality Labs drag → 6. Indep demand → 8. Two useful-life extensions, $2.3B benefit → 6. Spec: §16.'),

-- ─── Names with derived breakdowns (sum to spec-table total) ───
-- 8 of 18 — CEG, VRT, MSFT, AMZN, CRWD, SNOW, ASML, LRCX

  -- CEG (75) — 15, 15, 11, 11, 11, 12
  ('CEG', '2026-05-14', 15, 15, 11, 11, 11, 12,
   'Derived from spec-table AIQ=75. Decomposition approximate — refine in next quarterly review.'),

  -- VRT (80) — 16, 16, 12, 12, 12, 12
  ('VRT', '2026-05-14', 16, 16, 12, 12, 12, 12,
   'Derived from spec-table AIQ=80. Decomposition approximate — refine in next quarterly review.'),

  -- MSFT (71) — 14, 14, 11, 11, 11, 10
  ('MSFT', '2026-05-14', 14, 14, 11, 11, 11, 10,
   'Derived from spec-table AIQ=71. Decomposition approximate — refine in next quarterly review.'),

  -- AMZN (70) — 14, 14, 11, 10, 11, 10
  ('AMZN', '2026-05-14', 14, 14, 11, 10, 11, 10,
   'Derived from spec-table AIQ=70. Decomposition approximate — refine in next quarterly review.'),

  -- CRWD (70) — 14, 14, 11, 10, 11, 10
  ('CRWD', '2026-05-14', 14, 14, 11, 10, 11, 10,
   'Derived from spec-table AIQ=70. Decomposition approximate — refine in next quarterly review.'),

  -- SNOW (64) — 13, 13, 10, 9, 10, 9
  ('SNOW', '2026-05-14', 13, 13, 10, 9, 10, 9,
   'Derived from spec-table AIQ=64. Decomposition approximate — refine in next quarterly review.'),

  -- ASML (88) — 18, 18, 13, 13, 13, 13
  ('ASML', '2026-05-14', 18, 18, 13, 13, 13, 13,
   'Derived from spec-table AIQ=88. Decomposition approximate — refine in next quarterly review.'),

  -- LRCX (78) — 16, 16, 12, 12, 11, 11
  ('LRCX', '2026-05-14', 16, 16, 12, 12, 11, 11,
   'Derived from spec-table AIQ=78. Decomposition approximate — refine in next quarterly review.')
ON CONFLICT (ticker, scored_at) DO UPDATE SET
  disclosure_pts    = EXCLUDED.disclosure_pts,
  defensibility_pts = EXCLUDED.defensibility_pts,
  concentration_pts = EXCLUDED.concentration_pts,
  capex_eff_pts     = EXCLUDED.capex_eff_pts,
  indep_demand_pts  = EXCLUDED.indep_demand_pts,
  accounting_pts    = EXCLUDED.accounting_pts,
  notes             = EXCLUDED.notes;

-- ─── Assertions ──────────────────────────────────────────────────────────
-- Sum-check: each row's GENERATED total matches the documented spec total
-- (where dims and spec agree). For GOOGL / ORCL, the asserted total is the
-- dim-sum, not the spec-table number — see header notes for rationale.

DO $$
DECLARE
  expected jsonb := jsonb_build_object(
    'TSM', 92, 'NVDA', 87, 'AVGO', 84, 'VST', 78, 'GEV', 78,
    'GOOGL', 75,                                    -- spec table 74, dims 75
    'ANET', 85, 'PLTR', 69,
    'ORCL', 52,                                     -- spec table 60, dims 52
    'META', 54,
    'CEG', 75, 'VRT', 80, 'MSFT', 71, 'AMZN', 70,
    'CRWD', 70, 'SNOW', 64, 'ASML', 88, 'LRCX', 78
  );
  k text;
  observed int;
BEGIN
  FOR k IN SELECT jsonb_object_keys(expected) LOOP
    SELECT total INTO observed
      FROM public.aiq_rubric
      WHERE ticker = k AND scored_at = '2026-05-14';
    IF observed IS NULL THEN
      RAISE EXCEPTION 'aiq_rubric row missing for ticker=%', k;
    END IF;
    IF observed <> (expected ->> k)::int THEN
      RAISE EXCEPTION 'aiq_rubric total mismatch for ticker=%: expected %, got %',
        k, expected ->> k, observed;
    END IF;
  END LOOP;
END $$;

COMMIT;
