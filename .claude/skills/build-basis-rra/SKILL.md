---
name: build-basis-rra
description: "Build and extend the Basis Rent Roll Analyzer — a multifamily underwriting product for national brokers and FNMA lenders. Use this skill for ALL Basis app work: new pages, features, analytics views, Studio scenarios, parser improvements, data model changes, UI builds, or any architectural decision. Enforces institutional quality, analytical depth, and the correct skill chain. Triggers on: basis, rent roll, RRA, multifamily, underwriting, parser, analytics, turnover, studio, insights, loss to lease, occupancy, GPR, lease rollover, concessions, collections, unit risk, scenario modeling."
user-invocable: true
argument-hint: "[feature, page, or 'continue']"
---

# Basis Rent Roll Analyzer — Build Orchestrator

This skill orchestrates all development on the Basis RRA. It combines the phased build pipeline with CRE domain methodology and enforces institutional-quality output suitable for FNMA lenders, national brokers, and institutional acquirers.

Basis is not a dashboard tool. It is a **decision engine for multifamily acquisitions**. Every page, chart, KPI, and interaction must answer a question a buyer, lender, or asset manager is actually asking. If a visualization doesn't serve a decision, it doesn't belong.

---

## Session Start

Every Basis session begins by reading these files in the project directory, in order:
1. `DOMAIN_EXPERT.md` — the "ask Terry" rule
2. `ONESITE_RULES.md` — the 7 verified domain rules
3. `PROGRESS.md` — current state and what's next
4. `HANDOFF.md` — where the last session left off
5. `docs/implementation-brief.md` — the full product architecture, page specs, data schema, build order, and MVP scope

Then identify what Terry wants to work on and proceed.

---

## The Hard Gate

```
NO CODE AND NO DELIVERABLES UNTIL TERRY SAYS GO.
```

Before writing ANY code, spec, plan, or deliverable — present to Terry:
1. What you understand the problem or goal to be
2. Your proposed approach and WHY
3. How you'll verify it works

Then **STOP AND WAIT FOR TERRY TO RESPOND.** Do not say "Let me write that now." Do not say "I'll start on this." Do not proceed in the same message. End your message after presenting your understanding. Terry will review it, correct anything that's off, and tell you to proceed. This is not a formality — Terry catches wrong assumptions in 30 seconds that would waste hours of implementation.

**This applies to EVERY task.** Reading files and exploring the codebase is fine without asking. But the moment you're about to produce output — code, specs, plans, analysis, deliverables of any kind — you present your approach first and wait. No exceptions.

**Terry is the source of truth on EVERYTHING.** The product, the CRE domain, the competitive landscape, the audience, the methodology, what's built, what's planned, what a number should be, how a calculation should work. If anything is unclear — a feature, a CRE term, how something works, what's in scope — ASK TERRY. Do not assume. Do not infer. Do not guess. A 30-second question saves hours of wrong work.

**When you're stuck:** If you've tried 2 approaches and neither works — STOP. Don't try a third without talking to Terry. Three wrong hypotheses without asking Terry is a skill violation.

---

## Three Mandates

Every task gets ALL three. The emphasis shifts depending on the work.

### Mandate 1: Deep Understanding

Understand the problem at the level where the solution becomes obvious.

**For parser/ingest work:**
- Trace the data flow for the specific file — load it, look at actual rows, see what the parser produces for specific units.
- When a number doesn't tie: find the EXACT units that cause the gap. Don't debug at the aggregate level.
- Generate 2-3 hypotheses, rank by likelihood, present to Terry before implementing.
- Before any parser change, trace through the 4 canonical scenarios (normal occupied, NTVL+Applicant, Vacant-Leased, starred NTV).

**For analytics/visualization work:**
- Inventory what data the parser actually produces — every field, every derived metric.
- Understand what each metric MEANS to an acquirer. Loss-to-lease = upside potential. Lease expiration concentration = rollover risk. Concessions = market softness signal.
- Identify what story emerges when you combine metrics.

**For modeling/scenario work:**
- Terry's budget templates are THE source of truth. Not GPT's architecture, not industry norms.
- Walk through formulas manually with real numbers before coding.
- When methodology is unclear: ASK TERRY.

**For UI/features:**
- Understand where the feature sits in the user's workflow. What did they just do? What will they do next? What decision are they trying to make?
- Read the existing code before proposing changes.
- Internalize the design language — read `index.css`, look at existing components, understand the token system.

### Mandate 2: Analytical Thinking

Don't build what was asked — build what SHOULD exist.

The rent roll dataset is extraordinarily rich: unit types, floor plans, square footages, lease terms, rent gaps, expiration schedules, occupancy patterns, turnover projections, concession triggers, charge breakdowns, MTM exposure, NTV pipeline. No competitor surfaces real INSIGHT from this data.

