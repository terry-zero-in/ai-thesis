---
name: basis-context
description: "Pure reference context for the Basis multifamily underwriting product. Load this before or during any work that touches the Basis app, marketing site, parser, docs, data model, analytics engine, Studio scenarios, Reports, or any Basis-adjacent artifact. Use to answer 'what is Basis,' 'what does this screen do,' 'what's the Insights vs Studio split,' 'what does the scorecard measure,' 'what's the palette,' or any question about Basis's product surface, analytical model, competitive position, or design system. Does NOT tell you how to build — it tells you what exists and why. Pair with build-basis-rra for implementation or build-basis-marketing for the marketing site. Triggers: basis, basis app, rent roll analyzer, RRA, multifamily underwriting, rent roll parser, insights tab, studio, pro forma, deal scorecard, loss to lease, turnover model, lease rollover, basis reports, basis settings, basis palette, basis theme, cypher indigo, basis-linear."
user-invocable: true
argument-hint: ""
---

# Basis — Product Context

This is reference material. It describes **what Basis is**, **what each screen does**, **how the analytical model works**, **how it's positioned**, **what product principles are non-negotiable**, and **what the stable design constraints are**. It does not prescribe workflow. For build workflow use `build-basis-rra` or `build-basis-marketing`.

---

## 1. Product Overview

**What it does.** Basis is a multifamily underwriting platform. The shipping wedge is the **Rent Roll Analyzer (RRA)** — a standalone tool that parses a rent roll from any PMS (OneSite, Yardi, RealPage, MRI, Entrata, ResMan, AppFolio), normalizes it to a canonical schema with per-field confidence scoring, surfaces deal-level insights, lets the user model scenarios, and produces institutional-grade reports. The longer-term layer — **Basis UW** — is the full DCF underwriting model the RRA feeds into. The RRA is the sticky wedge; UW is the eventual full-stack product.

**Who buys it.**
- **Primary:** Acquisition analysts and underwriters at institutional shops, PE firms, and family offices who review a rent roll on every deal.
- **Secondary:** FNMA / Freddie / bridge lenders who need to validate an operator's rent roll during credit review.
- **Tertiary:** Brokers packaging deal summaries and asset managers tracking portfolio performance.

These users are financially sophisticated. They know what loss-to-lease means, what a healthy MTM concentration looks like, and how to read an occupancy summary. They evaluate products by whether the numbers tie and whether the workflow is faster than their current process — not by feature lists or marketing copy.

**Why it exists.** Every multifamily acquisition requires a rent roll analysis. The incumbent (redIQ / Radix) is 15 years old with a dated UI and no forward-looking modeling. Newer entrants (Cactus, QuickData) nail extraction but stop short of an analytical workspace. No product currently combines confidence-scored extraction, month-by-month turnover modeling, scenario comparison, and IC-memo-grade output in one environment. That's the gap Basis fills.

---

## 2. Architecture Overview

The canonical product flow, left-to-right:

```
Upload → Rent Roll → Insights → Studio → Reports
```

`Settings` sits outside the flow (account, team, mapping templates, defaults).

- **Upload** is where a rent roll enters the system.
- **Rent Roll** is where it's verified as correctly parsed.
- **Insights** is where the deal gets diagnosed as-is.
- **Studio** is where forward scenarios get modeled.
- **Reports** is where output gets packaged for the outside world.

Each step produces a durable artifact the next step consumes. A user can loop back (e.g., edit a parsed cell in Rent Roll → Insights updates automatically) but the forward flow is the normal path.

---

## 3. Screens — Purpose and Audience

### Upload
**Purpose.** File intake. Accepts Excel (.xlsx, .xls) and CSV. Drag-and-drop or file picker. Stores the raw file in Supabase Storage and triggers the parser pipeline.
**Audience.** Whoever pulls the rent roll out of the PMS — usually a junior analyst or associate.
**What's surfaced.** File name, size, upload timestamp, parse progress, detected PMS format.

### Rent Roll
**Purpose.** Verify the parse. Display every parsed field in a canonical table with confidence indicators and flag markers. Allow inline edits to correct extraction errors. This is the trust checkpoint — nothing downstream is reliable unless this screen is reconciled.
**Audience.** The underwriter. They need to see every cell, every flag, and every confidence score before they build a thesis on the numbers.
**Tabs.**
- **Units** — canonical table: Unit, Type, SqFt, Tenant, Status, Lease Start, Lease End, Market Rent, In-Place Rent, LTL, Balance. Status color-coded (Occupied / Vacant / Notice / MTM).
- **Flags** — every validation violation (date logic, rent reasonableness, occupancy inconsistencies, data completeness), grouped by severity.
- **Mapping** — the field-mapping layer. Shows which source column mapped to which canonical field, with confidence. Editable.
- **Summary** — totals and aggregates: unit count, GPR, in-place revenue, occupancy, LTL.
- **Audit Log** — every edit, every re-parse, every override, timestamped.

