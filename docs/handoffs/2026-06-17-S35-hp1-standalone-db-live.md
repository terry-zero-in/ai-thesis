# S35 Handoff — HP-1 went STANDALONE; the standalone DB is stood up + verified LIVE

**Date:** 2026-06-17 (UTC)
**Branch:** `claude/magical-darwin-43eiyb`
**Supersedes:** the shared-DB premise in S33/S34 (`docs/handoffs/2026-06-16-S33/S34-*.md`). Read those for HP-1 background, but the topology + DB facts below are now authoritative.

---

## HEADLINE (read first)

1. **HP-1 topology flipped shared → STANDALONE** mid-session (main commits `9d52687`, `da08b0d`, by Terry/other-CC). HP-1 no longer shares v2's Supabase project or reads v2's `public.*`. It owns its own schema + data.
2. **The standalone HP-1 Supabase project is `uetclnhbubmkwbherwkw`** (name: "AI Thesis", us-east-1) — it IS in this session's Supabase MCP scope. The **real v2 prod project is `mvxgnliwvoauwwarrlrr`** (us-west-2) and is NOT in scope (that's why earlier sessions couldn't reach it).
3. **The standalone HP-1 DB is fully stood up and verified LIVE** on `uetclnhbubmkwbherwkw`. Three migrations applied via MCP `apply_migration` (in order): `hp1_schema` → `hp1_rls_harden` → `hp1_universe_prices_macro`.
4. **Do NOT apply `20260616000000_hp1_universe_kind_and_seed.sql` to anything** — it targets `public.universe` (shared-DB only). Terry confirmed nothing has been run against the v2 project.

---

## What is LIVE on `uetclnhbubmkwbherwkw` (verified)

- **13 `hp1` tables** + `hp1.positions` view:
  - `engine_runs`, `engine_ranks`, `fable_runs`, `fable_reviews`, `trades`, `tranches`, `anth_state`, `decisions_log`, `backtest_record`, `aiq_scores` (from `hp1_schema`)
  - `universe`, `prices`, `macro_gauges` (from `hp1_universe_prices_macro`)
- **`hp1.universe` = 53 rows**: 50 investable (42 pure_play / 8 megacap) + SPY/QQQ (benchmark) + ^VIX (macro).
- **`hp1.anth_state`** seeded: ceiling 15×, run-rate $47B (Series H, 2026-05-28), status **WAIT** (Series H mark $965B = 20.5× > 15× ceiling).
- **RLS hardened**: every policy is SELECT-only for `authenticated`; **writes go through `service_role` only** (engine Action, Fable orchestrator). `authenticated` cannot write `hp1.trades`. `anon` has SELECT grant + no policy (empty).
- **`get_advisors` security = 0 lints.**
- Migration history on the project: `hp1_schema`, `hp1_rls_harden`, `hp1_universe_prices_macro`.

Project URL: `https://uetclnhbubmkwbherwkw.supabase.co`. App reads via the authenticated user session; loaders/engine write via the service-role key.

---

## PRs merged this session (all squashed to `main`)

| PR | What |
|---|---|
| #22 | `hp1.*` canonical schema (10 tables + positions view). Adopted as canonical over the hand-written `hp1_schema.sql` (which was deleted in `da08b0d`). |
| #23 | (a) RLS harden — authenticated read-only (Codex P1: shared-project mom/dad could've written the trade ledger); (b) ingestion extension covering the 19 hp1 names in v2's ingest fns — **now MOOT under standalone**. |
| #24 | `hp1.universe` + `hp1.prices` + `hp1.macro_gauges` (the tables the canonical schema assumed from v2's `public.*`). |

---

## Key decisions made this session (don't re-litigate)

