# S11 Handoff — 2026-05-19 — PortfolioValueChart v2 instrumentation

## 1. TL;DR

- 1 commit shipped: `93f0904` — PortfolioValueChart full rewrite with axes + grid + cost-basis ref line + HIGH/LOW annotations + footer summary + 2-decimal headline + multi-comparison header.
- Driven by Claude Design HTML reference (`/Users/terryturner/Documents/Archives/AI Thesis Lambo Polish/AI Thesis - Dashboard.html`) — adapted, not lifted.
- LineChart primitive intentionally untouched (Sparkline + NameScoreChart + AggregateBar still consume it). Only PortfolioValueChart rolls its own custom SVG now.
- 2 of 3 planned items deferred — greeting countdown clock (#2) and Top Positions table weight column + thesis grade (#3) — both still applicable from the reference HTML.
- Continues directly from S10 (`8f26ac4`). All session-level overrides from S10 still apply.

## 2. Architectural pivot or major decision

**PortfolioValueChart switches from LineChart primitive composition to a fully-custom SVG.** The chart is now the only consumer in the codebase that doesn't go through `LineChart`. Reason: it needs grid lines, axis labels, area fill, HIGH/LOW dot markers, and a cost-basis horizontal reference line — all in the same coordinate space. Layering positioned divs over `LineChart` for all that would have been brittle.

**Why:** Single-canvas SVG = single source of truth for the coordinate math (xAt/yAt computed once, every element references them). The HTML reference does exactly this; matching the implementation pattern eliminated 4 sources of layout drift.

**Tradeoff accepted:** ~370 lines of SVG/JSX inside PortfolioValueChart vs the prior ~50 lines that called `LineChart`. Worth it — every other chart in the app (Sparkline tiles, NameScoreChart, AggregateBar 30D chart) is simpler and still composes through `LineChart`. The fully-instrumented PortfolioValueChart is the only outlier and earned that outlier status.

**`synthesize()` algorithm also pivoted.** Old: random walk centered at currentValue. New: linear interpolation from cost basis (i=0) to currentValue (i=N-1) + bounded ±0.6% noise with anchored endpoints. Honest fixture: chart starts where the user bought in, ends at today's value. Cost-basis reference line now sits meaningfully inside the chart range instead of floating at a random Y position relative to a noise-centered curve.

## 3. State of the world

**Services / endpoints**
- Marketing: `https://ai-thesis-v2.vercel.app/` → HTTP 200 (verified at handoff write, 2026-05-19 ~01:30 CT)
- Authed: `/portfolio` → 307, `/?moverTier=High` → 200 (Dashboard rail filter still alive)
- Latest deploy: `https://ai-thesis-v2-14mg32v95-terry-8893s-projects.vercel.app` (from `93f0904`)

**Secrets** (names only): unchanged from S10. No env touched.

**Scheduled jobs:** unchanged from S10.

**External integrations:** unchanged. GitHub→Vercel webhook STILL BROKEN.

**DB state:** No schema changes. No migrations. No new tables. No queries added.

**Git state**
- Branch: `main` @ `93f0904f47551905501a4ee38b73d96a2c7622d3` (short `93f0904`)
- Commits ahead of `origin/main`: 0 (all pushed)
- TSC clean: YES (exit 0)
- Working tree: clean except 9 untracked handoff docs (S3-S11)

## 4. Action / API reference

None this session. No new endpoints, no API contract changes. PortfolioValueChart's prop contract widened by one prop:
- `costBasis: number` (required) — passed from Dashboard as `portfolio.total_deployed`

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/components/dashboard/PortfolioValueChart.tsx` | REWRITE | Full instrumentation kit — axes, grid, area fill, cost-basis ref line, HIGH/LOW canvas annotations, 2-decimal headline, multi-comparison header, footer summary, custom-SVG hover |
| `web/src/app/page.tsx` | MOD (1 line) | Pass `costBasis={portfolio.total_deployed}` to PortfolioValueChart |

That's it. Two-file commit, 541 insertions / 150 deletions.

## 6. Decisions locked

**PortfolioValueChart now owns its SVG; doesn't compose through LineChart primitive.**
Why: instrumentation density (grid + axes + area fill + ref line + dots + crosshair + hover dot) needs single coordinate space. Layering positioned divs over LineChart for all that = brittle.
Tradeoff accepted: PortfolioValueChart is the only outlier in the chart system. Sparkline, NameScoreChart, AggregateBar 30D chart all still compose through LineChart.

**Cost-basis reference renders as a HORIZONTAL line (single value), NOT as a SPY-normalized SERIES.**
Why: we don't have SPY time-series data wired through yet — only `spy_as_of` (a date). The reference HTML mock has SPY as a dashed series; we'd be inventing data to match. Honest v1 = cost basis only.
Tradeoff accepted: chart legend has 2 items (NAV + Cost basis) instead of 3 (NAV + SPY-normalized + Cost basis). Provenance footer notes when SPY series will land.

**Headline value shows 2 decimals with the `.XX` rendered at `--text-3` weight 400.**
Why: pennies = precision = real money. /lambo institutional read. The dimmer decimal lets the dollars dominate while the cents are still present for trader-grade reading.
Tradeoff accepted: other surfaces (KPI tiles, AggregateBar) still round to whole dollars. Inconsistent across surfaces by design — chart is the precision surface, glance surfaces stay rounded.

**`synthesize()` walks cost basis → currentValue (linear-interpolated trend + bounded noise, anchored endpoints).**
Why: chart now MEANS something. Bought in at $79,475, today at $77,992 → downtrend. Cost-basis reference line falls at the START of the range. Old algorithm centered noise around currentValue, making the cost-basis line float randomly.
Tradeoff accepted: range pills (5D / 1M / 6M / 1Y / All) all show same shape with different time resolutions. Real data will introduce range-specific volatility once `positions_history` snapshotter is wired.

**Container bumped 180 → 280px for instrumentation breathing room.**
Why: axes labels + footer summary + annotations need vertical space. 180px was sized for a single line + range pills.
Tradeoff accepted: chart is now a more substantial canvas element; pushes Score Movers + Top Positions further below the fold. Real estate trade-off for institutional density.

**HIGH/LOW label edge-flip logic: text flips to LEFT side of dot when the dot is past 70% of x-axis width.**
Why: prevents labels from clipping the right edge.
Tradeoff accepted: when HIGH and LOW are in similar X regions, labels can stack — visual not perfect at certain data shapes. Acceptable for fixture; live data will rarely produce this.

**SPY-normalized overlay deferred to v1.1.**
Why: data not available. See above + provenance footer text.
Tradeoff accepted: documented in source-file comment block + footer provenance line so next session doesn't reinvent.

## 7. Next-session test plan

### 7.1 Read-only verification (<60s)

```bash
cd /Users/terryturner/Projects/ai-thesis && \
  echo "=== git ===" && git rev-parse --short HEAD && git rev-list --count origin/main..HEAD && \
  echo "=== tsc ===" && cd web && npx tsc --noEmit 2>&1 | tail -3 && cd .. && \
  echo "=== live ===" && curl -sI https://ai-thesis-v2.vercel.app/ | head -2 && \
  curl -sI https://ai-thesis-v2.vercel.app/portfolio | head -2 && \
  curl -sI "https://ai-thesis-v2.vercel.app/?moverTier=High" | head -2
```

Expected: HEAD = `93f0904`, ahead = `0`, tsc exit = `0`, marketing 200, portfolio 307, moverTier 200.

### 7.2 Fresh end-to-end deploy (only if commits added)

```bash
cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes 2>&1 | grep -E "Production|ready" | head -3
```

**CRITICAL:** STANDALONE command. Do NOT chain after `cd /Users/terryturner/Projects/ai-thesis && ...`. See §11.

### 7.3 Visual / UI verification (hard-refresh required)

Hard-refresh `https://ai-thesis-v2.vercel.app/` and walk the PORTFOLIO VALUE chart card:

1. **Header row:**
   - Eyebrow: `PORTFOLIO · NAV` (mono uppercase 10.5px, --text-3, 0.14em tracking)
   - Headline: `$77,992.41` at 44px JetBrains Mono weight 500, letter-spacing -0.025em. The `.41` decimal should be DIMMER (--text-3) than the whole dollar part.
   - Below headline: `−$1,483.12 (−1.87%) since open · vs cost −$2,066.00 (−2.58%)` — multi-comparison, color-coded (red for losses, green for gains)
   - Right side: range pills (1D/5D/1M/6M/YTD/1Y/All), 1M active

2. **Chart canvas (280px tall):**
   - 5 horizontal grid lines very subtle (`rgba(255,255,255,0.04)`)
   - Y-axis tick labels right-anchored at left edge, format `$XX.Xk` (e.g., `$78.5k`)
   - Blue NAV line + filled gradient beneath
   - **Dashed gray cost-basis horizontal line** at $79,475
   - Green dot at the 30d HIGH with `HIGH $XX,XXX` label beside it
   - Red dot at the 30d LOW with `LOW $XX,XXX` label beside it
   - Labels auto-flip to left side of dot when near right edge
   - Bottom: 5 X-axis date labels evenly spaced, rightmost reads `TODAY`

3. **Hover the chart:**
   - Dashed vertical crosshair appears
   - Accent dot with halo glow at the data point
   - Tooltip card shows:
     - Date header in uppercase (e.g., `MAY 10, 2026`)
     - `NAV  $77,XXX.XX` (2 decimals)
     - `vs cost  ±$X · ±X.XX%` color-coded

4. **Footer summary line:**
   - `— NAV  --- Cost basis · 30d high $X (date) · 30d low $X (date) · max drawdown −X.XX%`
   - Swatches: solid accent for NAV, dashed --text-3 for Cost basis

5. **Provenance line** (smaller, dimmer):
   - `Fixture · deterministic walk from cost basis → current value · SPY-normalized overlay lands when SPY time-series wires up`

### 7.4 Cross-range smoke check
- Click 1D / 5D / 1M / 6M / YTD / 1Y / All — chart should re-render with different X-axis label dates. Endpoints always anchored at cost basis (start) and currentValue (end). Cost-basis reference line stays at the same Y across all ranges.

## 8. Budget / quota tracking

None this session.

## 9. Known issues / backlog

### Deferred from this build session (still aligned with reference HTML)
1. **Greeting subtitle + live countdown clock** (S10 item #2). Reference HTML lines 911-926. Format: `Last sync HH:MM:SS ET · stream healthy · N of M covered held` + right-side pulsing dot · `HH:MM:SS ET · TUE MAY 19 · NYSE CLOSED · OPENS IN HH:MM:SS`. setInterval(tick, 1000) for live updates. Touches: `web/src/app/GreetingStrip.tsx` + `greeting-compute.ts`.
2. **Top Positions table — Weight column + Thesis grade column** (S10 item #3). Reference HTML lines 1019-1109. Add weight % column (% of book) + thin bar visualization + thesis grade column (letter + composite score). Reconciliation row (dim, "N positions + cash") + Total row (Σ · Portfolio · NAV $X.XX). Touches: `web/src/app/page.tsx` `MoversTable` component or new `TopPositionsTable`.

### SPY-normalized series (true v1.1)
3. PortfolioValueChart needs `spy?: number[]` prop + parallel dashed line. Requires wiring SPY time-series fetch (currently only `spy_as_of` is exposed). Defer until backend provides series.

### Carried over from S10 (still open)
4. Fold Dashboard greeting + per-name detail header into PageHeader (Terry's call on consistency vs role).
5. Operational cleanup commit — fix or delete repo-root `.vercel/project.json` (wrong-project footgun source); commit 9 untracked handoff docs (S3-S11) as single docs-housekeeping commit; delete orphan files (EngineStateStrip.tsx, UniverseFilterRail.tsx, TodayThesisCard.tsx).
6. Hoist hover tooltip primitive — pattern now duplicated 3× (PortfolioValueChart, NameScoreChart, will be in any new chart). Hoist when 3rd consumer + a 4th appears.
7. `/logout` discoverability — add to CmdPalette.
8. THS-71 Routines plumbing manual setup (task #47, Terry's manual).
9. Per-surface Instrument-Field Pattern lift — Regime inner content, AIQ Editor, AIQ Drafts, Decisions, Memos, Backtest, Settings.
10. Relocate MorningBrief to `/memos` when that page graduates.
11. THS-85 Auth + Stripe — high priority, billing risk.
12. THS-87 backtest + duplicate cleanup.
13. Fix GitHub→Vercel webhook (every commit needs manual deploy).

## 10. Quick-reference IDs

| Item | Value |
|---|---|
| Repo root (git) | `/Users/terryturner/Projects/ai-thesis` |
| Web app dir | `/Users/terryturner/Projects/ai-thesis/web` |
| Production URL | `https://ai-thesis-v2.vercel.app/` |
| Vercel project (correct) | `ai-thesis-v2` |
| Vercel project (footgun, WRONG) | `ai-thesis` |
| Branch | `main` |
| HEAD SHA | `93f0904f47551905501a4ee38b73d96a2c7622d3` (short `93f0904`) |
| Latest deploy URL | `https://ai-thesis-v2-14mg32v95-terry-8893s-projects.vercel.app` |
| Prior session handoff | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-19-S10-chart-polish-pageheader-portfolio-hero.md` |
| Claude Design HTML reference (for #1 #2 #3) | `/Users/terryturner/Documents/Archives/AI Thesis Lambo Polish/AI Thesis - Dashboard.html` |
| Rewritten file | `web/src/components/dashboard/PortfolioValueChart.tsx` |
| Consumer | `web/src/app/page.tsx` (passes `costBasis={portfolio.total_deployed}`) |
| Constants in chart | `CHART_H=280`, `VIEW_W=1200`, `VIEW_H=280`, `PAD_L=48`, `PAD_R=16`, `PAD_T=16`, `PAD_B=30` |

## 11. Pitfalls / gotchas

1. **Wrong-project deploy footgun is still live.** Repo-root `.vercel/project.json` points to `ai-thesis` (wrong). `vercel deploy` MUST be STANDALONE from `web/`, never chained after `cd /Users/terryturner/Projects/ai-thesis && ...`. Hit once in S10 (`af95c7b`), avoided cleanly this session.

2. **CSS changes need hard-refresh.** Always tell Terry "Cmd+Shift+R" before claiming a visual change is live.

3. **PortfolioValueChart is now the ONLY chart NOT using LineChart primitive.** Sparkline, NameScoreChart, AggregateBar 30D chart all still consume LineChart. Don't accidentally "consolidate" PortfolioValueChart back through LineChart — the instrumentation density requires the single-SVG single-coordinate-space treatment. Read the file's header comment block first.

4. **`synthesize()` algorithm changed shape.** Old: noise centered at currentValue. New: cost-basis → currentValue linear-interpolated walk with bounded noise + anchored endpoints. If you reference old synthesize behavior in another component (Sparkline on KPI tiles still uses its own `synthesizePortfolioSpark()` in `page.tsx`), they're now using DIFFERENT algorithms. They're not visually inconsistent because they're showing different things — Sparkline shows 30d noise around current; chart shows a full performance arc.

5. **Cost-basis reference line position depends on Y-axis bounds INCLUDING costBasis.** `yMinRaw = Math.min(...data, costBasis)` + `yMaxRaw = Math.max(...data, costBasis)`. If you change Y-axis bounds computation, the cost-basis line could fall outside the visible chart.

6. **HIGH/LOW edge-flip threshold = 70% x-axis width.** If labels overlap at certain data shapes (HIGH and LOW close in X), consider a smarter collision avoidance algorithm. Acceptable for fixture data.

7. **Hover tooltip uses % positioning on transform, not absolute pixels.** Edge clamps at 12% / 88%. If chart width changes dramatically, may need to re-tune.

8. **SPY-normalized overlay is deferred — don't fake it.** Reference HTML has SPY series as a second dashed line. We don't have SPY time-series data (only a date). If you're tempted to synthesize SPY data to "complete" the chart, DON'T — Terry's rejected fake comparison data before. Wait for real data wiring.

9. **Greeting countdown clock will introduce JS timer + ticking re-renders.** If implemented, use `setInterval(1000)` per the reference HTML pattern, but ensure cleanup on unmount.

10. **Reference HTML uses `--accent: #7c7cff`** — a violet/blue. Our Basis palette uses a different blue. Don't lift the exact hex; trust `var(--accent)`.

11. **GitHub→Vercel webhook STILL broken.** Manual deploy required per commit.

12. **HeroNumber primitive sizes (lg/xl/xxl) still NOT used in Portfolio AggregateBar OR PortfolioValueChart headline.** Both use inline custom styling. If a future surface wants "HeroNumber" semantic consistency, that's a different design question — both AggregateBar and PortfolioValueChart consciously diverged for their specific roles.

13. **TopPositions table still has the OLD structure** (no weight column, no thesis grade, no reconciliation row, no total row). The reference HTML has all four. If/when shipping item #2 from §9, mirror that structure.

## 12. Next-session pickup point

Run §7.1 verification block first. Then ask Terry: *"S11 closed with the PortfolioValueChart v2 instrumentation (commit `93f0904`). Two items from the chart-polish reference plan remain: (a) Greeting subtitle + live countdown clock per the HTML mock greeting-row pattern, (b) Top Positions table weight column + thesis grade column + reconciliation + total rows. Plus the broader S10 carryover queue (operational cleanup, Auth+Stripe THS-85, etc.). Which first?"*

Do NOT pre-pick the next surface. Terry's been driving the reference walk-through page by page; let him pick the next leverage point.
