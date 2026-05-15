# Operating Instructions for Claude Code

**Read this file at the start of every session before doing any work.**

This document tells you (Claude Code) how Terry wants you to operate on the AI Thesis repo. The technical specs are in `docs/` and the design references are in `design-references/`. This file is about *posture* — how much to ask, how much to ship, when to surface things.

---

## Operating posture: autonomous by default

Terry has set this project up so you can operate **largely autonomously and just crank through tickets each session**. He has:

- Written the full algorithm spec (`docs/AI-Thesis-v2-Algorithm-and-Deployment.md`)
- Written the full design spec (`docs/AI-Thesis-v2-Master-Design-Spec.md`)
- Locked a 4-tier design source hierarchy (`DESIGN_REFERENCES.md`)
- Sequenced 33 Linear tickets in strict build order with priorities, acceptance criteria, and sub-issue chains
- Provided a working visual prototype (`prototype/`) to reference

**That means: pick up the next ticket in build order, read its scope and acceptance criteria, build it, ship it. Move to the next.** Don't stop and ask permission to start a ticket that's already on the board in priority order. Don't ask which sub-issue to do next — the parent epic lists them in order.

### What "autonomous" means specifically

- **Pick the next ticket without asking.** Build order is encoded in Linear: Epic 1 → 2 → 3 → 4 → 5 → 6, and each epic's sub-issues list their internal order at the bottom of its description. If a previous ticket is `Done`, start the next one.
- **Make architecture choices in the stack already chosen.** Next.js 15, React 19, Tailwind v4, Supabase, FMP, Polygon, Vercel. Don't re-litigate stack decisions.
- **Make small design judgment calls in line with the references.** When the Reticle/Basis Proforma hierarchy gives you a clear answer, use it. Don't ask Terry to confirm every padding choice.
- **Commit often.** After each sub-issue is meaningfully complete (passes its acceptance criteria), commit and push. Reference the THS-XX ticket in the commit message.
- **Write tests as you go.** Don't ask "do you want tests?" — the answer is yes for any function that touches money, factor math, or data ingestion.
- **Self-document.** Add docstrings and `docs/` notes for non-obvious decisions. Future sessions need them.

### When to ask Terry (and when not to)

**Do ask** when:
- A ticket's acceptance criteria are ambiguous AND the spec docs don't resolve it
- A design decision is genuinely novel — something the references don't cover (e.g., a new page type, a chart we haven't seen)
- An external decision is required: third-party service selection beyond what's specified (e.g., "Polygon vs. Tradier for options"), or a credentials prompt
- A discovered fact invalidates the plan (e.g., "FMP doesn't expose this field — should we switch providers, derive it, or skip the factor?")
- The algorithm spec and the design spec genuinely contradict each other on a non-trivial point

**Do NOT ask** when:
- The answer is clearly inferable from the specs or references
- It's a routine engineering choice (file naming, function decomposition, test framework, internal API shape)
- It's a small visual judgment call (exact spacing, hover treatment, transition timing) — pick something in line with Reticle/Basis Proforma and move on
- You're tempted to ask "should I start ticket THS-XX?" — yes, you should
- You'd be asking just to feel safe — Terry has explicitly said he expects you to operate independently

### How to ask, when you must

When you do need Terry's input, batch the questions. Don't ask one question, wait, then ask another. Look at the whole context, list everything you genuinely need, and present a short numbered list with your recommended default for each one. Terry will read it once and answer everything.

Format:

> I need three things to keep moving. My recommended defaults are in brackets.
> 1. [Q] — [recommended default]
> 2. [Q] — [recommended default]
> 3. [Q] — [recommended default]
> Confirm defaults or override.

If Terry says "go with defaults" or doesn't override, proceed.

---

## How to read the repo on session start

1. **Open this file (CLAUDE.md).** ← you are here
2. **Open `README.md`.** Stack, build sequence, top-level structure.
3. **Open `DESIGN_REFERENCES.md`** if you're doing any UI work. Tier 1-4 hierarchy is non-negotiable.
4. **Open the next Linear ticket in build order.** The MCP connector is configured. If Linear is unavailable, fall back to the build-order list in `README.md`.
5. **Skim the relevant spec section.** Don't re-read both spec docs cover-to-cover every session — find the section your current ticket references.
6. **Start building.**

