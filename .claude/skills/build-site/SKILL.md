---
name: build-site
description: "The user wants to build a website or marketing site. This command enforces the correct skill chain. Use this skill whenever the user mentions building a website, landing page, marketing site, web app, or any from-scratch frontend project. Also use when the user is mid-build on a web project and needs to pick up where they left off, add pages, polish existing work, or prep for launch. Triggers on: build site, build website, create landing page, marketing site, new site, web project, launch page, website redesign, new page, add a page, site polish, make it responsive, prep for launch."
user-invocable: true
argument-hint: "[description or 'continue']"
---

# Website Build Orchestrator

This skill orchestrates the full lifecycle of building a website — from initial idea through polished, production-ready launch. It coordinates 15+ specialized skills so you get the right expertise at the right time without having to remember which skills to invoke.

The process has 6 phases. Each phase has a gate — you complete it before moving on. But this isn't rigid: if you're joining a project mid-build, start at whatever phase makes sense.

## Phase Detection

Before doing anything else, figure out where in the process this project is. Do BOTH:

1. **Auto-detect** by examining the project directory:
   - No project directory or empty? → **Phase 1** (Discovery)
   - Has a design spec in `docs/` or recent brainstorm? → **Phase 2** (Planning)
   - Has an implementation plan but no pages built? → **Phase 3** (Foundation)
   - Has pages/components being actively built? → **Phase 4** (Build)
   - Pages built but rough around the edges? → **Phase 5** (Harden)
   - Functionally complete, needs final QA? → **Phase 6** (Polish & Review)

2. **Confirm with the user**: Share what you found and ask where they want to start. Something like: "Looks like you have pages built but no responsive handling yet — I'd put you at Phase 5. Want to start there, or somewhere else?"

If the user says "continue" or "pick up where I left off," rely more heavily on auto-detection. If they describe what they want to build, start at Phase 1.

---

## The Hard Gate

```
NO CODE AND NO DELIVERABLES UNTIL TERRY SAYS GO.
```

Before writing ANY code, spec, plan, page, or deliverable — present to Terry:
1. What you understand the task to be
2. Your proposed approach and WHY
3. Any questions or things you're unsure about

Then **STOP AND WAIT FOR TERRY TO RESPOND.** Do not say "Let me write that now." Do not say "I'll start building." Do not proceed in the same message. End your message after presenting your understanding. Terry will review it, correct anything that's off, and tell you to proceed.

**This applies to EVERY task.** Reading files, exploring the codebase, and loading skills is fine without asking. But the moment you're about to produce output — code, specs, plans, frameworks, deliverables of any kind — you present your approach first and wait. No exceptions.

---

## IMMEDIATE — Load All Sub-Skills at Session Start

Invoke ALL of these using the Skill tool the moment this skill is invoked. Do them all now, not phase-by-phase. Terry should never have to ask for any of these — they are pre-loaded automatically:

1. `/brainstorming` — Design thinking and collaborative exploration
2. `/frontend-design` — Creative direction, anti-AI-slop, aesthetics
3. `/vercel-composition-patterns` — Component architecture
4. `/vercel-react-best-practices` — React performance patterns
5. `/motion` — Motion animation library reference
6. `/harden` — Edge cases, error handling, resilience
7. `/adapt` — Responsive design across devices
8. `/polish` — Final quality pass standards
9. `/critique` — UX evaluation and scoring
10. `/web-design-guidelines` — Compliance review standards
11. `/copywriting` — Marketing copy principles
12. `/seo-audit` — SEO optimization standards

### Additional skills — invoke only when the work specifically calls for them:
- `/writing-plans` — When a new feature needs an implementation plan
- `/theme` — When applying a visual foundation
- `/mirror [url]` — When recreating a reference component
- `/marketing-psychology` — For pricing pages, CTAs, social proof
- `/content-strategy` — When planning what content goes where
- `/product-marketing-context` — When positioning/ICP context is needed
- `/shadcn` — When using shadcn/ui components (fallback for structural UI — Aceternity takes priority for visual components)

### Aceternity UI (no skill to invoke — follow these rules):
Aceternity is the default component library for anything visual. Check Aceternity first before writing custom components or reaching for shadcn. Always adapt to project theme tokens, never use raw.

---

## Phase 1: Discovery

**Goal**: Understand what we're building, for whom, and why — then produce an approved design spec.

**Invoke**: `/brainstorming`

Brainstorming drives this entire phase. It handles:
- Understanding purpose, audience, and constraints
- Page structure and content strategy
- Visual direction and tone
- Competitive positioning
- Technical requirements
- Producing a design spec document

**Gate**: The user has approved the design spec. Do NOT proceed until this happens. Even "simple" sites go through this — unexamined assumptions waste more time than a quick brainstorm.

---

## Phase 2: Planning

**Goal**: Turn the approved spec into a step-by-step implementation plan.

**Invoke**: `/writing-plans`

The plan should cover:
- Page-by-page build order (prioritized by importance)
- Component inventory — what needs to be built, what can be reused
- Content requirements per section (what copy is needed)
- Theme/foundation setup step
- SEO requirements per page
- Responsive breakpoints strategy
- Animation strategy (hero moments, micro-interactions)
- Polish checklist for the end

