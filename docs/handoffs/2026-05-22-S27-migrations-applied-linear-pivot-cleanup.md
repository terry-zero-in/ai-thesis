# S27 — migrations applied, Linear pivoted to personal-tool

**Date:** 2026-05-22 (continuation of S26 same-day)
**Branch:** `claude/peaceful-rubin-KqluN` (fast-forwarded from `claude/beautiful-carson-QaTLG` — same commit graph, just the system-mandated branch name)
**Container:** Fresh remote Claude Code session. Supabase MCP + Linear MCP both online (first time both worked in the same session for AI Thesis since S25).

## What S27 picked up from S26

S26 found prod was missing 2 migrations (`e25_aiq_scores_cron` and `e80_routines_pr1`) and authored a paste-ready handoff for a fresh session to finish. S26's Supabase MCP disconnected before it could apply them. S27 picked up at Gate 0 of that handoff and ran the full sequence.

## What S27 surfaced that S26 missed

**The e80 migration hardcoded `terryturner2026@gmail.com` in 7 places**, including a `RAISE EXCEPTION` guard. That email does NOT exist in `auth.users`. Three real users do:

| Email | UID | Last sign-in |
|---|---|---|
| `terry@zero-in.io` | `77631cb5-93bf-4b2b-b992-eae1ca0d271c` | 2026-05-20 (active) |
| `at-turner@sbcglobal.net` | `a44a032e-438f-4a21-a4b5-8bfcde79507d` | never (confirmed only) |
| `terryturner2027@gmail.com` | `8f7893ae-f75a-4d34-adf2-e3263db92854` | 2026-05-18 (once) |

If S26's handoff had been followed verbatim, Gate 1 would have failed with `RAISE EXCEPTION 'No auth.users row for terryturner2026@gmail.com'` regardless of who signed in.

**Fix (commit `8a826c5`):** replaced all 7 refs in the migration body + 5 refs in active operational docs (`docs/setup/2026-05-21-supabase-setup-checklist.md`, `docs/routines/03-monthly-curator.md`). Historical handoffs (`docs/handoffs/2026-05-18-*`, `docs/handoffs/2026-05-22-S26-*`) left as point-in-time records.

## Migrations applied

Both via Supabase MCP `apply_migration` against `mvxgnliwvoauwwarrlrr`:

| File version (on disk) | Applied version (in schema_migrations) | Name |
|---|---|---|
| `20260518000100` | `20260522232423` | `e25_aiq_scores_cron` |
| `20260518000200` | `20260522232605` | `e80_routines_pr1` |

(Supabase MCP rewrites `version` to apply-time — known behavior, not a problem.)

**Post-apply verification (Gate 2):**
- `public.users` 1 row → terry@zero-in.io, owner tier ✅
- `portfolio_positions` 13 rows backfilled with user_id NOT NULL ✅
- `alert_acks` 2 rows backfilled ✅
- `aiq_draft_queue` 5 rows seeded (status=queued) ✅
- `portfolio_settings_self_all` policy = `(auth.uid() = user_id)` ✅
- `portfolio_positions_self_all` policy = `(auth.uid() = user_id)` ✅
- 7 routine output tables created (weekly_summary, insider_summary, macro_log, memo_proposals, universe_proposals, position_pulse, aiq_draft_queue), all empty except seeded queue.

**Gate 3 advisors:** no correctness blockers. New e80-introduced perf advisories (10 `auth.uid()` direct calls in RLS policies, 3 unindexed FKs, 4 multiple-permissive-policy patterns) filed as **THS-96** for follow-up. Pre-existing advisories from Epic 1-3 (mutable search_path on 2 triggers, pg_net in public, materialized views API-exposed, 2 SECURITY DEFINER funcs callable by anon, ~20 `auth.uid()` direct calls on older tables) also noted in THS-96 as out-of-scope reminders.

## Linear scope cleanup — personal-tool pivot landed

Pre-S27 state: 64 tickets, 41 Done, 1 In Progress (THS-71), 22 Backlog. THS-70 "Monetization-Ready v1" epic and 17 sub-issues built around a paid-SaaS plan that's been abandoned for a 3-user personal tool.

Cleanup (run via background subagent — see THS-92 + child tickets):

**Canceled:** THS-70 (parent), THS-84 (paid-beta marketing landing), THS-85 (Stripe billing), THS-86 (SEC marketing-rule compliance), THS-87 (duplicate of THS-81; kept THS-81).

