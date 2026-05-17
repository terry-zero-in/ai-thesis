# Handoff — 2026-05-17 S3 — Rails + P1/P2 fixes

## 1. TL;DR

Shipped Task #4 (right-rail content fan-out, all 5 spec §6 rails) in scoped commits, then took out 6 high-value items from the `lambo-review-2026-05-17.md §2` review: breadcrumb routing, universe filter rail completion (AIQ-MIN + FLAGS), GaugeCard wavy→spec horizontal bar + gate-hit color → warning, 12-month trend chart on /regime, "last 5 gate-state changes" history list, /decisions BY KIND filter affordance, /universe/[ticker] sparkline polish (threshold rules + line styles + fresh x-axis fixture date). 13 commits this session; branch 30 commits ahead of `origin/main`, pushed, all typecheck-clean. Task #4 + #8 made big progress; Task #9 (P3 polish) is the next phase per Terry's instruction.

## 2. Architectural pivot or major decision

None this session — execution against the existing spec + S2 handoff queue. The only judgement call worth recording is the **CtxPanel scope clarification** (§6.D1 below) where I explicitly asked Terry whether Override #1 from S2 ("right rail OFF-LIMITS") banned adding new rail-key branches; he confirmed it did not — chrome stays, content slots in.

## 3. State of the world

### Git state

| Field | Value |
|---|---|
| Working dir | `/Users/terryturner/Projects/ai-thesis` |
| Branch | `claude/lambo-design-finish` |
| HEAD SHA | `02975ce1107153ba9fa7a7b57df1530e01ae737b` |
| Commits ahead of `origin/main` | 30 |
| Pushed to remote | YES (`git push origin claude/lambo-design-finish`) — last push landed `02975ce` on `terry-zero-in/ai-thesis` |
| Upstream tracking | NOT configured locally (`@{upstream}` is unset). `git pull` / `git status` won't show ahead-behind without explicit `-u` on a future push or `git branch --set-upstream-to origin/claude/lambo-design-finish` |
| Working tree | Two prior-session docs **untracked**: `docs/design/lambo-review-2026-05-17.md` and `docs/handoffs/2026-05-17-S1-lambo-design-finish.md`. They exist on disk and were referenced (and read) this session, but were never `git add`-ed in any earlier session. Surface to Terry — likely belong in their own scoped commit. |

### Dev server / processes

| Process | State | Detail |
|---|---|---|
| Next dev server (port 3003) | UP, HTTP 200 verified at 13:47 CDT 2026-05-17 | Started by S1's background task `bw3hy4o16` and has been running across S2 + S3 |

### External integrations

| System | State |
|---|---|
| Supabase | Fixture mode (no env). All surfaces gracefully degrade with honest empty/pending states — confirmed visually post-S3 work on /portfolio (empty positions), /aiq/[ticker] (empty rubric history), /decisions (deterministic 6-event fixture), /regime (52w deterministic NAAIM walk landing on May 14 reading). |
| FMP / Polygon / SEC / NAAIM / AAII / F&G | N/A for this session — UI only; backend ingest functions exist in `supabase/functions/ingest-*` but were not touched. |

### DB state changes

None this session.

### Secrets touched

None this session.

### Scheduled jobs

None added / modified this session.

## 4. Action / API reference

None this session — UI/presentation work and one Next App Router searchParams convention added (`/decisions?kind=<AlertKind>`).

## 5. Files created or modified

### Created

| Path | Rationale |
|---|---|
| `web/src/components/rails/RailChrome.tsx` | Shared RailHeader/RailSection/RailEmpty/RailGhost/RailFooter primitives — used by all 5 per-page rails |
| `web/src/components/rails/DashboardTodayRail.tsx` | /dashboard rail per spec §6 — top movers + insider ghost + macro gates summary |
| `web/src/components/rails/DashboardRailRegister.tsx` | Client wrapper that calls setRail+setPayload on mount |
| `web/src/components/rails/NameActivityRail.tsx` | /universe/[ticker] rail per spec §6 — composite change events + insider ghost + news ghost |
| `web/src/components/rails/NameRailRegister.tsx` | As above for /universe/[ticker] |
| `web/src/components/rails/PortfolioReserveRail.tsx` | /portfolio rail per spec §6 — reserve hero + bar + 3 trigger pills |
| `web/src/components/rails/PortfolioRailRegister.tsx` | Register wrapper for /portfolio |
| `web/src/components/rails/RegimeLegendRail.tsx` | /regime rail per spec §6 — per-gauge legend + multiplier table |
| `web/src/components/rails/RegimeRailRegister.tsx` | Register wrapper for /regime |
| `web/src/components/rails/AiqHistoryRail.tsx` | /aiq/[ticker] rail per spec §6 — versions list with deltas |
| `web/src/components/rails/AiqRailRegister.tsx` | Register wrapper for /aiq/[ticker] |
| `web/src/app/regime/GaugeBar.tsx` | Replaces wavy sparkline inside GaugeCard with spec §4.3 horizontal threshold bar |
| `web/src/app/regime/RegimeTrendChart.tsx` | 12-month trend (3 normalized lines + threshold dashes + today marker) per spec §5.5 |
| `web/src/app/regime/GateHistory.tsx` | "Last 5 gate-state changes" receipts list per spec §5.5 |