- **`engine_ranks` grain = (run_id, ticker, view, sleeve)** — lossless single-table shape for the 2-sleeve × 3-view engine. Per-name/per-view facts denormalized across the 2 sleeve rows.
- **No cross-schema FKs** — `ticker` is text, `layer` denormalized; `hp1` is self-contained/portable.
- **View partition**: `category` ∈ {pure_play (L1+L3+L4), megacap (L2+L5)}; combined = all. Engine re-ranks (z-scores) within each view.
- **`fable_reviews`** stores the rubric §7 object verbatim (sleeve TACTICAL/CORE/NONE, confidence H/M/L, action enum, adjustment hard floor −20 / operational [−10,+5]).
- **`hp1.prices.adj_close`** is what the engine reads (dividend/split adjusted).
- **Deferred**: mom-read-only identity RLS (needs the 2 provisioned uids — auth-wiring step); `fable_calibration` view (sparse until ~60 runs).

---

## Pending Terry actions (gate the next phase)

| # | Item | Blocks |
|---|---|---|
| 1 | **Price source + key**: FMP (rec, `FMP_API_KEY`) / Polygon (`POLYGON_API_KEY`) / yfinance (free bootstrap). | the price loader → `hp1.prices` → the engine. **Open question to Terry as of this handoff.** |
| 2 | The standalone project's **service-role key + URL** as GitHub Action secrets | loaders/engine writing to `hp1.*` |
| 3 | **`terry-zero-in/hp1` fork repo** + add to scope | the frontend fork (engine/loaders can live in `engine/` here meanwhile) |
| 4 | Vercel `hp1` project | deploy |
| 5 | 2 auth users (Terry write / mom read) | the identity-based RLS upgrade (currently authenticated = read-only for everyone) |

---

## Next session — start here

1. **Confirm the price source** (pending Q to Terry). Then build, in `engine/` (Python, scheduled GitHub Action → `hp1.*` via service_role):
   - **Price loader** → `hp1.prices` (the 53 tickers; engine can't score without it). Backfill history once.
   - **Adapt `engine/hp1_engine.py`**: read `hp1.prices`, compute per-view (combined/pure_play/megacap) × per-sleeve (tactical/core) ranks + breadth/gate_gross/driver_tag/above_100·200/dist/dd_from_high/sleeve_eligible/r3·r6·r12, write `hp1.engine_runs` (1 row) + `hp1.engine_ranks`. Keep Python (spec: no TS rewrite of the math).
   - **GitHub Action** workflow (post-close daily 5:30 PM CT). Pin pandas.
   - **Macro loader** → `hp1.macro_gauges` (NAAIM/AAII/F&G — sources need scraping; was an open question in v2 too).
2. **Revert the moot ingestion extension** (#23 part b) — restore v2's `ingest-fundamentals/consensus/form4/short-interest` + `_shared/supabase.ts` to pre-#23 (drop `INGEST_KINDS`). It's inert (nothing applied to v2) but dead code under standalone. Files to restore from commit `4b83aab`.
3. Then the **frontend fork** (terry-zero-in/hp1) per S33's fork plan — repoint loaders to `hp1.*`, build the 8 surfaces.

---

## Verified facts (don't re-prove)

- Standalone HP-1 project = `uetclnhbubmkwbherwkw` (in MCP scope). v2 prod = `mvxgnliwvoauwwarrlrr` (out of scope). Basis = `dmhuvacfwrfrrfwyrqlx`.
- `hp1` schema is live with 13 tables + positions view, RLS hardened (authenticated read-only), anth seeded, 0 security lints.
- `hp1.universe` 53 rows seeded; full 50-name list + layers in `HP1_SPEC_v1.1.md` §2 and the `20260617000200` migration.
- Canonical migrations on `main`: `20260617000000_hp1_schema.sql`, `20260617000100_hp1_rls_harden.sql`, `20260617000200_hp1_universe_prices_macro.sql` (+ rollbacks). The `20260616000000` universe-kind seed is **shared-DB-only — do not apply to the standalone project.**
- Engine = `engine/hp1_engine.py` (Python, currently yfinance + CSV output; needs DB-read/write adaptation). Corrected record CSVs in `engine/data/`.
