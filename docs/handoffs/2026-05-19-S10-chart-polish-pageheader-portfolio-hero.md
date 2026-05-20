# S10 Handoff — 2026-05-19 — Chart polish + PageHeader primitive + Portfolio hero restructure

## 1. TL;DR

- 9 commits shipped from `a8e2768` → `8f26ac4`, all live on ai-thesis-v2, all TSC clean.
- Chart system hardened: solo-accent lines (no severity-coded red/green), hover crosshair + tooltip, dropped phantom -29% drift on 1Y range, fixed right-edge overflow, fixed sparkline tile-fill regression.
- TopBar chrome cleaned: username chip + Search button removed (Cmd+K still bound).
- `PageHeader` primitive built and applied to 9 surfaces (28px Inter title vs prior 20px mono); Dashboard greeting + per-name detail intentionally NOT converted.
- Portfolio AggregateBar fully restructured to 4-column protagonist row (Basis Rent-Roll pattern); Dashboard 5-KPI row stripped of every divider/hairline.

## 2. Architectural pivot or major decision

**PageHeader primitive supersedes per-page hand-rolled headers.** Every analytical surface previously had its own `<header>` block with `<h1 fontSize:20>` + MonoMetaSpine. Terry called the result anemic: *"our current one looks bad ... we need to standardize this across every single page as itll look 100x beter"* (verbatim, 2026-05-18 22:39 CT). Lifted into `web/src/components/primitives/PageHeader.tsx` — 28px Inter weight 600 with -0.02em tracking, optional subtitle/eyebrow/action slot/meta spine. 9 surfaces converted in one commit (`e0ba170`).

Dashboard `/` and `/universe/[ticker]` intentionally NOT converted: Greeting is the dashboard's header by design, and NameHeader already lifts the composite as HeroNumber. Either can adopt PageHeader if Terry wants the consistency over the personality/role differentiation.

**Why:** Page-title weight should match Linear/Vercel scale for analytical surfaces, not section-heading scale. **Tradeoff accepted:** 2 surfaces stay non-canonical; documented explicitly so next session doesn't accidentally convert them.

## 3. State of the world

**Services / endpoints**
- Marketing: `https://ai-thesis-v2.vercel.app/` → HTTP 200 (verified 2026-05-19 ~01:00 CT)
- Authed routes: `/portfolio` → 307, `/universe` → 307 (auth gates alive)
- URL-state filter: `/?moverTier=High` → HTTP 200 (Dashboard rail mini-Insights working)
- Footgun URL (DO NOT use): `https://ai-thesis-przwyittj-terry-8893s-projects.vercel.app` — burned during `af95c7b` deploy via chained command; this is the WRONG project (`ai-thesis`, not `ai-thesis-v2`).

**Secrets** (names only): Supabase env (anon + service role), FMP API key, Polygon API key, GitHub token, Vercel token. All in `.env.local` (web/) — none touched this session.

**Scheduled jobs:** unchanged from S9. Composite scoring Saturday chain, macro gauges Tue 22:00 UTC, daily memo 13:00 UTC, weekly memo Sunday. None affected this session.

**External integrations:** Supabase (auth + data), FMP (prices + fundamentals), Vercel (hosting). GitHub→Vercel webhook **STILL BROKEN** — every commit requires manual `cd web && vercel deploy --prod --yes` as a STANDALONE command.

**DB state:** No schema changes this session. No migrations applied. No new tables.

**Git state:**
- Branch: `main` @ `8f26ac480f44e42ef6af84ca4ad5ff6bfa9e750f` (short `8f26ac4`)
- Commits ahead of `origin/main`: 0 (all pushed)
- TSC clean: YES (exit 0 verified at handoff write)
- Working tree: clean except 8 untracked handoff docs (S3-S9 from prior sessions + this S10)

## 4. Action / API reference