### Modified

| Path | Rationale |
|---|---|
| `web/src/hooks/ctx-panel-context.tsx` | Added `payload: unknown` slot + 5 new rail keys (`dashboard-today`, `name-activity`, `portfolio-reserve`, `regime-legend`, `aiq-history`) |
| `web/src/components/shell/CtxPanel.tsx` | 5 new render branches (cast payload per rail). Aside chrome (320px, surface bg, border, radius) UNCHANGED per S2 Override #1. |
| `web/src/app/page.tsx` | Derive `gateState` from regime.latest + pass to DashboardRailRegister |
| `web/src/app/universe/[ticker]/page.tsx` | Compute activity events from history + dep_flags + pass to NameRailRegister |
| `web/src/app/portfolio/page.tsx` | Derive railData + render PortfolioRailRegister |
| `web/src/app/regime/page.tsx` | Derive items, render RegimeRailRegister + RegimeTrendChart + GateHistory below gauges |
| `web/src/app/aiq/[ticker]/page.tsx` | Compute railRows with per-row delta + render AiqRailRegister |
| `web/src/lib/screens.ts` | Added `backtest`, `aiq-drafts`, `aiq-detail`, `login` ScreenIds + dynamic-ticker `pathToCrumb` helper. Fixes review §2.11 #1 + §2.3 #1. |
| `web/src/components/shell/TopBar.tsx` | Use new `pathToCrumb` helper; dropped `CRUMBS` import |
| `web/src/components/universe/UniverseTable.tsx` | (a) Hardcoded `#FACC15` macro flag → `var(--warning)`/`var(--warning-soft)` (token drift). (b) Apply aiqMin + macro flag filters. |
| `web/src/hooks/universe-filter-context.tsx` | Added `aiqMin: number | null` + `flags: Set<UniverseFlag>` + setters + clear |
| `web/src/components/universe/UniverseFilterRail.tsx` | Render AIQ MINIMUM slider + FLAGS triplet (Macro wired; Depr/Burry ghost-disabled with "THS-46 ingestion pending") |
| `web/src/app/regime/GaugeCard.tsx` | Replace `<Trendline>` with `<GaugeBar>`; chip + value color → `var(--warning)` |
| `web/src/lib/regime-types.ts` | Add `GateChange` interface + `gate_changes` field on RegimeSnapshot |
| `web/src/lib/regime-data.ts` | Implement `computeGateChanges(history)` — emits one event per gate-count change with cause label |
| `web/src/app/decisions/page.tsx` | Accept `searchParams.kind`, filter events, BY KIND rows become `<Link>` with active-state styling + active-filter pill + Clear button in header |
| `web/src/components/name/Sparkline.tsx` | Threshold rules at 60 (Medium) + 75 (High), Composite line dashed, height 56→72, legend swatches reflect dashed |
| `web/src/lib/name-detail-data.ts` | Anchor fixture history to 2026-05-09 (was hardcoded Feb 1 → Apr 22) — sparkline no longer truncates 25 days back |

### Repo state caveat

Two files untracked in git from prior session: `docs/design/lambo-review-2026-05-17.md`, `docs/handoffs/2026-05-17-S1-lambo-design-finish.md`. Both exist on disk and are read by the current `mercury-references.md` + this handoff. Not added in S3 — keep scoped to in-progress work.

## 6. Decisions locked

### D1: CtxPanel render branches are part of Task #4 scope; aside chrome stays

**Rule:** Adding new `CtxRailKey` entries + branch arms to `CtxPanel.tsx` is within Task #4 scope. The aside element itself (320px width, surface bg, border, radius, margin) was NOT modified.

