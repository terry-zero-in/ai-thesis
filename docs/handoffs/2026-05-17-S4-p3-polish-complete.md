# S4 Handoff — 2026-05-17 — P3 polish complete

## 1. TL;DR

P3 polish phase shipped end-to-end. 14 commits this session covering all 14 P3 items in `docs/design/lambo-review-2026-05-17.md` plus the deferred design-judgment trio (footer move / chip-button consolidation / memos filter+search). 6 review items resolved as verify-only (already wired in prior sessions). Branch `claude/lambo-design-finish` @ `df30561`, 45 commits ahead of origin/main, pushed, typecheck-clean. Only remaining queue item is **§2.7 #2 per-dimension Source URL field in AiqEditor** (P2, deferred — has a schema design call embedded; needs Terry input on column-add vs JSONB vs extend-existing-sources).

## 2. Architectural pivot or major decision

None this session. Pure polish on existing primitives + filter-pattern reuse from S3 (server-side searchParams filter applied to /decisions in S3, replicated to /memos in S4 — same shape).

## 3. State of the world

- **Working dir:** `/Users/terryturner/Projects/ai-thesis`
- **Branch:** `claude/lambo-design-finish` @ `df3056168eb215fb058afc37825a66c33280ea39`
- **Commits ahead of origin/main:** 45 (verified via `git log --oneline origin/main..HEAD | wc -l`)
- **Pushed to remote:** YES — `git ls-remote origin claude/lambo-design-finish` returns the same SHA
- **Upstream tracking:** NOT configured locally — `git status` won't show ahead-behind without `git branch --set-upstream-to origin/claude/lambo-design-finish` (carryover from S3)
- **Dev server:** http://localhost:3003 — HTTP 200 verified at 14:48 CDT. Background task ID `bw3hy4o16` (alive across S1+S2+S3+S4)
- **Typecheck clean:** YES (`npx tsc --noEmit` from `web/` returns no output)
- **Time at handoff write:** 2026-05-17 14:48 CDT
- **External integrations:** No new calls. Existing Supabase env still unconfigured in dev → fixture-mode renders everywhere
- **DB state:** No schema changes this session. No new migrations. `aiq_rubric` table still has single `source_url` column (relevant for §2.7 #2 deferred work)
- **PR opened:** NOT YET — link ready at https://github.com/terry-zero-in/ai-thesis/pull/new/claude/lambo-design-finish

## 4. Action / API reference

None this session. No endpoints touched. One new server action `ackAlerts` added in S4 commit `d8e9064` at `web/src/app/decisions/actions.ts:50-94` — covered in §5.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/components/shell/Sidebar.tsx` | edit | Operations → Command Center label (§2.1 #7, spec §3.3) |
| `web/src/app/aiq/[ticker]/page.tsx` | edit | Add spec §5.6 meta line under H1; HISTORY column collapse-when-empty grid |
| `web/src/app/aiq/[ticker]/AiqEditor.tsx` | edit | Discard button + Save→N projection (§2.7 #4) |
| `web/src/components/shell/CtxPanel.tsx` | edit | Early-return null when rail==="none"; remove unused universe-filter footer props |
| `web/src/components/rails/PortfolioReserveRail.tsx` | edit | Document 2→3 trigger decomposition (§2.4 #4, header comment only) |
| `web/src/components/name/FactorPanels.tsx` | edit | PillarList ptsStyle: swap to "value / cap" order (§2.3 #6) |
| `web/src/components/universe/UniverseTable.tsx` | edit | ≥80 cell-bg tint (§2.2 #8) + quiet ⇅ sort affordance (§2.2 #7) + under-table footer (§2.2 #6) + setMeta cleanup |
| `web/src/components/universe/UniverseFilterRail.tsx` | edit | Remove Footer block + dead props (§2.2 #6 cleanup) |
| `web/src/hooks/universe-filter-context.tsx` | edit | Strip dead totalRows/visibleRows/asOf/synthetic/setMeta fields (§2.2 #6 cleanup) |
| `web/src/app/decisions/actions.ts` | edit | New `ackAlerts` bulk server action (§2.10 #5) |
| `web/src/app/decisions/BulkAckButton.tsx` | **create** | Client wrapper that serializes unseen keys + invokes bulk action |
| `web/src/app/decisions/page.tsx` | edit | Wire BulkAckButton into header; compute `unseenKeysInView` respecting filter |
| `web/src/app/decisions/AlertRow.tsx` | edit | Spec §4.5 chip refactor + unified button styles (§2.10 #3) |
| `web/src/app/aiq/page.tsx` | edit | Native `title` tooltip on each row (§2.6 #2) |
| `web/src/app/memos/page.tsx` | rewrite | Convert to filter+search via searchParams (§2.9 #3) |
| `docs/handoffs/2026-05-17-S4-p3-polish-complete.md` | **create** | This file |

15 source files touched + 2 created. 14 commits.

## 6. Decisions locked

### D1. §2.6 #4 — Right rail aside hides entirely when `rail === "none"`.
**Rule:** `CtxPanel.tsx` returns `null` (not an empty 320px aside) on pages registering `<NoRail/>`.
**Why:** Terry approved "Hide entirely (Recommended)" via AskUserQuestion 2026-05-17. Empty 320px aside with "Context" placeholder was wasted real-estate on /aiq, /decisions, /backtest, /settings, /memos.
**Tradeoff accepted:** Override #1 "right rail chrome OFF-LIMITS for restyling" preserved structurally — the aside element itself is unchanged (320px / surface / border / radius / margin). Only the early-return is new, gated by `rail === "none"`. Re-enables automatically on navigation to a page that sets a real rail key.

### D2. §2.4 #4 — Keep all 3 portfolio triggers; document 2→3 decomposition as spec amendment.
**Rule:** PortfolioReserveRail header comment records that spec §6 "two pre-committed triggers" (Position drawdown >7%; SPY ≤ −5% / VIX >25 for 3+ days) decomposes into 1 position + 2 market kinds (`spy_daily_drop` + `vix_sustained`).
**Why:** Terry approved "Keep all 3 (Recommended)" via AskUserQuestion 2026-05-17. Operator wants per-signal granularity (WHICH market signal tripped).
**Tradeoff accepted:** Build count diverges from spec count; refinement is documented in code so future sessions don't try to "reconcile" back to 2.

### D3. §2.7 #5 — HISTORY column collapses to single-col grid when empty.
**Rule:** `/aiq/[ticker]` grid template = `ctx.history.length === 0 ? "minmax(0, 1fr)" : "minmax(0, 1fr) 320px"`. Skip rendering `<AiqHistory/>` entirely when empty.
**Why:** Terry approved "Collapse to auto when empty (Recommended)" 2026-05-17. Empty 320px column with one line of "Connect Supabase to read prior versions" wasn't earning real estate.
**Tradeoff accepted:** Right-rail VERSIONS (`AiqHistoryRail` in CtxPanel) is unaffected — separate surface per spec §6, has its own empty state.

### D4. §2.7 #1 — Spec wins over review on tier suggestion.
**Rule:** AIQ detail meta line renders `Last scored {scored_at} · {total}/100` (no tier) — matches spec §5.6 line 682 verbatim.
**Why:** Review §2.7 #1 suggested appending `· {tier}`. Spec §5.6 line 682 shows no tier. `aiq_rubric` table has no tier column (composite tier lives on `scores_history`). Adding a speculative tier-derivation scheme would violate CLAUDE.md "Don't add abstraction speculatively."
**Tradeoff accepted:** Loses suggested tier badge. Stays honest to schema + spec letter.

### D5. §2.10 #3 — Spec §4.5 chip styling enforced; chips never used as actions.
**Rule:** AlertRow kind chip = `--surface-2` bg + `--text-2` color + 1px 5px padding + 3px radius (matches spec §4.5 line 288-298 exactly). Detail link = quiet `--text-3` text-button with `lin-hov` hover lift (NOT an accent-bordered chip-pretending-to-be-action). Ack button = solid `--accent` for primary action; ghost outline for the re-open undo state.
**Why:** Spec §4.5 line 298 explicit: "Never use for actions — chips are not clickable buttons; they are filter affordances at most." Build had an accent-bordered "↗ detail" Link styled as a chip-shaped action — violated the §4.5 rule.
**Tradeoff accepted:** Detail link is less visually prominent; relies on hover for accent promotion. Defensible — it's secondary navigation, not the primary action (ack is).

### D6. §2.9 #3 — /memos filter via searchParams, not client state.
**Rule:** Filter chips + search are URL-driven (`?kind=daily&q=insider`) — same pattern as `/decisions ?kind=`.
**Why:** Server-side filtering is bookmarkable, survives reload, browser-history navigates filter history. Matches existing /decisions pattern (no new abstraction).
**Tradeoff accepted:** Search input doesn't filter as you type (form submit required). Acceptable for a memos page that has ≤50 items in practice.

### D7. §2.6 #2 — Native `title` tooltip, not custom popover.
**Rule:** /aiq row hover hint uses native `<tr title="...">` not a custom hover-popover with first-hover localStorage state.
**Why:** [[feedback_build_correctness_vs_polish]] — the click affordance already exists (ticker col + edit ↗ link); tooltip just narrates it. Custom popover for "first-hover only" was over-engineering.
**Tradeoff accepted:** Slight UX inconsistency (browser-default tooltip styling), but zero net-new state to maintain.

### D8. §2.2 #6 — Footer move includes context cleanup.
**Rule:** Removing the rail Footer carries with it: drop `Footer` helper, drop `asOf/synthetic/visibleRows/totalRows` props from `UniverseFilterRail`, drop matching CtxPanel props, drop dead `totalRows/visibleRows/asOf/synthetic/setMeta` fields from `universe-filter-context`, drop the publishing `useEffect` from `UniverseTable`, drop unused `useEffect` import.
**Why:** Context fields existed PURELY to feed the rail Footer just deleted. Per [[feedback_pattern_dependencies_in_sd_scope]] — orphaned-by-the-change is in-scope; not removing them leaves dead code.
**Tradeoff accepted:** Single commit touches 4 files instead of 1. Defensible: same change, no scope creep.

## 7. Next-session test plan — MOST IMPORTANT

### 7.1 Read-only verification (<60s, no mutations)

```bash
# Verify branch + HEAD match this handoff
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD
# Expected: df3056168eb215fb058afc37825a66c33280ea39 (or newer if S4 handoff commit landed)

git log --oneline origin/main..HEAD | head -16
# Expected: top 14 entries = this S4 session commits + S3 handoff doc + S3 final commit
# (8bfbe0d, f369f74, bdc374e, 5d21215, 2b78b93, 4f48260, 813c07b, 0353610,
#  a276868, d8e9064, 5b7d05c, b0ab16d, f1f29af, df30561 + S3 commits underneath)

# Verify pushed
git ls-remote origin claude/lambo-design-finish 2>&1 | head -1
# Expected: SHA matching local HEAD (or one commit newer if this handoff doc landed)

# Verify dev server still up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/
# Expected: 200. If not: cd web && npm run dev (background it)

# Verify typecheck clean
cd web && npx tsc --noEmit
# Expected: no output (no errors)

# Confirm S4-changed files all present
ls /Users/terryturner/Projects/ai-thesis/web/src/app/decisions/
# Expected: actions.ts AlertRow.tsx BulkAckButton.tsx page.tsx
```

### 7.2 Fresh end-to-end test

Not applicable — UI/polish session. No endpoints, no engine changes, no ingestion.

### 7.3 Visual / UI verification

```bash
# Spot-check each S4-touched surface
python3 -c "
from playwright.sync_api import sync_playwright
from pathlib import Path
OUT = Path('/tmp/s4_visual_check'); OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={'width':1440,'height':1100},device_scale_factor=2).new_page()
    for name, url in [
        ('sidebar',     'http://localhost:3003/'),
        ('universe',    'http://localhost:3003/universe'),
        ('aiq_list',    'http://localhost:3003/aiq'),
        ('aiq_detail',  'http://localhost:3003/aiq/AAPL'),
        ('memos',       'http://localhost:3003/memos'),
        ('memos_daily', 'http://localhost:3003/memos?kind=daily'),
        ('decisions',   'http://localhost:3003/decisions'),
    ]:
        pg.goto(url, wait_until='networkidle'); pg.wait_for_timeout(700)
        pg.screenshot(path=str(OUT / f'{name}.png'))