None this session. No server actions touched, no edge functions modified, no API contracts changed. URL search-param contract added: `/?moverTier={High|Medium|Low|Avoid}` filters Score Movers table on Dashboard.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/components/primitives/PageHeader.tsx` | NEW | Canonical 28px page-title primitive — title, subtitle, eyebrow, action, meta spine, bottom hairline |
| `web/src/components/primitives/LineChart.tsx` | MOD ×3 | (1) Sparkline wrapped in sized span to fix tile-fill regression; (2) SVG switched to 100% style for container fit; (3) drop trend-based color, default to var(--accent) |
| `web/src/components/dashboard/PortfolioValueChart.tsx` | MOD | Hover crosshair + tooltip card (value + date), solo-accent line, drift dropped from synthesize() |
| `web/src/components/name/NameScoreChart.tsx` | NEW | Per-name composite history chart (THS-78) — wrapped in Inset card, hover tooltip, insufficient-data state |
| `web/src/app/portfolio/AggregateBar.tsx` | REWRITE | 4-column protagonist hero (Basis Rent-Roll pattern), no dividers, chart absorbed into Col 2 |
| `web/src/app/portfolio/PortfolioHeroChart.tsx` | NEW→DEL | Shipped in `2294728`, superseded by AggregateBar restructure in `8f26ac4`, deleted same session |
| `web/src/app/portfolio/page.tsx` | MOD | Converted to PageHeader (subtitle + demo chip + add drawer in action slot + meta spine) |
| `web/src/app/page.tsx` (Dashboard) | MOD ×3 | (1) searchParams.moverTier filter; (2) tier-counts in railData; (3) KPI row dividers + hairlines removed |
| `web/src/app/universe/page.tsx` | MOD | Converted to PageHeader; SearchInput moved to action slot |
| `web/src/app/universe/[ticker]/page.tsx` | MOD | NameScoreChart inserted above FactorPanels |
| `web/src/app/regime/page.tsx` | MOD | Converted to PageHeader |
| `web/src/app/memos/page.tsx` | MOD | Converted to PageHeader |
| `web/src/app/decisions/page.tsx` | MOD | Converted to PageHeader (BulkAck in action slot, filter chip moved below) |
| `web/src/app/aiq/page.tsx` | MOD | Converted to PageHeader (Drafts queue link in action slot, show-filter tabs moved below) |
| `web/src/app/aiq-drafts/page.tsx` | MOD | Converted to PageHeader |
| `web/src/app/backtest/page.tsx` | MOD | Converted to PageHeader |
| `web/src/app/settings/page.tsx` | MOD | Converted to PageHeader |
| `web/src/app/proposals/page.tsx` | MOD | Converted to PageHeader |
| `web/src/components/rails/DashboardTodayRail.tsx` | MOD | Mini-Insights port: 4-bar tier chart + URL push-to-filter (THS-77) |
| `web/src/components/shell/TopBar.tsx` | MOD | UserChip removed, Search button removed (Cmd+K still bound via global keymap) |

## 6. Decisions locked

**Solo-accent chart lines — NO trend-based color coding on line itself.**
Why: /lambo "severity colors only at severity moments. The accent is even more precious." Trend communication lives in the numeric chip beside the value (color-coded), not in the line stroke.
Tradeoff accepted: less visual scanability of trend direction from the line alone; users read the % chip for direction.

**Macro Multiplier sparkline keeps regime-state color (green/yellow/orange/red by gates hit) as the exception.**
Why: Macro state IS a severity moment per /lambo — gates hit = warning state, applies to ENTIRE engine output.
Tradeoff accepted: 1 of 2 sparklines on Dashboard varies color; Portfolio sparkline is always blue.

**UserChip + TopBar Search button permanently removed.**
Why: Terry verbatim: "delete my username at the top right and just move everything over in its place" + "search icon and search br are redundant".
Tradeoff accepted: no visible sign-out affordance in topbar (`/logout` direct URL still works); discoverability of Cmd+K relies on help (?) popover + ShortcutsOverlay. Linear/Vercel pattern.

**Hover tooltip pattern (crosshair + accent dot + edge-clamped card with value + date).**
Why: Linear/Mercury financial-chart pattern; Terry explicitly requested *"if you move you cursor close to it or over itt it could show the exact price and datat that point on the line"* (verbatim 2026-05-18 22:59 CT).
Tradeoff accepted: pure-SVG implementation duplicated between PortfolioValueChart + NameScoreChart (Portfolio's `ChartWithHover`, Name's `ChartWithHover`) — same shape, different formatting. If a 3rd consumer needs it, hoist to a shared `HoverableChart` primitive.

**`synthesize()` drift removed — pure noise centered at zero.**
Why: walking backward from `currentValue` with `drift=-0.0008/step` compounded: prior values went HIGHER over 365 iterations, producing a phantom -29% loss on 1Y range with no real-data basis.
Tradeoff accepted: longer ranges look flatter (less dramatic) — but anchored at currentValue is the honest behavior for fixture data.

**PageHeader is the canonical page-title block. 9 surfaces converted; Dashboard greeting + per-name detail explicitly out of scope.**
Why: Dashboard's GreetingStrip carries personality ("Up late, Terry"); NameHeader already promotes composite to HeroNumber. Both serve a different role than generic page-title.
Tradeoff accepted: 2 surfaces remain non-canonical; next session can fold if Terry decides consistency > role differentiation.

**Portfolio hero = 4-column protagonist row, NO dividers, NO hairlines. Dashboard KPI row = 5 cells, NO dividers, NO hairlines, gap:32.**
Why: Basis Rent-Roll pattern from Terry's reference screenshot — protagonist columns with whitespace as the separator beat chrome-heavy dividers for institutional read.
Tradeoff accepted: less structural separation between cells; relies on label + value rhythm and column width for grouping. Top hairline from PageHeader + bottom hairline from next section provide outer structure.

**Movers-by-tier rail bar chart: aggregates run on the FULL unfiltered movers set; only the table filters.**
Why: matches the Universe Insights rail contract from S9 — Linear's "filter doesn't change bar heights" pattern.
Tradeoff accepted: clicking a bar may show "0 names" if no rows in that tier; explicit "No {Tier}-tier names in this week's score movers" empty state handles it.

## 7. Next-session test plan

### 7.1 Read-only verification (<60s, paste-and-run)

```bash
cd /Users/terryturner/Projects/ai-thesis && \
  echo "=== git state ===" && git rev-parse --short HEAD && git rev-list --count origin/main..HEAD && \
  echo "=== tsc ===" && cd web && npx tsc --noEmit 2>&1 | tail -3 && cd .. && \
  echo "=== live ===" && curl -sI https://ai-thesis-v2.vercel.app/ | head -2 && \
  curl -sI https://ai-thesis-v2.vercel.app/portfolio | head -2 && \
  curl -sI https://ai-thesis-v2.vercel.app/universe | head -2 && \
  curl -sI "https://ai-thesis-v2.vercel.app/?moverTier=High" | head -2
