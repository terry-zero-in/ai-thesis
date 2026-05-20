# S9 — Universe Insights primitive + Dashboard v3 (5-KPI / chart-in-card / top positions)

**Date:** 2026-05-18
**Session ID:** S9
**Slug:** insights-rail-dashboard-v3
**Predecessor:** S8 (`docs/handoffs/2026-05-18-S8-create-drawer-instrument-field-pattern-dashboard-v2.md`)
**Project root:** `/Users/terryturner/Projects/ai-thesis/`
**Code dir:** `/Users/terryturner/Projects/ai-thesis/web/`

---

## §1 — TL;DR

S9 shipped two major UI primitives and one major canvas rebuild, in 6 commits.

- **Universe Insights rail** (`/universe` right rail) — Tier bar chart + click-to-filter + dimmed-when-inactive, Linear's "calmer" pattern Terry referenced from screenshots. v1: Slice=Tier, Measure=count, Segment=none.
- **Dashboard v3 canvas** — killed EngineStateStrip (Terry: *"If thats it i didnt like it"*); promoted MACRO MULTIPLIER to 5th KPI tile; added PORTFOLIO VALUE line chart in a card with 1D/5D/1M/6M/YTD/1Y/All range pills; added TOP POSITIONS rows-on-canvas section. Sparklines on time-series tiles only (Portfolio + Macro Multiplier).
- **Pure-SVG LineChart primitive** — zero deps, used by PortfolioValueChart + Sparkline (in KPI tiles) and will be reused by per-name detail page chart (THS-78 queued).
- **3 bug rounds on /universe rail**: dropped THS-46 ghost text + unwired flag toggles (Terry: *"do those bottom two flag boxes be come checkable?"* — answer: no, hide them), killed `<1600px` fixed-overlay (panel now compresses canvas, no overlap, no overlay), reverted dual-scroll-context after it clipped NAME column ("alantir Technologies" instead of "Palantir").

Final state: 6 commits live in prod, TSC clean, panel-overlay bug + ghost-flag bug fixed; trackpad-bleed bug addressed via `overscroll-behavior: contain` on single page-wrapper scroll context.

---

## §2 — Architectural pivot or major decision

**Pivot: kill EngineStateStrip from Dashboard v2; absorb engine-state info into a 5th KPI tile.**

**Why:** Dashboard v2 (S8 cce37ae) added EngineStateStrip as the consolidation primitive — it was supposed to merge MonoMetaSpine + AlertCallout into a single chrome row. Terry saw it live S9 and said verbatim: *"If thats it i didnt like it."* (full quote: *"I saw the additional strip above the current strip. If thats it i didnt like it."*)

