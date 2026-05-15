---
name: build-basis-marketing
description: "Build the marketing site for Basis, the multifamily rent roll analyzer. Use this skill when working on the Basis marketing site, landing pages, product pages, pricing pages, or any customer-facing web presence for Basis. Combines full website build orchestration with deep Basis product knowledge so marketing copy is accurate, compelling, and differentiated. Triggers on: basis marketing, basis site, basis landing page, basis website, basis pricing page, basis product page."
user-invocable: true
argument-hint: "[page, section, or 'continue']"
---

# Basis Marketing Site — Build Orchestrator

This skill builds the marketing site for Basis, a multifamily rent roll analysis and underwriting platform shipping to FNMA lenders, national brokers, and institutional acquirers.

The Claude session running this skill must deeply understand what Basis does, who it's for, and why it wins — because every headline, feature description, and CTA must reflect the real product with precision. No generic SaaS marketing. This is a financial tool for professionals who will see through fluff instantly.

---

## Session Start

### IMMEDIATE — Read the PRODUCT BIBLE (DO THIS FIRST, DO NOT SKIP)

**Read this file FIRST, cover to cover:**

**`/Users/terryturner/Projects/basis-app/docs/PRODUCT_BIBLE.md`**

This is the single source of truth for the entire marketing site. It contains:
- **Part 1:** What Basis is (RRA vs UW, elevator pitch, founder story)
- **Part 2:** The pain story — why rent rolls are a nightmare, with hard numbers (8-12 hours manual, 48 hours per deal, 1-4 weeks per property)
- **Part 3:** 5 competitive advantages, why competitors can't match, the actual moat ranked, 18-24 month window, why RealPage/Yardi won't build this
- **Part 4:** Locked 3-tier pricing (Free $0 / Pro $149 / Team $399 / Enterprise custom) with full rationale
- **Part 5:** Target audience (primary: MF acquisition analysts, secondary: lenders, tertiary: brokers)
- **Part 6:** 10 copy rules (NON-NEGOTIABLE — Linear style, no competitor naming, no generic SaaS language, let product speak for itself)
- **Part 7:** COMPLETE marketing site blueprint — 14 homepage sections with exact layout patterns, content, and screenshot placement. Plus 5 feature pages, pricing page, about page. ~45 total sections mapped.
- **Part 8:** Technical build specs (React 19 + Vite + Tailwind v4 + Aceternity UI)
- **Part 9:** Where every reference file and screenshot lives (organized by site: resend/, linear/, trigger-dev/, basis-app-screenshots/)
- **Part 10:** All key decisions answered (domain: basisuw.com, CTA: "Get Started", color palette, etc.)

After reading the PRODUCT_BIBLE, you should be able to answer ALL of these cold:
- What happens when a user uploads a rent roll? (parsing → field mapping → confidence scoring → warnings → review)
- What is the Insights vs Studio split? (truth vs assumptions)
- What are the 6 Insights tabs and what question does each answer?
- What makes Basis different from every competitor? (confidence scoring, turnover model, scenario studio, institutional reports)
- What does loss-to-lease mean and why does a buyer care?
- What is the month-by-month turnover model and why does no competitor have one?
- What's the pricing model and why hybrid?
- What's the copy style? (Linear — pictures tell the story, title + 1-2 sentences, no selling)
- What's the aesthetic? (Resend — dark, premium, massive negative space)
- What layout patterns to use? (7 page structure, 14 homepage sections, specific ACE components)

If you can't answer all of these, re-read the PRODUCT_BIBLE. It's all in there.

### SECONDARY READING (only if you need deeper detail)

These files provide additional depth beyond the PRODUCT_BIBLE:

