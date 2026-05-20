# S14 — Perplexity Adopt-Now Bundle · Palette v1.2 · Tier Traffic-Light Rationalization

**Session:** S14 · **Date:** 2026-05-19 · **Branch:** `main` · **HEAD:** `282d690e2c8d9754a417db8b4b00c2baf5108eb0`
**Handoff written:** 11:58 CDT · **Predecessor:** S13 (`1bdcf47`)

---

## 1. TL;DR

- 9 commits shipped, all pushed + Vercel-deployed (production endpoints 200).
- Perplexity adopt-now bundle (8 items) closed cluster-by-cluster.
- **Palette v1.2 pivot**: `--accent` rebound from electric indigo `#5236DC` to electric blue `#2A5FE6` (60/40 weighted Apex Blue + iris-300). L2 Hyperscaler dot + Universe queued chip cascade-followed; Iris ramp preserved for marketing atmosphere.
- **Tier color rationalization**: 5 separate `TIER_COLORS` maps unified to canonical traffic-light (success/text-1/warning/danger). Fixed High/Low collision created by palette pivot (both resolved to same hex).
- **Portfolio differentiation from Dashboard**: dropped PortfolioValueChart from /portfolio (was duplicative, pushed table below fold). Inline 30D sparkline replaces chart-canvas-below in AggregateBar col 2. Col 1 rebalanced from 6 lines → 4.
- Universe table width strategy fixed (now fills canvas when rail collapsed, shrinks proportionally when rail expanded).

## 2. Architectural pivot or major decision

