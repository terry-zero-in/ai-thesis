# /LAMBO Design Finish Review — AI Thesis Web App

**Date:** 2026-05-17
**Reviewer:** Claude Code (local CC session)
**Branch:** `main` @ `84115cd` (post-Epic 4-6 merge)
**Surface:** `http://localhost:3003` (Next 16.2.6 / React 19 / Turbopack)
**Mode:** Fixture (no Supabase env)
**Viewport:** 1440 × 900, 2× density
**Lens stack:** `/lambo` (posture), `/frontend-design`, `/ui-ux-pro-max`, `/vercel-react-best-practices`, `/web-design-guidelines`
**Spec authority:** `docs/AI-Thesis-v2-Master-Design-Spec.md` v1.0 · `DESIGN_REFERENCES.md` Tier 1–4

Screenshots: `/tmp/lambo-review-2026-05-16/*.png` (13 routes × {full-page, viewport}).
Console capture: zero errors, zero warnings across 13 routes (clean baseline).

---

## 0 · Executive verdict

> **Strong scaffold, wrong skin. Ship-quality composition with one token swap and four IA fixes away from a /lambo finish.**

The Reticle chrome lift is excellent. Hairlines, density, mono numerics, sidebar pattern, breadcrumb chrome, tag chips, monospace metadata strips — all institutional-grade. Console is clean. Routes return 200. Empty/deferred-feature states are honest (no "No data."). Pipeline-freshness and decisions surfaces in particular hit the Bloomberg + Vercel + Lambo blend.

The ship-blocker for "this looks like Basis" is **single-token-deep**: the chromatic palette never swapped from Reticle's Plasma Cyan to the spec-locked Cypher Indigo + AI Thesis semantic ladder. Every primary CTA, every active nav state, every accent moment in the entire 13-route product is wearing Reticle's cyan-default theme. The CSS file self-documents the inheritance ("Extracted verbatim 2026-05-11 from Reticle Stage 3 ... DO NOT mutate values silently"). Surfaces, text, borders, and type ladders DID port to spec. Chromatic identity didn't.

Once the token swap lands, the rest is per-page IA reconciliation (dashboard layout deviates from spec §5.1; right-rail content is placeholder on every page; macro-gauge component shape diverges from spec §4.3) and the absence of a named signature pattern the product can be recognized by.

**Top 5 findings (ranked by leverage):**

| # | Finding | Severity | Surface | Why it matters |
|---|---|---|---|---|
| 1 | Chromatic token system uses Reticle's Plasma Cyan, not spec §2.1 Cypher Indigo + semantic palette | **P0** | All 13 routes | Cross-cutting brand-identity drift; ~10 lines of CSS fixes the entire app |
| 2 | Right rail is empty placeholder on every page (`"Page-level rail content lands here as each surface ships. ⌘\ toggles."`) | **P1** | 7 of 13 routes | Spec §6 mandates per-page contextual rail content; 280px of dead real estate everywhere |
| 3 | Dashboard IA diverges from spec §5.1 — no KPI row, no macro-gauges row, replaced with Tier Distribution + Pipeline Freshness + Winners/Losers/Crossings | **P1** | `/` | First-thing-on-login surface; sets product posture |
| 4 | No named signature pattern propagates across surfaces — each page is a coherent screen, but the product reads as "portfolio of screens" not "the AI Thesis way" | **P1** | All | /lambo: signature patterns are the unit of work; need 2–3 per major surface |
| 5 | Hero numbers (Composite, Final) on `/universe/[ticker]` are jammed in top-right corner at chip-size; the most important number on the page gets <10% surrounding space, violating /lambo's 60%-breathing rule | **P1** | `/universe/[ticker]` | The score is the protagonist (spec §1.7); current treatment buries it |

**Recommended next moves (in order):**

1. **One-commit token swap** (~30 min): rewrite `src/app/globals.css` lines 23–28 to spec §2.1 values; update `src/lib/theme.ts` to ship Cypher Indigo as default; verify HIGH tier badge re-renders indigo, primary CTA re-renders indigo, macro-gate ribbons re-render amber.
2. **One-commit rail-content fan-out** (~2 hr): implement the 6 right-rail contents from spec §6 (Today / Filter / Activity / Reserve / History / Legend). Delete the placeholder copy.
3. **One-commit dashboard IA realignment** (~3 hr): replace the current top half with spec §5.1 (greeting strip, 4-col KPI row using component 4.4, score-movers table per 4.11, 3-gauge row per 4.3). Keep the bottom Tier Crossings list as a /lambo invention-within-spec — it's a strong addition.
4. **Invent the signature pattern set** (1 design session): name 2–3 patterns that propagate (proposals in §4 below).
5. **Hero-number reflow on `/universe/[ticker]`** (~1 hr): pull Composite into the main column at 56–64px JetBrains Mono with the derivation chain immediately beneath (`Raw 87.0 · ×0.95 macro · = 82.6 effective`).

Everything else triages to P2/P3 polish post-cutover.

---

## 1 · The P0 finding — token system

### What's wrong

`web/src/app/globals.css` lines 13–28 inherit Reticle's chromatic palette wholesale. The file's own header reads:

> Source of truth: Reticle Stage 3 - Standalone.html (style block). Extracted verbatim 2026-05-11. DO NOT mutate values silently — pixel parity with the standalone mockup is the contract.

The contract was the wrong contract. AI Thesis's Master Design Spec §2.1 locks a different palette.

| Token | Actual (`globals.css:24-28`) | Spec §2.1 | Δ |
|---|---|---|---|
| `--accent` | `#22D3EE` Plasma Cyan | `#4D5BFF` Cypher Indigo | Different hue family entirely |
| `--accent-hover` | `#67E8F9` | `#6573FF` | — |
| `--accent-soft` | `rgba(34,211,238,.10)` | `rgba(77, 91, 255, 0.10)` | — |
| `--success` | `#34D399` | `#5BB880` | Spec is desaturated; actual is saturated emerald |
| `--warning` | `#F59E0B` | `#DDA85A` | Spec is desaturated amber; actual is saturated |
| `--danger` | `#EF4444` | `#E07878` | Spec is muted; actual is alert-red |
| `--info` | `#A78BFA` | `#6594E8` | Spec is blue; actual is purple |