1. **`/Projects/basis-app/docs/implementation-brief.md`** — Full product architecture (every page, tab, chart, table)
2. **`/Projects/basis-app/CLAUDE.md`** — Tech stack, field mapping tables, validation rules
3. **`/Projects/basis-app/PROGRESS.md`** — What's built today vs planned
4. **`/Projects/basis-app/DOMAIN_EXPERT.md`** — Ask Terry when CRE methodology is unclear
5. **`_Basis App/Perplexity/Basis Platform — Exhaustive Build Spec & Market Intelligence Report.md`** — Deep competitor analysis with real pricing
6. **`_Basis App/Perplexity/RENT_ROLL_REVIEW_ANALYSIS.md`** — The pain story with sourced statistics

### REFERENCE SCREENSHOTS (organized by site)
```
/Projects/basis-app/docs/marketing-site-ref/
├── resend/              — 25 screenshots (AESTHETIC reference — dark, premium, cards, layouts)
├── linear/              — 25 screenshots (CONTENT/STYLE reference — concise copy, expandable cards)
├── trigger-dev/         — 8 screenshots (LAYOUT reference — tabbed sections, feature grids)
├── basis-app-screenshots/ — 12 screenshots (THE PRODUCT — these go ON the marketing site)
└── pricing-analysis/    — pricing research report
```

**Terry is the source of truth on EVERYTHING.** If anything is unclear — a feature description, a CRE term, how something works, what's in scope vs out of scope — ASK TERRY. Do not guess based on what "most SaaS products do." Basis is not most SaaS products.

## The Hard Gate

```
NO CODE AND NO DELIVERABLES UNTIL TERRY SAYS GO.
```

Before writing ANY code, page, copy, framework, or deliverable — present to Terry:
1. What you understand the task to be
2. Your proposed approach and WHY
3. Any questions or things you're unsure about

Then **STOP AND WAIT FOR TERRY TO RESPOND.** Do not proceed in the same message. End your message after presenting your understanding. Terry will review it, correct anything that's off, and tell you to proceed.

**This applies to EVERY task.** Reading files and studying reference sites is fine without asking. But the moment you're about to produce output — code, specs, plans, copy, deliverables of any kind — present your approach first and wait.

### IMMEDIATE — Invoke ALL sub-skills at session start:

Invoke every one of these using the Skill tool. Do them all now, not later. Terry should never have to ask for any of these:

1. `/brainstorming` — Design thinking and collaborative exploration
2. `/frontend-design` — Creative direction, anti-AI-slop, aesthetics
3. `/copywriting` — Marketing copy principles, voice/tone, headline formulas
4. `/marketing-psychology` — Persuasion patterns, social proof, cognitive bias
5. `/seo-audit` — SEO optimization standards
6. `/content-strategy` — What content goes where and why
7. `/product-marketing-context` — Positioning, ICP, competitive differentiation
8. `/vercel-composition-patterns` — Component architecture
9. `/vercel-react-best-practices` — React performance patterns
10. `/motion` — Motion animation library reference
11. `/harden` — Edge cases, error handling, resilience
12. `/adapt` — Responsive design across devices
13. `/polish` — Final quality pass standards
14. `/critique` — UX evaluation and scoring
15. `/web-design-guidelines` — Compliance review standards

### Additional skills — invoke when the work calls for them:
- `/writing-plans` — When a new page needs an implementation plan
- `/mirror [url]` — When recreating a reference component
- `/marketing-ideas` — When brainstorming marketing angles or growth strategies
- `/pricing-strategy` — When building the pricing page
- `/shadcn` — When using shadcn/ui components (fallback — Aceternity takes priority for visual components)

### Aceternity UI (no skill to invoke — follow these rules):
Aceternity is the default component library for anything visual. Check Aceternity first before writing custom components or reaching for shadcn. Always adapt to project theme tokens, never use raw.

---

## What You're Marketing

### The Product
Basis is a rent roll analysis and underwriting platform for multifamily acquisitions. Users upload a rent roll (Excel/CSV from any PMS — OneSite, Yardi, RealPage), and Basis:

1. **Parses and maps** every field with confidence scoring (88% threshold, per-field visibility)
2. **Surfaces insights** — revenue leakage, embedded rent upside, lease rollover risk, collections quality, unit-level risk flags
3. **Models scenarios** — turnover, mark-to-market, collections normalization, concession strategy, with side-by-side comparison
4. **Exports reports** — IC memos, lender summaries, broker deal packages, shareable links