**Palette v1.2 — accent off iris.** WHY: Terry verbatim 2026-05-19 — current indigo accent read too "design-tool" for a fintech surface; wanted 60/40 weight toward electric blue. Approved hex `#2A5FE6`. The Iris ramp itself stays at v1.1 values (marketing landing's iris-900 → jet atmospheric gradient retained, UniverseTable queued chip rebound away from iris-300). This is the second palette pivot in the repo (v1.1 was the indigo migration); v1.2 is a hue shift, not a ramp shift.

**Tier color override of Master Design Spec.** The Spec §2.1/§4.1/§4.6 codified "High = indigo because *we* believe in it" — but after the accent pivot to electric blue, High and Low literally resolved to the same hex (`var(--accent)` and `var(--info)` both → `#2A5FE6`). Replaced with semantic traffic-light: High=success green / Medium=text-1 neutral / Low=warning amber / Avoid=danger red. Documented in commit `87142db`. Spec doc is now stale; needs an explicit §2.1/§4.1/§4.6 update next session.

## 3. State of the world

- **Services:** Vercel (production live, manual deploy per commit — webhook still broken). Supabase (project name `ai-thesis-v2`, env-driven). FMP daily price chain (5-min refresh per /portfolio `revalidate = 300`).
- **Endpoints (verified 11:56 CDT):** `/` → 200, `/universe` → 200, `/portfolio` → 200, `/?moverTier=High` → 200. All redirect to `/login` for unauth.
- **Secrets:** Unchanged. No new env names introduced this session.
- **Scheduled jobs:** Saturday 22:45 UTC score chain (unchanged).
- **DB state:** No schema migrations this session. Used existing tables: `scores_history`, `concentration_history`, `prices_raw`, `portfolio_positions`, `portfolio_settings`, `universe`.
- **Git state:**
  - HEAD: `282d690e2c8d9754a417db8b4b00c2baf5108eb0`
  - Branch: `main`
  - Commits ahead of S13 baseline (`1bdcf47`): 9
  - Commits ahead of origin/main: 0 (all pushed)
  - Working tree: 11 untracked files — all `docs/handoffs/2026-05-1{8,9}-S{3..14}-*.md` predecessors plus this S14 file
  - tsc: exit 0 verified

## 4. Action / API reference

None this session — no new server actions, no new API routes touched.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/app/page.tsx` | M | Dashboard P&L label: "P&L · today" → "P&L · since open"; TIER_COLORS map → traffic-light |
| `web/src/lib/portfolio-types.ts` | M | Added `composite`/`tier`/`concentration_tax` to PositionRow; `portfolio_concentration_tax` to PortfolioSnapshot |
| `web/src/lib/portfolio-data.ts` | M | Parallel fetch scores_history + concentration_history; latestScoreMap + latestTaxMap helpers; fixture book extended w/ tier/composite/tax |
| `web/src/app/portfolio/PositionsTable.tsx` | M | THESIS column + ThesisCell (tier+composite+tax chip); Th gained optional `title` for #6 tooltip |
| `web/src/app/portfolio/AggregateBar.tsx` | M | Concentration drag surfaced; later: dropped chart, inline sparkline col 2, col 1 rebalance, accent sparkline |
| `web/src/app/portfolio/page.tsx` | M | Dropped PortfolioValueChart import + render — Portfolio is now book-first, not chart-first |
| `web/src/app/portfolio/AddPositionForm.tsx` | M | Submit button retired voltage → accent fill |
| `web/src/components/primitives/PageCreateDrawer.tsx` | M | Added backdrop scrim (Fragment-wrapped); ▾ chevron → + glyph (rotates 45° to ×); reuses globals.css `@keyframes fadeIn` |
| `web/src/components/universe/UniverseTable.tsx` | M | Name column pinned to 220px; later: width:100% restored so table fills canvas + scales with rail; queued chip rebound to accent-* tokens |
| `web/src/components/universe/TierBadge.tsx` | M | Tier traffic-light (overrides Master Design Spec §2.1/§4.1/§4.6) |
| `web/src/components/universe/UniverseInsightsRail.tsx` | M | TIER_COLORS → canonical traffic-light |
| `web/src/components/universe/LayerChip.tsx` | M | L2 Hyperscaler dot `#A78BFA` violet → `#6E7BE8` violet-leaning electric blue |
| `web/src/components/dashboard/TopPositionsList.tsx` | M | TIER_COLORS → canonical traffic-light |
| `web/src/components/rails/DashboardTodayRail.tsx` | M | TIER_COLORS → canonical traffic-light |
| `web/src/app/globals.css` | M | Palette v1.2: --accent + accent-hover/pressed/soft/border/glow + --info + --info-soft rebound; html accent-color updated |
| `docs/handoffs/2026-05-19-S14-perplexity-bundle-palette-v1.2-tier-traffic-light.md` | C | This file |

## 6. Decisions locked

**Decision 1 — Palette v1.2 accent hex `#2A5FE6`.**
- **Why:** Terry 2026-05-19, indigo too "design-tool"; wants 60% Apex Blue / 40% indigo. Hex is the literal 60/40 weighted blend.
- **Tradeoff accepted:** Iris ramp stays for marketing atmosphere → small inconsistency between brand-mark surfaces (marketing) and interaction surfaces (app workspace). Accepted because marketing has its own atmospheric language.

**Decision 2 — L2 Hyperscaler dot `#6E7BE8` (option A from menu).**
- **Why:** Categorically distinct from L1 teal + new accent, but visibly a sibling of the new accent family. Maintains layer dot system integrity.
- **Tradeoff accepted:** A small categorical-color drift from "violet" to "violet-leaning electric blue" — no one will read L2 as "indigo conviction" anymore. Cost: zero, that wasn't a load-bearing meaning.

**Decision 3 — Tier semantic traffic-light overrides Master Design Spec.**
- **Why:** Spec's "High = indigo because *we* believe in it" became visually impossible after accent pivot (High and Low resolved to identical hex). Universal analyst convention: green=long / amber=caution / red=avoid.
- **Tradeoff accepted:** Spec doc (`docs/AI-Thesis-v2-Master-Design-Spec.md`) §2.1/§4.1/§4.6 now stale. Spec must be updated in a follow-on commit OR explicitly marked as superseded. Did NOT update spec this session (scope).

**Decision 4 — Portfolio is positions-first, Dashboard is chart-first.**
- **Why:** NAV chart on both surfaces made them too similar AND pushed Portfolio positions table below the fold. Differentiation forces purpose-clarity.
- **Tradeoff accepted:** Portfolio loses range-selectable trend drill-down (Dashboard owns it). Acceptable because AggregateBar's 30D column still shows the at-a-glance delta + sparkline.

**Decision 5 — Sparkline color is fixed `var(--accent)`, never per-direction.**
- **Why:** Per /lambo "severity colors only at severity moments." A 30D sparkline is glance-trend, not severity. The +/- text already carries direction.
- **Tradeoff accepted:** A red number with a blue line beside it reads "non-redundant signal" — initially counterintuitive but matches Dashboard pattern.

**Decision 6 — Engine context (tier/composite/concentration_tax) lives ON Portfolio.**
- **Why:** Perplexity flagged the gap; Portfolio rows previously had no engine signal. THESIS column ports the Dashboard pattern, concentration tax surfaces both per-row (chip) and book-wide (AggregateBar sub-line).
- **Tradeoff accepted:** Portfolio fetcher now does 4 parallel queries instead of 2. Round-trip cost ~negligible at fixture/v1 universe size.

**Decision 7 — DID NOT extract a single canonical TIER_COLORS constant.**
- **Why:** 5 separate copies updated inline. Extracting a primitive is its own commit/refactor.
- **Tradeoff accepted:** Next palette/semantic shift requires 5-file update. Follow-on DRY pass should consolidate.

## 7. Next-session test plan — MOST IMPORTANT

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD
# expect: 282d690e2c8d9754a417db8b4b00c2baf5108eb0

git log --oneline 1bdcf47..HEAD | wc -l
# expect: 9

git status --short | wc -l
# expect: 11 (untracked S3-S14 handoffs)

git rev-parse origin/main
# expect: 282d690e2c8d9754a417db8b4b00c2baf5108eb0 (same as HEAD — all pushed)

cd web && npx tsc --noEmit; echo "tsc exit $?"
# expect: tsc exit 0

curl -s -o /dev/null -w "marketing %{http_code}\nuniverse %{http_code}\nportfolio %{http_code}\nmoverTier %{http_code}\n" https://ai-thesis-v2.vercel.app/ https://ai-thesis-v2.vercel.app/universe https://ai-thesis-v2.vercel.app/portfolio "https://ai-thesis-v2.vercel.app/?moverTier=High"
# expect: all 200

curl -s "https://ai-thesis-v2.vercel.app/_next/static/chunks/0hpn5xeq5i~u8.css" | grep -oE "(--accent:#[a-f0-9]+|--iris-300:#[a-f0-9]+)"
# expect: --accent:#2a5fe6  AND  --iris-300:#5236dc  (both present; pivot worked, ramp preserved)
```

### 7.2 Fresh end-to-end

None applicable — no migrations, no new flows, no schema changes.

### 7.3 Visual/UI verification (hard-refresh required for each)

| URL | Verify |
|---|---|
| `https://ai-thesis-v2.vercel.app/` (hard-refresh) | Greeting countdown ticking · KPI tiles + sparklines · Score Movers + Top Positions tier badges read green/white/amber/red |
| `https://ai-thesis-v2.vercel.app/portfolio` (hard-refresh) | NO NAV chart between hero and table · AggregateBar col 1 has 4 content lines (label/$77,992/-1.87%/dense sub w/ drag) · col 2 sparkline is electric blue regardless of trend · THESIS column traffic-light · Add Position pill on header (no voltage yellow on submit) |
| `https://ai-thesis-v2.vercel.app/universe` (hard-refresh) | Table fills canvas with rail collapsed · table shrinks (no overlap) when rail expanded · TierBadge column traffic-light · L2 Hyperscaler dot is violet-leaning blue not pure violet · Queued chips (if any tickers queued) read electric blue not indigo · Insights bar chart shows distinct High/Low colors |
| `https://ai-thesis-v2.vercel.app/universe/AVGO` (hard-refresh) | Dual-line chart still composite+price; per-name pager works; concentration tax chip still surfaces |
| Add Position drawer (any page) | Trigger pill shows `Add position +`; clicking opens with 22% black scrim behind; + glyph rotates 45° to × on open; submit button is electric blue accent (not voltage yellow) |

## 8. Budget / quota tracking

None this session — no token budgets renegotiated, no rate-limit-relevant burn. Vercel deploys: 9 manual (1 phantom retried). Anthropic spend: not tracked here.

## 9. Known issues / backlog (numbered, by area)

### Portfolio
1. **Col 1 may STILL feel slightly heavier than cols 3/4 after the 282d690 rebalance.** Now at 4 lines vs 3 on cols 3/4. Mercury format-on-canvas tolerates protagonist asymmetry; if Terry pushes, can collapse further by moving concentration drag elsewhere (col 2 sub or col 4 sub).
2. **Portfolio positions table — long sub-line in AggregateBar col 1 may wrap on narrow canvases.** Not seen at 1440px; could wrap < 1100. Acceptable.

### Universe
3. **Table layout still uses `width: 100%`.** Browser distributes excess across all columns proportionally — Name doesn't blow up (now has 220px hint), but ALL columns stretch slightly when canvas grows. Acceptable trade vs the prior "Name absorbs everything" bug.
4. **Universe Insights rail bar chart**: tier bars now read distinct, but bar HEIGHTS at fixture-data scale may make Medium and Low look similar in height. Cosmetic only; real engine output will differentiate.

### Brand / Palette
5. **Master Design Spec `docs/AI-Thesis-v2-Master-Design-Spec.md` §2.1/§4.1/§4.6 still says "High = indigo."** Spec is stale post-S14. Update needed in a docs-only commit before any future tier discussion cites the spec.
6. **5 copies of `TIER_COLORS` not yet consolidated.** DRY refactor pending — extract `web/src/lib/tier-colors.ts` with single source.

### Drawer
7. **`PageCreateDrawer` module-level `<style>` keyframe injection was REMOVED in 32ea95b** (replaced with reuse of globals.css `fadeIn`). Confirmed clean. No follow-up.

### Operational
8. **10 untracked S3-S13 handoffs** still in working tree pre-existing this session. S14 adds an 11th. Not blocking anything but should be a single cleanup-commit at some point.
9. **GitHub→Vercel webhook still broken.** Manual `cd web && vercel deploy --prod --yes` per commit. Phantom-deploy footgun: ALWAYS run as ONE chained command, never split cd into a separate Bash call.
10. **Repo-root `.vercel/project.json` points to wrong project.** Workaround functional — never touch the file without explicit ask.

### Engine
11. **TSM Q=4 engine investigation** — still deferred, multi-session.

### Auth / Billing
12. **THS-85 Auth + Stripe** — high-priority, multi-session.

## 10. Quick-reference IDs

| Kind | Value |
|---|---|
| Working dir (code) | `/Users/terryturner/Projects/ai-thesis/web` |
| Working dir (git) | `/Users/terryturner/Projects/ai-thesis` |
| HEAD SHA | `282d690e2c8d9754a417db8b4b00c2baf5108eb0` |
| S13 baseline SHA | `1bdcf474d32eb6ad6178d45f6a63b839b5e073d3` |
| Production URL | `https://ai-thesis-v2.vercel.app` |
| Latest deploy URL | `https://ai-thesis-6mb3yuxlu-terry-8893s-projects.vercel.app` |
| Live CSS chunk (current build) | `/_next/static/chunks/0hpn5xeq5i~u8.css` |
| Palette v1.2 accent | `#2A5FE6` |
| Palette v1.2 accent-hover | `#4F7AED` |
| Palette v1.2 accent-pressed | `#1842B0` |
| L2 Hyperscaler dot v1.2 | `#6E7BE8` |
| Iris-300 (legacy accent, preserved) | `#5236DC` |
| Voltage CTA (marketing/auth only) | `#CCFF33` |
| Spec doc (stale on tier colors) | `docs/AI-Thesis-v2-Master-Design-Spec.md` §2.1, §4.1, §4.6 |
| S14 handoff (this file) | `docs/handoffs/2026-05-19-S14-perplexity-bundle-palette-v1.2-tier-traffic-light.md` |
| S13 handoff | `docs/handoffs/2026-05-19-S13-bucket4-s11-polish-portfolio-chart-perplexity-triage.md` |
| Auto-deploy invocation | `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes` |

## 11. Pitfalls / gotchas

1. **Phantom deploys.** Splitting `cd web` and `vercel deploy` across two Bash calls (especially when one is `run_in_background`) loses the cwd. Vercel prints help-text-tail instead of deploying. Caught once this session (between commits `3bffa82` and `142a4f2`). Always chain: `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`.

2. **`tail -5` truncates Vercel deploy output past the URL line.** Use `grep -E "Production:|ready\." | head -3` instead to confirm a deploy actually fired.

3. **`--info` is slaved to `--accent`.** Any future accent change cascades to info-driven surfaces. Don't unbind without auditing info consumers.

4. **L2 Hyperscaler dot is now a literal `#6E7BE8`, not a token.** Same for L1 `#5BC0DE`. If next palette pivot changes accent again, these literals don't follow — they're categorical, on purpose.

5. **Tier colors live in 5 separate files.** A future palette pivot needs 5 updates OR a follow-on DRY refactor to extract a single canonical `TIER_COLORS` map. See backlog #6.

6. **Master Design Spec is stale on tier colors** (see backlog #5). Don't cite §2.1/§4.1/§4.6 as authoritative on tier hues until updated.

7. **AggregateBar col 1 still has 4 lines** vs cols 3/4's 3. If Terry pushes again, options: combine concentration drag into the value row (e.g., "$77,992 · drag −11.7"), move it to col 4 attribution, or accept the asymmetry as protagonist weight.

8. **Sparkline color is fixed `var(--accent)`** in AggregateBar AND every Dashboard KpiCell. A future "color the sparkline by direction" request would need an explicit pattern override.

9. **Score chain runs Saturday 22:45 UTC.** `scores_history.as_of` is Saturday; `prices_raw` is trading days. Naive `.in('date', scoreDates)` returns zero rows. Use snap-to-prior-trading-day (already in name-detail-data.ts).

10. **TIER_COLORS Medium = `var(--text-1)` (pure white).** Reads cleanly on the canvas; could feel too prominent in cool light surfaces if surfaces ever lighten. Bound to canvas-dark assumption.

11. **Tier semantic mapping overrides spec.** Do NOT re-litigate this in next session without re-reading commit `87142db` rationale + this handoff §2 / §6 / backlog #5.

12. **Portfolio canvas no longer has a chart.** If a future request is "add a per-position breakdown chart on portfolio," the answer is yes — but the NAV-over-time chart belongs on Dashboard, not Portfolio. Don't reintroduce the same chart that was just removed.

13. **CSS changes need hard-refresh** (Cmd+Shift+R) on Terry's browser. Deploy completion verified via curl + CSS-chunk hex grep (see §7.1).

14. **`Attribution` helper removed from AggregateBar.tsx.** Don't reference it — was the "prices as of" line, killed in 282d690.

15. **`--voltage` is marketing/auth only.** Removed from in-app submit buttons. Re-adding voltage inside the workspace will reproduce the "yellow button doesn't belong" complaint Terry raised this session.

## 12. Next-session pickup point

1. Run §7.1 verification block (paste-and-run, <60s).
2. Send Terry a short status: "S14 closed Perplexity bundle (8/8), palette v1.2 (accent → #2A5FE6 + L2 + queued chip cascade), tier traffic-light unification, Portfolio differentiation, Universe width + tier bar chart fix, AggregateBar col 1 rebalance + accent sparkline. 9 commits on main, all deployed. Endpoints 200. tsc clean. What's next?"
3. **Likely next directives (predicted, not assigned):** update Master Design Spec §2.1/§4.1/§4.6 to reflect tier traffic-light (closes backlog #5); DRY-extract `tier-colors.ts` (closes backlog #6); operational cleanup commit for 11 untracked handoffs (closes backlog #8); TSM Q=4 engine investigation; THS-85 Auth+Stripe.