**Why:** S2 Override #1 said "right rail is OFF-LIMITS for restyling" — meant chrome, not extension points. Asked Terry explicitly (AskUserQuestion gate); he confirmed "Yes — add new rail branches, leave chrome."

**Tradeoff accepted:** CtxPanel.tsx grows by one branch per page; type safety per rail uses `as TypeName` casts at the branch level (payload is `unknown` in the context).

### D2: Generic `payload: unknown` slot on CtxPanelContext (vs per-rail typed contexts)

**Rule:** Page-rail data flows through a single `payload: unknown` slot on `useCtxPanel`. Per-rail types are asserted at the CtxPanel branch.

**Why:** Avoids touching `Shell.tsx` (would have been needed to register a fifth+sixth+seventh provider per page). Keeps the architecture additive; one slot serves all 5 rails.

**Tradeoff accepted:** Loses some compile-time type safety at the branch (the cast). Acceptable because the producing pages immediately re-type via the imported `*RailData` interface, and the branch condition guarantees the matching `rail` key.

### D3: Portfolio rail = glance compression of main canvas, NOT replacement

**Rule:** `/portfolio` rail shows compressed reserve hero + 3 trigger pills. Main canvas keeps the full `ReservePanel` instrument (bar + target tick + detail prose).

**Why:** Spec §6 wants rail content = reserve + triggers; but the main canvas already has them. Removing them from main = bigger refactor + risk of breaking your mental model. Per /lambo "rail = glance, main = work" (Linear pattern). Asymmetry is intentional.

**Tradeoff accepted:** Mild duplication. The rail is meaningfully different (different visual: pill list vs section-with-prose) so it justifies its pixels.

### D4: Macro flag in /universe filter rail is WIRED; Depr + Burry are GHOST-disabled

**Rule:** "Macro gate hit" filter actually restricts the row set. "Depreciation flag" + "Burry overstatement" render as disabled checkboxes with "THS-46 ingestion pending" sub-note.

**Why:** `UniverseRow.macro_gates_hit` exists in the data; `depreciation_flags` ingestion (THS-46) hasn't shipped, so there's nothing to filter on. Honest empty-state per /universe ghost pattern is better than fake-filtering everything.

**Tradeoff accepted:** Two of three FLAGS are non-functional until ingestion lands. Disabled-state + sub-note makes the dependency explicit.

### D5: GaugeCard color flip — `--danger` → `--warning` on hit chip + value

**Rule:** Gate-hit chip background, chip text, and hero-value color all bind to `var(--warning)`. `var(--danger)` reserved for actual danger states.

**Why:** Spec §4.3 + §2.1 define gate-hit = amber (warning), not red. The token swap (S1) fixed the underlying `--warning` value but the bindings in GaugeCard still pointed at `--danger`. Review §2.5 #1 named this explicitly.

**Tradeoff accepted:** None — pure correctness fix.

### D6: Sparkline Composite line dashed; Final solid (review §2.3 #8)

**Rule:** `Final` line stays solid `--accent`. `Composite` switches to dashed `--text-3`. Legend swatches update to match.

**Why:** When `macro_multiplier == 1.0`, Final and Composite have identical values; the two lines overlap pixel-perfect. Distinct line styles preserve readability across all multiplier states.

**Tradeoff accepted:** None — strictly better.

### D7: Sparkline fixture anchor moves to 2026-05-09 (review §2.3 #7)

**Rule:** Fixture history dates walk back 7 days × 11 from 2026-05-09 (the rest-of-app fixture anchor). Was hardcoded 2026-02-01 → 2026-04-22 ending 25 days before "today."

**Why:** The chart truncated visibly short of today, reading as "data stale."

**Tradeoff accepted:** None.

### D8: /decisions filter state via Next App Router searchParams (vs client state)

**Rule:** Active kind filter lives in URL (`/decisions?kind=tier_change`). Server reads `searchParams.kind`, filters, renders.

**Why:** No client JS for filter state. Bookmarkable. Server-rendered fast path stays intact. Active row in BY KIND panel renders as `<Link>` so toggling = one navigation.

**Tradeoff accepted:** Counts in BY KIND panel are computed over the FULL event set so users see inventory, not "what survived the filter" — already documented inline.

## 7. Next-session test plan — MOST IMPORTANT

### 7.1 Read-only verification (<60s, no mutations)