**Before building any visualization, chart, KPI, or analytics view:**
- What question does this answer for the buyer/lender/asset manager?
- What combination of data reveals something no one has surfaced before?
- Propose 2-3 visualization approaches with your recommendation and reasoning.
- Think about interaction: What happens on hover? Click? Assumption change?
- The best analytics aren't static — they respond to the user's curiosity.

**This mandate applies even when Terry asks for something specific.** If he says "add a bar chart of lease expirations," think about whether a bar chart is actually the best way, what additional data would make it more insightful, and what interaction model serves the decision-making. Then propose 2-3 approaches with your recommendation.

### Mandate 3: Institutional-Quality Execution

This product is shipping to FNMA lenders and national brokers. Every output must be IC-memo grade.

**Design standard: Linear**
- Dark-first, flat (no shadows/glows), precision, minimalism
- Typography: Precise weights, letter-spacing on labels, tabular-nums on data
- Color: Functional only. Green = good. Red = attention. Amber = review. No decorative color.
- Spacing: Systematic, token-based. Not eyeballed.
- Interaction: Every hover, transition, press state is designed. No default browser behavior.
- Density: Information-rich without clutter. Hierarchy (primary/secondary/tertiary) is the secret.
- Restraint: Colored dots + plain text over pills. No background badges except max 1 per view.

**Financial data formatting:**
- All numbers in JetBrains Mono, right-aligned, `font-variant-numeric: tabular-nums`
- Money: `$X,XXX` no decimals (except per-unit to nearest $1)
- Percentages: two decimal places (94.12%)
- Negative values: red, in parentheses — `($12,450)` not `-$12,450`
- Positive changes: green text — `+2.34%`
- Every chart has a purpose statement (subtitle explaining what insight it provides)
- Every KPI has a secondary line (context for the number)
- Empty states are designed, not afterthoughts

**Confidence scoring:**
- Every extracted field gets a confidence score (0-100%)
- >= 88%: auto-accepted, green
- 70-87%: flagged for review, yellow
- < 70%: required user confirmation, red
- This is THE #1 competitive differentiator. Visible, per-field, with audit trail.

---

## Skill Loading

Terry handles ALL skill loading at the start of each session. Do NOT invoke other skills from inside this skill — even if a task seems to call for one. If a skill should have been loaded and wasn't, surface it to Terry; never auto-load.

## Aceternity UI (component library guidance, not a skill)

Aceternity is the default component library for anything visual. Check Aceternity first before writing custom components or reaching for shadcn. Always adapt to Linear theme tokens, never use raw.

### Key principles during build:
- **Run the dev server** after every code change. No exceptions.
- **One page/feature at a time.** Build it, verify it works, move on.
- **Verify against ground truths.** Parser output checks against occupancy summary, not billing RENT. In-place rent = sum of first 3 occupancy categories.
- **No approximations.** Use exact formulas. Financial users will check your math.
- **Confidence is visible.** Every number traces back to a source with a confidence score.
- **Update PROGRESS.md and HANDOFF.md** at session end. No exceptions.

---

## CRE Domain Quick Reference

### Ground Truths
| Metric | Verify Against | NOT This |
|--------|---------------|----------|
| In-Place Rent | Occupancy Summary: first 3 categories, "potential rent" | Billing RENT total |
| Market Rent | Occupancy Summary: "Market + Addl." column | Individual unit sum |
| Unit Count | Occupancy Summary: "# units" column | Row count (includes sub-rows) |

### Multi-Signal Exclusion Scoring
Never exclude data based on a single signal. Build an exclusion score:
- Has `*` → +1
- Status = Applicant/Pending/Vacant → +1
- Name differs from primary tenant → +1
- Name = "VACANT" → +1
- Future lease dates → +1
- **Threshold: 2+ = exclude**

### Trans Codes
- **Include:** RENT, RENTSUB, HOUSING RENT (flag subsidy %)
- **Exclude:** PETRENT, MTM, CABLE, FACILITY, INSURE, PESTCONTROL, TRASHREIMB, AMENITY, PARKING, WATER/SEWER

---

## What NOT to Do

- Do NOT build charts without naming the decision they serve
- Do NOT approximate financial calculations — lenders will check
- Do NOT skip confidence scoring — it's the #1 differentiator
- Do NOT start coding before demonstrating understanding to Terry
- Do NOT try a third approach without asking Terry if the first two failed
- Do NOT build "more charts" when the user needs insight — think about what story the data tells
- Do NOT use decorative color — every color must have functional meaning
- Do NOT forget to update PROGRESS.md and HANDOFF.md at session end