---

## What "done" looks like for any ticket

Before you mark a Linear ticket Done:

1. All acceptance criteria from the ticket description are met
2. Tests pass (for engine/data work) or visual fidelity matches references (for UI work)
3. Code is committed and pushed
4. Commit message references the THS-XX ticket
5. If you made a non-obvious decision, it's documented in `docs/` or as a docstring
6. The next ticket's prerequisites are satisfied (or you've explicitly noted the gap)

Then update the Linear ticket: state → Done, add a brief comment summarizing what shipped + any deviations from the original scope. Move to the next ticket.

---

## Commit message convention

```
THS-XX <short verb-led summary>

<optional body: what shipped, why, anything notable>

Refs: docs/<spec section>, design-references/<tier>
```

Examples:

```
THS-35 add Supabase schema for universe, fundamentals, prices

Tables: universe, fundamentals_raw, prices_raw, consensus, revisions
with PK + FK constraints and RLS scoped to Terry. Migration runs idempotent.

Refs: docs/AI-Thesis-v2-Algorithm-and-Deployment.md §Part 4
```

```
THS-52 universe table with Reticle Routines layout

Sortable columns, hover row lift, sticky header, virtualized rows.
Layer/Tier/AIQ filter chips in right rail. <500ms load on 70 names.

Refs: design-references/01-base-reticle-screenshots, DESIGN_REFERENCES.md §Tier 1
```

---

## Don't do

- Don't refactor outside the scope of the current ticket. Leave a `// TODO: THS-XX refactor` note if you see something.
- Don't add libraries casually. Tailwind v4 + React 19 + the libs already in `package.json` cover 95% of what's needed. If you genuinely need a new dep, justify it in the commit message.
- Don't add abstraction speculatively. YAGNI. The next ticket will tell you what abstraction it needs.
- Don't reword Terry's spec language in UI copy. If the spec says "Composite," the UI says "Composite" — not "Total Score" or "Aggregate."
- Don't reintroduce categories/features from the v3/v4 Investment Portal HTMLs that Terry explicitly rejected (trigger workflow, pending decisions queue, memo approval as primary IA). Those HTMLs are aesthetic references, not IA references.
- Don't change the algorithm. Spec is locked. If a discovered fact breaks the algorithm, surface it — don't silently adjust weights.

---

## The one rule that overrides everything else

**Honesty before agreement.** If Terry's direction is wrong, or a ticket's acceptance criteria are unachievable as written, say so. Don't quietly work around it and hope no one notices. Surface it, propose a fix, then either proceed with his answer or with your default if he doesn't reply.

This isn't optional. Terry has a global `honesty` skill that applies to every interaction. It applies to you too.

---

## Where things live

| Need | Location |
|---|---|
| Algorithm spec | `docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Design system spec | `docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Design source hierarchy | `DESIGN_REFERENCES.md` |
| Visual reference (chrome) | `design-references/01-base-reticle-screenshots/` |
| Visual reference (canvas, primary) | `design-references/02-canvas-primary-basis-proforma/` |
| Visual reference (canvas, secondary) | `design-references/03-canvas-secondary-investment-portal/` |
| Visual reference (component mining) | `design-references/04-additional-basis-q-series/` |
| Current visual state (not locked) | `prototype/` |
| Tickets | [Linear THS team](https://linear.app/basisuw/team/THS) |
| Project hub | [AI Thesis v2 project](https://linear.app/basisuw/project/ai-thesis-v2-scoring-engine-and-portfolio-79a38aec2b49) |

---

## Start here on a fresh session

```
1. Read CLAUDE.md (this file)
2. Read README.md
3. Get the next ticket in build order from Linear
4. Read the ticket's "Sub-issues (build in order)" line
5. Start the next sub-issue in that chain
6. Build → test → commit → push → mark Done → next sub-issue
```

If you find yourself stuck or unsure for more than ~10 minutes on a single decision, batch the question per "How to ask" above and surface it. Otherwise: keep moving.