The original consolidation intent (don't repeat engine-state across 3-4 surfaces) was correct, but a dedicated strip was the wrong execution. Engine state should ride along with the other primary numbers (KPI tiles), not get its own chrome row.

**Replacement:** MACRO MULTIPLIER becomes the 5th KPI tile (e.g., `0.95×`, `Tightened · 1/3 gates`, color-coded by regime severity). KPI row now reads as one strip with five numbers; the operator sees engine state at the same glance as Portfolio value + P&L.

**Tradeoff accepted:** The pure "weekly chain Sat 22:00 UTC" cadence info from EngineStateStrip is dropped — that info is low-frequency-update and not decision-relevant on the dashboard. If it ever needs to surface again, it belongs in a Settings or Status page, not Dashboard chrome.

**Locked in:** `docs/design/insights-primitive-and-dashboard.md` §6 Q-DASH-4 marked REVISED LOCK with full revision note; Q-DASH-7..11 (S9-specific additions) capture the rest of the v3 composition.

---

## §3 — State of the world

**Git:**
- Branch: `main`
- HEAD: `a8e2768c620730a9692e665e7d38f65241d265f8`
- Commits ahead of `origin/main`: 0 (all pushed)
- Working tree: clean except 6 untracked handoff docs (S3-S8); S9 (this doc) becomes the 7th

**TypeScript:** `npx tsc --noEmit` exit 0 (verified S9 handoff-write time)

**Production:**
- Marketing landing: `https://ai-thesis-v2.vercel.app/` → HTTP 200
- `/portfolio` → HTTP 307 (auth gate, expected)
- `/universe` → HTTP 307 (auth gate, expected)
- Vercel project: `ai-thesis-v2` (NOT `ai-thesis` — the S8 wrong-project footgun)
- Latest deploy commit: `a8e2768` (revert dual-scroll-context)

**Supabase:** unchanged from S8 — `ydzvrosvkmqkdaqgsxtb` (Reticle project, KEEP)

**Routines (Anthropic via Claude Max):** unchanged — THS-71 manual setup still pending (Terry: e80 migration + 4 routines on claude.ai/code)

**Scheduled jobs:** none new this session

**External integrations:** none touched

---

## §4 — Action / API reference

None this session — no endpoints touched. All work was visual/composition on existing data fetchers (`dashboard-data.ts`, `portfolio-data.ts`, `universe-data.ts`).

---

## §5 — Files created or modified

| Path | Action | One-line rationale |
|---|---|---|
| `docs/design/insights-primitive-and-dashboard.md` | MOD | §6 LOCKED w/ 11 Open Qs answered + 5 S9 additions (Q-DASH-7..11) |
| `docs/handoffs/2026-05-18-S9-insights-rail-dashboard-v3.md` | NEW | This handoff doc |
| `web/src/components/universe/UniverseInsightsRail.tsx` | NEW | Tier bar chart + legend table + click-to-filter; preserves Layer/AIQ/Flags chips below |
| `web/src/components/rails/UniverseRailRegister.tsx` | NEW | Push UniverseSnapshot to CtxPanel payload so InsightsRail has rows for bar chart |
| `web/src/components/shell/CtxPanel.tsx` | MOD | Swap UniverseFilterRail for UniverseInsightsRail; pass payload through |
| `web/src/app/universe/page.tsx` | MOD | Mount UniverseRailRegister; final state has single scroll context + overscroll-behavior:contain |
| `web/src/components/universe/UniverseTable.tsx` | MOD (twice) | Added then reverted inner overflow-x; final state: no inner overflow (page wrapper owns scroll) |
| `web/src/app/globals.css` | MOD | Killed `.ctx-panel-aside` fixed-overlay rule + 1600px media query — panel always flex-sibling now |
| `web/src/components/primitives/LineChart.tsx` | NEW | Pure-SVG line chart + Sparkline wrapper; zero deps |
| `web/src/components/dashboard/PortfolioValueChart.tsx` | NEW | Canvas card w/ line chart + range pills (1D..All); synthesized fixture data |
| `web/src/components/dashboard/TopPositionsList.tsx` | NEW | Rows-on-canvas (Strip role) ranked by market value, click → /universe/[ticker] |
| `web/src/app/page.tsx` | MOD | Killed EngineStateStrip + regimeStateFor helper; 5-KPI row w/ macroMultiplier + sparklines; PortfolioValueChart + Section + TopPositionsList added |

**Orphan files** (no consumers, deletion deferred to cleanup commit):
- `web/src/components/universe/UniverseFilterRail.tsx` — old chip rail; replaced by UniverseInsightsRail
- `web/src/components/dashboard/EngineStateStrip.tsx` — killed from Dashboard v3 import; file retained

---

## §6 — Decisions locked

**Decision 1: Tier as primary Slice for v1 Insights primitive**
- **Why:** Tier (HIGH / MEDIUM / LOW / AVOID) is the decision-relevant cut — operator acts on tiers, not on engine layers or self-set conviction. Maps directly to existing `classifyTier(final_score)` helper; no new derivation needed.
- **Tradeoff accepted:** v1 drops Slice + Segment dropdowns (Linear's full pattern has Measure/Slice/Segment). Means no "AIQ band" or "Macro gate" slicing yet; comes in v1.1 with stacked-by-Segment rendering.

**Decision 2: MACRO MULTIPLIER as 5th KPI tile (replacing the killed EngineStateStrip)**
- **Why:** Composite-engine vibe — the multiplier (×1.00, ×0.95, etc.) is the decision-actionable engine output. Putting it next to PORTFOLIO + P&L tiles surfaces the de-rating effect on every Dashboard load. Absorbs the EngineStateStrip's job without a dedicated chrome row.
- **Tradeoff accepted:** Rejected COMPOSITE AVG (averaging tier scores across a portfolio is meaningless — a (90, 38) book averages 64, which underwrites nothing). Also rejected: CASH (low signal) and INSIDER ACTIVITY 24H (too volatile).

**Decision 3: Sparklines on time-series tiles only**
- **Why:** PORTFOLIO (30d trend), 30D RETURN (trajectory), MACRO MULTIPLIER (regime history) all benefit from trend visualization. P&L TODAY is a single-day value — a one-point "line" is fake polish. HIGH-TIER NAMES is an integer count — a step chart of 14→14→14→15 reads as jagged garbage with zero signal.
- **Tradeoff accepted:** Slight visual asymmetry across the 5-tile row (3 have sparklines, 2 don't). Honesty over symmetry per [[feedback_quiet_chrome_principle]].

**Decision 4: PORTFOLIO VALUE chart in CARD container (not raw canvas)**
- **Why:** Instrument-Field §3.1 says cards on var(--surface). The Add Position drawer set the pattern; breaking it for the chart = noise, not signature.
- **Tradeoff accepted:** Less visual drama than a hero-style raw-canvas chart. Lambo doesn't have racing stripes.

**Decision 5: TOP POSITIONS as ROWS-ON-CANVAS (Strip role), NOT a card**
- **Why:** Instrument-Field §3.1 has three card roles (Floating / Inset / Strip). Long ranked lists are *Strip* — edge-to-edge canvas, hairline dividers, header flush. Cards-on-cards looks SaaS. The AIQ pattern is right for ranked lists.
- **Tradeoff accepted:** Score Movers + Top Positions stacked feels denser than a single section, but they're different lenses (market activity vs your exposure) and both belong on the morning surface.

**Decision 6: Hide unwired flag toggles (THS-46 self-citation banned)**
- **Why:** Per [[feedback_empty_state_asymmetry]] self-referential ticket citation from inside the ticket's own preview surface is banned. Depreciation + Burry flags were rendering with "THS-46 ingestion pending" subtext — Terry caught: *"TH6 at the bottom shouldnt be tghere. ALso do those bottom two flag boxes be come checkable?"* Answer: no, remove until wired.
- **Tradeoff accepted:** Lost the "we know about these features, they're coming" affordance. Honesty (no ghost UI) wins.

**Decision 7: Single scroll context on /universe page wrapper + overscroll-behavior: contain**
- **Why:** First attempt split horizontal scroll into the table wrapper (commit 587a7c8) — that clipped the NAME column's first letter (Terry's screenshot showed "alantir Technologies"). Reverted to single page-wrapper scroll context with overscroll-behavior to address the trackpad-swipe bleed without splitting axes.
- **Tradeoff accepted:** If `overscroll-behavior: contain` doesn't fully solve the trackpad-under-sidebar bleed on Mac, we may need a different containment strategy (overflow: hidden on Shell + nested scroll). Awaiting Terry's verification post-hard-refresh.

---

## §7 — Next-session test plan

### §7.1 — Read-only verification (<60s, paste-and-run)

```bash
cd /Users/terryturner/Projects/ai-thesis && git rev-parse HEAD
cd /Users/terryturner/Projects/ai-thesis && git rev-list --count origin/main..HEAD
cd /Users/terryturner/Projects/ai-thesis/web && npx tsc --noEmit && echo "TSC OK"
curl -s -o /dev/null -w "marketing: %{http_code}\n" https://ai-thesis-v2.vercel.app/
curl -s -o /dev/null -w "portfolio: %{http_code}\n" https://ai-thesis-v2.vercel.app/portfolio
curl -s -o /dev/null -w "universe: %{http_code}\n" https://ai-thesis-v2.vercel.app/universe
```

Expected output:
- HEAD = `a8e2768c620730a9692e665e7d38f65241d265f8` (or newer if next session commits)
- commits ahead = 0
- TSC OK
- marketing: 200
- portfolio: 307
- universe: 307

### §7.2 — Fresh end-to-end

Not applicable — no engine/data work this session.

### §7.3 — Visual / UI verification

**Hard-refresh first (Mac):** Cmd+Shift+R on every page below.

1. **Dashboard v3** (https://ai-thesis-v2.vercel.app/, logged in):
   - 5 KPI tiles in row: PORTFOLIO, P&L TODAY, 30D RETURN, MACRO MULTIPLIER, HIGH-TIER NAMES
   - Sparklines visible on PORTFOLIO + MACRO MULTIPLIER tile labels (top-right of each tile, 56×18px)
   - No sparkline on P&L TODAY or HIGH-TIER NAMES tiles
   - PORTFOLIO VALUE chart in a card with range pills (1D/5D/1M/6M/YTD/1Y/All) — clicking a range re-renders the line
   - Score Movers section: rows on canvas with hairline dividers, no card chrome
   - Top Positions section below Score Movers: same rows-on-canvas pattern, ranked by market value
   - NO "engine state strip" between greeting and KPI row (killed)

2. **Universe Insights rail** (https://ai-thesis-v2.vercel.app/universe, logged in):
   - Right rail header reads "INSIGHTS" (not "FILTERS")
   - "Tier distribution" section at top: 4 bars (HIGH / MEDIUM / LOW / AVOID), each Tier-colored
   - "Legend" section below: 4 rows with color dot · tier name · count · avg final score
   - Click any bar OR any legend row → table filters to that tier; non-active bars dim to opacity 0.3 + saturation 0.4
   - Layer chips section preserved (L1 Compute / L2 Hyperscaler / etc.)
   - AIQ minimum slider preserved
   - Flags section shows ONLY "Macro gate hit" checkbox — Depreciation + Burry are gone (no ghost UI)
   - Panel is flex-sibling at all viewport widths — opening it compresses canvas leftward, no overlay
   - TopBar's collapse button (panel icon) remains reachable when panel is open
   - Universe table left edge: TICKER column is the leftmost visible, fully readable (no "alantir" clipping)
   - Trackpad two-finger swipe horizontally on the canvas: contained, doesn't trigger browser back-nav or bleed words under sidebar

3. **Portfolio Add drawer** (https://ai-thesis-v2.vercel.app/portfolio, logged in):
   - Unchanged from S8 — verify still works (S9 didn't touch it but it's adjacent surface)

---

## §8 — Budget / quota tracking

None this session. No external API calls beyond Vercel deploys (4 deploys this session: c77311f, 6bd5529, b57484f, 587a7c8, a8e2768 — actually 5).

---

## §9 — Known issues / backlog

**Numbered by area.**

### Dashboard
1. **Real chart data missing** — PortfolioValueChart + KPI sparklines synthesize from current value via deterministic LCG random walk. Live data wires up when `positions_history` snapshotter ships (no ticket yet; not in current Epic priority).
2. **30D RETURN tile still shows em-dash** — needs ≥30 days of position history to compute real benchmark-relative return. Empty-state copy: "tracks once positions have ≥30d of history".

### Universe
3. **Sector slice dimension deferred to v1.1** — `UniverseRow` shape has no `sector` field; requires schema migration. Q-INS-1 LOCKED to defer (see brainstorm doc §6).
4. **Slice/Segment dropdowns deferred to v1.1** — v1 is Tier-only (fixed). Adding Measure/Slice/Segment selectors comes when stacked-by-Segment rendering lands.
5. **Depreciation + Burry flag toggles hidden** — return when THS-46 ingestion ships.

### Per-name detail
6. **THS-78 (queued task #78)** — Per-name detail page needs line chart (price/score trend over time). Terry captured S9: *"we've got to have some sort of line chart for each so we can see the trend up or down etx over time"*. Use LineChart primitive built this session.

### Portfolio
6a. **Task #79 (added post-/sch S9)** — Portfolio page hero has ~60-70% blank canvas to the right of MARKET VALUE block. Drop a line chart there + % change indicator. Terry verbatim: *"The blank space to the right of the amount invested would be a good spot to put the % increase or decrase and then maybe a line chart right on the canvas."* Note **"right on the canvas" = NOT in a card** (different from Dashboard's chart-in-card). Reuse LineChart primitive. Synthesize fixture data until positions_history wires up.

### Right rail (cross-page)
7. **Dashboard mini-Insights port (task #77 pending)** — Phase 4 per brainstorm doc §4 — port compressed bar-chart-with-filter from Universe to Dashboard rail, scoped to filter Score Movers.

### Operational
8. **GitHub→Vercel auto-deploy STILL broken** — every commit requires manual `cd web && vercel deploy --prod --yes`. Verified S7, S8, S9.
9. **Repo-root `.vercel/project.json` still points to wrong project (ai-thesis instead of ai-thesis-v2)** — bit S8 once via `&&` chain. Avoided S9 by always explicit `cd web/`. Long-term fix: delete or repoint.
10. **Universe panel overlap bug — verification pending** — Terry reported S9 that panel still overlapped after first CSS fix. Curl confirmed CSS fix WAS live; likely browser cache. After hard refresh + revert of dual-scroll-context, expected to be resolved. **Verify with Terry post-hard-refresh.**
11. **6 untracked handoff docs (S3-S8) + this S9 = 7 docs accumulating** — Terry's stated cadence is single docs-housekeeping commit when convenient.

### Carry-forward from S8
12. **THS-71 routines plumbing** (task #47, in_progress) — still blocked on Terry: e80 migration in Supabase Studio + create 4 routines on claude.ai/code.
13. **Relocate MorningBrief to /memos** — when that page lifts (THS-75 or sibling).
14. **TodayThesisCard orphan file** — reuse target or delete.
15. **Per-surface audit + lift to Instrument-Field Pattern** — Regime, AggregateBar, AIQ Editor, AIQ Drafts, Decisions, Memos, Backtest, Settings (each ~30-60min single-purpose commit).
16. **THS-85 Auth + Stripe** — high priority, billing risk.

---

## §10 — Quick-reference IDs

| Thing | Value |
|---|---|
| Project root | `/Users/terryturner/Projects/ai-thesis` |
| Code dir | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch | `main` |
| HEAD SHA | `a8e2768c620730a9692e665e7d38f65241d265f8` |
| HEAD short | `a8e2768` |
| Prior session handoff | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-18-S8-create-drawer-instrument-field-pattern-dashboard-v2.md` |
| This session handoff | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-18-S9-insights-rail-dashboard-v3.md` |
| Brainstorm doc (LOCKED §6) | `/Users/terryturner/Projects/ai-thesis/docs/design/insights-primitive-and-dashboard.md` |
| Instrument-Field spec (LOCKED) | `/Users/terryturner/Projects/ai-thesis/docs/design/instrument-field-pattern.md` |
| Operating posture | `/Users/terryturner/Projects/ai-thesis/CLAUDE.md` |
| Vercel posture | `/Users/terryturner/Projects/ai-thesis/web/AGENTS.md` |
| Prod alias | `https://ai-thesis-v2.vercel.app` |
| Prod marketing | `https://ai-thesis-v2.vercel.app/` |
| Prod dashboard (authed) | `https://ai-thesis-v2.vercel.app/` (post-login) |
| Prod universe | `https://ai-thesis-v2.vercel.app/universe` |
| Prod portfolio | `https://ai-thesis-v2.vercel.app/portfolio` |
| Vercel project ID | `ai-thesis-v2` |
| Wrong Vercel project (DO NOT deploy here) | `ai-thesis` |
| Supabase project | `ydzvrosvkmqkdaqgsxtb` (Reticle, KEEP) |
| Live CSS chunk URL (verifies CSS fix is deployed) | `https://ai-thesis-v2.vercel.app/_next/static/chunks/0_u_q3bc54ynj.css` |
| S9 commits (in chronological order) | `49ce299` (doc lock) → `c77311f` (Insights rail) → `6bd5529` (Dashboard v3) → `b57484f` (rail bugfixes) → `587a7c8` (dual-scroll attempt) → `a8e2768` (revert dual-scroll) |

---

## §11 — Pitfalls / gotchas

1. **GitHub→Vercel auto-deploy broken** — every commit requires manual `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`. Don't skip.
2. **`cd web/` MUST be explicit before vercel deploy** — repo-root `.vercel/project.json` points to wrong project. Using `&&` chain like `cd repo && git push && vercel deploy` will deploy to ai-thesis-three.vercel.app NOT ai-thesis-v2.vercel.app. Bit S8 once. Hit-free S9 because I was explicit. **Always: `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`** as standalone command.
3. **Browser cache on CSS changes** — Terry hit this S9: CSS fix was provably deployed (verified via curl on `_next/static/chunks/0_u_q3bc54ynj.css`) but his browser served the old version. **Always tell Terry to hard-refresh (Cmd+Shift+R) when shipping CSS changes**, and verify the live CSS chunk via `curl ... | grep ctx-panel-aside` (or whatever the relevant selector is) when claiming a CSS fix is deployed.
4. **Dual scroll context on /universe page wrapper is wrong** — S9 commit 587a7c8 split horizontal scroll into the UniverseTable wrapper while keeping vertical on the page wrapper. That clipped the NAME column ("alantir Technologies"). Reverted in a8e2768. Don't reintroduce. If trackpad-bleed bug persists despite `overscroll-behavior: contain`, the next attempt should be different (e.g., overflow: hidden on Shell + nested scroll; not splitting axes inside the page wrapper).
5. **`var(--surface-hover)` does NOT exist as a token** — use `var(--elevated)` for hover/popover surfaces per `globals.css:106-108` comment. Hit this S9 building InsightsRail legend table.
6. **The `_UnusedAlertCallout` rename pattern is messy** — when removing dead code, use `awk 'NR<X || NR>Y' file > /tmp/clean && mv /tmp/clean file` for clean range deletion instead of renaming with `_Unused` prefix. S8 caught this; S9 used it inline edits.
7. **Sparklines need a meaningful trend, not synthetic noise** — if you can't compute a real trend for a tile, DON'T add a sparkline (Q-DASH-8 LOCKED: time-series tiles only). Three bars of fake data is worse than no bar.
8. **EngineStateStrip is dead, but file retained** — don't reintroduce it on Dashboard. If a third surface needs the regime-pill primitive, hoist into `components/primitives/RegimePill.tsx` and consume there. The strip ROW shape is the antipattern, not the regime pill itself.
9. **UniverseFilterRail.tsx is orphan** — no consumers after S9 c77311f. Delete in a future single-purpose cleanup commit.
10. **Synthesized chart data is FIXTURE** — `PortfolioValueChart` + sparklines render deterministic LCG random walks anchored at currentValue. Footer reads "Fixture · deterministic random walk anchored at current value · live data lands when positions_history snapshot wires up". When `positions_history` table ships, swap the `synthesize()` call for a real fetcher.
11. **Don't deploy doc-only changes** — manual deploy is expensive (90s build + cache miss for users). Batch doc commits with the next code commit when possible.
12. **TypeScript doesn't warn on unused module-scope functions** — `regimeStateFor` lingered after EngineStateStrip removal. Manually grep for orphan helpers when removing a primary consumer.
13. **`<position: static>` ctx-panel rule with NO position fallback in CSS** — if a future media query tries to re-introduce overlay behavior, it MUST explicitly set `position: fixed` plus all the offset properties. The current rule is one-line: `.ctx-panel-aside{box-shadow:none;position:static}`.

---

## §12 — Next-session pickup point

1. **Run §7.1 verification block** (5 commands, <60s). Confirm HEAD `a8e2768`, 0 ahead, TSC OK, marketing 200, portfolio + universe 307.

2. **Ask Terry verbatim:**

   *"S9 closed with Universe Insights rail + Dashboard v3 + LineChart primitive shipped (6 commits). Three things on the queue: (1) Eyes on /universe + Dashboard v3 post-hard-refresh — does the panel-compress + trackpad-contain fix hold? (2) THS-78 per-name detail page line chart (uses the LineChart primitive built S9). (3) Dashboard right-rail mini-Insights port (task #77, Phase 4 — compress the Universe bar chart into a rail-width version scoped to filter Score Movers). Which first?"*

3. **Default autonomous path if Terry says "go" / "autonomous":**
   - Start THS-78 per-name detail page chart (read `/universe/[ticker]/page.tsx`, add price + composite history chart using LineChart primitive)
   - Then start task #77 Dashboard mini-Insights port (compress UniverseInsightsRail to single-axis, scope to filter Score Movers section)
   - DO NOT touch Dashboard v3 canvas — Terry's eye is required first
