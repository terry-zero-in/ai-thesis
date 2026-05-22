# S26 → SC handoff: paste this into a fresh Claude Code session with Supabase + Linear MCP wired

**Target session:** Fresh Claude Code on the web session with Linear MCP + Supabase MCP both connected.
**Date authored:** 2026-05-22
**Author session:** S26 remote (Supabase MCP disconnected mid-work; this handoff exists because the fresh session can complete what S26 couldn't).

---

## 🎯 Confirm you have the right Supabase project before doing ANYTHING

Run this first:

```
mcp__Supabase__list_projects
```

Expected: 2 projects in org `vercel_icfg_KtM5dD6oeBiWBB7es126PZQx`. The one you want is:

| Field | Value |
|---|---|
| **Project ID / ref** | **`mvxgnliwvoauwwarrlrr`** |
| Name | `AI Thesis` |
| Region | us-west-2 |
| Postgres | 17.6.1.121 |
| DB host | `db.mvxgnliwvoauwwarrlrr.supabase.co` |
| Created | 2026-05-17 |
| Status | ACTIVE_HEALTHY |

The other project (`ydzvrosvkmqkdaqgsxtb` = Reticle) is a separate codebase. **Do NOT touch it.** Every Supabase MCP call in this session goes against `mvxgnliwvoauwwarrlrr`.

If you don't see AI Thesis in `list_projects`, the connector is bound to the wrong org. Stop and tell Terry — reauthorize first.

---

## Repo state at handoff

```
Branch:    claude/beautiful-carson-QaTLG (per CLAUDE.md for remote sessions)
HEAD:      0934426 docs: S26 handoff + correct migration state in setup checklist
Commits ahead of origin/main: 13 (all pushed to remote claude/beautiful-carson-QaTLG)
Working tree: clean
TSC:       exit 0 verified on every commit
Dev server: none running in this container (no preview surface in remote env)
```

Read these in order before any work:

1. `CLAUDE.md` — autonomous-by-default posture
2. `docs/handoffs/2026-05-21-S25-remote-fixture-strip-routine-docs-rename.md` — S25 context (8 commits)
3. `docs/handoffs/2026-05-22-S26-page-audits-token-sweep-migration-finding.md` — S26 context (5 commits + this one)
4. `docs/setup/2026-05-21-supabase-setup-checklist.md` — the paste-ready SQL setup playbook
5. `docs/routines/README.md` + `docs/routines/01-daily-batch.md` + `docs/routines/02-weekly-rescore.md` — routine prompts (memo cadence is WEEKLY, not daily)

---

## Personal-tool pivot (NON-NEGOTIABLE context for fresh session)

AI Thesis v2 is no longer a paid product. It is a **3-user personal tool**: Terry + Mom + Dad, each with their own login + private portfolio. Research / scoring / memos are shared across all 3.

- `portfolio_positions` and `portfolio_settings` → per-user (`auth.uid() = user_id` RLS)
- `universe`, `scores_history`, `aiq_drafts`, `memos`, `macro_log`, `macro_gauges` → shared (anon SELECT)
- Blank empty states are correct. **Do not invent fixture/synthetic/demo data.** Terry verbatim: "I dont care if something shows as blank."
- Memo cadence is WEEKLY (writer lives in weekly-rescore TASK 3, NOT daily-batch). Do NOT move it back to daily.

---

## 🔥 The critical finding S26 surfaced

**Prod is missing 2 migrations** that exist on disk:

| Migration | What it does | Impact if missing |
|---|---|---|
| `20260518000100_e25_aiq_scores_cron` | Saturday cron — denormalizes `aiq_rubric` → `scores_history.aiq_score` | Per-factor UI won't show AIQ scores until applied |
| `20260518000200_e80_routines_pr1` | Multi-tenant pivot: creates `public.users` (FK auth.users), adds `user_id` + `auth.uid() = user_id` RLS to `portfolio_settings/portfolio_positions/alert_acks`, creates 6 routine output tables (`aiq_draft_queue`, `weekly_summary`, `memo_proposals`, `position_pulse`, `universe_proposals`, etc.) | **Hard prereq.** Mom + Dad onboarding blocked. Routines literally cannot fire — `aiq_draft_queue` doesn't exist. |

Migration body inspection (e80):
- Atomic (`BEGIN/COMMIT` wrap)
- Idempotent (`IF NOT EXISTS` everywhere, `ON CONFLICT DO NOTHING` for seeds)
- Backfills existing portfolio rows before setting `NOT NULL`
- Safe to re-run

**Hard prereq the migration enforces:** Terry must have signed in to the app at least once (creates `auth.users` row for `terryturner2026@gmail.com`) or migration `RAISE EXCEPTION`s with: *"No auth.users row for terryturner2026@gmail.com. Sign in to the app once before running this migration."*

---

## Sequence to run (in order — STOP and ask Terry between gates)

### Gate 0 — confirm prereqs (read-only)

```sql
-- Via mcp__Supabase__execute_sql on project mvxgnliwvoauwwarrlrr
SELECT id, email, created_at
  FROM auth.users
 WHERE email = 'terryturner2026@gmail.com';
```

Expected: exactly 1 row. If 0 rows → STOP. Ask Terry to sign in at `https://ai-thesis-v2.vercel.app/login` first, then resume.

```sql
SELECT name FROM supabase_migrations.schema_migrations
 WHERE name LIKE '20260518%' OR name LIKE '20260517%'
 ORDER BY name;
```

Expected at handoff time: only `20260517000000_e24_extend_depreciation_flags` and `20260517000100_e44_aiq_rubric_sources_jsonb`. The 2 missing ones (`20260518000100` and `20260518000200`) will NOT be present.

### Gate 1 — apply the 2 missing migrations

**Before calling `apply_migration`: confirm with Terry.** This is hard-to-reverse. Quote the migration name + first paragraph of header comment so Terry can confirm.

```
mcp__Supabase__apply_migration   project_id = mvxgnliwvoauwwarrlrr
                                  name = e25_aiq_scores_cron
                                  query = <contents of supabase/migrations/20260518000100_e25_aiq_scores_cron.sql>

mcp__Supabase__apply_migration   project_id = mvxgnliwvoauwwarrlrr
                                  name = e80_routines_pr1
                                  query = <contents of supabase/migrations/20260518000200_e80_routines_pr1.sql>
```

If e80 fails on the auth.users RAISE, Gate 0 wasn't satisfied — go back.

### Gate 2 — verify schema state post-migration

```sql
-- Confirm public.users created
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'users';

-- Confirm portfolio_positions now has user_id NOT NULL
SELECT column_name, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name = 'portfolio_positions'
   AND column_name IN ('user_id', 'ticker');

-- Confirm per-user RLS policy landed
SELECT polname, pg_get_expr(polqual, polrelid) AS qual
  FROM pg_policy
 WHERE polrelid = 'public.portfolio_positions'::regclass;
-- Expected: policy "portfolio_positions_self_all" with qual containing "auth.uid() = user_id"

-- Confirm routine output tables exist
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('aiq_draft_queue','weekly_summary','memo_proposals','position_pulse','universe_proposals','insider_summary','macro_log');
-- Expected: all 7
```

### Gate 3 — security advisor + lint check

```
mcp__Supabase__get_advisors  project_id = mvxgnliwvoauwwarrlrr  type = security
mcp__Supabase__get_advisors  project_id = mvxgnliwvoauwwarrlrr  type = performance
```

Report any new advisories to Terry. RLS on the new tables should pass; the seed `public.users` row for Terry should already exist via the migration's DO block.

### Gate 4 — create Mom + Dad auth users

Supabase MCP cannot directly create `auth.users` rows (no Auth Admin API tool). Two options:

a. **Recommended:** Ask Terry to add them in Studio → Authentication → Users → "Add user" → email + password. Then return.
b. Alternative: SQL approach with `auth.admin_create_user` is risky and depends on extension state. Skip unless Terry insists.

Once Mom + Dad exist in `auth.users`, run:

```sql
-- Backfill public.users for the 2 new users (run for each).
-- Get their auth.uid first:
SELECT id, email FROM auth.users WHERE email IN ('<mom-email>', '<dad-email>');

-- Then insert (substitute UUIDs):
INSERT INTO public.users (id, email, subscription_tier)
VALUES
  ('<mom-uuid>', '<mom-email>', 'free'),
  ('<dad-uuid>', '<dad-email>', 'free')
ON CONFLICT (id) DO NOTHING;

-- Initialize portfolio_settings row for each (defaults from spec — book cap $100K, reserve target 20%):
INSERT INTO public.portfolio_settings (user_id, total_book_cap, reserve_target_pct, max_position_pct, max_layer_pct)
VALUES
  ('<mom-uuid>', 100000, 0.20, 0.08, 0.40),
  ('<dad-uuid>', 100000, 0.20, 0.08, 0.40)
ON CONFLICT (user_id) DO NOTHING;
```

### Gate 5 — fire one-shot routines so pages populate

Read `docs/routines/01-daily-batch.md` and `02-weekly-rescore.md`. Each routine's "Paste-ready prompt" is the system + user message to invoke as a routine.

For a fresh session firing manually:
- Run TASK 1 (insider digest) and TASK 2 (macro state) of daily-batch via direct SQL writes. Both pull from real FMP/Polygon data — only fire if FMP/Polygon env keys are configured in Supabase Edge Function Secrets (check by trying to call those edge functions, or have Terry confirm).
- Run TASK 3 of daily-batch (AIQ draft queue) — this Calls Anthropic; requires `ANTHROPIC_API_KEY` in Edge Function Secrets.
- Run weekly-rescore TASKs 1-4 (full Saturday flow) for the same reasons.

If env secrets aren't set, STOP and tell Terry which secrets are missing per `web/.env.local.example`:
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `FMP_API_KEY`
- `POLYGON_API_KEY`
- `CRON_INVOKE_SECRET` (only needed for scheduled invocation; not for one-shot fire)

### Gate 6 — Linear: mark shipped work as Done

Linear MCP available. Project hub: https://linear.app/basisuw/project/ai-thesis-v2-scoring-engine-and-portfolio-79a38aec2b49

Tickets relevant to S25 + S26's shipped work (find by THS- prefix on the THS team):

- Tickets covering fixture/demo strip — mark Done. Reference commits `e1d6aee`, `7712493`, `cd4a7d5`, `92f2da5`, `eeeb233`, `84479c2`.
- Memo cadence fix → THS-XX (find the daily-batch ticket; comment on the cadence move).
- Setup-guide audit → comment with `dbab19c`.
- Motion audit + page audit reports → attach the two audit doc URLs (in the repo at `docs/audits/2026-05-21-motion-audit.md` and `docs/audits/2026-05-21-page-walk-audit.md`).
- E80 migration application → create a new ticket if none exists ("Apply e80 multi-tenant migration to prod"), mark Done after Gate 2 passes.

Use `mcp__21847a4e-3751-48c1-8e65-e834df6bef8a__list_issues` with `team = THS` to find pending tickets. Use `mcp__21847a4e-3751-48c1-8e65-e834df6bef8a__save_issue` to update state. Use `mcp__21847a4e-3751-48c1-8e65-e834df6bef8a__save_comment` to add the commit-reference comments.

---

## Honesty constraints for the fresh session

- **Never claim a status without fresh evidence** (per `superpowers:verification-before-completion`). Run the verification SQL, paste the output, then claim. Do not say "should pass" or "looks correct."
- **Confirm before `apply_migration`** — Hard-to-reverse. Show the migration name + relevant header comment + the change Terry is approving.
- **Do not invent demo data.** If a routine prompt asks you to write a row but the upstream data isn't available (e.g., no FMP key set so no `prices_raw` rows), STOP and tell Terry rather than synthesizing.
- **Blank pages are fine** until real routines fire. Terry's directive: "I dont care if something shows as blank."

---

## What S26 was about to do but couldn't (MCP dropped)

1. ✓ Already done: `list_projects` confirmed AI Thesis = `mvxgnliwvoauwwarrlrr`
2. ✓ Already done: `list_migrations` showed 2 missing
3. ✗ Was about to: `execute_sql` for the auth.users check (Gate 0 above)
4. ✗ Was about to: confirm Terry's go-ahead, then `apply_migration` for both missing migrations
5. ✗ Was about to: post-migration schema verification (Gate 2)

Fresh session resumes at Gate 0.

---

## Skills the fresh session should load before starting

```
/honesty
/verification-before-completion
/dispatching-parallel-agents
/subagent-driven-development
```

If working on Basis-adjacent UI later: `/linear` `/lambo` `/fidelity`.

---

## Final orientation command for fresh session

```bash
cd /home/user/ai-thesis \
  && git log --oneline origin/main..claude/beautiful-carson-QaTLG | head -15 \
  && cat docs/handoffs/2026-05-22-S26-page-audits-token-sweep-migration-finding.md | head -40
```

Then call `mcp__Supabase__list_projects` and confirm `mvxgnliwvoauwwarrlrr` exists. Then proceed at Gate 0.