**New epic:** **THS-92** "Personal-tool v1 polish (post-monetization-cancel)" — In Progress, High. Successor to THS-70.

**Re-parented to THS-92:** THS-71 (routines plumbing), THS-73 (Score Math drawer), THS-74 (Today's Thesis), THS-75, 76, 77 (engine visibility / portfolio guardrails / decisions inbox), THS-78, 79, 80, 82 (craft polish).

**Closed (state inconsistency fix):** THS-33, THS-34 (parent epics whose sub-issues are all Done).

**Description rewritten:** THS-91 (drop "daily" memo cron language; reframe around weekly Saturday cadence per `docs/routines/02-weekly-rescore.md`).

**Retro tickets created (under THS-92):**
- **THS-93** (Done) — S25 fixture/demo data strip + memo cadence move to weekly.
- **THS-94** (Done) — S26 page-walk audit + motion token sweep.
- **THS-95** (Done) — this session's migration apply (closed after Gate 2 verified).
- **THS-96** (Backlog) — Supabase advisor cleanup (perf + RLS hygiene).

## CLAUDE.md update

Terry's directive 2026-05-22 codified as a top-of-file RULE: run autonomously issue-to-issue, only pause for mission-critical or scope-material decisions. Commit `ab2b956`. All future sessions inherit it.

## Open items the next session inherits

### Mom + Dad onboarding (Terry action — cannot be done via MCP)

Email mapping confirmed by Terry late-S27:

| Role | Email | auth.users status |
|---|---|---|
| Mom | `at-turner@sbcglobal.net` | Already in auth.users (confirmed but never signed in). She can magic-link from `/login`. |
| Dad | `terryturner@gmail.com` | **Not in auth.users yet.** Terry creates via Studio → Authentication → Users → Add user. |

The setup checklist (`docs/setup/2026-05-21-supabase-setup-checklist.md` §2b–2e) has been updated with these emails — the backfill SQL is paste-ready as written.

### Routine first-fire

Once Mom + Dad accounts exist, the daily-batch routine can fire. Prereq env secrets per `web/.env.local.example`:
- `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions)
- `ANTHROPIC_API_KEY` (Sonnet calls for memos / digests)
- `FMP_API_KEY` (fundamentals)
- `POLYGON_API_KEY` (prices + options)
- `CRON_INVOKE_SECRET` (only for scheduled invocation)

If not yet set, S27 did not fire any routine. THS-71 in-flight work can pick up here.

### Next ticket in build order

**THS-71** — "Routines plumbing — finish Bucket A". In Progress, High, under THS-92. e80 migration blocker is resolved; this session's commit `8a826c5` is referenced in the ticket's threaded comment.

### THS-96 follow-up migration — authored, awaiting apply

S27 drafted `supabase/migrations/20260523000000_e80_advisor_cleanup.sql` (commit `<see git log>`). It:

- Wraps all 10 e80-introduced `auth.uid()` policy calls as `(select auth.uid())`
- Consolidates the 4 multiple-permissive-policy patterns (aiq_draft_queue, memo_proposals, universe_proposals, position_pulse) by splitting FOR ALL writes into per-action INSERT/UPDATE/DELETE so the `*_all_select` policies remain the sole SELECT path
- Adds 3 missing FK covering indexes (memo_proposals.resolved_by, memo_proposals.ticker, universe_proposals.resolved_by)

Idempotent + atomic. **Not yet applied to prod** — mission-critical (hard-to-reverse) per CLAUDE.md autonomy rule. Terry confirms → `apply_migration` → re-run `get_advisors performance` to confirm the e80 entries cleared.

## Verified facts (so the next session doesn't have to re-prove)

- Supabase project: `mvxgnliwvoauwwarrlrr` (AI Thesis, us-west-2, Postgres 17.6.1.121).
- Linear team: Thesis, ID `21c004fc-6402-4d22-9316-fa9a05bb9b82`.
- Branch: `claude/peaceful-rubin-KqluN` is the system-mandated branch for this session-class.
- Reticle (`ydzvrosvkmqkdaqgsxtb`) referenced in earlier handoffs is no longer in the org; only AI Thesis + Basis v2 (`gdclgjgzxihzzmicsccy`) appear in `list_projects`.

## Commits this session

```
8a826c5  fix(e80): swap hardcoded owner email to terry@zero-in.io
ab2b956  docs(CLAUDE.md): codify autonomous-by-default rule for future sessions
```

(Plus this handoff doc.)
