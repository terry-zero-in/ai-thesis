# Design References — Source-of-Truth Hierarchy

**Read this in full before changing any UI in AI Thesis.**

Terry has explicitly ranked design influences. Higher tier wins on conflict. Treat this as a contract.

---

## Tier 1 — BASE (skeleton of the app)

**Visual reference:** `design-references/01-base-reticle-screenshots/` (10 JPGs)
**Source code (the actual base file to develop in):** `/Users/terryturner/Hub/reticle-optimizeclaude/` — on Terry's local Mac. NOT in this repo. Remote Claude Code sessions cannot read his local filesystem; before any Epic 4 work, Terry must copy Reticle into this repo, push it to GitHub, or paste files. See `CLAUDE.md` → "Reticle base file — frontend foundation" for the full handoff.
**Status:** Source of truth for app chrome. Sidebar + right rail + top bar + Delegations/Reviews tab patterns carry over verbatim from Reticle; only re-skin for Basis-specific content.

The Reticle reference establishes:

- **Left sidebar (220px)** — `Command Center` and `Workspace` sections with 11px uppercase tracked-out gray labels, 13px Geist nav items, left-edge 2px indigo active indicator, mono badge for counts, hover lifts to `--surface`. Avatar block at the bottom. **Use this exact pattern across every page.**
- **Right rail (280px, contextual)** — header pattern `[ICON] CONTEXT LABEL` in 11px uppercase. Rail content changes per page (filters, activity, reserve, history). Dismissable via topbar panel-toggle. **Preserve across the entire app.**
- **Top bar (48px)** — brand cluster → breadcrumb (e.g. `Routines / Detail`) → spacer → search w/ ⌘K hint → icon cluster (alerts/help/panel/avatar). Sticky, `--bg` background, 1px `--border-subtle` bottom border.
- **Detail-page header pattern** — breadcrumb at top, then small-caps metadata strip (ID · model · cadence · trigger), then large title, then status meta line (`runs 5 · last 1h 15m · disabled`).
- **Tab strip** — Prompt | Runs (5) | Chat | Configuration pattern. Active tab is filled pill `--surface-2` with `--text-1`. Inactive tabs are plain `--text-2`. Use this for the per-name detail page sub-views.
- **Tag chips** — small (10px Geist 500 uppercase, 0.05em tracking, 3px radius, `--surface-2` bg, `--text-2` color). Active variant uses `--accent-soft` / `--accent`.
- **Tooltip on hover** — small dark sans, e.g. "Open routine detail". Use this idiom throughout.
- **Bottom-right "N" notification badge** — keep as the notifications affordance.
- **Motion** — calm, functional. Tab switches and rail toggles 120-200ms ease. No bounces.
- **Column header treatment** — 11px Geist 500 uppercase, 0.06em tracking, `--text-3` color. Every table uses this header style.

**Direct copies from Reticle screenshots:** the **Routines list page** and **Delegations list page** are essentially production-ready for the AI Thesis equivalents (e.g., Universe table on Routines pattern; Decisions log on Delegations pattern). Re-skin column headers and content, keep the structure, density, and interactions intact.

---

## Tier 2 — PRIMARY CANVAS (the middle column on most pages)

**File:** `design-references/02-canvas-primary-basis-proforma/Basis-Proforma-Overview-v3.4-1.html`
**Status:** Primary aesthetic reference for the canvas area inside the chrome.

What to take from this file:

- **Minimalist data density without boxing** — values laid out in a clean grid using hairline separators rather than cards/borders/shadows. Replicate this exact discipline on /dashboard, /portfolio, /n/[ticker], /regime.
- **KPI rows** — large mono numerics with small uppercase labels above, deltas inline. **No card chrome** between KPI columns — use 1px vertical `--border-subtle` dividers only.
- **Section composition** — section title in 17px Geist 500, then horizontal hairline, then content. Sections separated by 20px vertical space + hairline. No section "cards."
- **Tables** — same row height, mono numerics with tabular figures, success/danger color on deltas without arrow glyphs at table scale.
- **Inline annotations** — small uppercase labels next to numbers, footnote-style citations for figures. Keep this restraint.

When the algorithm spec (`docs/AI-Thesis-v2-Master-Design-Spec.md`) and this file conflict on canvas styling, **this file wins** for visual density.

---

## Tier 3 — SECONDARY CANVAS (supplementary aesthetic)

**Files:**
- `design-references/03-canvas-secondary-investment-portal/Investment-Portal-Dashboard-v2-2.html`
- `design-references/03-canvas-secondary-investment-portal/Investment-Portal-Mockup-v4-3.html`