### Insights
**Purpose.** Diagnose the deal **as it is today**. Static analysis — **no editable assumptions**. Answers the question: what's actually happening at this property right now?
**Audience.** Underwriter building the deal thesis and forming an initial view before modeling.
**Structure.**
- **Scorecard KPI row** — top-of-page summary (occupancy, economic occupancy, LTL, WALT, MTM concentration, aggregate confidence).
- **Deal Scorecard** — five 0–100 category scores (see Section 4).
- **AI Summary** — generated narrative of the deal's condition.
- **Diagnostic modules** — Revenue Leakage, Rent Upside, Lease Rollover, Collections, Unit Risk.

### Studio (pro forma / scenario workspace)
**Purpose.** Model **what could be true**. Every input here is editable, saveable, and comparable. Users define named scenarios (e.g., "base," "downside," "value-add," "lease-up") and compare them side by side.
**Audience.** Underwriter / IC analyst producing the case for the deal.
**Tabs.**
- **Turnover** — month-by-month projection using renewal probabilities (unit-level defaults adjustable), turnover costs, and re-leasing concessions across a 12-month post-closing horizon. This is the category-defining module.
- **Mark-to-Market** — close the loss-to-lease gap over time with user-defined lift schedules.
- **Collections** — normalize delinquency and bad debt assumptions.
- **Concessions** — model burn-off or continuation of existing concession strategy.
- **Compare** — side-by-side scenario comparison.

### Reports
**Purpose.** Package the analysis for the outside world — IC memo, lender summary, broker package, shareable link. This is where the work leaves the analyst's desk.
**Audience.** Whoever receives the output: investment committee, credit desk, broker counterparty, client.
**Report types.** IC Memo, Lender Summary, Broker Summary, Deal Package. Each generated from the same underlying data but formatted for its audience.

### Settings
**Purpose.** Account, team, mapping templates (reusable column mappings for a given PMS format), scenario assumption defaults, integrations.
**Audience.** The analyst setting up the workspace or the lead defining team-wide defaults.

---

## 4. The Analytical Model

### The sacred split: Insights vs Studio

**Insights = current reality. Static. No editable assumptions.**
**Studio = future assumptions. Editable. Saveable. Comparable.**

This split is load-bearing. Insights numbers never depend on user inputs; they're deterministic functions of the parsed data. Studio numbers always depend on user inputs; they're projections. A user should never be confused about whether a number is observed or projected.

### Scenarios

A **scenario** in Studio is a named bundle of assumptions that produces a projected outcome. Assumptions span:
- Per-unit renewal probabilities (defaults: below-market units 85%, at/above-market 65%, MTM 45%/month, NTV 0%)
- Turnover cost per unit (default: $1,500–$3,500 by unit size, user-adjustable)
- Lost-rent days during turnover (default: 45 days)
- Re-leasing concession (default: 1 month free)
- Mark-to-market lift schedule
- Collections / bad debt normalization
- Concession burn-off trajectory

Scenarios are first-class objects: named, saved, diffed, exported. A typical user has at least three (base / downside / value-add) per deal.

### The Deal Scorecard

Five categories, each scored 0–100. Each category has a short explanation string naming the drivers.

| Category | What It Measures | Inputs |
|---|---|---|
| **Income Durability** | How stable is current income? | Physical occupancy, MTM concentration, WALT, notice-filed count |
| **Embedded Upside** | How much rent is left on the table? | Loss-to-lease % |
| **Lease Rollover Risk** | How concentrated is expiration? | Peak-month expiration %, rolling 90-day exposure, MTM concentration |
| **Collections Quality** | Does the property actually collect? | Delinquent unit %, delinquent balance |
| **Data Quality** | How confident is the parse? | Average confidence score, critical-flag count, missing-field count |

Scorecard lives on Insights. It never depends on Studio assumptions.

### Key metric definitions (house standard)

| Metric | Definition |
|---|---|
| Physical Occupancy | Occupied units / total units |
| Economic Occupancy | Collected rent / GPR |
| GPR | Sum of market rents × 12 |
| In-Place Revenue | Sum of in-place rents × 12 |
| Loss to Lease (LTL) | GPR − In-Place Revenue |
| LTL % | (Market − In-Place) / Market, per unit, aggregated |
| WALT | Weighted average lease term remaining (months) |
| MTM Concentration | Month-to-month units / occupied units |
| NRI | GPR − vacancy − concessions − bad debt |

### Turnover engine — why it's the differentiator

No competitor produces a **month-by-month** projected turnover schedule with per-unit renewal probability, per-unit turnover cost, and per-unit re-leasing assumptions rolled into a 12-month revenue impact. Every other tool gives an aggregate rate. Basis projects the actual monthly curve: which units roll in which month, what each one costs to turn, what the new lease rate is, and what the combined Year 1 value-add revenue impact looks like.

---

## 5. Competitive Positioning