print('outputs:', list(OUT.iterdir()))
b.close()
"
```

Visual acceptance checklist:
- `sidebar.png` — COMMAND CENTER / WORKSPACE labels (D8 / §2.1 #7)
- `universe.png` — top-row Q/G/V/AIQ cells with ≥80 score have accent-soft tint; column headers show ⇅ on inactive, ▲/▼ on active; footer under table reads "Showing N of M · click row for detail · as of YYYY-MM-DD (fixture)"
- `aiq_list.png` — right rail aside is GONE (D1 / §2.6 #4); table spans full canvas width
- `aiq_detail.png` — "Not yet scored" meta line under AAPL/Apple/L5 (D4 / §2.7 #1); editor reclaims full width because history is empty (D3 / §2.7 #5)
- `memos.png` — ALL / DAILY / WEEKLY chips with counts; search input right-aligned; "All" active (accent-soft bg)
- `memos_daily.png` — DAILY chip active; only the daily memo card visible
- `decisions.png` — chips read `--surface-2`/`--text-2`; "Detail ↗" is text-only no border; "ack" button is solid accent; "MARK ALL READ" outline button in header (S3 `d8e9064`)

## 8. Budget / quota tracking

None this session.

## 9. Known issues / backlog

### A. Outstanding P2 (one item)
1. **§2.7 #2 — Per-dimension Source URL field in AiqEditor.** Spec §5.6 line 689+696 shows source-URL field per dimension. Build has a single `source_url` column on `aiq_rubric`. Schema design call required before implementation: (a) add 6 new `source_url_{dim}` columns, (b) replace `source_url` with a `sources` JSONB shape keyed by dim, or (c) extend existing `notes` JSONB to hold url-per-dim. Each has migration / type-cascade / fixture-update implications. **DO NOT pick unilaterally — ASK Terry.**

### B. Outstanding follow-ups from S3 not yet picked up
1. **§2.4 #1 P1** — `?seed=fixture-positions` flag for /portfolio demo (still pending; defer until a `/lambo` demo session is needed).

### C. Cross-session ambient
1. **Untracked docs** — `docs/design/lambo-review-2026-05-17.md` (the review itself) + `docs/handoffs/2026-05-17-S1-lambo-design-finish.md` (S1 handoff) exist on disk but are NOT git-added. Need a scoped commit at some point. Confirm intent with Terry first — neither was added during S3 or S4.
2. **Upstream tracking missing on branch** — `git branch --set-upstream-to origin/claude/lambo-design-finish` would enable `git status` ahead-behind. Not strictly required (pushes work fine).

### D. Out-of-scope-but-noted (not P3, surfaced by /lambo review)
1. Mercury reference pattern #7 — sticky scroll on /universe table (`docs/design/mercury-references.md`). Outside §2 review scope.

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Repo root | `/Users/terryturner/Projects/ai-thesis` |
| Web app subdir | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch | `claude/lambo-design-finish` |
| HEAD SHA (state described) | `df3056168eb215fb058afc37825a66c33280ea39` |
| HEAD SHA (after this handoff doc lands) | (TBD — commit this file to bump) |
| Origin remote | `git@github.com:terry-zero-in/ai-thesis.git` |
| GitHub repo | https://github.com/terry-zero-in/ai-thesis |
| PR open URL | https://github.com/terry-zero-in/ai-thesis/pull/new/claude/lambo-design-finish |
| Commits ahead | 45 (pre-handoff-commit) |
| Dev server port | 3003 |
| Dev server background task ID | `bw3hy4o16` |
| S4 commits | 14 (8bfbe0d → df30561, listed §3) |
| S3 handoff doc | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S3-rails-and-p1-p2-fixes.md` |
| S2 handoff doc | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S2-mercury-decard-pass.md` |
| Master design spec | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Algorithm spec | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Lambo review (the source-of-truth for §2 tickets) | `/Users/terryturner/Projects/ai-thesis/docs/design/lambo-review-2026-05-17.md` |
| Mercury pattern reference | `/Users/terryturner/Projects/ai-thesis/docs/design/mercury-references.md` |
| /sch skill | `~/.claude/skills/sch/SKILL.md` |
| Project CLAUDE.md | `/Users/terryturner/Projects/ai-thesis/CLAUDE.md` |
| Web CLAUDE.md (Next 16.2.6 warning) | `/Users/terryturner/Projects/ai-thesis/web/CLAUDE.md` → `@AGENTS.md` |

## 11. Pitfalls / gotchas

1. **`aiq_rubric.source_url` is a SINGLE column, not per-dim.** When you go to implement §2.7 #2, expect to introduce a schema change OR rework the existing column. Don't assume "just add 6 input fields" — they have nowhere to land in the current schema. See §9 A.1.
2. **`/aiq/[ticker]` page now collapses the HISTORY column when empty.** If you add a feature that depends on HISTORY rendering, it will not be present on pages where `ctx.history.length === 0`. The right-rail `AiqHistoryRail` still renders (separate surface).
3. **CtxPanel returns `null` when `rail === "none"`.** Adding any new rail-key needs both the branch in CtxPanel.tsx AND a page-level `<RailRegister/>` (or equivalent) that calls `setRail`. If you forget the register, the aside is hidden.
4. **`universe-filter-context` no longer exposes `setMeta` / `totalRows` / `visibleRows` / `asOf` / `synthetic`.** If any code outside `UniverseTable` ever read those (it didn't, but verify before re-adding), they're gone.
5. **`/memos` is server-component with `searchParams: Promise<...>`.** Don't add `"use client"` to that page — the filter+search depends on server-side searchParams.
6. **MiniBar at ≥75 (--accent fill) vs cell tint at ≥80 (--accent-soft bg).** Two different thresholds, two different visual surfaces, both intentional. The 75 is for bar fill (analytical scan), 80 is for spec §5.2 cell-bg compliance (row-level scan).
7. **`MARK ALL READ` bulk-ack button respects the active kind filter.** If the user is viewing `?kind=tier_change`, the bulk-ack only acks tier_change unseen events — not the entire inventory. By design (§2.10 #5 commit `d8e9064`).
8. **`AiqEditor` Discard button does NOT reset textarea notes.** Notes are uncontrolled (`defaultValue`), so the dim-numbers reset but text input persists. Intentional — see commit `bdc374e` and D-comment in the source.
9. **The S3 handoff doc moved HEAD from `02975ce` (state described) to `33dcea6` (handoff commit).** Same pattern will repeat for S4 — handoff doc commit moves HEAD past `df30561`. Don't be alarmed if SHAs differ by 1.
10. **Spec §4.5 chips never used for actions.** I enforced this on AlertRow in `f1f29af`. If you build a new page and want a clickable thing in a chip's visual shape, it should be a button-styled-as-chip, not a Link styled as chip. The /memos filter chips are an exception per spec §4.5 line 298 ("filter affordances at most" is allowed).
11. **JetBrains Mono `var(--m)` everywhere for numerics.** All counters, percentages, scores, footers added this session use it. Don't drop it on new numeric surfaces.
12. **Dev server background task ID `bw3hy4o16` is the same one across S1+S2+S3+S4.** It may die if the machine reboots; restart via `cd web && npm run dev` in background.

## 12. Next-session pickup point

Run §7.1 read-only verification first (4 commands, <60s — confirms HEAD `df30561`, dev server :3003, typecheck clean, decisions dir has BulkAckButton.tsx). Then **ASK Terry the §2.7 #2 schema question** before touching any code: "Per-dim Source URL needs schema design — (a) add 6 columns, (b) replace `source_url` with `sources` JSONB keyed by dim, (c) extend existing `notes` JSONB. Recommend (b) — cleanest migration, single column. Confirm or override." Wait for answer before implementing.

Alternative pickup if §2.7 #2 not desired: open the PR from the branch (link in §10) — branch is ready for review, 45+ commits ahead, all typecheck-clean.