```

Expected output: HEAD = `8f26ac4`, ahead count = `0`, tsc exit = `0`, marketing 200, portfolio + universe 307, moverTier 200.

### 7.2 Fresh end-to-end deploy (only if commits added)

```bash
cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes 2>&1 | grep -E "Production|ready" | head -3
```

**CRITICAL:** must be STANDALONE command. Do NOT chain after `cd /Users/terryturner/Projects/ai-thesis && ...` — repo root has stale `.vercel/project.json` pointing to wrong project (`ai-thesis`, not `ai-thesis-v2`). Got bit once this session, burned a wrong-project deploy. See §11 pitfall #1.

### 7.3 Visual / UI verification (hard-refresh required)

Hard-refresh (Cmd+Shift+R) on each surface, then walk:

1. **`/` Dashboard:**
   - Greeting at top ("Up late, Terry" or current time-of-day variant)
   - 5-KPI row: Portfolio · P&L Today · 30D Return · Macro Multiplier · High-Tier Names — NO vertical dividers between cells, NO top/bottom hairlines
   - PORTFOLIO sparkline = small blue line (var(--accent)) beside label, NOT red, NOT tile-filling
   - MACRO MULTIPLIER sparkline = green/yellow/orange/red per gates hit
   - PortfolioValueChart card: blue line stays INSIDE card right edge, no overflow into rail
   - 1Y range: chart should NOT show steady -29% drop; flatter random walk
   - Hover the chart: vertical guideline + blue dot + tooltip card showing `$value` + `Month Day, Year`
   - Rail "Movers by tier" section: 4 bars (tier-colored), click a bar → Score Movers table filters + section header updates to "Score movers · ... · {Tier} tier only"

2. **`/portfolio`:**
   - PageHeader: "Portfolio" at 28px Inter weight 600, subtitle + demo chip (if `?seed=fixture-positions`) inline, Add position drawer trigger right-aligned
   - 4-column AggregateBar: MARKET VALUE · 30D PERFORMANCE (chart) · P&L · SINCE OPEN · RESERVE — NO dividers between columns, whitespace as separator
   - MARKET VALUE gets the largest font, others slightly smaller
   - 30D PERFORMANCE chart line is blue accent, not severity-colored

3. **`/universe`:**
   - PageHeader: "Universe" at 28px, SearchInput on the right
   - Right rail Insights bar chart still works (S9 work)

4. **`/universe/AAPL` (or any ticker):**
   - NameHeader at top (unchanged — has HeroNumber for composite)
   - NEW: NameScoreChart card above FactorPanels — composite history with hover crosshair + tooltip showing score + week date

5. **TopBar (all pages):**
   - Right side: [?] [□|] only — no username chip, no "Search" button text
   - Cmd+K still opens CmdPalette (test with keyboard)

6. **Other PageHeader pages** (smoke check each):
   - `/regime` `/memos` `/decisions` `/aiq` `/aiq-drafts` `/backtest` `/settings` `/proposals` — all titles at 28px, hairline under header, generous padding

## 8. Budget / quota tracking

None this session. No new infrastructure provisioned, no third-party API limits approached.

## 9. Known issues / backlog

### Tasks closed this session (UI / charts)
- THS-77 Dashboard right-rail mini-Insights port — DONE (`c02faec`)
- THS-78 Per-name detail line chart — DONE (`ac1ba04`)
- THS-79 Portfolio hero chart — initial DONE (`2294728`), superseded by full restructure (`8f26ac4`)

### Pending — UI follow-ups
1. **Dashboard greeting → PageHeader?** Terry's call. Currently kept separate by design.
2. **NameHeader (per-name detail) → PageHeader?** Terry's call. Currently kept separate (HeroNumber-driven).
3. **Hover tooltip primitive extraction.** Currently duplicated between PortfolioValueChart + NameScoreChart. Hoist to `HoverableChart` if a 3rd consumer appears.
4. **`/logout` discoverability.** UserChip removed; no visible sign-out affordance. If discoverability needed, surface in CmdPalette as a command.
5. **Filter-state context for Dashboard rail.** Currently URL push triggers full page render. Lightweight; lift to context only if perf becomes an issue.

### Pending — pre-existing (from S9 handoff, still open)
6. THS-71 Routines plumbing manual setup — Terry's manual (task #47 in_progress)
7. Per-surface Instrument-Field Pattern lift — Regime, AggregateBar (NOW DONE via Portfolio restructure), AIQ Editor, AIQ Drafts, Decisions, Memos, Backtest, Settings (PageHeader handled the chrome but inner content still varies)
8. Relocate MorningBrief to `/memos` when that page graduates
9. TodayThesisCard fate — orphan file, reuse or delete
10. THS-85 Auth + Stripe — high priority, billing risk
11. THS-87 backtest + duplicate cleanup
12. EngineStateStrip.tsx + UniverseFilterRail.tsx — orphan files from prior sessions, queue cleanup commit

### Pending — operational
13. Fix GitHub→Vercel webhook (every commit needs manual deploy)
14. Fix or delete repo-root `.vercel/project.json` (points to wrong project; was the footgun source in `af95c7b` deploy)
15. 8 untracked handoff docs (S3-S10) — commit as single docs-housekeeping commit

## 10. Quick-reference IDs

| Item | Value |
|---|---|
| Repo root (git) | `/Users/terryturner/Projects/ai-thesis` |
| Web app dir | `/Users/terryturner/Projects/ai-thesis/web` |
| Production URL | `https://ai-thesis-v2.vercel.app/` |
| Vercel project (correct) | `ai-thesis-v2` |
| Vercel project (footgun, WRONG) | `ai-thesis` |
| Branch | `main` |
| HEAD SHA | `8f26ac480f44e42ef6af84ca4ad5ff6bfa9e750f` (short `8f26ac4`) |
| Latest deploy URL | `https://ai-thesis-v2-dq8hx6y8p-terry-8893s-projects.vercel.app` (from `8f26ac4`) |
| Wrong-project deploy URL | `https://ai-thesis-przwyittj-terry-8893s-projects.vercel.app` (from `af95c7b`, burned in error) |
| PageHeader primitive | `web/src/components/primitives/PageHeader.tsx` |
| LineChart primitive | `web/src/components/primitives/LineChart.tsx` (exports `LineChart` + `Sparkline`) |
| NameScoreChart | `web/src/components/name/NameScoreChart.tsx` |
| Portfolio AggregateBar (rewritten) | `web/src/app/portfolio/AggregateBar.tsx` |
| Dashboard page (filter logic) | `web/src/app/page.tsx` — searchParams.moverTier filter |
| Dashboard rail (mini-Insights) | `web/src/components/rails/DashboardTodayRail.tsx` — `MoversByTier` component |
| TopBar (after UserChip + Search removal) | `web/src/components/shell/TopBar.tsx` |
| URL contract (new this session) | `/?moverTier={High\|Medium\|Low\|Avoid}` |
| Prior session handoff | `docs/handoffs/2026-05-18-S9-insights-rail-dashboard-v3.md` |
| Brainstorm doc (Insights primitive, LOCKED S9) | `docs/design/insights-primitive-and-dashboard.md` |
| Instrument-Field Pattern (LOCKED S8) | `docs/design/instrument-field-pattern.md` |
| CLAUDE.md (autonomous-by-default posture) | `/Users/terryturner/Projects/ai-thesis/CLAUDE.md` |
| Web AGENTS.md (Next.js 16 caveats) | `/Users/terryturner/Projects/ai-thesis/web/AGENTS.md` |

