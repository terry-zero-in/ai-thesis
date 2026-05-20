# S12 — Dashboard + Universe + Name-Detail polish pass · 2026-05-19

## 1. TL;DR

5 commits across 3 surfaces, all live at `86a8db0` on `https://ai-thesis-v2.vercel.app/`. Dashboard: insider de-dupe with `(N)` filing badge + "X of Y scored" denominator label. Universe: 5 polish items (scored label, AIQ "n/a" vs low, MiniBar 50-mark tick, hide-empty Δw/Macro columns, "(N unscored)" line under tier histogram). Name-detail: REAL tier-cutoff bug at `universe-data.ts:162` fixed (fixture used 85/75/60 vs spec's 75/60/45 — every fixture row misclassified one band lower). Auto-deploy preference saved to memory ("just push to vercel live every time"). Bucket 4 remainder (items 2/3 diagnostic caption · 7 portfolio context block · 9 cutoff legend · 12 prev/next pager) deferred to S13 per Terry's compact-first call.

## 2. Architectural pivot or major decision

None this session. One memory added: **`feedback_ai_thesis_auto_deploy`** — on this repo, every visible-change edit ships to Vercel prod automatically (edit → tsc → commit → push → `cd web && vercel deploy --prod --yes` → curl 200). Reason: Terry doesn't review locally; production IS the review surface. Stated verbatim 2026-05-19 ("just push to vercel live every time").

## 3. State of the world

**Git** (verified 2026-05-19 03:14 CDT):
- Working dir: `/Users/terryturner/Projects/ai-thesis/` (code in `web/`)
- Branch: `main` @ `86a8db001a9b1b4b2c6523b8aecab8497ff1ba43` (short `86a8db0`)
- Commits ahead of `origin/main`: 0 (all pushed)
- TSC clean: YES (exit 0)
- Working tree: clean except 9 untracked handoff docs (S3-S11, pre-existing)

**Production** (verified 2026-05-19 03:14 CDT):
- Marketing: `https://ai-thesis-v2.vercel.app/` → 200
- `/universe` → 307 (auth gate intact)
- `/portfolio` → 307 (auth gate intact)
- `/?moverTier=High` → 200 (URL filter contract alive)
- Latest deploy: `https://ai-thesis-v2-gdo36dfdm-terry-8893s-projects.vercel.app`
- GitHub→Vercel webhook STILL broken — manual `vercel deploy --prod --yes` after every commit
- Repo-root `.vercel/project.json` STILL points wrong project — `cd web/` must be standalone (S10 footgun)

**External integrations:**
- Supabase project: `ydzvrosvkmqkdaqgsxtb` (Reticle — KEEP)
- Linear MCP: connected (THS team)
- GitHub MCP: scoped to `terry-zero-in/ai-thesis`

**DB state:** unchanged this session — no schema, no migrations, no seed touches.

## 4. Action / API reference

None this session — no endpoints created or modified. URL filter contract `/?moverTier=<Tier>` unchanged from S10.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/lib/dashboard-data.ts` | M | Insider de-dupe: `INSIDER_QUERY_LIMIT=40`, group raw rows by `(ticker, side)`, sum shares + value, return top 5 groups with `filing_count` field. 3 ARM SELLs no longer eat the rail. |
| `web/src/components/rails/DashboardTodayRail.tsx` | M | `InsiderRow` renders `(N)` suffix inline next to shares when `filing_count > 1`. |
| `web/src/app/page.tsx` | M | High-Tier sub label: `4/52` → `4 of 52 scored`. Denominator's meaning explicit. |
| `web/src/components/dashboard/PortfolioValueChart.tsx` | M (3 edits, net flat) | Gradient experiment — applied `--surface → #060709`, softened to `#07080E`, then reverted to flat `--surface`. Final state = identical to start of session. |
| `web/src/app/universe/page.tsx` | M | PageHeader meta `names` → `scored`. Mirrors dashboard fix. |
| `web/src/components/universe/MiniBar.tsx` | M | Null → italic `n/a` + `title` tooltip "{factor} not yet scored" + transparent bar fill. 1px tick at 50% of track for above-/below-median read. |
| `web/src/components/universe/UniverseTable.tsx` | M | Compute `hasAnyDelta` + `hasAnyMacro` off unfiltered rows. Hide both `<Th>` and `<Td>` for Δw + Macro when zero rows carry signal. Column count adjusts in empty-state `colSpan`. |
| `web/src/components/universe/UniverseInsightsRail.tsx` | M | `+ N unscored` italic caption under tier histogram when `rows.length > sum(tier-buckets)`. Math reconciles end-to-end. |
| `web/src/lib/universe-data.ts` | M | **Tier-cutoff bug fix.** Inline ternary `final >= 85 ? "High" : final >= 75 ? "Medium" : final >= 60 ? "Low" : "Avoid"` replaced with `classifyTier(final)` import from `scoring-weights.ts`. Spec cutoffs 75/60/45 now applied. |
| `web/src/components/name/NameHeader.tsx` | M | Derivation chain copy: `(no gates)` → `(0/3 gates)`. Parity with macro pill convention. |
| `web/src/components/name/NameScoreChart.tsx` | M | Insufficient-history banner tightened: dashed border, italic, dim, `max-width: 480px`, `align-self: flex-start`. Reads graceful empty, not system error. |
| `~/.claude/projects/-Users-terryturner/memory/feedback_ai_thesis_auto_deploy.md` | A | New memory: auto-deploy to Vercel prod on every visible-change edit. |
| `~/.claude/projects/-Users-terryturner/memory/MEMORY.md` | M | One-line index entry for the new memory. |
| `docs/handoffs/2026-05-19-S12-dashboard-universe-polish-pass.md` | A | This handoff doc. |

## 6. Decisions locked

1. **Insider rail de-dupes by (ticker, side), aggregates shares + value, badges with `(N)` when N > 1.** **Why:** 3 same-ticker rows of 5 was eating half the rail (Perplexity flag). **Tradeoff accepted:** Raw query bumped 5 → 40 (8× more rows pulled per render) to give the dedupe pass enough material. Cost negligible; insider table is small.

2. **High-Tier denominator label reads "X of Y scored" not "X/Y".** **Why:** "4/52" implied the universe is 52 names when 52 = current snapshot scored count; master universe is 70. **Tradeoff accepted:** Slightly longer label — chrome cost worth the honesty.

3. **MiniBar null state = italic "n/a" + tooltip + transparent bar, NOT "—" + gray bar.** **Why:** Coverage gap and low score are different signals; previous treatment conflated them. **Tradeoff accepted:** Marginal extra width (24px text col instead of 20px) so "n/a" fits.

4. **MiniBar always shows a 1px tick at 50%.** **Why:** Eyeballing "is 46 below average?" required arithmetic; tick anchors above-/below-median read at a glance. **Tradeoff accepted:** Tiny visual noise (rgba .10 opacity) — negligible.

5. **Δw + Macro columns hide entirely when zero rows carry signal, NOT when filtered.** **Why:** Empty columns imply data should be there. Compute off unfiltered set so toggling filters doesn't pop columns in/out mid-session. **Tradeoff accepted:** Table jumps when the underlying data graduates from empty to populated — one-time effect.

6. **Tier cutoffs are 75/60/45 — High/Medium/Low/Avoid — everywhere.** **Why:** Spec (`AI-Thesis-v2-Algorithm-and-Deployment.md:506,618-620`) + canonical `classifyTier` agree on 75/60/45. Fixture inline at `universe-data.ts:162` had 85/75/60, silently misclassifying every fixture row one band lower (MU 79.7 = Medium in fixture, High elsewhere). Now all call sites import `classifyTier` from `scoring-weights.ts`. **Tradeoff accepted:** Tier distribution shifts UP after this fix — more names qualify as High than before. "4 High" count on Universe insights rail will become ~10-15.

7. **Tier naming stays "High/Medium/Low/Avoid" — NOT "A/B/C/D".** **Why:** Perplexity asserted spec uses A/B/C/D; A-gate verification proved spec uses High/Medium/Low/Avoid at 3 loci. The "A 87" notation in the Claude Design Dashboard mock was a mock-author invention, not spec. **Tradeoff accepted:** None — confirmed alignment with spec; no rename needed.

8. **IBM stays in the universe.** **Why:** Perplexity flagged IBM as not belonging in L2 Hyperscaler; A-gate verification confirmed IBM is intentional (universe-fixture, e13 seed migration, SESSION_NOTES canonical L2 list). Already flagged for potential removal in monthly-curator routine — pipeline handles it. **Tradeoff accepted:** None.

9. **PortfolioValueChart background stays FLAT `--surface`, no gradient.** **Why:** Three-iteration experiment (#060709 → #07080E → flat) concluded "gotta keep moving." **Tradeoff accepted:** None — file ends identical to start.

10. **Auto-deploy to Vercel prod after every visible-change edit.** **Why:** Terry doesn't review locally; production IS the review surface. **Tradeoff accepted:** Every commit costs ~45s deploy time. Memory at `~/.claude/projects/-Users-terryturner/memory/feedback_ai_thesis_auto_deploy.md`.

11. **Skip Items 5, 8, 10, 11, 13 from Perplexity's Universe-detail review.** **Why:** Item 5 (chart range vs banner) is impossible per `NameScoreChart.tsx:26`; item 8 (memo surface) needs THS-65/66 to ship first; item 10 (AIQ "no rubric") is fixture choice; item 11 (Backtest sidebar) is shipped; item 13 (per-block freshness) is cosmetic low-value. **Tradeoff accepted:** None.

## 7. Next-session test plan

### 7.1 Read-only verification (<60s, paste-and-run)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                              # expect 86a8db001a9b1b4b2c6523b8aecab8497ff1ba43
git log --oneline -5                            # expect 86a8db0 at top
git status --short | wc -l                      # expect 9 (untracked S3-S11 handoffs only)
cd web && npx tsc --noEmit; echo "tsc exit $?"  # expect tsc exit 0
curl -s -o /dev/null -w "marketing %{http_code}\n" https://ai-thesis-v2.vercel.app/         # expect 200
curl -s -o /dev/null -w "universe %{http_code}\n" https://ai-thesis-v2.vercel.app/universe  # expect 307
curl -s -o /dev/null -w "moverTier %{http_code}\n" "https://ai-thesis-v2.vercel.app/?moverTier=High"  # expect 200
```

### 7.2 Fresh end-to-end

Not applicable this session — no new flows shipped, no schema touches.

### 7.3 Visual / UI verification

Open `https://ai-thesis-v2.vercel.app/` after sign-in. Hard-refresh (`Cmd+Shift+R`) to bust CSS cache.

**Dashboard:**
- High-Tier KPI tile sub-label reads `N of M scored · ↑/↓ N vs last week` (NOT `N/M`).
- Right rail "Insider · recent" shows distinct (ticker, side) rows. If any ticker has multiple filings of the same side, row shows `(N)` after shares.

**Universe (`/universe`):**
- PageHeader meta strip shows `scored: 52` (or whatever current snapshot count is).
- MiniBars in Q/G/V/AIQ cells: faint vertical tick at the 50% mark on every bar.
- Null factor cells show italic `n/a` (not "—") and have a tooltip on hover naming the missing factor.
- Δw and Macro columns: visible if ANY row has data; hidden entirely if all rows are empty.
- Tier histogram on right rail: if `4+10+18+18 ≠ snap.rows.length`, an italic `+ N unscored` caption appears under the bars.
- **Tier distribution should look different from yesterday** — at the new (correct) cutoffs, more names qualify as High; fewer as Avoid.

**Name detail (`/universe/MU` as a probe):**
- MU at composite 79.7 should now render `High` tier (was `Medium` before this session due to bug).
- NameScoreChart insufficient-history empty state: tighter dashed inline strip, NOT full-width card.
- Macro derivation chain on header reads `... ×1.00 (0/3 gates) ...` when no gates hit (was `(no gates)`).

## 8. Budget / quota tracking

None this session. No external API rate limits, no Vercel build minute concerns flagged.

## 9. Known issues / backlog

Numbered by priority. Items 1-4 are bucket 4 remainder — the explicit pickup for S13.

1. **(BUCKET 4 remainder) Item 7: Portfolio context block on name detail page.** Net-new section. Above NameScoreChart, below NameHeader (Option A locked). Held: weight · cost basis · P&L · concentration tax. Not-held: `Not in portfolio · target weight if entered: X%`. ~60-90 min. Needs data fetcher extending `name-detail-data.ts` to join portfolio position.
2. **(BUCKET 4 remainder) Items 2/3: FactorPanels diagnostic caption.** Add caption clarifying pillar Z-scores are diagnostic, not derivational. `Q · Quality` score is engine output; pillars come from `factor_breakdown` JSON — DIFFERENT computations. Currently misleading. ~10 min.
3. **(BUCKET 4 remainder) Item 9: Tier-cutoff legend under Hero.** Small caption: `High ≥75 · Medium 60-75 · Low 45-60 · Avoid <45`. ~10 min.
4. **(BUCKET 4 remainder) Item 12: Prev/next pager on name detail.** `← prev · TICKER · next →` affordance for fast slate review. Needs adjacent-ticker lookup from universe sort order. ~30 min.
5. **TSM Q-score = 4 (and other TSM anomalies).** Perplexity review item 6 — possible Q-factor calc bug or counterintuitive percentile-rank-vs-peer-group. Engine investigation, not polish. Likely hours. Own ticket.
6. **Operational cleanup commit.** 9 untracked handoff docs (S3-S11) + fix or delete repo-root `.vercel/project.json` (wrong-project deploy footgun). ~10 min, hygiene only.
7. **Greeting countdown clock** (S11 pending #1). Reference HTML at `/Users/terryturner/Documents/Archives/AI Thesis Lambo Polish/AI Thesis - Dashboard.html` (NOTE: per earlier session, this folder was empty when I checked — verify path) lines 911-926. Live JS tick required. ~30 min.
8. **Top Positions table: Weight + Thesis grade columns** (S11 pending #2). ~60 min.
9. **THS-85 Auth + Stripe.** High priority — billing risk. Multi-session.
10. **THS-87 backtest + duplicate cleanup.**
11. **THS-71 Routines plumbing** — Terry's manual setup (task #47).
12. **Per-name detail page chart polish** (task #78, pending) — chart shipped, but enhancements queued.
13. **Portfolio hero chart** (task #79, pending).
14. **Fix GitHub→Vercel webhook.**
15. **Hover tooltip primitive extraction** — pattern duplicated in PortfolioValueChart + NameScoreChart. Hoist when 4th consumer appears.
16. **/logout discoverability** — add to CmdPalette.
17. **Per-surface Instrument-Field Pattern lift** — Regime inner content, AIQ Editor, AIQ Drafts, Decisions, Memos, Backtest, Settings.
18. **Relocate MorningBrief to /memos** when that page graduates.

## 10. Quick-reference IDs

| Key | Value |
|---|---|
| Code working dir | `/Users/terryturner/Projects/ai-thesis/web` |
| Git working dir | `/Users/terryturner/Projects/ai-thesis` |
| HEAD SHA | `86a8db001a9b1b4b2c6523b8aecab8497ff1ba43` (short `86a8db0`) |
| Prior session handoff | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-19-S11-portfolio-chart-v2-instrumentation.md` |
| S10 handoff | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-19-S10-chart-polish-pageheader-portfolio-hero.md` |
| Production marketing | `https://ai-thesis-v2.vercel.app/` |
| Latest deploy URL | `https://ai-thesis-v2-gdo36dfdm-terry-8893s-projects.vercel.app` |
| Vercel deploy command | `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes` |
| Supabase Reticle project | `ydzvrosvkmqkdaqgsxtb` (KEEP) |
| Algorithm spec | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Canonical tier classifier | `web/src/lib/scoring-weights.ts:59` — `classifyTier(finalScore)` — cutoffs 75/60/45 |
| Tier classifier (was buggy) | `web/src/lib/universe-data.ts:162` — NOW uses `classifyTier(final)` |
| Name-detail-data fetcher | `web/src/lib/name-detail-data.ts` |
| Portfolio data fetcher | `web/src/lib/portfolio-data.ts` (server-only) |
| Portfolio types | `web/src/lib/portfolio-types.ts` (client-safe) |
| Reference HTML (Claude Design Dashboard mock) | `/Users/terryturner/Documents/Archives/AI Thesis Lambo Polish/AI Thesis - Dashboard.html` (verify path — was empty when I checked S11 wake-up) |
| Auto-deploy memory | `/Users/terryturner/.claude/projects/-Users-terryturner/memory/feedback_ai_thesis_auto_deploy.md` |
| Dashboard.html on Desktop | `/Users/terryturner/Desktop/AI Thesis/Dashboard.html` (1326 lines, read & in context in S12) |

## 11. Pitfalls / gotchas

1. **`cd web/` MUST be standalone before `vercel deploy`.** Never chain after `cd /Users/terryturner/Projects/ai-thesis && ...`. Repo-root `.vercel/project.json` points to wrong project (`ai-thesis`, not `ai-thesis-v2`). S10 footgun hit once; S11 + S12 avoided. The correct invocation: `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`.

2. **Tier-cutoff fix propagates app-wide.** Dashboard high-tier count, Universe insights histogram, Score Movers tier coloring, MoversByTier rail chart — all read from `r.tier` which is now computed via `classifyTier`. Expect visible shift: more High, fewer Avoid. This is correct.

3. **`r.tier` on UniverseRow comes from two places.** Live mode: pulled from `scores_history.tier` column (engine-set, presumably correct). Fixture mode: computed in `fixtureSnapshot()` at line 162 (was wrong, now fixed). When live DB is wired, verify the engine's tier write uses the same cutoffs — if not, this bug returns via the Saturday chain.

4. **Perplexity has a reliable failure mode: claiming spec drift without verifying.** S12 examples: A/B/C/D tier rename (spec actually uses High/Medium/Low/Avoid), IBM doesn't belong (intentional L2 Hyperscaler), Backtest is aspirational (shipped). Always grep spec before reflexively agreeing.

5. **Insider de-dupe over-pulls.** `INSIDER_QUERY_LIMIT=40` raw rows → top 5 distinct (ticker, side) groups. If a single ticker has >40 filings in the 14-day window, the dedupe is incomplete. Edge case; not a real concern at current volume.

6. **Dashboard PortfolioValueChart container stays FLAT.** Three-iteration gradient experiment ended in revert. Don't add a gradient back without explicit user direction.

7. **CSS changes need hard-refresh (`Cmd+Shift+R`).** Browser caches Tailwind output aggressively.

8. **GitHub→Vercel webhook STILL broken.** Manual `vercel deploy --prod --yes` after every commit.

9. **MiniBar 24px right-text col now (was 20px).** If any other consumer of MiniBar exists that assumed 20px, it'll re-flow. Grep before assuming non-breaking.

10. **`hasAnyDelta` / `hasAnyMacro` compute off `rows`, NOT `filtered`.** Critical — if Terry asks to make columns dynamic to filter state, that's a different design call (would cause columns to pop in/out mid-session).

11. **EngineStateStrip is DEAD** (S9 lock). Don't reintroduce.

12. **Don't split scroll axes on /universe** (S9 lock).

13. **Don't expand scope** ([[feedback_scope_no_unsolicited_changes]]). Bucket 4 remainder is the next session's work. Don't add items beyond what's queued without a focused clarifying question.

14. **PortfolioValueChart is ~540 lines.** Still no split — wait until it's unwieldy.

15. **Claude Design Dashboard reference HTML had path conflicts.** S11 referenced `/Users/terryturner/Documents/Archives/AI Thesis Lambo Polish/AI Thesis - Dashboard.html` (empty when re-checked). S12 read it at `/Users/terryturner/Desktop/AI Thesis/Dashboard.html` (1326 lines). Use the Desktop path going forward.

## 12. Next-session pickup point

Run §7.1 verification (5 commands, <60s). Then ask Terry: *"S12 closed dashboard + universe + tier-bug fix. Bucket 4 remainder is queued: items 2/3 (FactorPanels diagnostic caption), 7 (portfolio context block, ~60-90 min — biggest), 9 (cutoff legend), 12 (prev/next pager). Which first?"* If Terry says "autonomous" or "go": default to item 7 first (biggest UX gap, biggest leverage). Item 7 placement is LOCKED at Option A — inline strip just under NameHeader, above NameScoreChart. Hold the line — don't re-litigate placement.