| Competitor | Price | Strength | Weakness |
|---|---|---|---|
| **redIQ / Radix** | ~$50/mo | 15-year incumbent. Strong extraction. Broad PMS coverage. | Dated UI. No turnover modeling. No scenario engine. No confidence scoring. |
| **Cactus AI** | $175/mo | Clean UI. Source traceability (click a number, see the source cell). Template auto-population. | Shallow financial model. No DCF, no waterfall, no scenarios. |
| **Enodo** | varies | AI-driven comp identification and market rent benchmarking. | Not a rent roll analyzer. Different product. |
| **QuickData.ai** | ~$99/mo | Fast extraction. | No analysis layer. Feeds into the user's own Excel. |
| **ARGUS Enterprise** | thousands/seat | Institutional standard for office/retail. | Not multifamily-native. Poor UX. Heavy implementation. |

**Where Basis wins:**
1. **Confidence-scored extraction.** Per-field, 0–100%, 88% auto-accept threshold. No competitor shows field-level confidence.
2. **Month-by-month turnover projection.** Categorically absent from every competitor.
3. **Scenario Studio.** A full modeling workspace, not a single chart or report.
4. **Institutional-quality output.** IC-memo-grade reports, not data exports.
5. **Source traceability + confidence, combined.** Match Cactus's source-linking, then layer confidence on top of it.

---

## 6. Product Principles (non-negotiable)

### Source-linking
Every number surfaced in the UI can be traced back to its origin — the source cell, row, worksheet, or PDF page. A user should never see a number without being able to ask "where did this come from?" and get an answer. This is the foundation of trust for the buyer persona.

### Flag traceability
Every flag (critical, warning, info) has a reason code, a field-level attribution, and a human-readable explanation. Flags are never opaque. A user should be able to see why a unit was flagged and which specific field triggered it, and override it with an audit trail.

### Assumption editability
Studio assumptions are user-owned. There are sensible defaults (renewal probabilities, turnover costs, lost-rent days), but every default is visible, editable, and scoped to the scenario. No assumption is buried. The user always knows what they're agreeing to.

### Insights is static; Studio is dynamic
See Section 4. This split is sacred. Insights never contains editable assumptions; Studio always does. The two screens answer different questions and must never blur.

### Confidence is first-class
Every parsed field carries a confidence score. Scores are visible in the UI (green / yellow / red indicators), aggregated into the Data Quality scorecard category, and propagated into reports. Confidence is not hidden behind a progress bar — it's exposed.

### Numbers must tie
Parser output is verified against the source's own occupancy summary (first three occupancy categories for in-place rent; "Market + Addl." column for market rent; "# units" column for unit count — not billing totals, not row counts). The ground-truth verification methodology is codified per PMS format and is not negotiable per deal.

---

## 7. Stable Design Constraints

These are the settled-law visual constants. They don't change without an explicit theme decision.

### Palette (from `src/styles/basis-linear.css` — runtime truth)
Dark-only UI. No light mode.

| Token | Hex | Role |
|---|---|---|
| `--bl-canvas-bg` | `#0A0A0A` | App canvas |
| `--bl-surface-bg` | `#1B1D1E` | Default card / surface |
| `--bl-accent` | `#2E5BFF` | Primary accent (buttons, active states, links) |
| `--bl-accent-hover` | `#4D73FF` | Accent hover |
| `--bl-accent-secondary` | `#7B9AFF` | Secondary accent |
| `--bl-accent-text` | `#FFFFFF` | Foreground on accent |
| `--bl-scorecard-bg` | `#0A0A0A` | Scorecard card base |

Never introduce hardcoded hex in components. Use semantic Tailwind classes (`bg-bg-canvas`, `bg-bg-surface`, `text-text-primary`, `border-border-default`, etc.) or the `--bl-*` tokens directly.

### Typography
- **Inter** — body, labels, headings.
- **JetBrains Mono** — all numeric data. Right-aligned. `tabular-nums`.
- Money: `$X,XXX` with no decimals (per-unit metrics to the nearest $1).
- Percentages: two decimals (e.g., `94.12%`).
- Cap rates / yields: two decimals (e.g., `5.42%`).

### Vibe
Linear-inspired: **dark-first, flat, precise**. No drop shadows. No glows (with the narrow exception of the scorecard gradient). High information density without clutter. Zero hype language in UI copy. Every screen should feel like a professional instrument, not a dashboard.

### Iconography
Lucide React. Single stroke weight. No mixed icon libraries.

### Animation
Motion 12. Micro-interactions only (hover states, subtle transitions, tab switches). No decorative motion. No hero animations. Every animation should have a functional reason.

---

## 8. Tech Stack (for orientation)

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS v4
- **Animation:** Motion 12
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime)
- **Data:** TanStack Query + TanStack Table
- **Charts:** visx (signature charts), Nivo (specialty charts)
- **Fonts:** Inter (body), JetBrains Mono (numbers)
- **Icons:** Lucide React

App lives at `/Users/terryturner/Projects/basis-app/`. Standalone parser lives at `/Users/terryturner/Projects/basis-parser/`.
