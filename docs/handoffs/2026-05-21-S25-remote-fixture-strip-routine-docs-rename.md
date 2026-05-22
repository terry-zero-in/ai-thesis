# S25 — Remote Fixture Strip + Routine Cadence + Rename + Audits

**Session type:** Remote Claude Code (cloud container, not Terry's local Mac)
**Branch:** `claude/beautiful-carson-QaTLG` (per CLAUDE.md instructions for this environment)
**Date:** 2026-05-21
**Picked up from:** S23 handoff (`2026-05-21-S23-landing-hide-demo-strip-personal-tool-pivot.md` — local Mac, never committed to git)

## 1. TL;DR

- Picked up the S23/S24 work that lived only on Terry's local Mac and was never pushed. Re-executed in this remote container on the assigned branch.
- Stripped **all** fixture / demo-data infrastructure from the web app: `FIXTURE_UNIVERSE`, `FIXTURE_INDEX`, `fixtureClose()`, plus `synthesize()` fallback functions in 4 more data loaders the prior session's queue missed.
- Moved drift-detection from daily-batch routine → weekly-rescore routine (memo cadence is now weekly per Terry directive).
- Expanded `web/.env.local.example` from 2 vars to 8 with category comments and where-they-come-from notes.
- Renamed `fixtureSnapshot()` → `emptySnapshot()` so the function name matches its now-empty body.
- Dispatched 3 parallel subagents (still running when this handoff was written) for: stale "fixture mode" error string cleanup, motion audit, paste-ready Supabase setup checklist.
- 4 commits shipped, all on `claude/beautiful-carson-QaTLG`, all tsc-clean, all pushed.

## 2. Commits this session (in order)

| SHA | Title | Net LOC |
|---|---|---|
| `6b8cbf5` | `docs(routines): move drift detection from daily-batch → weekly-rescore` | +60 / −27 |
| `e1d6aee` | `strip FIXTURE_UNIVERSE/FIXTURE_INDEX/fixtureClose infra` | +65 / −496 |
| `7712493` | `strip synthesize() demo data from regime/memos/aiq-drafts/backtest` | +9 / −237 |
| `cd4a7d5` | `rename fixtureSnapshot() → emptySnapshot() in universe-data` | +9 / −9 |

**Total net cleanup:** −626 LOC of demo/fixture data infra removed.

## 3. Files touched

### Documentation + config

- `docs/routines/01-daily-batch.md` — TASK 4 (drift detection) removed; renumbered to 3 tasks; verification SQL updated; schema reference cleaned. Added top-of-file note explaining the move.
- `docs/routines/02-weekly-rescore.md` — Drift detection inserted as new TASK 3; renumbered narrative to TASK 4; `memo_proposals` schema added to schema reference; verification SQL extended. Added top-of-file note explaining the move.
- `docs/routines/README.md` — Cadence table updated to reflect memo writer move.
- `web/.env.local.example` — Expanded 2 → 8 variables. Two `NEXT_PUBLIC_*` vars stay on `web/.env.local` (browser-safe); the other 6 are Supabase Edge Function Secrets only (`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `FMP_API_KEY`, `POLYGON_API_KEY`, `CRON_INVOKE_SECRET`).

### Source code (web/src/)

Phase 2 fixture strip (commit `e1d6aee`, agent-executed, verified independently):

- `web/src/lib/universe-fixture.ts` — **deleted** (the 50-ticker hardcoded seed)
- `web/src/lib/portfolio-data.ts` — Removed FIXTURE imports + `fixtureClose()` helper. `getUniverseChoices()` returns `[]` when env unset.
- `web/src/lib/aiq-data.ts` — Empty rows when env unset.
- `web/src/lib/alerts-data.ts` — Removed fixture-based ticker validation; large block deleted (−86 LOC).
- `web/src/lib/name-detail-data.ts` — Replaced ~165 LOC `fixtureDetail()` with minimal `emptyDetail()`. Deleted unused `hash()`/`round()` helpers.
- `web/src/lib/universe-data.ts` — Empty snapshot when env unset.
- `web/src/components/shell/CmdPalette.tsx` — Removed ticker entries from command palette autocomplete (was sourced from FIXTURE_UNIVERSE); now screen-jumps only.
- `web/src/lib/portfolio-types.ts` — `SeedRow` type inlined locally.

Phase 3 extension (commit `7712493`, main-thread):

- `web/src/lib/aiq-drafts-data.ts` — Removed `synthesize()` (fake NOW row).
- `web/src/lib/memos-data.ts` — Removed `synthesize()` (fake TSM weekly + NVDA daily memos).
- `web/src/lib/backtest-data.ts` — Removed `synthesize()` (fixture-run-1 + fixture-run-2 with 36-month deterministic returns).
- `web/src/lib/regime-data.ts` — Removed `synthesize()` (52 weeks of fake macro gauge readings). Reused existing `finalize()` helper with empty array; finalize handles `latest=null + 0 gates + multiplier=1` cleanly. Deleted unused `sinNoise/round/clamp` helpers.

Rename (commit `cd4a7d5`):

- `web/src/lib/universe-data.ts` — Function rename.
- `web/src/lib/universe-data-server.ts` — Importer + 3 call sites updated; one docblock comment that referenced the old name updated.

## 4. Decisions made (no Terry input required)

- **Extending scope from FIXTURE_* strip to `synthesize()` strip in 4 more data loaders.** Surfaced via grep after the FIXTURE_* agent finished. Same demo-data pattern, same directive ("no demo data"), independent files (no merge risk). Flagged in chat at the time; user said "Yes go ahead with the actions that arise out of your flags".
- **`emptySnapshot()` rename.** Function name had to match its body or it lies to readers; trivial 2-file change.
- **Memo-cadence resolution (weekly, not daily).** Terry verbatim: "We just need to do memos once a week." Picked Resolution 1 (move TASK 4 from daily-batch → weekly-rescore as TASK 3) over Resolution 2 (gate daily to weekday) because: (a) `scores_history` only updates Saturdays — daily drift polling between rescores wrote no useful rows anyway, so the move aligns code with data reality; (b) cleaner separation of concerns.

## 5. Critical session-specific facts that future sessions must NOT relitigate

1. **Personal-tool pivot (S23 decision).** AI Thesis v2 is no longer a paid product. It is a 3-user personal tool: Terry + Mom + Dad. Each user gets their own login + private portfolio (RLS on `user_id`). Research / scoring / memos are shared.
2. **Blank is the correct empty state.** Terry: "*We dont neeedx any demo data or anything like that. I dont care if something shows as blank.*" Any future agent that surfaces a fixture/synthetic fallback should strip it, not preserve it.
3. **Memo cadence is weekly.** Drift detection writer lives in `02-weekly-rescore.md` (TASK 3). Do not move it back to daily-batch on the assumption that daily polling catches drift faster — it doesn't, because the underlying table only updates weekly.
4. **`MarketingLanding` gate is hidden, not deleted.** `app/page.tsx` + `ConditionalShell.tsx` have THS-84 restoration TODOs in comment-out blocks. Don't delete the `MarketingLanding` component itself.
5. **This branch is `claude/beautiful-carson-QaTLG`.** Per `/home/user/ai-thesis/CLAUDE.md` system message, the assigned branch for this remote container is `claude/beautiful-carson-QaTLG`. Do NOT push to `main` from this remote environment.
6. **Local S20–S23 handoffs are not in git.** Terry has handoff docs `2026-05-20-S20*.md` through `2026-05-21-S23*.md` only on his local Mac. They were never committed. This session's S25 handoff is the first one for the personal-tool pivot to actually land in git.

## 6. State at end of session

| Field | Value |
|---|---|
| Branch | `claude/beautiful-carson-QaTLG` |
| HEAD | `cd4a7d5` (will advance if subagent commits land) |
| Commits ahead of `origin/main` | 8 (5 from main session, 3 from S23 pre-this-session) |
| Working tree | Pending subagent completion: stale-strings cleanup, motion audit, supabase-setup checklist |
| `npx tsc --noEmit` | Exit 0 verified after every commit |
| Live `https://ai-thesis-v2.vercel.app/` | Not verified this session (no `vercel inspect` access in this remote container). Last verified state per S23: HTTP 200 with dashboard markup; `/portfolio` 307 for unauthed (correct auth middleware behavior). |

## 7. Open queue for next session

| # | Task | Gating |
|---|---|---|
| 1 | Supabase MCP wired to AI Thesis project | Path A/B/C decision from Terry; agent has produced paste-ready Supabase setup checklist at `docs/setup/2026-05-21-supabase-setup-checklist.md` |
| 2 | Verify migration state vs prod via MCP | Needs MCP from (1) |
| 3 | Verify per-user RLS on `portfolio_positions` | Needs MCP; setup checklist has the SQL |
| 4 | Create 3 user accounts (Terry + Mom + Dad) in Supabase Auth | Terry; setup checklist has the Studio path |
| 5 | Schedule 4 routines on claude.ai/code | Terry's account; `docs/routines/setup-guide.md` already documented |
| 6 | One-shot fire of daily-batch + weekly-rescore tonight so app populates | Needs MCP; setup checklist Step 6 has the prompts |
| 7 | `/linear` + `/lambo` page walk on `/regime`, `/aiq`, `/memos`, `/proposals` | Best done in a local session with browser preview |
| 8 | Final motion audit follow-through (read this session's audit at `docs/audits/2026-05-21-motion-audit.md` and pick D-tier upgrades to implement) | Agent produced the audit; implementation deferred |

## 8. Things I did NOT do (with reasons)

- Did NOT create a pull request. Per CLAUDE.md and environment guidance: "Do NOT create a pull request unless the user explicitly asks for one." Terry can merge `claude/beautiful-carson-QaTLG` → `main` via GitHub UI or PR when ready.
- Did NOT push to `main`. Per CLAUDE.md: "NEVER push to a different branch without explicit permission." Branch is `claude/beautiful-carson-QaTLG` as assigned.
- Did NOT exercise Supabase MCP. The Anthropic-hosted MCP available on `claude.ai/code` is NOT present in this remote container. Per setup checklist, Terry needs to reauthorize the connector or run the SQL himself.
- Did NOT verify pages render correctly in a browser. This remote container has no preview surface. Tsc exit 0 verifies types, not visual fidelity. The page-walk task remains open.

## 9. Pitfalls for the next session

1. **The remote container's git state may diverge from Terry's local Mac.** This session's commits are on `claude/beautiful-carson-QaTLG`, NOT `main`. If a future local session runs on `main`, those changes won't be visible until the branch is merged.
2. **The S23 / S24 local-only handoffs may surface as untracked files when Terry returns to his Mac.** Don't re-do work just because a local handoff doc says it's pending — verify against git history first.
3. **Empty arrays cascade through some UI components.** Pages will render empty states now that fixtures are gone. Some components have `if (rows.length === 0) return <Skeleton />` style handling; others don't. Visual verification on populated data is needed before the user-facing pages claim production-ready.
4. **`docs/routines/setup-guide.md` was NOT updated this session.** It still references the old daily/weekly memo split if it had memo-specific instructions. Audit it next session.
5. **`vercel` CLI is not available in this remote container.** Don't try `vercel inspect` or `vercel deploy` — push to branch and let GitHub→Vercel webhook handle previews.

## 10. Skills loaded this session

`honesty`, `frontend-design`, `ui-ux-pro-max`, `using-superpowers`, `subagent-driven-development`, `dispatching-parallel-agents`, `verification-before-completion`. (`basis-coding` requested but doesn't exist in this environment.)

## 11. First action for next session

```bash
cd /home/user/ai-thesis
git fetch origin && git log --oneline origin/main..claude/beautiful-carson-QaTLG
# Confirm S25's commits are present and tsc still passes:
cd web && npx tsc --noEmit
```

Then read in order:
1. This handoff
2. `docs/setup/2026-05-21-supabase-setup-checklist.md` (paste-ready Supabase setup)
3. `docs/audits/2026-05-21-motion-audit.md` (motion findings)
4. Confirm with Terry which queue item to pick up first.