```bash
# Verify branch + HEAD match this handoff
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD
# Expected: 02975ce1107153ba9fa7a7b57df1530e01ae737b (or newer if a follow-up commit landed)

git log --oneline origin/main..HEAD | head -15
# Expected: top entries 02975ce..4d56914 from this session (13 commits) on top of S2 commits

# Verify pushed
git ls-remote origin claude/lambo-design-finish 2>&1 | head -1
# Expected: a SHA matching local HEAD (or a SHA you can git fetch + diff)

# Verify dev server still up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/
# Expected: 200. If not: cd web && npm run dev (background it)

# Verify typecheck clean
cd web && npx tsc --noEmit
# Expected: no output (no errors)

# Confirm the 14 new component files landed
ls /Users/terryturner/Projects/ai-thesis/web/src/components/rails/
# Expected: 11 files — RailChrome.tsx + 5 *Rail.tsx + 5 *RailRegister.tsx
ls /Users/terryturner/Projects/ai-thesis/web/src/app/regime/
# Expected to include: GaugeBar.tsx, RegimeTrendChart.tsx, GateHistory.tsx
```

### 7.2 Fresh end-to-end test

Not applicable — UI session. No endpoints, no engine changes, no ingestion.

### 7.3 Visual / UI verification

Re-screenshot every surface and confirm rails + new components render:

```bash
# Rails sweep — uses the existing rails screenshot script
python3 /tmp/lambo-review-2026-05-16/shot_rails.py
# Outputs to /tmp/lambo-review-2026-05-16/after_rails/

# Universe filter rail + backtest topbar
python3 /tmp/lambo-review-2026-05-16/shot_universe.py

# Decisions filtered + unfiltered
python3 -c "
from playwright.sync_api import sync_playwright
from pathlib import Path
OUT = Path('/tmp/lambo-review-2026-05-16/after_rails')
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_context(viewport={'width':1440,'height':1100},device_scale_factor=2).new_page()
    pg.goto('http://localhost:3003/decisions', wait_until='networkidle'); pg.wait_for_timeout(800)
    pg.screenshot(path=str(OUT/'decisions_unfiltered.png'))
    pg.goto('http://localhost:3003/decisions?kind=tier_change', wait_until='networkidle'); pg.wait_for_timeout(800)
    pg.screenshot(path=str(OUT/'decisions_filtered.png'))
    b.close()
"
```

Expected appearance per surface — visual contract:

- **/dashboard rail**: 3 sub-sections (TOP MOVERS 5 rows, INSIDER ghost THS-66, MACRO GATES `1/3 · 0.95×` + per-gauge list + Open regime ›)
- **/universe/TSM rail**: TSM · ACTIVITY → RECENT EVENTS (composite Δ rows), INSIDER ghost THS-58, NEWS ghost THS-59
- **/universe rail**: FILTERS → LAYER chips + TIER chips + AIQ MINIMUM slider (NO FLOOR default) + FLAGS triplet (Macro active, Depr/Burry disabled with THS-46 sub-note) + footer "50 / 50 names · as of 2026-05-09 (fixture)"
- **/portfolio rail**: Reserve & triggers (no fired count in fixture) → RESERVE $100K hero + bar (on target) + TRIGGERS 3 pills (1 clear, 2 awaiting ingestion)
- **/regime rail**: THRESHOLD LEGEND → GATES list (NAAIM hit amber, AAII/F&G muted) + MULTIPLIER TABLE (1 GATE row highlighted in Cypher Indigo)
- **/regime canvas** (new sections below gauges): 12-MONTH TREND chart with 3 lines + right-edge labels + today vertical, then HISTORY · LAST 5 GATE-STATE CHANGES list (1 event in fixture: Mar 6 NAAIM crossed 90)
- **/regime gauges**: spec horizontal bar instead of wavy sparkline; NAAIM "96.7" + GATE HIT chip in amber (was red)
- **/aiq/TSM rail**: TSM · RUBRIC HISTORY → "0 versions" + "DB unconfigured — save a draft from the editor to populate history" + footer
- **/universe/TSM header**: 12-WEEK HISTORY chart now shows 2026-02-21 → 2026-05-09 range, HIGH 75 threshold rule visible, dashed Composite legend swatch
- **/decisions filtered to tier_change**: "Tier change · 1" pill + Clear button in header, BY KIND row "Tier change" highlighted in Cypher Indigo, only AVGO row visible

If any visual contract is wrong, grep for the surface's component files and check against this session's commits.

## 8. Budget / quota tracking

Not applicable.

## 9. Known issues / backlog

### Open queue (locked order)