Surface/text/border ladder ported correctly (verified all match spec):
- `--canvas: #0B0C0F` ✓ (spec `--bg`)
- `--surface: #15171C` ✓
- `--surface-2: #1B1E25` ✓
- `--elevated: #22262E` ✓ (spec `--surface-elevated`)
- `--text-1/2/3: #ECEDEF / #CFD3DA / #7A818D` ✓
- `--border / --border-subtle: #2A2F38 / #1F2229` ✓

So the structural identity (warmer-gray no-pure-black ladder) is correct. Only the chromatic identity drifted.

### Downstream symptoms (all observed in screenshots)

- **Login `/login`**: "Send magic link" primary button renders teal (`--accent`), not indigo. Single most-visible CTA in onboarding.
- **Universe table `/universe`**: HIGH tier badge renders coral/red instead of indigo because the per-tier semantic mapping (§2.1 "HIGH = accent-soft bg + accent color") resolves to a saturated cyan that visually clashes with the warmer canvas — likely the tier-badge code is also reaching for a different token. Either way, HIGH does not read as "ours / conviction" — spec §2.1 explicitly says "the accent indigo is the only color that signifies 'active / selected / mine'."
- **Active nav state**: 2px left-edge indicator is teal across all pages (sidebar Dashboard / Universe / Portfolio / Regime / AIQ Editor / Memos / Decisions / Backtest). Per spec §3.3, this should be `--accent` indigo.
- **Regime `/regime`**: "GATE HIT" ribbon on NAAIM card renders coral/red, not warning amber. Per spec §4.3, gate-hit uses `--warning-soft` bg + `--warning` text. Actual `--warning: #F59E0B` is fluorescent amber, not the desaturated `#DDA85A` spec; combined with the NAAIM `96.7` value also being colored, the entire card screams "danger" instead of "alert."
- **Active state on Curve component (regime page)**: The "1 GATE" highlighted multiplier step is teal. Should be indigo.
- **Search affordance indicator**: The cyan square next to search in the topbar is `--accent`. Should be indigo.

### Why this is P0 not P1

It's one CSS file, ~10 lines. The fix is reversible, cheap, mechanical. It propagates instantly to every surface. The cost of leaving it is that **every screenshot Terry shows anyone reads as "another cyan-accent SaaS"** instead of "the indigo-accent CRE tool I built." Brand identity is the product's primary trust vector per /lambo. Spec §1.3 calls Cypher Indigo "locked" and the only chromatic accent. Current state silently lifts that lock.

### Recommended fix

Replace `globals.css:13-28` with the spec §2.1 block verbatim (warm-gray surfaces are already correct; only the chromatic block needs replacement). Then strip the Reticle theme-swap mechanism (`src/lib/theme.ts` exports 5 themes including a "Plasma Cyan" default) — AI Thesis has one accent, locked. Themes are scope-creep for v1 per spec §13 ("Themes other than dark") and per /lambo conviction (one direction, defended).

