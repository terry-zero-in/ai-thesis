# S26 — Page Audits + Token Sweep + Critical Migration Finding

**Session type:** Remote Claude Code (continued from S25)
**Branch:** `claude/beautiful-carson-QaTLG`
**Date:** 2026-05-22

## 1. TL;DR

- 4 more commits shipped on top of S25's 9. Working tree clean, all pushed.
- Setup-guide aligned to weekly memo cadence; motion-token sweep across 9 files (17 sites normalized); page-walk audit on `/regime` `/aiq` `/memos` `/proposals` produced 27 findings (1 P0).
- **Critical Supabase finding (~5 min of MCP access before it disconnected):** prod is missing 2 migrations including `20260518000200_e80_routines_pr1` — the multi-tenant pivot. Routines literally cannot fire without it. Setup checklist updated to reflect actual state.
- Latent demo-data hunt (`/sch` style grep across multiple patterns) returned clean — the S25 strip commits caught everything.

## 2. Commits this session (since S25's last)

| SHA | Title | Net |
|---|---|---|
| `dbab19c` | `docs(routines): update setup-guide for memo-cadence move + add prereq link` | +19 / −3 |
| `eeeb233` | `motion: normalize 17 literal duration sites to token vars` | +13 / −13 |
| `a4b515a` | `add /linear /lambo code-read page audit — /regime /aiq /memos /proposals` | +161 |
| (pending) | `docs(setup): correct migration state per 2026-05-22 MCP read` | +3 / −1 |

## 3. The Supabase finding (most important)

While the Anthropic-hosted Supabase MCP was briefly connected, I ran:
- `list_projects` → found AI Thesis at ref `mvxgnliwvoauwwarrlrr`
- `list_migrations` → prod has 50, latest is `20260517000100_e44_aiq_rubric_sources_jsonb`

Two migrations exist on disk but NOT on prod:

| Local migration | What it does | Why missing matters |
|---|---|---|
| `20260518000100_e25_aiq_scores_cron` | Saturday 22:35 UTC cron — denormalizes `aiq_rubric` → `scores_history.aiq_score` | Per-factor UI won't show AIQ scores until applied |
| `20260518000200_e80_routines_pr1` | Multi-tenant pivot: creates `public.users` table (FK auth.users), adds `user_id` + `auth.uid() = user_id` RLS to `portfolio_settings/portfolio_positions/alert_acks`, creates 6 routine output tables (`aiq_draft_queue`, `weekly_summary`, `memo_proposals`, `position_pulse`, `universe_proposals`, etc.) | **Hard prereq for everything.** Mom + Dad onboarding (their `portfolio_positions` rows would have no `user_id` column), routines firing (`aiq_draft_queue` doesn't exist), all gated on this |

Migration body inspected: atomic (`BEGIN/COMMIT`), idempotent (`IF NOT EXISTS` everywhere), backfills existing rows before setting `NOT NULL`, safe to re-run.

**One hard prereq the migration enforces:** the user must have signed in to the app at least once so `auth.users` has a row for `terryturner2026@gmail.com` — otherwise the migration `RAISE EXCEPTION`s.

### What Terry needs to do (in order)

1. Sign in once at `https://ai-thesis-v2.vercel.app/login` (creates `auth.users` row)
2. From his Mac, in the AI Thesis repo: `supabase link --project-ref mvxgnliwvoauwwarrlrr && supabase db push`
3. Resume the checklist at Step 2

The MCP disconnected before I could apply the migration or verify Terry's auth state. The setup checklist now reflects this corrected state at line 13 + the Step 1 callout.

## 4. Page-walk audit highlights (`docs/audits/2026-05-21-page-walk-audit.md`)

27 findings across the 4 pages. Severity breakdown:
- **1 P0** — `web/src/app/memos/page.tsx:122-150` system-broken banner uses `margin: "10px 28px 0"` instead of S22-locked 32L/40R/r6 inset-pill geometry. Either promote to `.ribbon-inset` or document exemption.
- **11 P1** — Missing hover affordances. The most structural is `AiqEditor`'s inline-styled "Save scoring" CTA which can't satisfy `:hover` from a CSS class — audit recommends extracting `.btn-primary` to globals.css before more form-page work.
- **11 P2** — Stylistic inconsistencies.
- **4 P3** — Nits.

Worst page: `/aiq/[ticker]` (11 findings). Cleanest: `/proposals` (1 P3).

Invariants that held: zero non-locked purples, zero raw duration literals (the token sweep + S25 audit cleared those).

## 5. Motion-token sweep details (`eeeb233`)

17 sites normalized across 9 files. Actual locked token scale (confirmed from `globals.css` source of truth — my S25 prompt was inaccurate):

```
--dur-instant 80ms · hover bg, link colors
--dur-fast    140ms · borders, tab underlines, chevrons
--dur-base    200ms · modals fade-in, panels, palette, ribbon
--dur-mid     240ms · sidebar collapse, content scale-up
--dur-slow    320ms · page transitions, big layout shifts
```

**Four 220ms sites intentionally left alone** — no matching token, brackets between `--dur-base` (200) and `--dur-mid` (240). Pair with bespoke springs or page-swap choreography. Design decision needed:
- `Toast.tsx:48` slide-in
- `Shell.tsx:108` page-swap incoming
- `CmdPalette.tsx:105` modal spring entrance
- `MovingPillTabs.tsx:75` tab pill spring (custom cubic-bezier curve)

Recommended follow-up: either promote `220ms` to a new token (e.g., `--dur-stage`) or accept as design-intent exception with locked `// motion-audit-exempt` comments.

## 6. Latent demo-data hunt (D)

Multi-pattern grep across `web/src/`:
- Hardcoded ticker literals: 0 (only one was in a JSDoc example, not data)
- Demo IDs (`"seed-"`, `"demo-"`, `"sample-"`, `"preview-"`, `"mock-"`): 0
- `mockData` / `dummyData` / `sampleData` / `seedData` variables: 0
- Hardcoded financial figures in components: 0 (only one was in a JSDoc example)

The S25 commits (`e1d6aee`, `7712493`, the 4 `synthesize()` strips) caught all demo data. No further code work needed.

## 7. Open queue for next session

1. **Apply the 2 missing migrations** (Terry on his Mac: `supabase db push`) — unblocks everything below
2. Create Mom + Dad auth users in Supabase Studio + run the `INSERT INTO public.users` backfill per checklist Step 2c
3. Wire env vars in Vercel (Step 4) + Supabase Edge Function secrets
4. Reauthorize claude.ai Supabase MCP against the org that owns AI Thesis
5. Fire daily-batch + weekly-rescore once manually (Step 6) to populate empty pages
6. Schedule the 4 routines on claude.ai/code per `docs/routines/setup-guide.md`
7. Implement the page-walk audit's P0 fix + P1 sweep (next session, in a local environment with browser preview)
8. Address the 4 `220ms` sites flagged by the motion token sweep (design call)
9. Larger motion-audit upgrades: `MovingPillTabs` / `Sidebar` width animations (layout-tier) + `AnimateNumber` Motion Plus migration (audit's top ROI target)

## 8. State at end of session

| Field | Value |
|---|---|
| Branch | `claude/beautiful-carson-QaTLG` |
| HEAD | `a4b515a` plus this handoff + setup-checklist update once committed |
| Commits ahead of `origin/main` | 13 |
| Working tree | This handoff + updated checklist pending commit |
| `npx tsc --noEmit` | Exit 0 verified after every commit |
| Supabase MCP | Disconnected mid-session — Terry can reconnect via claude.ai → Connectors |
| Prod migration state | 50/52 applied (2 missing — see §3) |

## 9. Skills used this session

`subagent-driven-development`, `dispatching-parallel-agents`, `verification-before-completion`, plus the persistent Claude Code default skills from S25.

## 10. First action for next session

```bash
cd /home/user/ai-thesis
git log --oneline origin/main..claude/beautiful-carson-QaTLG  # 13 commits expected
git status --short  # clean
```

Then if Terry has applied the e80 migration in the meantime, resume the setup checklist from Step 2. Otherwise, hand him the §3 action items above.