1. **Task #9 P3 polish** — Terry's explicit next phase per the message that triggered this /sch. Items in backlog:
   - §2.1 #7 Sidebar labels OPERATIONS/WORKSPACE → COMMAND CENTER/WORKSPACE (spec §3.3)
   - §2.6 #1 "SCOR" column truncation on /aiq list
   - §2.6 #4 /aiq list rail should hide-by-default (spec doesn't define rail for it)
   - §2.4 #4 P3 Confirm 3-trigger list (spec mentions 2 — verify w/ Terry)
   - Various P3 micro-spacing + label rename items per §2 tables

2. **Task #8 residuals not done this session** (P1/P2 still open):
   - §2.4 #1 P1 `?seed=fixture-positions` flag for /portfolio demo
   - §2.7 #1 P2 AIQ detail header meta line ("Last scored {date} · {score}/100 · {tier}")
   - §2.7 #2 P2 Per-dimension source URL field in AiqEditor
   - I was reading `AiqEditor.tsx` when Terry interrupted to invoke /sch — nothing partial on disk.

3. **Pre-existing untracked docs** — `docs/design/lambo-review-2026-05-17.md` + `docs/handoffs/2026-05-17-S1-lambo-design-finish.md` are on disk from prior sessions but never `git add`-ed. Need their own commit; not adding here to keep scope clean.

### Spec §6 rail fan-out

Complete. 5/5 wired. `/settings` correctly excluded per spec ("None — no rail").

### Mercury pattern map (S2 doc)

Pattern #7 (sticky scroll on /universe table) still pending per `docs/design/mercury-references.md`. Lives outside the §2 review.

### No blockers

## 10. Quick-reference IDs

```
PROJECT ROOT:     /Users/terryturner/Projects/ai-thesis
WEB SUBDIR:       /Users/terryturner/Projects/ai-thesis/web
BRANCH:           claude/lambo-design-finish
HEAD SHA:         02975ce1107153ba9fa7a7b57df1530e01ae737b
COMMITS AHEAD:    30 vs origin/main
PUSHED:           YES — terry-zero-in/ai-thesis on GitHub
UPSTREAM:         NOT tracked locally (set via git branch --set-upstream-to origin/claude/lambo-design-finish if needed)
DEV SERVER:       http://localhost:3003
DEV SERVER TASK:  bw3hy4o16 (still alive from S1; HTTP 200 verified 2026-05-17 13:47 CDT)

PR LINK:          https://github.com/terry-zero-in/ai-thesis/pull/new/claude/lambo-design-finish
                  (Terry has not yet opened PR — branch is pushed and ready)

SPEC + REVIEW DOCS:
  Master design spec   /Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Master-Design-Spec.md  (§6 rail spec at line 722; §5.5 regime at 628)
  Algorithm spec       /Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Algorithm-and-Deployment.md
  Lambo review         /Users/terryturner/Projects/ai-thesis/docs/design/lambo-review-2026-05-17.md  (§2 per-route findings; §3.1 rail framing)
  Mercury ref index    /Users/terryturner/Projects/ai-thesis/docs/design/mercury-references.md
  S2 handoff           /Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S2-mercury-decard-pass.md
  S1 handoff           /Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S1-lambo-design-finish.md  (UNTRACKED in git but on disk)
  THIS HANDOFF         /Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S3-rails-and-p1-p2-fixes.md
  Desktop copy         /Users/terryturner/Desktop/2026-05-17-S3-rails-and-p1-p2-fixes.md

NEW PRIMITIVES (use these; don't fork):
  web/src/components/rails/RailChrome.tsx           — RailHeader, RailSection, RailEmpty, RailGhost, RailFooter
  web/src/components/rails/{Dashboard,Name,Portfolio,Regime,Aiq}*Rail.tsx
  web/src/components/rails/{Dashboard,Name,Portfolio,Regime,Aiq}RailRegister.tsx
  web/src/app/regime/GaugeBar.tsx                   — props: value, threshold, range, fired
  web/src/app/regime/RegimeTrendChart.tsx           — props: history
  web/src/app/regime/GateHistory.tsx                — props: changes

CONTEXT SLOT:
  useCtxPanel().payload : unknown  // set via setPayload from page's *RailRegister; cast at the CtxPanel branch level

NEXT URL CONVENTION:
  /decisions?kind=<AlertKind>   // tier_change | conv_drop | aiq_drift | macro_flip | insider_cluster | quarterly_review

PLAYWRIGHT SCRIPTS:
  /tmp/lambo-review-2026-05-16/shot_rails.py            — all 5 page rails
  /tmp/lambo-review-2026-05-16/shot_universe.py         — /universe rail + /backtest topbar crop
  /tmp/lambo-review-2026-05-16/reshot.py                — original 4-surface baseline
  /tmp/lambo-review-2026-05-16/shot_aiq.py, shot_portfolio.py — surface-specific
SCREENSHOT OUTPUT:                  /tmp/lambo-review-2026-05-16/after_rails/
```