If the multi-theme switcher is wired into a Settings UI surface (it isn't visible in the current `/settings` screenshot but the code suggests so), gate it behind a dev-only flag or remove for v1. The Reticle base needed it because Reticle is a chrome demo; AI Thesis is a product with locked identity.

---

## 2 · Per-route findings

Severity scale:
- **P0** — broken / brand-identity drift / accessibility blocker
- **P1** — spec violation / missing required component / awe-gap on a hero surface
- **P2** — IA deviation with reasoning required / token-derivative bug
- **P3** — polish / micro-spacing / nit

### 2.1 `/` Dashboard

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Layout does not match spec §5.1. No greeting strip ("Good evening, Terry · Friday, May 16, 2026 · 23:24 CT"), no 4-col KPI row (Portfolio Value / Day P&L / 30D Return / High Tier count), no 3-gauge macro row | P1 | Realign to spec §5.1 wireframe; keep the additive Tier Crossings list at bottom |
| 2 | Topbar duplicates page title ("≡ Dashboard" in topbar + "Weekly snapshot" H1 in canvas). Spec §3.2 has no page-title slot in topbar; breadcrumb only on sub-pages | P2 | Remove topbar title; let breadcrumb + canvas H1 do the work |
| 3 | H1 reads "Weekly snapshot" — but the page contains daily-flavored content (Pipeline freshness, BY KIND counts). H1 wording understates the page's scope | P3 | "Snapshot" + meta-strip with cadence |
| 4 | Right rail shows placeholder copy. Spec §6 mandates Today / Top movers / Insider today / Macro summary | P1 | Implement rail per spec |
| 5 | Tier Distribution counts: `-10 + -11 + +25 + +1 = +5`, but universe size is constant 50 — deltas should sum to 0 | P2 | Verify fixture math or surface as "computed before universe expansion to 50" with attribution |
| 6 | Tier Crossings table uses `↓` arrow glyph in delta column. Spec §4.11: "no chevron icon at 13px size (too noisy)" | P2 | Remove arrow; rely on color (`--success`/`--danger`) and sign |
| 7 | Sidebar section labels "OPERATIONS" / "WORKSPACE" deviate from spec §3.3 "COMMAND CENTER" / "WORKSPACE" | P3 | Rename to spec labels |
| 8 | Macro Gate "0.95×" card is good (large mono hero number, derivation prose underneath) — keep | ✓ | — |
| 9 | Pipeline Freshness card on dashboard duplicates the `/settings` Pipeline Freshness table. Pick one home | P2 | Move to `/settings` only; dashboard shows a 1-line `"All freshness ≤ SLA · last run X"` summary instead |

### 2.2 `/universe`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Two adjacent columns "COMP" and "FINAL" show identical values (e.g. CDNS 85.3 / 85.3 — every row). If FINAL is post-macro-multiplier, it should differ when multiplier ≠ 1.0; if redundant, drop one | P1 | Show derivation: `COMP · ×0.95 · FINAL` either as 2 columns with a × between, or as a single FINAL column with hover-revealing the chain |
| 2 | HIGH tier badge renders coral/red — spec §4.1 wants `--accent-soft` bg + `--accent` color (post-token-swap, indigo) | P0 | Audit `TierBadge` component; ensure tier→token map uses `--accent` for HIGH |
| 3 | No Δ7D column visible. Spec §5.2 has it explicitly. Composite without delta hides the trend the user is actually scanning for | P1 | Add Δ7D mono column with `--success`/`--danger` color, no arrow glyph |
| 4 | Right rail filter content partially implemented: LAYER chips ✓, TIER buttons ✓ — but no AIQ-MIN slider, no FLAGS toggles (Depr / Burry / Macro) per spec §5.2 | P1 | Complete filter rail per spec |
| 5 | Filter affordances use pill chips (Layer) + buttons (Tier) instead of spec's checkboxes (`☐ L1` etc). Chips arguably better than checkboxes for compact filters | P2 (defensible) | Hold as-is, document deviation in component spec |
| 6 | Footer count "50 / 50 names · As of 2026-05-09 [fixture]" lives in rail; spec wants it under the table ("Showing 12 of 70 · click row for detail") | P3 | Move to under-table position |
| 7 | No sort indicator on columns — clicking COMP should sort, with caret affordance. Not visible | P3 | Add sortable headers with caret on hover |
| 8 | Factor cells (Q/G/V/AIQ) appear to tint at score ≥80 per spec §5.2 — verify pixel-accurately post-token-swap | P3 | Verify |
| 9 | Mono ticker + sans name two-line cell ✓ matches spec §4.11 | ✓ | — |
| 10 | Density at 50 rows visible is Bloomberg-grade — strong /lambo posture | ✓ | — |

### 2.3 `/universe/[ticker]`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Breadcrumb reads `Universe / Name` — should be `Universe / TSM` (or `Universe / TSM · Taiwan Semiconductor`) | P2 | Wire breadcrumb to dynamic param |
| 2 | Hero numbers (COMPOSITE 87.0 / FINAL 87.0) jammed in top-right chip area at <16px. Per spec §5.3, Composite is "the largest type on the page (28px JetBrains Mono 500)"; per /lambo, hero number gets ≥60% breathing space | P1 | Pull Composite into a hero block in the main column: 56–64px JetBrains Mono with derivation chain `Raw 87.0 · ×0.95 macro · = 82.6 effective` immediately beneath. THIS is signature-pattern #1 (the Derivation Hero) |
| 3 | No 7-day delta on Composite ("↑ +3.1 (7d)" per spec §5.3) | P1 | Add delta + period to hero |
| 4 | No macro multiplier derivation visible (`Macro mult 0.95× → 78.1 effective`). The most-asked underwriting question for a scored name is "did the macro state derate it?" — answer should be in eyeshot of the hero | P1 | Inline as part of the Derivation Hero |
| 5 | Factor cards (Q QUALITY / G GROWTH / V VALUE) show RAW underlying metrics (Profitability -0.03 z, NTM Growth 19.8%, PEG-like 1.69, etc.) rather than spec §4.2's normalized 0–100 sub-scores. RAW is more institutional — analysts read these directly. Defensible deviation; possibly an upgrade. AIQ has its own card with the rubric structure spec §5.6 | P2 (defensible) | Keep; document as deviation; ensure hover reveals the 0–100 normalized score for system traceability |
| 6 | AIQ rubric column format reads "Disclosure / 20 20" — awkward placement of `/20`. Spec is "18 / 20" with value first | P3 | Swap to `value / max` order |
| 7 | 12-WEEK HISTORY chart x-axis "2026-02-01 → 2026-04-22" — current date is 2026-05-17, chart truncates 25 days before today | P2 | Extend window to latest fixture date |
| 8 | Chart shows two declared lines (Final · 87.0, Composite · 87.0) but only one is visually distinguishable. When the multiplier ≠ 1.0 they should diverge; legend should show even when overlapping | P2 | Distinct line styles (Final solid, Composite dashed) so the relationship is readable even when values coincide |
| 9 | No threshold lines at 60 (Medium) / 75 (High) per spec §4.9 | P2 | Add hairline `--border-subtle` horizontal rules at threshold y-values, labels in `--text-3` |
| 10 | Right rail shows Universe filter content (LAYER chips, TIER buttons, "0 / 0 names") — wrong context. Spec §6 mandates Activity rail (tier history, recent score changes, insider events, news links) | P1 | Implement per-page rail content (links to finding #2 in §0) |
| 11 | Bottom deferred-feature panels (INSIDER FORM 4, RECENT NEWS, SENTIMENT TIMELINE) use the right pattern: titled, ticket-tagged, copy explains the deferral. /lambo: this is the correct "decorative ghost" — structural ghost, not visual ghost | ✓ | — |

### 2.4 `/portfolio`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Fixture mode shows empty book → page degrades to "No open positions yet" + ADD POSITION form. Spec §5.4's KPI row, positions table, allocation chart, concentration line all hidden. Reasonable empty handling; but for /lambo review we can't see the strongest state | P1 | Provide a `?seed=fixture-positions` flag for review/demo that populates 12 positions per spec §5.4 |
| 2 | RESERVE, TRIGGERS, ADD POSITION panels live in main canvas right side. Spec §5.4 puts RESERVE + TRIGGERS in the right rail. ADD POSITION is reasonable in main | P1 | Move RESERVE + TRIGGERS to the right rail; main canvas keeps positions table + ADD POSITION |
| 3 | Right rail is empty placeholder while reserve/triggers occupy main — double miss (no rail content + main carrying rail content) | P1 | Resolve via fix #2 |
| 4 | TRIGGERS list shows 3 triggers (spec mentions 2: Position drawdown > 7%, SPY ≤ −5% / VIX > 25 for 3+ days). Three triggers is fine; flag for verification with spec author | P3 | Confirm with Terry |
| 5 | "Add position" button uses primary accent color — post-token-swap it should be indigo. Currently teal | P0 | Token swap fixes |
| 6 | "Position drawdown > 7%" / "SPY single-day drop ≥ 5%" — copy uses sentence case + symbols. Institutional. ✓ | ✓ | — |

### 2.5 `/regime`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | NAAIM "GATE HIT" ribbon and NAAIM "96.7" value both render coral/red, not amber. Per spec §4.3, gate-hit uses `--warning` (amber). Current `--warning: #F59E0B` is saturated amber, but the NAAIM rendering reads red | P1 | Audit gate-hit color binding; ensure it resolves to `--warning`, not `--danger`. Token swap also reduces saturation to spec's `#DDA85A` |
| 2 | Three gauge cards use sparkline-style wavy lines instead of spec §4.3's horizontal bar with threshold tick + current marker + numeric scale (0…50…90▲100). The wave is decorative; the bar is dispositive | P1 | Replace wave with spec gauge bar; keep the meta lines underneath (sub-text + crossings count) |
| 3 | "11 crossings in last 52w · last 2026-05-14" source-attribution beneath gauges — institutional, /lambo-aligned | ✓ | — |
| 4 | No 12-month trend chart (3 lines + threshold lines + today markers) per spec §5.5 bottom | P1 | Add |
| 5 | No "last 5 gate-state changes" history list per spec §5.5 | P2 | Add |
| 6 | CURVE component (0 GATES → 3 GATES with multiplier values 1.00 / 0.95 / 0.90 / 0.85, active step highlighted) — not in spec. **This is a signature-pattern candidate.** Strong /lambo invention-within-spec: shows the entire ladder so user sees where we are AND where we could go | ✓✓ | Name it. Propose: **"Multiplier Ladder"** — apply same idiom anywhere the system has a stepped state machine (e.g., concentration cap tiers) |
| 7 | "HOW THE MULTIPLIER APPLIES" explainer paragraph at bottom — institutional teaching tone, /lambo-aligned ("the system shows its work") | ✓ | — |
| 8 | "Regime" page title has a subtle indigo dot on the "i" — branded touch. Verify it's consistent across page titles; if so, it's a brand signature; if only here, remove or extend | P3 | Verify consistency; either extend or remove |
| 9 | Right rail empty placeholder. Spec §6 wants threshold legend for NAAIM/AAII/F&G | P1 | Implement |

### 2.6 `/aiq` (list)

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Column header "SCOR" truncated — should be "SCORE" | P3 | Widen column or rename to "TOTAL" (matches the per-row scoring vocabulary) |
| 2 | All values "—" because no rubrics scored. Dash placeholder per spec §4.13 ✓ — but no "Score a new ticker" CTA. Click-row implied | P3 | Surface affordance: clicking row navigates to `/aiq/[ticker]`; show tooltip on first hover |
| 3 | "DRAFTS QUEUE →" affordance top right ✓ | ✓ | — |
| 4 | Right rail empty placeholder. Spec doesn't define rail content for `/aiq` list — defensible to omit. Better: collapse the rail on this page (already supported via panel-toggle) | P2 | If no spec rail, hide rail by default; toggle to show empty placeholder when user opens it |

### 2.7 `/aiq/[ticker]`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Header shows ticker + name + layer chip — but no current-state context per spec §5.6 ("Last scored May 15 · 92 / 100") | P2 | Add meta line under H1: `Last scored {date} · {score}/100 · {tier}` |
| 2 | Per-dimension cards lack the Source URL field per spec §5.6 ("source URL field at bottom, placeholder 'https://...'") — only Rationale textarea exists | P2 | Add Source URL field per dimension; institutional traceability |
| 3 | TOTAL row format: `TOTAL · _ / 100` — underscore placeholder where the live sum should render. With zeros entered it should show `0 / 100`, with values it should compute live | P3 | Wire live sum |
| 4 | No Save / Discard buttons visible above fold; need to verify they exist below in full-page screenshot. Per spec §5.6 footer | P3 | Verify |
| 5 | HISTORY panel right column says "Connect Supabase to read prior versions." — honest fixture state. But the panel takes full-width vertical real estate at zero data. Could be a slim placeholder until populated | P3 | Width-collapse when empty; restore on data |
| 6 | Instructional copy at top ("AIQ rubric editor — six dimensions, 0..20 / 0..15. Save creates a new versioned row (UPSERT on same day)") — institutional, teaches mechanism. /lambo-aligned | ✓ | — |

### 2.8 `/aiq-drafts`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Single draft card shows compact dimension shorthand `D:15 D:17 C:13 C:13 I:14 A:14` — two `D:` (Disclosure / Defensibility) and two `C:` (Concentration / Capex) are ambiguous. Reader must memorize order | P2 | Disambiguate: `Di:15 Df:17 Cn:13 Cx:13 In:14 Ac:14` — or full short words `disc:15 def:17 conc:13 capx:13 indep:14 acct:14` |
| 2 | No action affordances (Apply / Discard / Edit) on the draft | P1 | Add action row per draft |
| 3 | Page is mostly empty whitespace below the single card | P2 | Add: pending drafts list (left col), action panel (right col), comparison-with-current view |
| 4 | "NOW" pill status indicator without timestamp ambiguous (vs the date already in the metadata strip) | P3 | Either clarify (`pending now`) or remove redundancy |
| 5 | Compact mono dimension layout itself is Bloomberg-grade — institutional. Keep the form, fix the disambiguation | ✓ | — |

### 2.9 `/memos`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Spec §5.7 says memos are v1.1 ("Out of scope for v1 launch") — page exists with 2 cards. Either spec is outdated or implementation chose to land a stub. Note as state/spec delta | P2 (deferred decision) | Either close spec §5.7 OOS note or scope-back |
| 2 | Cards lack detail-link affordance (`Read more →`) | P2 | Add detail navigation |
| 3 | No filter by type, no search within memos | P3 | Add filter chips + search |
| 4 | Mono date + model attribution strip on each card — institutional ✓ | ✓ | — |
| 5 | Right rail empty placeholder | P1 | If no rail planned, hide; if planned, implement |

### 2.10 `/decisions`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | "6 unseen" highlighted in red in the meta strip — strong unread indicator. Matches sidebar badge ✓ | ✓ | — |
| 2 | Strongest non-`/regime` non-`/settings` surface in the build. Event log + BY KIND inventory + acknowledge affordance reads like an institutional alert console | ✓ | — |
| 3 | Tag chips and detail-buttons inside event cards use mixed treatment (some outlined, some solid) | P3 | Consolidate to one chip style + one button style per spec §4.5 |
| 4 | No bulk-acknowledge / "mark all read" | P3 | Add |
| 5 | BY KIND counts not clickable to filter the log | P3 | Wire as filter affordance |
| 6 | Right rail empty placeholder | P1 | Move BY KIND panel from main canvas into the rail to free main for the event log; or implement a separate rail (Activity / Threshold legend) |

### 2.11 `/backtest`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | Topbar breadcrumb shows "Dashboard" — wrong context | P1 | Fix breadcrumb to "Backtest" |
| 2 | Spec §13 lists backtest as v1.1. Page exists with 2 fixture runs. Note as state/spec delta | P2 | Either close spec §13 OOS note or scope-back |
| 3 | HIT RATE "+61.1%" and AVG TURNOVER "+24.0%" / "+31.0%" use leading `+` — these are rates, not deltas. The `+` reads as "vs benchmark" or "improvement," which is misleading | P2 | Strip leading `+` from non-delta metrics |
| 4 | Sparkline overlaps numerics row visually — cramped | P3 | Increase vertical spacing or move sparkline to its own row |
| 5 | N=15, 100PS notation institutional; could expand on hover | P3 | Add hover tooltip |
| 6 | Card pattern (date / window / N / position-sizing / strategy-label + 6-KPI grid + equity curve) — strong institutional format | ✓ | — |
| 7 | Right rail empty placeholder | P1 | Run-detail context (factor attribution, drawdown periods) — or hide if no spec |

### 2.12 `/settings`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | **Best page in the build for /lambo standards.** Operator view, pipeline freshness table, cron registry with literal cron expressions + cadence translation, institutional honesty in every block | ✓✓ | — |
| 2 | ACCOUNT block: "Not signed in (fixture mode). RLS gates all writes; reads fall back to fixtures when env is unset." — operational honesty that a CRE PE analyst would respect | ✓ | — |
| 3 | Cron registry explainer: "Mirrors supabase/migrations/*.cron.sql ... keep in sync with migrations." Self-documenting why the table exists. /lambo-aligned | ✓ | — |
| 4 | Pipeline freshness STATUS column all "—" in fixture; once live, this is where amber/red status pills propagate | P3 | Plan for live coloring |
| 5 | No "Run now" manual trigger affordances per row in cron registry | P3 (post-cutover) | Add per-job manual trigger affordance gated to authenticated operators |
| 6 | Right rail empty placeholder — spec §6 explicitly lists `/settings` as no-rail. Either show the rail toggled to hidden by default (preserve consistency) or hide the rail entirely | P2 | Hide rail entirely on `/settings` per spec |

### 2.13 `/login`

| # | Finding | Sev | Fix |
|---|---|---|---|
| 1 | "Send magic link" primary button renders teal (`--accent`) — wrong color per spec §2.1 | P0 | Token swap |
| 2 | Card composition (centered, hairline border, no shadow, mono header "AI THESIS" + sans "Sign in" + magic-link copy + email input + primary CTA + dashed warning box for env-not-configured) — restrained, institutional | ✓ | — |
| 3 | Magic-link copy: "Magic-link sign-in via Supabase. Submit your email; we'll send a link that signs you in for ~1 hour." Honest, concrete, no marketing fluff | ✓ | — |
| 4 | Env-not-configured warning is dashed-border box with copy "Supabase env not configured. Set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local; the app renders against fixtures without auth." Institutional. /lambo-aligned | ✓ | — |
| 5 | Card vertical center on a blank canvas — minimum-affordance login surface, restrained. ✓ | ✓ | — |

---

## 3 · Cross-cutting findings

### 3.1 Right rail is empty on 7 of 13 routes

Every screen except `/universe` (filter rail), `/universe/[ticker]` (wrong rail), `/portfolio` (rail content in main), and `/regime` (no rail content despite having gauge data) shows the same placeholder copy: `"Page-level rail content lands here as each surface ships. ⌘\ toggles."`

This is the single most visible "unfinished" tell in the build. 280px × ~800px of dead space on every page reads as "we ran out of time," not "deliberate restraint." Per /lambo: "decorative ghosts ... if you ghost something, ghost the *structure* with enough fidelity that it reads as 'this is where X lives,' not 'this is unfinished.'"

**Fix**: implement the 6 spec §6 rail contents in a single PR. For pages with no spec'd rail (`/aiq` list, `/aiq-drafts`, `/memos`, `/decisions`, `/backtest`), either invent the rail or hide it by default (preserving the ⌘\ toggle for symmetry).

### 3.2 Topbar over-articulates

Spec §3.2 topbar: brand cluster → breadcrumb (sub-pages only) → spacer → search → right cluster (alerts, help, panel-toggle, avatar).

Actual topbar adds a page-title slot ("≡ Dashboard" on `/`, "≡ Portfolio / Book" on `/portfolio`, etc.) that duplicates the canvas H1. The leading hamburger-glyph icon isn't in spec — appears to be a sidebar-collapse toggle. If kept, move to the brand cluster left of the wordmark, not adjacent to the breadcrumb.

`/backtest` shows breadcrumb "Dashboard" — bug.

### 3.3 Hero numbers are undersized everywhere except `/regime`

Per spec §1.7: "the score is the protagonist." Per /lambo: "the most important number on the screen should get at least 60% empty space around it."

`/regime`'s "0.95×" hits the bar — large amber hero, surrounding breathing room, derivation prose beneath. **This is the template.**

`/universe/[ticker]` has the inverse: Composite 87.0 is the most important number on the entire surface but is rendered as a small mono chip in the top-right corner.

`/portfolio` (when populated) needs the Portfolio Value as the hero — currently the slot exists but the page renders empty.

`/dashboard` has no hero number — spec wants Portfolio Value as the lead per §5.1.

**Fix**: establish a "Hero Number Pattern" — JetBrains Mono 48–64px, `--text-1`, with derivation chain (mono 13px `--text-3`) immediately beneath and ≥60% canvas breathing around. Apply to every page's protagonist number.

### 3.4 Derivation chain is implicit where it should be explicit

Spec §1.7 says the score is protagonist; spec §5.3 hints at derivation (`Composite 82.2 ↑ +3.1 (7d) · Macro mult 0.95× → 78.1 effective`). Per /lambo: "Every computed number has a source attribution nearby ... 'turnover-engine · T-1 annualized' reads like the system is showing its work."

`/regime` does this well: NAAIM card meta says "11 crossings in last 52w · last 2026-05-14". `/settings` does it with the source `TABLE.COLUMN` per pipeline-freshness row.

`/universe` Composite column has no derivation visible. `/universe/[ticker]` Composite has no delta, no macro-applied chain. Hover would help; an inline chain helps more.

**Fix**: standardize a `Derivation Ladder` micro-pattern (this is signature-pattern #2 — see §4).

### 3.5 Tier badge color is the canary

Across multiple pages, the HIGH tier badge does not render as Cypher Indigo. The current visual identity says "HIGH = warning state" rather than "HIGH = ours / conviction." Post-token-swap, audit the `TierBadge` component for correct token binding.

### 3.6 What works cross-cutting

- Hairline composition discipline — no boxes-in-boxes
- Mono numerics with right-alignment in tables
- Sans/mono split per data type ✓ matches spec §1.4
- No shadows, no glassmorphism, no `rounded-2xl`, no rainbow charts ✓
- Honest deferred-feature placeholders with ticket attribution ("THS-66 INSIDER FORM 4 ... lands here once Form 4 ingestion ships")
- Sidebar pattern + breadcrumb + section composition all lift cleanly from Reticle
- Zero console errors / warnings across 13 routes (technical baseline is clean)

---

## 4 · Signature-pattern audit

### 4.1 What exists today

| Candidate | Surface | Status |
|---|---|---|
| Curve / Multiplier Ladder | `/regime` (0/1/2/3 GATES → 1.00 / 0.95 / 0.90 / 0.85) | **Strong** — name it, propagate |
| Pipeline Freshness Table | `/settings` (+ duplicate on `/dashboard`) | Useful as ops-only; should NOT propagate |
| Deferred-feature Ghost | `/universe/[ticker]` bottom (INSIDER FORM 4 / RECENT NEWS / SENTIMENT TIMELINE) | Correct pattern for v1 — name it, document for future use |
| Compact Mono Dimension Strip | `/aiq-drafts` (`D:15 D:17 C:13 C:13 I:14 A:14`) | Bloomberg-grade but ambiguous; refine |

Nothing else propagates. The product reads as 13 coherent screens, not as "the AI Thesis way."

### 4.2 Recommended signature patterns (3 per /lambo target)

#### Pattern #1 — Derivation Hero

The protagonist number per page rendered at 48–64px JetBrains Mono with the derivation chain in 13px mono `--text-3` immediately beneath, ≥60% breathing room around.

```
              82.6
              ───────────────────────────────
              Raw 87.0 · ×0.95 macro · = 82.6 effective
              ↑ +3.1 (7d) · scored 2026-05-09
```

Propagates to:
- `/` → Portfolio Value as hero
- `/universe/[ticker]` → Composite as hero (current critical fix)
- `/portfolio` → Portfolio Value as hero (when populated)
- `/regime` → already does this with the 0.95× multiplier — confirms the pattern
- `/aiq/[ticker]` → TOTAL / 100 as hero with rubric derivation

Why it earns the slot: the score is the protagonist (spec §1.7). The protagonist deserves its stage.

#### Pattern #2 — Derivation Ladder

For any computed number, an inline source attribution + delta + period strip in 11px Geist `--text-3` immediately beneath the number. Standardized order: `source · period · attribution`.

```
82.2 ↑ +3.1 (7d)
turnover-engine · weekly · scored 2026-05-09 · v3.2
```

Propagates to:
- Every table cell that shows a computed number (Composite, factor scores, AIQ totals)
- Every KPI card hero
- Every chart's "today" marker
- Every cron-job entry in `/settings`

Why it earns the slot: per /lambo "math reconciles end-to-end" and "every computed number has a source attribution nearby." Bloomberg's posture, applied universally.

#### Pattern #3 — Multiplier Ladder

The stepped state-machine visualization from `/regime` (0/1/2/3 GATES with multiplier values, active step highlighted in accent). Propagates anywhere the system has a discrete stepped state.

```
0 GATES   1 GATE   2 GATES   3 GATES
 1.00      0.95     0.90      0.85
           ╱╲ active
```

Propagates to:
- `/regime` (already)
- `/portfolio` → concentration ladder (e.g., L1 weight tiers: <25% / 25–30% / 30–35% / >35% with concentration-cap state)
- `/universe/[ticker]` → tier transition ladder (Avoid / Low / Medium / High with current and next-threshold-to-cross marked)

Why it earns the slot: it shows the entire ladder so the user sees where we are AND where we could go — uniquely powerful for stepped policy systems (macro multiplier, concentration cap, tier transitions). This is a genuine /lambo invention-within-spec.

### 4.3 What NOT to propagate

- Single-purpose cards (the per-factor cards on `/universe/[ticker]` showing raw underlying metrics) — strong on that surface, but cards-as-system is generic SaaS.
- The colored-dot layer indicators on `/decisions` event cards — visual cue is fine, but it's not load-bearing enough to be a signature.
- The wave-line gauges on `/regime` (these are visual decoration; replace with spec §4.3 horizontal bars).

---

## 5 · State / spec deltas (notable, not blocking)

| Spec says | Actual is | Resolution |
|---|---|---|
| Routes: 6 v1 + 1 v1.1 (`/dashboard`, `/universe`, `/n/[ticker]`, `/portfolio`, `/regime`, `/aiq/[ticker]`; `/memos` v1.1) | 13 routes including `/memos`, `/decisions`, `/backtest`, `/aiq-drafts`, `/settings`, `/login` | Either bump spec to reflect actual scope or scope back the extras |
| Route name `/n/[ticker]` (per spec §5.3) | Actual `/universe/[ticker]` | Actual is more conventional — update spec wording |
| Universe = 70 names | Actual = 50 names | Reflect actual in spec §0 |
| Sidebar sections: COMMAND CENTER / WORKSPACE | Actual: OPERATIONS / WORKSPACE | Rename to spec |
| Filter affordances = checkboxes | Actual = chip + button | Update spec to reflect chips (better UX) |
| Tier "Avoid" badge in spec §4.1 | Verify in actual data (haven't seen one populated) | Confirm |
| Single accent indigo locked (§1.3) | 5-theme switcher in `src/lib/theme.ts` | Strip multi-theme for v1; one accent, locked |
| Backtest = v1.1 (§13) | Page exists in v1 | Confirm |

---

## 6 · Technical lens (vercel-react-best-practices + web-design-guidelines)

### What I verified

- Next.js 16.2.6, React 19, Turbopack — past my training cutoff. Heeded `web/AGENTS.md`: "This is NOT the Next.js you know." Did not write or edit Next code in this review.
- Zero console errors / warnings across 13 routes (technical baseline is clean).
- Initial page loads feel <500ms each (spec §7.5 target).
- All routes returned 200 in fixture mode (no Supabase env required for read).

### What I did NOT verify (out of scope for review-pass)

- Bundle size, hydration mismatches, RSC vs Client Component split
- Lighthouse / CWV scores
- Accessibility (contrast, focus order, semantic HTML, screen-reader narration)
- Keyboard surface per spec §7.2 (⌘K, ⌘1–7, J/K, Enter, R, Esc)

Flag for a follow-up audit pass before cutover.

---

## 7 · Recommended sequencing (if fixes are authorized in a follow-up turn)

In order, smallest scope first, each its own commit:

1. **Token swap** (~30 min, 1 file). Rewrite `globals.css:13-28` to spec §2.1 chromatic values. Verify HIGH tier badge, primary CTAs, active nav state, gate-hit ribbon. TDD: write a test that renders TierBadge with `tier="HIGH"` and asserts `getComputedStyle(...).color` resolves to `#4D5BFF`. RED → GREEN → REFACTOR.
2. **Strip multi-theme** (~15 min, 1 file). Remove `THEMES` from `src/lib/theme.ts`; keep `applyPalette` as a no-op stub or delete; remove any Settings UI surface that exposes theme switching (defer until v2).
3. **Tier-badge audit** (~30 min, 1 component + tests). Ensure tier → token map is `HIGH=accent, MEDIUM=warning, LOW=info, AVOID=danger` per spec §4.1 / §2.1.
4. **Right-rail content fan-out** (~3 hr, 6 components + page wiring). Implement spec §6 per-page rail content. Each rail is its own component, each its own TDD test (render + props snapshot).
5. **Dashboard IA realignment** (~3 hr, 1 page + 2 components). Replace top half with spec §5.1 (greeting strip, 4-col KPI row using component 4.4, score-movers table per 4.11, 3-gauge row per 4.3). Keep Tier Crossings list at bottom as additive invention.
6. **Hero Number Pattern primitive** (~2 hr, 1 component + 4 page integrations). Build `<HeroNumber value={...} derivation={...} delta={...} period={...} />`. Apply to `/`, `/universe/[ticker]`, `/portfolio`, `/regime`, `/aiq/[ticker]`.
7. **Derivation Ladder primitive** (~2 hr, 1 component + per-table integration). Build `<DerivationStrip source={...} period={...} attribution={...} version={...} />`. Apply universally beneath protagonist numbers.
8. **Multiplier Ladder primitive** (~3 hr, 1 component + 3 use-sites). Generalize the `/regime` Curve component into `<MultiplierLadder steps={[...]} active={...} />`. Apply to concentration tiers (`/portfolio`) and tier transitions (`/universe/[ticker]`).
9. **Per-page P1/P2 fixes** (varied). Tackle in priority order from §2 tables.
10. **Polish pass** (P3 items) (varied). Last.

Each step is a single-purpose commit per Terry's commit-discipline rules. TDD on every component (failing test first, watched to fail, minimal pass, refactor). Δ-from-parent typecheck gate before each commit. ship-gate subagent before each PR.

---

## 8 · Open questions for Terry

> Per local CLAUDE.md "How to ask" format. Defaults bracketed; confirm or override.

1. Token swap is P0 — execute in the next turn? **[Yes, single commit, TDD on TierBadge]**
2. Multi-theme switcher (`src/lib/theme.ts` THEMES export) is a Reticle-base artifact, not in AI Thesis spec. Strip for v1? **[Yes, strip; defer v2]**
3. State/spec deltas (memos / decisions / backtest exist as v1 routes despite spec §13 OOS list). Update spec to reflect actual scope, or scope back the routes? **[Update spec — work shipped, scope expanded]**
4. Sidebar section labels "OPERATIONS / WORKSPACE" vs spec "COMMAND CENTER / WORKSPACE". Rename to spec? **[Yes, rename to spec]**
5. The `/regime` Curve component as foundation for the Multiplier Ladder signature pattern — name it that, or propose alternate? **["Multiplier Ladder" — applies beyond regime]**
6. Right rail on `/settings`: spec says no rail; current shows empty placeholder. Hide entirely on this page? **[Hide entirely]**
7. Tier Crossings table on `/dashboard` — additive invention not in spec. Keep, remove, or move to `/decisions`? **[Keep on dashboard, but reduce row count to top 5 to free vertical real estate for the spec-mandated KPI row + gauge row above it]**

---

## 9 · One-line verdict

The build is one CSS swap, one rail fan-out, one dashboard IA fix, and three named signature patterns away from a /lambo finish. The composition is already there. The conviction is not yet visible.

---

## 10 · /linear doctrine amendment (added post-initial-pass)

After Terry stacked `/linear` (his portable design doctrine) onto the review, three calibrations and one gap.

### 10.1 P0 verification — `--chart-1` caveat does not apply here

`/linear` §6 carries a caveat: *"`--accent` resolves to surface-hover gray on AI Thesis — use `--chart-1` there for brand indigo. Audit the project's token file before assuming."* Verified against this codebase:

```bash
$ grep -rn "chart-1\|chart_1\|brand-\|--brand\|cypher" src/
(zero hits)
```

No `--chart-1`, no `--brand-*`, no alternate brand-indigo token exists in `web/src/`. `--accent` IS the brand accent token in this project — it's just bound to Plasma Cyan from the Reticle inheritance. **P0 stands as written**: rewrite `globals.css:23-28` to spec §2.1 values. The fix target is `--accent` directly.

### 10.2 What the original pass missed

**Hover / click provenance is UNVERIFIED** (this is the biggest gap in the review). `/linear` §3.3: *"every number, every label, every status — hover gives provenance, click gives detail."* My pass was static-screenshot-only. I do not know whether:

- Composite scores reveal sub-factor breakdown on hover per spec §4.2
- Tier badges hover-reveal "what changed, when, by whom" per /linear §3.3
- AIQ rubric dimensions click-expand methodology
- Macro gauges hover-reveal source attribution, formula, vintage
- Cron registry entries click-expand to surface migration file path / next-run time

The Derivation Ladder signature pattern (§4 Pattern #2) is the *static* form of this. The interactive form is /linear's hover-iceberg. **Follow-up review needed**: interaction pass with Playwright `page.hover()` + DOM inspection on every protagonist number, status, and editable element. Until that lands, the answer to /linear §7 Q2 ("does institutional depth reveal itself on peel-back?") is *unknown*, not "yes."

**Selection state on nav was inherited, not chosen.** /linear §3.7: *"selection states earn their pattern, not borrow it."* Spec §3.3 mandates a 2px×16px left-edge accent bar for active nav state — this is the Reticle pattern, lifted verbatim into the spec. Once tokens swap to indigo, ask: is the left-edge bar the right selection signal for AI Thesis's chrome, or is it a Reticle borrow that nobody re-defended? /linear lists "indigo lines, dots, or accents under tabs" as anti-pattern — left-edge bar on sidebar is technically a different surface, but the principle (earn the pattern) applies. P3 calibration: hold the left-edge bar through v1 (consistency with spec); revisit at v2 once Terry has lived with it.

**Inputs vs displays — mostly clean.** /linear §3.4: *"anything the user can change must visually announce itself as changeable."*

- `/aiq/[ticker]` editor: number inputs have `--surface-2` bg + border ✓
- `/portfolio` ADD POSITION form: inputs clearly distinct ✓
- `/decisions` event cards: "ack" / "detail" buttons mixed in with read-only metadata. Affordance differentiation is weak — `ack` and `detail` look similar to the date chip beside them. P3: bump action buttons to ghost-button variant per spec §4.17.
- `/universe` filter row: chips vs buttons mixed treatment — affordance is clear but visual language inconsistent. P3.

**The 5-theme switcher is "differentness for its own sake."** /linear §4 anti-pattern hit. `src/lib/theme.ts` ships 5 themes (Plasma Cyan / Plasma Lime / Phosphor Green / Lava / Iris Indigo). Inherited from Reticle Stage 3, has zero AI Thesis purpose, and spec §13 explicitly puts "Themes other than dark" out of scope. Already in my §7 sequence step 2 (strip multi-theme), but /linear reinforces this is doctrine-level, not just spec-deference.

### 10.3 Self-assessment correction (/linear §5.5 — subtract 5–10 points)

My §0 verdict framed this as "strong scaffold, wrong skin." Honest recalibration:

- **The composition deserves the credit it got.** Hairlines, density, mono numerics, sidebar pattern, breadcrumb chrome, deferred-feature placeholders, zero console errors — these are real and they're hard.
- **The identity framing was too gentle.** A reviewer shown a screenshot blind would not be able to identify it as AI Thesis. The brand identity is currently Reticle Stage 3 with different copy. That's a harsher truth than "wrong skin."
- **The token mistake is a "didn't read the spec" mistake, not a "made a judgment call" mistake.** The CSS file self-documents the inheritance and explicitly tells future editors "DO NOT mutate values silently — pixel parity with the standalone mockup is the contract." That contract was a Reticle-base mockup, not the AI Thesis Master Design Spec. Spec §2.1 was never the input to this CSS file. That's worse than "drift" — it's "spec was not consulted."
- **The right-rail-empty problem is more damning than P1.** Every page (7 of 13) carries the same `"Page-level rail content lands here as each surface ships. ⌘\ toggles."` placeholder. That's not "incomplete" — that's "the spec's intent for these 280px is unimplemented, with a self-narrating excuse pasted in." Re-classifying as a meta-P0 alongside tokens: ship-blocker for the /lambo bar.

Adjusted verdict: the work is structurally trustworthy and chromatically invisible. Two surfaces — tokens and rails — carry the entire identity finish. Until both land, the product looks competent without conviction.

### 10.4 /linear §7 test scorecard

Applied to the current static state:

| # | Test | Verdict |
|---|---|---|
| 1 | Calm / clean / surgical first glance | ✓ Yes |
| 2 | Institutional analytical depth on peel-back | **UNVERIFIED** — interaction pass needed |
| 3 | Every visible element justifies its existence | Mostly — right-rail placeholder copy does not |
| 4 | Inputs visually distinct from displays | ✓ Mostly yes; `/decisions` ack/detail buttons weak |
| 5 | Every number has provenance one hover/click away | **UNVERIFIED** statically; structurally no (no Derivation Ladder propagation) |
| 6 | Top of screen feels resolved, not stacked | Mostly — topbar duplicates canvas H1 in places |
| 7 | Looks like something Linear / Resend / Ramp / Apple would ship | **Composition yes. Color identity no. Signature personality no.** Net: not yet |
| 8 | Terry excited to open this every morning | Not yet. Post-token-swap + rail-content + Hero-Number pattern: probably yes |

Two unverifieds, three partials, three yeses. The interaction pass is the most leveraged next investigation — it determines whether the depth promised by /linear §3.3 is built and just invisible to a static review, or whether it isn't built at all. If the former, the verdict lifts. If the latter, signature-pattern #2 (Derivation Ladder) becomes the second meta-P0.

### 10.5 Interaction pass result — meta-P0 #3

Ran a Playwright hover audit on 14 protagonist targets across 5 routes (`/`, `/universe`, `/universe/TSM`, `/regime`, `/aiq/TSM`): Composite values, tier badges, factor cards, NAAIM value, gate-hit ribbon, multiplier, AIQ dimension labels.

**Result: zero tooltips revealed on any target.** Cursor goes to `pointer` on universe rows (clickable navigation, correct) and on AIQ score inputs. Everywhere else `auto` — no hover affordance whatsoever.

Spec §4.2 mandate: *"Hover any factor row → tooltip 240px wide shows sub-factor breakdown (e.g. Q → profitability 82, growth 76, safety 72, payout 80)."* Unimplemented.
Spec §4.10 mandate: *"Click → opens tooltip with extension years, source URL, Burry overstatement %."* Unimplemented (no depreciation flags visible at all).
/linear §3.3 mandate: *"every number, every label, every status — hover gives provenance, click gives detail."* Unimplemented.

**Reclassifying** — the build now has three meta-P0s, each ship-blocking for the /lambo bar:

1. **Tokens** (chromatic identity inherited from Reticle, not spec)
2. **Rails** (placeholder copy on 7 of 13 routes, spec §6 unimplemented)
3. **Hover/click depth** (every protagonist number is a flat read — no peel-back)

Adjusted verdict (further sharpened): the work is *structurally trustworthy, chromatically invisible, and interactively flat*. /lambo's "minimalism is the front door, density is the building" hits the front door but not the building. The Derivation Ladder primitive (signature pattern #2) is now a fundamental build with its own per-component TDD scope — not a propagation of existing infra.

Adjusts §7 sequencing: Hero Number + Derivation Ladder primitives (step 5) carry more weight than originally estimated. Each protagonist number on each surface needs its hover-tooltip wired with sub-factor breakdown sourced from the engine (Q/G/V/AIQ → 4 sub-scores each; tier badge → tier-change history; macro multiplier → gate states feeding the math). Roughly doubles step 5 estimate (4 hr → 6-8 hr) and makes it the longest single phase.

— End of /linear amendment · End of review —