## 11. Pitfalls / gotchas

1. **Wrong-project deploy footgun is live.** Repo-root `.vercel/project.json` points to project `ai-thesis` (wrong). Only `web/.vercel/project.json` points to `ai-thesis-v2` (correct). `vercel deploy` MUST run as STANDALONE command from `web/`, never chained after `cd /Users/terryturner/Projects/ai-thesis && ...`. Got bit during `af95c7b` this session — burned one deploy to the wrong project before re-deploying correctly. Either delete the repo-root `.vercel/` or fix the project pointer.

2. **CSS changes need hard-refresh.** Browser cache will lie about new builds. Always tell Terry "Cmd+Shift+R" and optionally verify via `curl https://ai-thesis-v2.vercel.app/_next/static/chunks/<chunk>.css | grep <rule>` to confirm the deployed CSS contains the change.

3. **GitHub→Vercel webhook STILL broken.** Every commit needs manual `cd web && vercel deploy --prod --yes`. No automatic deploy on push.

4. **Don't reintroduce dual-scroll-context on `/universe`.** S9 commit `587a7c8` attempted to move horizontal scroll into the table wrapper while keeping vertical on the page wrapper; clipped the NAME column. Reverted in `a8e2768`. Single scroll context (overflow: auto + overscroll-behavior: contain) is the current contract.

