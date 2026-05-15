---
name: basis
description: "Get up to speed on the Basis product — what it is, who it's for, how it works, the CRE domain it operates in, and the competitive landscape. Use this skill when a Claude session needs to understand Basis before doing any work, when onboarding a new session to Basis context, or when anyone asks 'what is Basis?' Triggers on: what is basis, basis overview, basis context, onboard to basis, understand basis, basis product, basis background."
user-invocable: true
argument-hint: ""
---

# Basis — Product Knowledge & Domain Onboarding

This skill gets you up to speed on the Basis product. It is NOT a build skill — use `/build-basis-rra` for app development and `/build-basis-marketing` for the marketing site. This skill is for understanding.

---

## What Basis Is

Basis is a multifamily underwriting platform. It has two layers:

### Basis RRA (Rent Roll Analyzer) — Shipping First
The standalone rent roll parsing, analysis, and insights tool. This is the wedge product. Users upload a rent roll (Excel/CSV from any PMS — OneSite, Yardi, RealPage), and Basis:

1. **Parses and maps** every field with confidence scoring (88% threshold, per-field visibility)
2. **Surfaces insights** — revenue leakage, embedded rent upside, lease rollover risk, collections quality, unit-level risk flags
3. **Models scenarios** — turnover, mark-to-market, collections normalization, concession strategy, with side-by-side comparison
4. **Exports reports** — IC memos, lender summaries, broker deal packages, shareable links

The product flow: Upload → Rent Roll Review → Insights → Studio → Reports

### Basis UW (Underwriting Platform) — Future Vision
The full DCF underwriting model that the RRA feeds into. This is the broader platform the RRA grows into. Not in scope for current build — the RRA is the wedge that creates sticky users first.

**These are different products with different scopes and timelines.** Know which one you're talking about.

---

## Who It's For

- **Primary:** Multifamily acquisition analysts and underwriters at institutional shops, PE firms, family offices
- **Secondary:** FNMA/Freddie/bridge lenders reviewing deals
- **Tertiary:** Brokers packaging deal summaries, asset managers tracking performance

These are financially sophisticated professionals. They know what loss-to-lease means. They know what an occupancy summary should look like. They judge products by whether the numbers are right and the workflow is fast — not by feature lists.

---

## The Competitive Landscape

- **redIQ / Radix** — 15yr incumbent. Strong extraction, mediocre UI, no turnover modeling, no scenario engine. ~$50/mo.
- **Cactus AI** — Clean UI, source traceability (click any number, see where it came from). $175/mo. Shallow financial model.
- **Enodo** — AI comp identification and market rent benchmarking. Not a rent roll analyzer.
- **QuickData.ai** — Fast extraction, $99/mo. No analysis, feeds user's own Excel.
- **ARGUS Enterprise** — Legacy institutional standard for commercial (office/retail), not multifamily. Poor UX. Thousands per seat.

### Where Basis Wins
1. **Confidence-scored extraction** — 88% threshold, per-field visibility. No competitor shows you WHY they trust a number.
2. **Month-by-month turnover model** — NO competitor does this. Period.
3. **Scenario Studio** — Compare base/downside/value-add/lease-up side by side. A full modeling workspace, not a single chart.
4. **Institutional-quality output** — IC memo-grade reports, not data exports.
5. **Source traceability** — Match Cactus's best feature, then exceed it with confidence scoring on top.

---

## The Product Architecture

**Left nav:** Upload | Rent Roll | Insights | Studio | Reports | Settings

**Rent Roll tabs:** Units | Flags | Mapping | Summary | Audit Log

**Insights tabs:** Overview | Revenue Leakage | Rent Upside | Lease Rollover | Collections | Unit Risk

**Studio tabs:** Turnover | Mark-to-Market | Collections | Concessions | Compare

**The critical split:**
- **Insights = current reality.** What IS true right now. No editable assumptions. Static analysis.
- **Studio = future assumptions.** What COULD be true. Editable, saveable, comparable scenarios.

This split is sacred. Don't blur it.

---

## CRE Domain Essentials

### Key Metrics (Know These)
- **Physical Occupancy** = occupied units / total units
- **Economic Occupancy** = collected rent / GPR
- **GPR (Gross Potential Rent)** = total market rent across all units
- **In-Place Revenue** = total current scheduled rent
- **Loss to Lease (LTL)** = GPR - in-place revenue (this is embedded upside)
- **WALT** = weighted average lease term remaining
- **MTM Concentration** = month-to-month units / occupied units (rollover risk)
- **NRI (Net Rental Income)** = GPR - vacancy - concessions - bad debt

### What Each Metric Means to a Buyer
- **Loss-to-lease** = upside potential. "How much rent am I leaving on the table?"
- **Lease expiration concentration** = rollover risk. "When do my tenants leave?"
- **Concessions** = market softness signal. "Am I buying into a soft market?"
- **MTM concentration** = volatility. "How much income can walk out next month?"
- **Bad debt / delinquency** = collections quality. "Is this property actually collecting what it bills?"

### The Rent Roll Is a Point-in-Time Snapshot
It shows what's true RIGHT NOW per the PMS software. Monthly financials will never match it to the dollar. Do not try to reconcile against monthly financial statements.

### Ground Truths for Verification
| Metric | Verify Against | NOT This |
|--------|---------------|----------|
| In-Place Rent | Occupancy Summary: first 3 categories, "potential rent" | Billing RENT total |
| Market Rent | Occupancy Summary: "Market + Addl." column | Individual unit sum |
| Unit Count | Occupancy Summary: "# units" column | Row count (includes sub-rows) |

### Parser Methodology
- **Multi-signal exclusion scoring** — Never exclude data based on a single signal. Stars (+1), applicant status (+1), name mismatch (+1), "VACANT" name (+1), future dates (+1). Threshold: 2+ = exclude.
- **Trans codes** — Include: RENT, RENTSUB, HOUSING RENT. Exclude: PETRENT, MTM, CABLE, FACILITY, INSURE, etc.
- **Confidence scoring** — Every field gets 0-100%. >=88% auto-accepted. 70-87% flagged for review. <70% requires user confirmation.

---

## Tech Stack
- React 19 + TypeScript + Vite + Tailwind CSS v4
- Motion 12 for animations
- Supabase (Postgres, auth, storage)
- Geist Sans (body) + JetBrains Mono (data/numbers)
- Lucide React icons
- TanStack Query + TanStack Table
- visx for signature charts, Nivo for specialty charts
- Linear theme (dark-first, flat, precise)

---

## Key Files to Read for Full Context

All in `/Users/terryturner/Projects/basis-app/`:
- `docs/implementation-brief.md` — Full product architecture, every page/tab spec, data schema, build order
- `CLAUDE.md` — Build prompt, field mapping tables, validation rules, scope boundaries
- `DOMAIN_EXPERT.md` — The "ask Terry" rule
- `ONESITE_RULES.md` — 7 verified domain rules for rent roll parsing
- `PROGRESS.md` — Current state of what's built vs planned
- `HANDOFF.md` — Where the last session left off

---

## Terry Is the Source of Truth

Terry is a commercial real estate professional who built this product. He understands underwriting, rent roll analysis, and the competitive landscape deeply. If anything is unclear — a CRE term, how a calculation works, what a metric should include, what's in scope, what the product should do — ASK TERRY. Do not assume. Do not infer. Do not guess. A 30-second question saves hours of wrong work.
