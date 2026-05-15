# AI Thesis v2 — Supabase Schema

Source of truth for the database. Migrations live in `supabase/migrations/` and
are applied in filename (timestamp) order. Rollback scripts live in
`supabase/migrations/rollback/` and are run manually when needed.

The full target schema is in
[`AI-Thesis-v2-Algorithm-and-Deployment.md`](./AI-Thesis-v2-Algorithm-and-Deployment.md)
Part 4. This doc is the operator's-view companion — what shipped, when, and how
to apply / roll back.

## Migration ledger

| Timestamp        | Ticket | File                                                | Status  |
| ---------------- | ------ | --------------------------------------------------- | ------- |
| 20260515000000   | THS-35 | `20260515000000_e11_init_core_tables.sql`           | applied |
| 20260515000100   | THS-36 | `20260515000100_e12_overlay_tables.sql`             | applied |
| 20260515000200   | THS-37 | `20260515000200_e13_seed_universe.sql`              | applied |

## Tables (current)

### `universe` (THS-35)
Hand-curated 70-name list across 5 layers. PK `ticker`. `layer` is 1..5 with a
human label. `is_active` lets us soft-retire names without losing history.

### `fundamentals_raw` (THS-35)
FMP fundamentals. PK `(ticker, period_end, period_type)` where `period_type` is
`'Q'` or `'A'`. Idempotent ingestion: re-running the same period overwrites the
same row.

### `consensus` (THS-35)
Daily analyst consensus snapshot. PK `(ticker, as_of)`. `rating_avg` is FMP
convention: 1 = strong buy, 5 = strong sell.

### `prices_raw` (THS-35)
Daily OHLCV. PK `(ticker, date)`. Indexed `(ticker, date DESC)` for momentum
lookbacks and own-history valuation z-scores.

### `revisions` (THS-35)
Derived analyst-revision deltas, computed nightly from `consensus` diffs by the
THS-39 job. PK `(ticker, as_of)`.

### `aiq_rubric` (THS-36)
Manually scored AIQ rubric across six dimensions (Disclosure 20, Defensibility 20,
Concentration 15, Capex efficiency 15, Independent demand 15, Accounting 15).
`total` is a `GENERATED ALWAYS AS (...) STORED` column — you cannot write to it
directly; it always equals the sum of the components, indexable like any other
column. PK `(ticker, scored_at)`.

### `depreciation_flags` (THS-36)
Hyperscaler depreciation-extension and Burry-style overstatement flags. Feeds
`v_penalty` in the V-score. PK `(ticker, flagged_at)`.

### `scores_history` (THS-36)
Per-ticker composite scores, tier classification, and the full
`factor_breakdown` JSONB the UI consumes. `tier` is constrained to
`High | Medium | Low | Avoid`; `macro_gates_hit` is 0..3. Indexed for the three
hot query patterns:
- latest snapshot: `(as_of DESC)` and `(as_of DESC, final_score DESC)` for the leaderboard
- tier filter: partial index `(tier, as_of DESC) WHERE tier IS NOT NULL`
- JSONB containment lookups: GIN `jsonb_path_ops` on `factor_breakdown` and `layer_weights`

## Row-Level Security

Every table has RLS **enabled** and **forced**.

| Role            | Grants                              | Behavior                                                                    |
| --------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| `anon`          | `SELECT`                            | RLS has no policy for anon → query returns `[]` (empty array, not an error) |
| `authenticated` | `SELECT, INSERT, UPDATE, DELETE`    | Policy `*_authenticated_all` allows access when `auth.uid() IS NOT NULL`    |
| `service_role`  | `ALL`                               | Bypasses RLS (Postgres role attribute) — used by edge functions             |

Single-tenant assumption: Terry is the only authenticated user. If that ever
changes we tighten the policies to a specific `auth.uid()` check.

## Applying migrations

Local dev (Supabase CLI):

```bash
# from repo root
supabase start          # spins up local Postgres + studio
supabase db reset       # re-applies all migrations from scratch
```

Remote (production project):

```bash
supabase link --project-ref <ref>
supabase db push        # applies pending migrations
```

Or, without the CLI, against any Postgres:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260515000000_e11_init_core_tables.sql
```

## Rolling back

Rollbacks are explicit `DROP` scripts in `supabase/migrations/rollback/` keyed
to the same timestamp as the up migration. They run in reverse order — drop
children before `universe` so FK constraints don't block.

```bash
psql "$DATABASE_URL" -f supabase/migrations/rollback/20260515000000_e11_rollback.sql
```

Re-applying the up migration after rollback is supported and clean (verified in
THS-35; tables, indexes, RLS, and grants all come back identically).

## Verification on a fresh DB

After applying THS-35, every check below should hold:

1. `SELECT count(*) FROM pg_tables WHERE schemaname='public'` returns `5`.
2. `SELECT count(*) FROM pg_policies WHERE schemaname='public'` returns `5`.
3. `SELECT relrowsecurity, relforcerowsecurity FROM pg_class WHERE relname IN
   ('universe','fundamentals_raw','consensus','prices_raw','revisions')` returns
   `(t, t)` for all five.
4. As `anon` with `SET ROLE anon`, a `SELECT * FROM public.universe` returns 0
   rows even after a row is inserted via service_role.
5. FK to `universe(ticker)` blocks inserts into child tables for unknown
   tickers.
6. `period_type` rejects values other than `'Q'` or `'A'`; `layer` rejects
   values outside 1..5.