5. **EngineStateStrip is DEAD.** S9 lock. Engine-state info lives in the 5th KPI tile (MACRO MULTIPLIER). Don't reintroduce the strip row shape.

6. **PortfolioHeroChart was shipped + deleted in same session.** It existed in `2294728` for ~30 min, then superseded by AggregateBar restructure in `8f26ac4`. Don't try to bring it back — the chart logic is now inline in `AggregateBar.tsx` Column 2.

7. **Sparkline regression pattern.** When changing LineChart SVG sizing, the Sparkline inline wrapper needs a fixed-size span to constrain the now-100%-styled SVG. Bit once this session — fixed in `af95c7b`. If you ever touch LineChart's SVG attributes again, verify Sparkline still renders at 56×18 on Dashboard KPI tiles.

8. **`useRouter().push("/")` from rail filter triggers a full Next render.** Works fine but slightly heavier than needed. If perf becomes an issue, lift filter state into a client context provider.

9. **Demo badge logic.** `DemoBadge` only renders when `!userEmail` (TopBar.tsx:47). If user is signed in, NO demo chip appears regardless of fixture-mode state on individual pages. Per-page demo chips (e.g., Portfolio's `?seed=fixture-positions`) are independent.

10. **HeroNumber primitive sizes (lg/xl/xxl) are NOT used in the new Portfolio AggregateBar.** AggregateBar uses custom `BigNumber` inline component at 36px. If someone later wants to "use HeroNumber on Portfolio for consistency," that would revert the 4-column restructure — read the comment block in AggregateBar.tsx first.

11. **Sparkline color prop is now respected.** Was previously ignored (TODO comment + display:none span). Don't add back the trend-based auto-color in Sparkline — Terry rejected it.

12. **`/logout` direct URL still works** but is NOT discoverable from chrome. If someone files a "how do I sign out" bug, that's the answer until CmdPalette surfaces a logout command.

13. **NameScoreChart insufficient-data state.** Renders quiet "needs N more weeks" message inside card chrome when `history.filter(h => h.composite != null).length < 2`. Don't add fake data to "make it work."

## 12. Next-session pickup point

Run §7.1 verification block first. Then ask Terry: *"S10 closed with 9 commits — chart polish, PageHeader primitive applied to 9 surfaces, Portfolio hero restructured to 4-column protagonist row, Dashboard KPI row dividers cleaned up. Want me to (a) fold Dashboard greeting + per-name detail header into PageHeader for full standardization, (b) work the operational cleanup queue (repo-root .vercel fix + 8 untracked handoffs commit + orphan file deletion), or (c) move to THS-85 (Auth + Stripe) which is high-priority/billing-risk?"*

Do NOT touch any surface until Terry confirms direction. The session ended with a /sch — that means Terry's done shipping for this session.
