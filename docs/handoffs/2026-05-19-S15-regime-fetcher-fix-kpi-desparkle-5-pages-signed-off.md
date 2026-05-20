# S15 — Regime fetcher direction fix · KPI desparkle · 5 priority pages signed off

Session date: 2026-05-19 (afternoon CDT)
Prior: S14 (282d690) — palette v1.2 + tier traffic-light + Perplexity bundle
HEAD this handoff: `fde7cbb`

---

## 1. TL;DR

- Diagnosed and fixed Regime page rendering stale 2025-07 data: fetcher used `.order(as_of, asc).limit(60)`, returning the OLDEST 60 macro_gauges rows. Flipped to DESC + reverse.
- Confirmed macro_gauges is live: 366 rows, latest 2026-05-18, NAAIM 77.34 / AAII +5.36 / F&G 62.8, 0 gates → 1.00× multiplier.
- Bundled Regime polish (AAII symmetry, canonical `fmtGaugeValue`, hero subtext sync, closest-gate chip, MultiplierLadder de-buttonized, right-edge ▲ collision fix).
- Retired KPI sparklines (Dashboard PORTFOLIO + MACRO MULTIPLIER tiles, Portfolio AggregateBar col 2 sparkline). Terry: "they look so dramatic when they really aren't."
- Restored Portfolio AggregateBar col 1 sub-line to 2 lines (was crammed to one).
- Universe polish: Q/G/V headers → "Quality"/"Growth"/"Value" with tooltips · Final col hides when no row diverges from Composite (today's 1.00× state) · macro chip → /regime link.
- Name Detail macro chip → /regime link (mirrors Universe).
- Dashboard, Universe, Portfolio, Regime, Name Detail = **5/5 priority pages signed off**.
- Updated `~/.claude/skills/sch/SKILL.md` to add the mandatory deploy-parity gate (Vercel inspect timestamp must post-date HEAD authored timestamp).

## 2. Architectural pivot or major decision

**None this session as a pivot.** The fetcher-direction fix on `regime-data.ts` was a bug correction, not a design pivot. The macro_gauges seed (2026-05-14 row + cron-inserted rows back to 2025-05-18) was always there — the page just couldn't see it because of ASC+LIMIT truncation.

The one *secondary* decision: the right-edge ▲ threshold labels on the trend chart were dropped (not relocated). Justification: threshold values are already shown in the gauge cards AND in the rail Threshold Legend, so removing them from the chart edge loses no information. The chart's bottom legend was enhanced to carry per-series threshold values ("NAAIM gate 90") so the dashed line + color attribution remains complete.

## 3. State of the world

### Git state
- Branch: `main`
- HEAD: `fde7cbb5bc8fe4bd751744a8723c95094a822b97`
- Commits ahead of S14 baseline (`282d690`): **6**
- Commits ahead of `origin/main`: **0** (all pushed)
- Working tree: 12 untracked S3-S15 handoffs (pre-existing carry from S14 + this S15 doc)

### Production deploy
- Prod alias: `https://ai-thesis-v2.vercel.app`
- Pointing to: `dpl_2upj3bKUYM5t9nKKUiXNLUKdo1fv` (`ai-thesis-v2-5t6g2wjho-...`)
- Deploy created: 2026-05-19 13:06:15 CDT
- HEAD authored: 2026-05-19 13:06:10 CDT
- Δ deploy − HEAD: **+5 seconds** (deploy-parity gate ✓)
- TSC: `exit 0`

### Endpoints (production)
- `/` 200 · `/universe` 200 · `/portfolio` 200 · `/regime` 200 · `/?moverTier=High` 200 (then 307 redirects to sign-in as expected for auth-gated pages)

### Live CSS chunk
- `/_next/static/chunks/0hpn5xeq5i~u8.css` (unchanged from S14)
- `--accent:#2a5fe6` (electric blue) · `--iris-300:#5236dc` (preserved) ✓

### Database state (Supabase project `mvxgnliwvoauwwarrlrr`)
- `macro_gauges`: 366 rows, earliest `2025-05-18`, latest `2026-05-18`
  - Latest row: NAAIM `77.34` · AAII `5.36` (forward-filled since ~2026-05-14) · F&G `62.8`
  - 0 gates hit → multiplier 1.00× → page now renders this correctly
- Cron `ingest-macro-daily` at 21:45 UTC — confirmed running (data continuity through 2026-05-18)

### External integrations
- FMP /stable/ — used by ingest paths · unchanged
- Polygon — used by `prices_raw` (trading days only) · unchanged
- Vercel — manual `cd web && vercel deploy --prod --yes` per commit (webhook still broken)

### Scheduled jobs
- Saturday 22:45 UTC: composite chain (`scores_history`)
- Daily 21:45 UTC: `ingest-macro-daily` → NAAIM + F&G live, AAII forward-fills

## 4. Action / API reference

**None this session — no new endpoints, no schema migrations.**

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/lib/regime-data.ts` | M | Sort DESC + reverse client-side (was ASC+LIMIT returning oldest 60) |
| `web/src/lib/regime-types.ts` | M | Added `fmtGaugeValue(n, key)` canonical formatter + `distanceToGate()` + `pickClosestGate()` + `ClosestGate` type + AAII range `[-60, 60]` |
| `web/src/app/regime/MultiplierBanner.tsx` | M | Hero subtext "applied to raw ≥ 75 only" → "applied only to composite ≥ 75 (high-tier names)" · Added "Approaching" chip when any signal within 10pts of gate · Takes `closestGate` prop |
| `web/src/app/regime/GaugeCard.tsx` | M | Removed inline `fmt()` · uses canonical `fmtGaugeValue` |
| `web/src/app/regime/RegimeTrendChart.tsx` | M | AAII VISIBLE_RANGE → `[-60, 60]` · Uses canonical `fmtGaugeValue` for value labels · Dropped right-edge ▲ threshold labels (collision fix) · Legend now carries per-series threshold values |
| `web/src/app/regime/page.tsx` | M | Passes `key: GaugeKey` into rail items · Passes `closestGate` into MultiplierBanner |
| `web/src/components/rails/RegimeLegendRail.tsx` | M | `RegimeLegendItem` gains `key: GaugeKey` · Uses canonical `fmtGaugeValue` (was 1 decimal at threshold≥10) |
| `web/src/components/primitives/MultiplierLadder.tsx` | M | Inactive cells border → `transparent` (was `--border`) · Removes false clickability per Perplexity |
| `web/src/app/page.tsx` | M | Removed Sparkline import + `synthesizePortfolioSpark` + `synthesizeMacroSpark` helpers · `KpiCell` desparkle (removed `spark`/`sparkColor` props + render block) · All 3 KpiCell call sites cleaned · Comment header updated |
| `web/src/app/portfolio/AggregateBar.tsx` | M | Removed Sparkline import + render in col 2 (now scalar `BigNumber` matching cols 3/4) · Col 1 sub-line split back into 2 separate SubLine elements with "concentration drag" on its own line |
| `web/src/components/universe/UniverseTable.tsx` | M | `Comp` → "Composite" · `Q`/`G`/`V` → "Quality"/"Growth"/"Value" with tooltips · `Th` gains `title` prop · Added `hasAnyFinalDelta` gate to hide Final column when no row diverges from Composite (today: 0 gates → hidden) · Row gains `showFinal` prop · colSpan reflects |
| `web/src/app/universe/page.tsx` | M | macro chip → `<Link href="/regime">` with dotted-underline affordance |
| `web/src/components/name/NameHeader.tsx` | M | macro chip → `<Link href="/regime">` (mirror of Universe fix) |
| `/Users/terryturner/.claude/skills/sch/SKILL.md` | M | Added mandatory deploy-parity gate rule + failure mode #6 (catches the S14 phantom-deploy incident) |
| `docs/handoffs/2026-05-19-S15-regime-fetcher-fix-kpi-desparkle-5-pages-signed-off.md` | A | This handoff |

## 6. Decisions locked

### Decision 1 — KPI tiles are scalar; sparklines retired on Dashboard + Portfolio col 2

**Rule:** No sparkline in any KPI tile across Dashboard (Portfolio / P&L / 30D / Macro Multiplier / High-Tier) OR in Portfolio AggregateBar col 2 (30D performance).
**Why:** Terry verbatim 2026-05-19: "I dont think we should put those spark lines in the KPIs as they look so dramatic when they really aren't. They also messs up the spacing relative to the others." The 72×20 amplification on tame movements created false drama; vertical-rhythm asymmetry against KPIs that didn't carry one.
**Tradeoff accepted:** Time-series shape lives on the NAV chart (Dashboard) only. No in-tile trend hints.

### Decision 2 — Portfolio AggregateBar col 1 wraps to 2 lines (always)

**Rule:** Col 1 sub renders as two SubLine elements: line 1 = positions/invested/cap; line 2 = "concentration drag X.X pts" (with `--warning` when negative).
**Why:** Terry verbatim 2026-05-19: "on the portfolio tab the writing underneath the first KPI needs to wrap to two lines how it previously was so it doesnt extend so far to the right. It looks bad and also throws off the entire spacing."
**Tradeoff accepted:** Slight vertical-line-count asymmetry vs cols 3/4 (3 lines vs col 1's 4) — but col 1 is the protagonist; Mercury format-on-canvas tolerates the asymmetry.

### Decision 3 — Universe `Composite` and `Final` collapse to one column when macro = 1.00×

**Rule:** `Final` column hides whenever no row has `|composite − final_score| > 0.05`. Mirrors `hasAnyDelta` / `hasAnyMacro` honest-column-hiding pattern.
**Why:** When macro is 1.00× (today: 0 gates), Composite = Final for every row. Two identical columns is wasted real estate AND confusing (which is the real one?).
**Tradeoff accepted:** When macro fires, Final reappears. User scanning during macro-active periods learns the layout shift; during quiet periods sees a calmer table.

### Decision 4 — Factor columns spell out their meaning

**Rule:** Q/G/V → "Quality"/"Growth"/"Value" everywhere in Universe headers, with tooltips on hover citing what the factor measures.
**Why:** Single-letter headers are decodable only if you already know the algorithm. Linear-class apps spell things out.
**Tradeoff accepted:** Header row gets denser; columns widened from 100→110px. Acceptable on 1440px+ canvases.

### Decision 5 — Right-edge ▲ threshold labels dropped from Regime trend chart

**Rule:** Chart dashed threshold lines render WITHOUT inline ▲90/▲80/▲+30 labels. Legend below chart carries the threshold values ("NAAIM gate 90 · AAII gate +30 · CNN gate 80").
**Why:** Labels were rendering at the same x-strip and within 5-6px of the per-series value labels, producing visual collision (Terry: "all the numbers messed up"). Threshold values are already in the gauge cards + rail Threshold Legend.
**Tradeoff accepted:** Per-series threshold attribution moves from chart edge to chart legend. Reader makes a slightly longer eye-scan to attribute a dashed line to its threshold value.

### Decision 6 — Macro chip in page headers is a Link to /regime

**Rule:** Anywhere a macro multiplier chip appears in a page-header meta strip (Universe header, Name Detail header) it renders as `<Link href="/regime">` with dotted-underline affordance.
**Why:** Cross-surface jump from per-name/universe context to the page that explains the multiplier.
**Tradeoff accepted:** None — single-letter edit per surface.

### Decision 7 — `fmtGaugeValue(n, key)` is the single source of truth for gauge number formatting

**Rule:** All Regime surfaces (hero card, rail legend, trend chart value labels) call `fmtGaugeValue(n, key)` from `regime-types.ts`. NAAIM = 1dp · AAII = 1dp+sign · F&G = integer.
**Why:** Previously three inline formatters disagreed (rail showed 72.9 vs card showed 73 for the same F&G value).
**Tradeoff accepted:** `RegimeLegendItem` interface gained a `key: GaugeKey` field to support per-key formatting.

### Decision 8 — `/sch` skill carries a mandatory deploy-parity gate

**Rule:** `~/.claude/skills/sch/SKILL.md` now requires every handoff §7.1 verification block to include `vercel inspect <prod-alias>` + HEAD authored-timestamp comparison. "Pushed" ≠ "deployed."
**Why:** S14's final commit was authored 11min AFTER the last prod deploy; handoff claimed "all deployed" and S15 burned cycles diagnosing a stale screenshot before realizing the deploy hadn't promoted.
**Tradeoff accepted:** /sch verification flow is now slightly longer (~5s for vercel inspect). Worth it.

## 7. Next-session test plan — MOST IMPORTANT

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis

# Git state
git rev-parse HEAD
# expect: fde7cbb5bc8fe4bd751744a8723c95094a822b97

git log --oneline 282d690..HEAD | wc -l
# expect: 6

git status --short | wc -l
# expect: 12 (untracked S3-S15 handoffs)

git rev-parse origin/main
# expect: fde7cbb5bc8fe4bd751744a8723c95094a822b97 (all pushed)

# Typecheck
cd web && npx tsc --noEmit; echo "tsc exit $?"
# expect: tsc exit 0

# Deploy-parity gate (MANDATORY per new /sch rule)
vercel inspect ai-thesis-v2.vercel.app 2>&1 | grep -E "(id|created)" | head -2
# expect: id dpl_2upj3bKUYM5t9nKKUiXNLUKdo1fv (or newer), created post-13:06:10 CDT

git log -1 --format="HEAD authored %ad" --date=iso-local
# expect: 2026-05-19 13:06:10 -0500 (or later if continued work)

# Endpoints
curl -s -o /dev/null -w "marketing %{http_code}\nuniverse %{http_code}\nportfolio %{http_code}\nregime %{http_code}\nmoverTier %{http_code}\n" https://ai-thesis-v2.vercel.app/ https://ai-thesis-v2.vercel.app/universe https://ai-thesis-v2.vercel.app/portfolio https://ai-thesis-v2.vercel.app/regime "https://ai-thesis-v2.vercel.app/?moverTier=High"
# expect: all 200
```

### 7.2 Fresh end-to-end

None applicable — no migrations, no new flows, no schema changes.

### 7.3 Visual / UI verification (hard-refresh required for each)

| URL | Verify |
|---|---|
| `https://ai-thesis-v2.vercel.app/` (hard-refresh) | 5-KPI row carries NO sparklines · No in-tile trend hints · NAV chart sits below KPIs as the canonical trend surface |
| `https://ai-thesis-v2.vercel.app/portfolio` | Col 1 sub spans 2 lines: line 1 "13 positions · $79,475 invested · $100,000 cap" / line 2 "concentration drag −11.7 pts" (warning color) · Col 2 shows scalar "−2.58%" hero, no sparkline · Col 3 P&L · Col 4 Reserve · grid rhythm even across all 4 columns |
| `https://ai-thesis-v2.vercel.app/universe` | "COMPOSITE" / "QUALITY" / "GROWTH" / "VALUE" / "AIQ" headers (no single letters) · Header tooltips on factor headers cite the factor meaning · Final column is HIDDEN (macro 1.00×, no divergence) · macro chip "1.00× (0/3)" has dotted underline, click → /regime · Insights rail tier distribution sums to 50 with "+ 2 unscored" tail |
| `https://ai-thesis-v2.vercel.app/regime` | as_of `2026-05-18` (NOT 2025-07-16) · NAAIM 77.3 / AAII +5.4 / F&G 63 in cards (no em-dashes) · Trend chart right edge clean — only "NAAIM 77.3" / "CNN 63" / "AAII +5.4" labels (no ▲ markers colliding) · Chart legend reads "NAAIM gate 90 · AAII gate +30 · CNN gate 80 · --- gate threshold" · Curve cells flow on canvas with only active "0 GATES 1.00" boxed · Hero sub "applied only to composite ≥ 75 (high-tier names)" · "Approaching" chip stays HIDDEN (no signal within 10pts of gate today) |
| `https://ai-thesis-v2.vercel.app/universe/AVGO` (hard-refresh) | Header macro chip "1.00× (0/3)" has dotted underline → /regime · TierLegend below hero · 12-week sparkline on right · NameScoreChart below · FactorPanels Q/G/V/AIQ render |

## 8. Budget / quota tracking

None this session — no token budgets renegotiated. Vercel deploys this session: **6 manual** (1 phantom routed to wrong project — caught by deploy-parity gate, redeployed cleanly).

## 9. Known issues / backlog

### Regime
1. **`fmtGaugeValue` shows AAII threshold as "+30.0"** (1 decimal). Reads slightly awkward vs F&G's "80" (integer) and NAAIM's "90.0". Internally consistent per the canonical formatter (each gauge keeps its own precision for value AND threshold) — defensible. Skip unless flagged.
2. **"Approaching" chip hasn't been visually verified live** — current state has no signal within 10pts of its gate, so the chip stays hidden (correct). Will exercise when conditions tighten or fixture is bumped.

### Universe
3. **AIQ column has `width=110px` (was 100px).** Total Q/G/V/AIQ = 440px fixed block. May squeeze other columns on canvases narrower than 1100px. Verify visually.
4. **`+ N unscored` tail on Insights bar chart** — only renders when unscoredCount > 0. Today 4+10+18+18=50 vs 52 total = 2 unscored. Should be visible; not visually verified post-deploy.

### Dashboard
5. **`KpiCell` is now scalar-only** — no consumers downstream depend on the removed `spark`/`sparkColor` props. If someone wants per-tile trend later, primitive needs to be re-augmented.

### Name Detail
6. **FactorPanels uses severity tokens for factor categories** — Q = accent, G = `--success` (green), V = `--warning` (amber), AIQ = ?. Per /lambo "severity colors only at severity moments" this is a misuse: Growth is a factor LABEL, not a positive SIGNAL; Value is a factor label, not a warning. Should rotate to data-category tokens or neutralize. **NEEDS TERRY'S COLOR DIRECTION** to pick a swap.
7. **Bottom 3-col grid is currently 2/3 placeholders** (`Form4Section` + 2 `DataPendingCard`). If Form4 is also empty for a given name, the entire strip is placeholders. Could consolidate to a single "Insider · News · Sentiment will land here" card until any of the three lights up. Cheap polish; awaits Terry direction.
8. **Header has a 480×72 12-week sparkline AND a full NameScoreChart below.** Both show composite. Defensible (paired series differ: header = composite/final, canvas = composite/price) but worth a callout — could it be one richer chart with mode toggle?

### Cross-page
9. **Sidebar `Backtest` still shown as live navigation.** Cross-page item, not regime-specific. Tracks as THS-87. Should be greyed/disabled or removed entirely until the backtest harness is shippable.
10. **5 separate `TIER_COLORS` maps not yet consolidated.** DRY refactor pending — extract `web/src/lib/tier-colors.ts` with single source.
11. **Master Design Spec `docs/AI-Thesis-v2-Master-Design-Spec.md` §2.1/§4.1/§4.6 still says "High = indigo."** Stale post-S14 traffic-light decision. Update needed in a docs-only commit.
12. **12 untracked S3-S15 handoff docs.** Operational cleanup commit pending.

### Operational
13. **GitHub→Vercel webhook still broken.** Manual `cd web && vercel deploy --prod --yes` per commit. Single-command chain mandatory; phantom-deploy caught this session.
14. **Repo-root `.vercel/project.json` points to wrong project (`ai-thesis` not `ai-thesis-v2`).** Workaround functional — never touch without explicit ask.
15. **Score chain runs Saturday 22:45 UTC** so `scores_history.as_of` is Saturday. `prices_raw` only has trading days. Naive `.in('date', scoreDates)` returns zero rows. Use snap-to-prior-trading-day pattern.

### Engine
16. **TSM Q=4 engine investigation** — still deferred, multi-session.

### Auth / Billing
17. **THS-85 Auth + Stripe** — high-priority, multi-session.

### Second-half pages (not yet reviewed)
18. AIQ Editor (`/aiq`) — not reviewed.
19. Memos (`/memos`) — not reviewed.
20. Decisions (`/decisions`) — not reviewed.
21. Proposals (`/proposals`) — not reviewed.
22. Backtest (`/backtest`) — flagged for dim per THS-87.

## 10. Quick-reference IDs

| Kind | Value |
|---|---|
| Working dir (code) | `/Users/terryturner/Projects/ai-thesis/web` |
| Working dir (git) | `/Users/terryturner/Projects/ai-thesis` |
| Branch | `main` |
| HEAD | `fde7cbb5bc8fe4bd751744a8723c95094a822b97` |
| Prior session baseline | `282d690e2c8d9754a417db8b4b00c2baf5108eb0` (S14) |
| Prod alias | `https://ai-thesis-v2.vercel.app` |
| Prod deploy id (HEAD-matching) | `dpl_2upj3bKUYM5t9nKKUiXNLUKdo1fv` |
| Prod deploy url | `https://ai-thesis-v2-5t6g2wjho-terry-8893s-projects.vercel.app` |
| Supabase project ref | `mvxgnliwvoauwwarrlrr` |
| Supabase SQL editor URL | `https://supabase.com/dashboard/project/mvxgnliwvoauwwarrlrr/sql/new` |
| GitHub repo | `github.com:terry-zero-in/ai-thesis.git` |
| macro_gauges row count | 366 |
| macro_gauges earliest | 2025-05-18 |
| macro_gauges latest | 2026-05-18 |
| Latest macro snapshot | NAAIM 77.34 / AAII +5.36 / F&G 62.8 / 0 gates / 1.00× |
| Macro cron schedule | daily 21:45 UTC (`ingest-macro-daily`) |
| Composite chain schedule | Saturday 22:45 UTC |
| Live CSS chunk | `/_next/static/chunks/0hpn5xeq5i~u8.css` |
| `--accent` (live) | `#2a5fe6` (electric blue) |
| `--iris-300` (live) | `#5236dc` (preserved for marketing gradient) |
| S15 commits | f72ed34→fde7cbb (6 commits) |

### S15 commit chain
```
fde7cbb name-detail: macro chip in header links to /regime (mirrors Universe)
6c75122 regime trend chart: drop right-edge ▲ threshold labels (collision fix) · legend carries threshold values
a03ef07 universe polish: factor headers expanded · Final column hides at 1.00× · macro chip links to /regime
0b9f28c KPI sparklines retired · Portfolio col 1 sub-line wrapped
9216738 regime polish: AAII symmetry · canonical fmt · closest-gate chip · ladder de-buttonized
a83ae1c regime: fix fetcher direction — was returning oldest 60 rows
```

## 11. Pitfalls / gotchas

1. **Deploy from `web/`, not repo root.** Phantom-deploy footgun: repo-root `.vercel/project.json` points to wrong project (`ai-thesis` not `ai-thesis-v2`). Splitting `cd` and `vercel deploy` across two Bash calls (or `run_in_background`) loses cwd and routes to wrong project. ALWAYS: `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes` as ONE chained foreground command. Caught twice this session.
2. **macro_gauges anon-view returns empty.** RLS allows `authenticated` only (`auth.uid() IS NOT NULL`); anon has GRANT SELECT but no policy → empty result. Server client uses anon key + cookie; when Terry is signed in, his session.cookies pass authenticated check. Direct curl with anon key returns `[]`.
3. **`prices_raw` only contains trading days.** `scores_history.as_of` is Saturday from the weekly chain. Naive join returns zero rows. Use snap-to-prior-trading-day (already in `name-detail-data.ts`).
4. **`fmtGaugeValue` applies per-key precision to BOTH value and threshold.** So "gate at +30.0" for AAII (1 decimal) — internally consistent, but reads slightly awkward vs "gate at 80" (F&G integer). Defensible; don't change without explicit ask.
5. **`hasAnyFinalDelta` (Universe) uses `> 0.05` tolerance.** Below that, Final column hides. Today (multiplier exactly 1.00 everywhere) → hidden. The moment macro fires (multiplier 0.95) Composite × 0.05 = at least 3.0 difference for a 60-score, so column reappears.
6. **`pickClosestGate` requires `currentGates` param to compute `nextMultiplier`.** Passing wrong gates count → wrong next-multiplier displayed in chip. Verify by computing nextGates = min(currentGates+1, 3) and reading from MULTIPLIER_BY_GATES.
7. **MultiplierLadder is shared primitive** — only consumer is /regime today, but docstring lists 4 future reuse candidates. Inactive border now `transparent`; if any future consumer needs row separators, they'll need to add their own treatment (don't restore globally).
8. **Right-edge value labels in RegimeTrendChart** — `avoidOverlap` deconflicts value-vs-value only. With all three series now visible (NAAIM/CNN/AAII), if their values pile up at similar y-positions, labels stack. Current data spaces them well; verify on screenshots when readings tighten.
9. **KpiCell `spark`/`sparkColor` props REMOVED.** Re-adding requires a primitive rebuild. If a future page wants per-tile sparklines, lift to a new primitive rather than restoring KpiCell's prop surface.
10. **Portfolio AggregateBar still synthesizes a 30D walk for the % delta calc** — `synthesize()` helper retained to compute `sparkStart` → `sparkChange` → `sparkPct`. Just doesn't render the line anymore. When `positions_history` lands, swap to real diff.
11. **macro_gauges has stale AAII column from before ~2026-05-13** — forward-fill from "previous row" pulled in `5.36` once curation resumed. Older rows have AAII null. This is fine for the page since it reads `.latest` after fetcher fix, but historical AAII line on the trend chart may show as carry-forward flat at 5.36.
12. **Deploy-parity gate is now MANDATORY in /sch.** Future sessions writing handoffs that claim "all deployed" must include `vercel inspect ai-thesis-v2.vercel.app | grep created` showing a timestamp AFTER `git log -1 --format=%ad HEAD`. Otherwise either redeploy or write the actually-deployed SHA into the handoff with the gap flagged.
13. **The 12-untracked-handoffs cleanup is operational, not blocking.** Don't auto-commit unless explicitly tasked — they're a deliberate carry until Terry triggers cleanup.
14. **Universe filter context** uses `useFilter` (search query) + `useUniverseFilter` (layers/tiers/aiqMin/flags). Two separate hooks. Don't conflate when adding new filter dims.
15. **PageHeader meta items can be ReactNode** — used in Universe + Regime + Name Detail to embed Links + colored mode pills. New surfaces using PageHeader can render rich meta values, not just strings.

## 12. Next-session pickup point

Run §7.1 verification block (paste-and-run, <60s). If all green, the literal first action depends on Terry's call:
- **If Terry says "continue page reviews"** → start AIQ Editor (`/aiq`) Perplexity-style code+screenshot review. Files at `web/src/app/aiq/`.
- **If Terry says "ship Name Detail #6/#7 from §9"** → needs his color-direction call first (FactorPanels severity-token swap) and his consolidate-placeholders decision.
- **If Terry says "knock out the backlog"** → start with Master Design Spec tier-color update (docs-only, single commit, closes §9 #11) then DRY `tier-colors.ts` extraction (closes #10) then untracked handoffs cleanup (closes #12). Three small commits in sequence.

Default if Terry doesn't pre-direct: send him "5/5 priority pages signed off. 4 second-half pages remaining (AIQ/Memos/Decisions/Proposals) + Name Detail tweaks pending your color direction. What's the next move?"