**Gate**: The user has approved the plan.

---

## Phase 3: Foundation

**Goal**: Set up the visual foundation so every component built afterward inherits the design system automatically.

**Invoke**: `/theme` (if a theme is specified or available)

This phase sets ALL CSS variables, component tokens, typography, spacing, easing curves, and interaction patterns. Doing this first means you don't waste time styling individual components — the system handles it.

If no pre-built theme applies, establish the foundation manually:
- CSS custom properties for colors, spacing, typography, shadows, radii
- Base component styles
- Animation/transition defaults
- Dark mode setup (if applicable)

**Gate**: The visual foundation is in place. Test it with a simple component to verify tokens are working.

---

## Phase 4: Build

**Goal**: Build all pages and components with high design quality, proper architecture, performant code, and purposeful motion.

All skills are already loaded from session start. Apply them as the work calls for them — no additional invocations needed.

### Key principles during build:
- **One page at a time.** Build it, verify it works, move on. Don't scaffold everything then fill in.
- **Run the dev server.** After any code change, run it so the user can preview immediately.
- **No AI slop.** Distinctive fonts, intentional color, bold layout choices. Review against `/frontend-design` anti-patterns.
- **Performance from the start.** Lazy load below-fold, optimize images, avoid barrel imports, use Suspense boundaries. Don't bolt these on later.

**Gate**: All planned pages are built and functional. Content is in place (even if draft). Navigation works. No broken routes.

---

## Phase 5: Harden

**Goal**: Make the site resilient against real-world usage — edge cases, different screen sizes, error states, long content, empty states.

**Invoke (all three, in this order):**

1. `/harden` — Test and fix:
   - Text overflow (long names, titles, descriptions)
   - Empty states (no data, no results, no items)
   - Error states (network failures, API errors, 404s)
   - Loading states (skeleton screens, spinners)
   - Large datasets (pagination, virtual scrolling)
   - Input validation and sanitization
   - Accessibility (keyboard nav, screen reader, contrast)
   - `prefers-reduced-motion` support

2. `/adapt` — Responsive design:
   - Mobile layout (single column, bottom nav, thumb-friendly)
   - Tablet layout (adaptive columns, touch + pointer)
   - Desktop layout (multi-column, hover states, keyboard shortcuts)
   - Test at 320px, 768px, 1024px, 1440px, and 4K
   - Touch targets 44x44px minimum
   - No horizontal scroll on mobile

3. `/web-design-guidelines` — Compliance review:
   - Fetch latest Vercel web interface guidelines
   - Review all built pages against the rules
   - Fix violations

**Gate**: Site works on mobile, tablet, and desktop. No overflow, no missing states, no a11y violations.

---

## Phase 6: Polish & Review

**Goal**: Final quality pass. Go from "works" to "ships with pride."

**Invoke (all three, in this order):**

1. `/polish` — Meticulous detail pass:
   - Pixel-perfect alignment and spacing
   - Typography hierarchy consistency
   - Color and contrast verification
   - All interaction states (hover, focus, active, disabled, loading, error, success)
   - Micro-interaction smoothness (60fps, natural easing)
   - Content and copy consistency
   - Remove console logs, commented code, unused imports
   - No layout shift on load

2. `/critique` — UX evaluation:
   - Nielsen heuristic scoring (0-40 scale)
   - AI slop detection
   - Visual hierarchy assessment
   - Cognitive load check
   - Persona-based red flags
   - Prioritized issue list with fix recommendations

3. **Address critique findings** — Work through the priority issues from the critique. Re-run `/polish` on any sections you changed.

**Gate**: The user is happy. The critique score is solid. The site feels intentional and polished.

---

## Quick Reference

| Phase | Skills | Gate |
|-------|--------|------|
| 1. Discovery | `/brainstorming` | Approved design spec |
| 2. Planning | `/writing-plans` | Approved implementation plan |
| 3. Foundation | `/theme` | Visual tokens in place |
| 4. Build | `/frontend-design`, `/vercel-composition-patterns`, `/vercel-react-best-practices`, `/motion`, `/copywriting`, `/mirror`, `/marketing-psychology`, `/seo-audit`, `/content-strategy`, `/product-marketing-context` | All pages built and functional |
| 5. Harden | `/harden`, `/adapt`, `/web-design-guidelines` | Responsive, resilient, compliant |
| 6. Polish | `/polish`, `/critique` | Ship-ready |

## Terry Is the Source of Truth

Terry knows the product, the audience, the business, and the vision. If anything is unclear — scope, design direction, content, priorities, what's in vs out — ASK TERRY. Do not assume. Do not infer. Do not guess based on what "most websites do." A 30-second question saves hours of wrong work that has to be redone.

## What NOT to do

- Do NOT assume anything about the product, audience, or scope — ask Terry
- Do NOT start building before the brainstorm is approved — even "simple" sites
- Do NOT skip the theme/foundation step — restyling individual components later wastes enormous time
- Do NOT write marketing copy without `/copywriting` — it has specific principles that prevent generic AI copy
- Do NOT ship without running through Phase 5 and 6 — the details are what separate amateur from professional
- Do NOT forget to run the dev server after every code change — the user needs to see what's happening