### The Audience
- **Primary:** Multifamily acquisition analysts and underwriters at institutional shops, PE firms, family offices
- **Secondary:** FNMA/Freddie/bridge lenders reviewing deals
- **Tertiary:** Brokers packaging deal summaries, asset managers tracking performance

These are financially sophisticated professionals. They know what loss-to-lease means. They know what an occupancy summary should look like. They will judge the product by whether the numbers are right and the workflow is fast — not by how many features are listed.

### The Competitive Landscape
- **redIQ / Radix** — 15yr incumbent. Strong extraction, mediocre UI, no turnover modeling, no scenario engine. ~$50/mo.
- **Cactus AI** — Clean UI, source traceability. $175/mo. Shallow financial model.
- **Enodo** — AI comp identification and market rent benchmarking. Not a rent roll analyzer.
- **QuickData.ai** — Fast extraction, $99/mo. No analysis, feeds user's own Excel.
- **ARGUS Enterprise** — Legacy institutional standard for commercial, not multifamily. Poor UX. Thousands per seat.

### Basis Wins On
1. **Confidence-scored extraction** — 88% threshold, per-field visibility. No competitor shows you WHY they trust a number.
2. **Month-by-month turnover model** — NO competitor does this. Period.
3. **Scenario Studio** — Compare base/downside/value-add/lease-up side by side. Not a single chart — a full modeling workspace.
4. **Institutional-quality output** — IC memo-grade reports, not data exports.
5. **Source traceability** — Match Cactus's best feature, then exceed it with confidence scoring on top.

### Copy Rules
- **NEVER name competitors** in customer-facing content. Position Basis on its own strengths.
- **No generic SaaS language.** "Streamline your workflow" means nothing to an underwriter. Speak to specific pain: "Stop rebuilding the same rent roll analysis in Excel for every deal."
- **Use CRE terminology correctly.** Loss-to-lease, GPR, NRI, WALT, economic occupancy, lease rollover, concession drag, bad debt — use them precisely.
- **Linear copy style.** Concise, factual, no hype, no stories. 50/50 layout (text + visuals). If it reads like a blog post, rewrite it.
- **"Subcontractor" never "sub."** "Jobs" not "projects."
- **$1B+ not $18B+** for market sizing.

---

## Site Architecture Process

Before writing a single line of code, you must develop a complete site framework — every page, every section, every content block — mapped out and approved.

### Step 1: Study the Best SaaS Sites

Use WebFetch to review the following sites. Study their structure, page flow, section ordering, content strategy, and how they present a sophisticated product to a professional audience.

**For site structure and content strategy (study these first):**
- **stripe.com** — The gold standard for presenting complex financial infrastructure to a professional audience. Study how they layer information: simple headline, clear value prop, then progressive depth. Notice how each page has a clear job.
- **mercury.com** — Financial product marketed to sophisticated users. Study their information hierarchy, how they balance simplicity with credibility, and how they make a new product feel established.
- **linear.app** — **THIS IS THE #1 REFERENCE for content and copy.** Study it deeply. Linear's approach: every sentence earns its place. No filler. No storytelling. No "imagine a world where..." The main pages are surgically clean — short, precise, explanatory. But depth is everywhere: click into a feature and you'll find rich detail inside modals, slide-outs, expandable sections, and visual walkthroughs. The surface is minimal; the substance is dense. This is exactly how Basis should read. Headlines state what the product does. Body copy explains why it matters. Detail lives one click deeper, not cluttering the page. Apply this philosophy to every page.