**Status:** Mine for specific component ideas only; do not adopt wholesale.

Useful elements:

- **Macro gauge tile pattern** (NAAIM / AAII / F&G) — copy the gauge bar with threshold tick, current marker, and "GATE HIT" ribbon.
- **KPI cards with sparklines** — value, delta, mini-sparkline pattern. Use this on /portfolio.
- **Proximity bars** — horizontal bars showing distance-to-threshold; useful for "approaching 35% layer cap" type signals.
- **Bull/bear pressure visualization** — small dual-bar idiom; useful on /n/[ticker] if you want a sentiment row.
- **Color discipline** — same desaturated semantic palette this project uses.

**Do not adopt** from these files: the trigger/memo workflow IA, the pending-decisions list structure (we don't have that workflow), or any feature/category labels.

---

## Tier 4 — ADDITIONAL MINING (component & state ideas)

**Files:** `design-references/04-additional-basis-q-series/` (Q1-Q39 HTMLs + screenshot)

**Status:** Idea pool for cross-cutting UX concerns. Not authoritative — visual style across these may not match Tier 1/2.

Useful files by topic:

| File | Borrow for |
|---|---|
| `Q1-Q4__Cross-cutting__Empty-states-Loading-Errors-Tooltips-5.html` | Empty state, skeleton loader, error inline, tooltip patterns |
| `Q5-Q8__Cross-cutting__Tooltip-Annotation-Drilldown-FilterPersist-6.html` | Tooltip annotation overlays, drilldown affordances, filter persistence |
| `Q9-Q12__Cross-cutting__SavedViews-KPIenrichment-AInarrative-DensityToggle-7.html` | Saved views, KPI enrichment expansion, AI-narrative inline, density toggle |
| `Q13-Q16__Insights__Scorecard-RecActions-AISummary-Waterfall-8.html` | Scorecard layout, recommendation actions, AI summary, waterfall chart |
| `Q17__POLICY__Drill-Mechanic-Cross-Surface-9.html` + `Q17-drill-policy-mockup-10.html` | Drill-down mechanic across surfaces |
| `Q18-Q19__Insights-RentUpside__BoxPlot-RentPSF-11.html` | Box plot styling (could apply to factor distributions) |
| `Q20-Q21__Insights-LeaseRollover_*.html` | Matrix visualizations (could apply to layer × factor heatmaps) |
| `Q22-Q24__Insights-Collections__Charts-LOCKED-S59-14.html` | Chart treatments (could apply to score-history charts) |
| `Q25-Q28__Insights-UnitRisk-and-Studio-Turnover-LOCKED-S60-S61-S64-15.html` | Risk visualization (could apply to concentration tax displays) |
| `Q33-Q34__Studio-Compare__LOCKED-S66-4ca0b24-16.html` | Compare view (could apply to side-by-side ticker comparison) |
| `Q35-Q39__Studio-Cross-Tab__VERBAL-LOCKS-S67-17.html` | Cross-tab analysis (could apply to layer-factor matrix) |
| `CleanShot-2026-05-15-at-11.24.43-2x-4.jpg` | Screenshot for additional visual cues |

When mining from this tier, **adapt the pattern to Tier 1/2 visual style**. Do not import their exact colors, type, or chrome.

---

## Conflict resolution

When two references suggest different visual choices for the same element:

1. **Tier 1 wins for chrome** (sidebar, right rail, top bar, breadcrumbs, tabs, tags, tooltips)
2. **Tier 2 wins for canvas content** (KPI rows, tables, section composition, density)
3. **Tier 3 wins only for the specific components called out** (macro gauges, sparkline KPI cards, proximity bars)
4. **Tier 4 is suggestion only** — adapt to Tier 1/2 style

When the prototype in `prototype/` conflicts with the references: **the references win.** The prototype is a snapshot of the working visual state as of May 15 2026, not the locked spec.

When the master design spec (`docs/AI-Thesis-v2-Master-Design-Spec.md`) conflicts with the references: the master spec defines tokens, components, and IA. The references define **visual fidelity** of how those tokens render. Tokens lose to references on density and stripping of chrome; references lose to tokens on color, type family, and spacing scale.

---

## What "done" looks like for a UI ticket

When Epic 4 sub-issues (THS-51 through THS-57) are implemented, the result should be indistinguishable in visual character from a side-by-side of:

- The Reticle screenshots (chrome)
- The Basis Proforma v3.4 HTML (canvas density)

If a stranger looked at AI Thesis next to those references, they should see the same designer's hand. That is the bar.