## 11. Pitfalls / gotchas

1. **Aside count selector trap.** `page.locator("aside").all()[-1]` is the right way to grab the RIGHT rail in Playwright — the LEFT Sidebar is also an `aside`. Don't use `.first` or it'll grab the nav.
2. **Upstream not configured.** `git status` won't show "X ahead of origin/Y" by default for this branch. Push works (origin knows the branch), but local won't auto-display ahead-behind without `git branch --set-upstream-to origin/claude/lambo-design-finish`. Don't be confused if `git status` looks like nothing's pending.
3. **Untracked prior-session docs.** `docs/design/lambo-review-2026-05-17.md` + `docs/handoffs/2026-05-17-S1-lambo-design-finish.md` are on disk but never committed. They'll keep showing up in `git status` as untracked until someone (Terry?) decides whether to add them as their own commit or .gitignore them.
4. **S2 handoff §10 SHA mismatch.** S2 handoff says HEAD is `16c83f6` because the doc was committed AS `5aac70e` (the doc itself moved HEAD). Same pattern this handoff: it documents `02975ce` and will be committed as the NEXT SHA after this file lands.
5. **S2 handoff pointed at "lambo-review §10" for rail spec — that's wrong.** §10 is the /linear doctrine amendment. The rail spec lives in `lambo-review §3.1` + `Master Design Spec §6`. Verify both when extending rails.
6. **CtxPanel branch ordering matters.** The render branch is a chained ternary, evaluated top-down. New rails go BEFORE the `<Placeholder/>` fallback. If you add a new rail key but skip its branch, the fallback eats it.
7. **Rail register cleanup.** Every `*RailRegister` calls `setPayload(null)` in its cleanup. Without that, switching surfaces would leave stale data in the slot and the WRONG-RAIL cast at CtxPanel branch would crash. Don't forget the cleanup function.
8. **AIQ-MIN slider edge case.** A value of `0` is treated as "no floor" (null), not "≥ 0." That's intentional — the slider's left anchor reads "0" but submitting 0 = clearing the filter. The "Off" button is the explicit clear.
9. **Macro flag inconsistency between rail + table.** The /universe table also has a macro-flag column. The filter rail's FLAGS · "Macro gate hit" filters table rows that have `macro_gates_hit >= 1` — those are also visually marked by the warning chip in the Macro column. Consistent, but easy to double-test.
10. **Sparkline thresholds expand y-domain.** If a score sits at 87 (close to HIGH=75 only at ~12pt distance), the y-domain expands to include 75 even if no data point reaches it. Without this, the threshold line would clip at the top edge and read as noise. The reverse (score at 90+) wouldn't show MEDIUM=60 because it's too far below the data range. That's the visible-only filter — by design.

## 12. Next-session pickup point

**Terry has explicitly said:** *"lets do an //sch prior to the starting the P3 ppolish"* — meaning Task #9 (P3 polish pass) is next.

Concrete first action: Open `docs/design/lambo-review-2026-05-17.md` §2 tables; pick off the P3 items in order of surface. Suggested starting cluster:

1. `/dashboard §2.1 #7` — Sidebar labels OPERATIONS/WORKSPACE → COMMAND CENTER/WORKSPACE per spec §3.3
2. `/aiq §2.6 #1` — "SCOR" column header truncation (widen or rename to "TOTAL")
3. `/aiq §2.6 #4` — hide rail by default on /aiq list (spec has no rail for it)
4. `/portfolio §2.4 #4` — Confirm with Terry: spec mentions 2 triggers, build has 3
5. Walk down §2 tables surface by surface for remaining P3s

Suggested NOT to skip in P3:
- `/aiq §2.7 #1` AIQ detail header meta line ("Last scored {date} · {score}/100 · {tier}") — was queued as P2 but small/fast; bundle with /aiq P3 work.

Suggested DEFER (P1 but bigger scope; treat as separate session):
- §2.4 #1 `?seed=fixture-positions` for /portfolio demo
- §2.7 #2 Per-dimension source URL field in AiqEditor
