-- THS-42 — Seed `ai_segment_overrides` with the explicit AI-revenue
-- disclosures cited in docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Part 3.
--
-- Only includes rows where the spec cites an explicit absolute USD figure
-- with a source URL. Names whose AI exposure is disclosed only as a
-- percentage of total revenue (e.g. TSMC HPC = 61%) or only as a growth
-- rate (e.g. GOOGL Cloud +63% YoY) are NOT seeded here — adding them
-- requires either the absolute figure from FMP fundamentals at engine time
-- or an operator-curated addition.
--
-- ON CONFLICT DO NOTHING so re-running the migration on a populated table
-- never overwrites operator-curated edits.

BEGIN;

INSERT INTO public.ai_segment_overrides
  (ticker, period_end, ai_revenue, ai_revenue_source_url, disclosure_quality, notes)
VALUES
  (
    'NVDA',
    DATE '2026-04-27',
    39100000000,
    'https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-first-quarter-fiscal-2026',
    'explicit',
    'Q1 FY26 data center segment revenue $39.1B, disclosed in earnings release. Up 73% YoY.'
  ),
  (
    'AVGO',
    DATE '2026-02-02',
    8400000000,
    'https://investors.broadcom.com/news-releases/news-release-details/broadcom-inc-announces-first-quarter-fiscal-year-2026-financial',
    'explicit',
    'Q1 FY26 AI semiconductor revenue $8.4B, disclosed in earnings release. Q2 guide $10.7B (+140% YoY).'
  )
ON CONFLICT (ticker, period_end) DO NOTHING;

COMMIT;