**For development quality and design execution:**
- **resend.com** — **THIS IS THE #1 REFERENCE for design and build quality.** Resend is the benchmark for what a developer-grade product site looks like when designed for a broader audience. Study their visual sophistication: the dark palette, the typographic precision, the motion design, the way every interaction feels intentional. The site looks like a $100M product. It's innovative without being experimental. High-end without being pretentious. This is the tier Basis must hit — not a developer portfolio, but a premium product experience built with developer-level craft.
- **linear.app** — Also a top-tier design reference. Flat, dark, precise. Every pixel is deliberate.
- **vercel.com** — Clean engineering aesthetic. Study their component patterns and page transitions.
- **apple.com** — The gold standard for finish, polish, and motion. Study how they choreograph scroll-triggered reveals, how product imagery is presented, and how motion serves storytelling without becoming decoration.
- **warp.dev** — Dark developer aesthetic adapted for a broader audience. Study their hero treatment and feature presentation.
- **raycast.com** — Exceptional micro-interactions and keyboard-centric design language.
- **unkey.com** — Clean API/developer product presentation. Study their information density.
- **retool.com** — Enterprise SaaS positioning done well. Study how they make a technical product feel approachable without dumbing it down.
- **recharts.org** — Relevant because Basis is chart-heavy. Study how they present data visualization capabilities.
- **neon.tech** — Database product with premium visual execution. Study their dark theme and typography.
- **render.com** — Clean infrastructure product marketing. Study their pricing page and feature comparison patterns.

### Step 2: Build the Framework

After studying those sites, produce a complete site outline:
- Every page that needs to exist
- Every section within each page, in order
- What content/copy belongs in each section
- What visual treatment each section gets (hero, feature grid, comparison table, testimonial, CTA, etc.)
- How the pages connect and flow (what links where, what the user journey looks like)

This framework is the deliverable. Present it to Terry for approval before any code.

### The Design Standard

This is a new product launch, but it must NOT look like one. Basis should look and feel like a $100M product from day one. The audience — institutional lenders and national brokers — will judge credibility in the first 3 seconds. A site that looks like a weekend project kills the deal before they ever try the product.

The design direction: premium, dark, precise, sophisticated. Think financial infrastructure, not startup landing page. The visual craft of Resend, the content discipline of Linear, the polish of Apple. Not a developer site — a premium product experience that happens to be built with developer-level quality.

---

## Build Phases

Follow the same 6-phase pipeline as `/build-site`:

### Phase 1: Discovery
`/brainstorming` — What pages, what sections, what the site needs to communicate, visual direction, content strategy.

**Gate:** Approved design spec.

### Phase 2: Planning
`/writing-plans` — Page-by-page build order, component inventory, content requirements, SEO requirements.

**Gate:** Approved implementation plan.

### Phase 3: Foundation
`/theme` — Visual foundation. CSS variables, tokens, typography, spacing, easing.

**Gate:** Tokens in place, verified with a test component.

### Phase 4: Build
All skills are already loaded. Apply them as the work calls for them.

**Key principles:**
- **One page at a time.** Build it, verify it works, move on.
- **Run the dev server** after every code change.
- **No AI slop.** Distinctive fonts, intentional color, bold layout. Review against `/frontend-design` anti-patterns.
- **Performance from the start.** Lazy load below-fold, optimize images, avoid barrel imports.
- **Every feature claim must be real.** Don't market features that aren't built yet without Terry's explicit approval. Check PROGRESS.md.

**Gate:** All pages built, content in place, navigation works.

### Phase 5: Harden
`/harden` + `/adapt` + `/web-design-guidelines`

**Gate:** Works on mobile, tablet, desktop. No overflow, no missing states.

### Phase 6: Polish & Review
`/polish` + `/critique`

**Gate:** Ship-ready.

---

## What NOT to Do

- Do NOT name competitors in customer-facing copy — position Basis on its own strengths
- Do NOT use generic SaaS marketing language — speak CRE
- Do NOT market features that aren't built yet without Terry's approval
- Do NOT write copy that a CRE professional would roll their eyes at
- Do NOT forget responsive design — brokers check sites on phones between property tours
- Do NOT skip the brainstorming step — even "just add a pricing page" gets design-first treatment
- Do NOT forget to run the dev server after every code change
