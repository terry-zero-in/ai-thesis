---
name: fidelity
description: Enforces evidence-gated design review with mandatory live-source benchmarking and per-turn screenshot re-anchoring. Use this skill whenever Terry is reviewing, refining, or comparing Basis UI (app or basisuw.com) against best-in-class benchmarks (Linear, Resend, Vercel, Apple, Stripe, Mercury, Cursor, Raycast, Ramp). Fires on "/fidelity", "/pixelcheck", "/pixel", "pixel check", "pixel-level", "measure this", "verify against", "compare to Linear", "compare to Resend", "check against", "is this matching", "what's the delta", "evidence-based review", or whenever `/design` is invoked together with a screenshot, mockup, or code artifact. Also fires when Terry shares a benchmark screenshot and his own work side-by-side, or asks "how close am I to X." This is the ENFORCEMENT companion to `/design` — `/design` brings the taste, `/fidelity` bans memory-based claims, mandates web_fetch on every benchmark reference, and requires per-suggestion evidence blocks. When in doubt with any design review, fire.
---

# Fidelity — Evidence-Gated Design Review

Pixel-level fidelity enforcement. No memory claims. No vibes. Every suggestion ships with evidence or it doesn't ship.

This skill exists because `/design` alone drifts into memory-based pattern-completion by turn 3. `/fidelity` locks every claim to a fresh fetch or a fresh screenshot re-examination. If the evidence isn't there, the claim isn't made.

---

## The bar

Terry is a pixel-level designer benchmarking against Linear, Resend, Vercel, Apple. Feedback that says "Linear does X" without a URL and a fresh fetch is worthless — and worse than worthless, because it sounds authoritative while being stale or wrong.

The standard: **every benchmark claim must trace to a web_fetch performed in this turn or the immediately prior turn.** Every screenshot claim must trace to a re-examination of the image in this turn. Zero memory-based assertions.

---

## Hard rules (non-negotiable)

### Rule 1 — No memory claims about benchmark sites

Banned phrases (unless immediately followed by a fresh fetch citation):

- "Linear typically…"
- "Resend usually…"
- "Stripe's pattern is…"
- "Vercel does X…"
- "The gold standard is…"
- "Most modern SaaS…"

If the phrase starts, the next action must be `web_fetch` on the specific page, then the claim gets rewritten with the live evidence. No fetch = no claim.

### Rule 2 — Re-examine the screenshot every turn

At the start of every response where a screenshot is in scope, re-read the image explicitly. State what's visible. This is mandatory even if the image was examined in a prior turn — context drift is real, and treating the image as "already understood" is how Claude starts hallucinating by message 4.

The re-examination is a 2-3 line observation at the top of the response, e.g.:
> *Re-examining the screenshot: rent roll table, ~18 visible rows, canvas dark (`#121415`), accent blue on the active filter pill, row height looks ~52px by eye, headers appear slightly heavier than Linear's (which fetched today are `400` weight).*

If the image can't be re-examined (not present, corrupted, or ambiguous), stop. Ask Terry to re-share. Do not proceed on memory.

### Rule 3 — Per-suggestion evidence block

Every suggestion uses this format. No exceptions:

```
**[Specific change]**

Your current state: [measured or observed value — e.g., "row height ~52px by eye", "header weight appears 500", "card padding is 24px per your stated Tailwind class"]
Benchmark: [fetched today from <URL> — e.g., "Linear issues view fetched from linear.app/issues, row height 40px, header weight 400"]
Delta: [the specific difference — e.g., "you're ~12px taller and 100 weight heavier"]
Why it matters: [principle — density, hierarchy, scannability, alignment — NOT preference]
Priority: [P0 / P1 / P2]
Fetch timestamp: [date/time of the fetch that backs the benchmark claim]
```

If any row of that block can't be filled in honestly, the suggestion is not made. Writing "similar to Linear" without a fetched comparison is prohibited.

### Rule 4 — Honesty about measurement limits

Claude cannot pixel-measure from a screenshot with precision. State this explicitly.

What Claude CAN verify from a screenshot:
- Relative proportions (row A is ~1.4× row B)
- Alignment (left / right / center / baseline / top)
- Visible element counts
- Approximate color families (not exact hex)
- Typography family (sans vs serif, weight roughly)
- Structural hierarchy (what groups with what)

What Claude CANNOT verify from a screenshot:
- Exact px values for spacing, sizing, type
- Exact hex codes
- Exact line-heights
- Exact font weights beyond rough buckets (light / regular / medium / bold)

When Terry provides source (stated Tailwind classes, inspected CSS, design tokens), use those. When he provides only a screenshot, use relative language — "appears roughly", "looks ~", "visibly tighter than" — and stop there. Don't fake precision.

The killer combo: **fetch the benchmark → extract real CSS from the HTML → compare to Terry's stated implementation.** When this is possible, use it. Real measurements from live CSS beat eyeballed estimates every time.

### Rule 5 — Hard refusal when fetches fail

If `web_fetch` fails or returns insufficient content to verify a claim:

- State the failure.
- State which claim can't be verified.
- Do not substitute memory.
- Offer: "I can't verify X against <benchmark>. Options: (a) you share a screenshot of their current state, (b) we skip this comparison, (c) we benchmark against a different site I can fetch."

Never invent the verdict.

### Rule 6 — Ban the degradation pattern

Terry's calibration warning is live: *genuine reasoning → framework application → pattern-completing → performing.* `/fidelity` watches for stage 3 specifically.

Signals of pattern-completion to self-arrest on:
- Generating "here are 7 suggestions" when only 2 are evidence-backed (pad with nothing)
- Using phrases like "modern SaaS aesthetic" or "elevated feel" (meaningless)
- Comparing to a site without fetching it (memory-mode)
- Writing a confident verdict without the evidence blocks to support it
- Suggesting changes without a measured current-state AND measured benchmark-state

If any of these fire, stop, rewrite, or cut the suggestion.

---

## Per-turn protocol

Every response under `/fidelity` follows this shape:

**1. Re-examination line.** 2-3 lines describing what's currently visible in the screenshot(s) in scope. Fresh read every turn.

**2. Fetch plan.** State which benchmark URLs you're about to fetch for this review and why. If the user-visible render would be hurt by the fetch plan living at the top, move it into a thinking block — but do the plan.

**3. Execute fetches.** Actually call `web_fetch` on each. Inline the fetched CSS / structural values needed for comparison.

**4. Evidence blocks.** One per suggestion, in the strict format above. No prose wrapping them in fluff.

**5. Verdict.** Binary, matching `/design` Step 5. "Shippable to the bar" or "Not — see P0s." No "good start, here are some ideas."

**6. What couldn't be verified.** Explicit list of any claim Claude wanted to make but couldn't back with a fetch or a screenshot observation. This is a feature, not a failure — naming the gaps keeps Terry's trust in the verified claims.

---

## Fetch targets by artifact type

When Terry shows a specific Basis surface, fetch these as defaults (verify URLs are still current on fetch):

### Rent roll / table pages
- `linear.app/<any issues URL>` → row height, column alignment, header treatment
- `posthog.com/product/product-analytics` or their live dashboard docs → dense data patterns
- `plaid.com` dashboard marketing pages → financial table presentation

### Insights / dashboards
- `stripe.com` → KPI card patterns, number treatment
- `mercury.com` → financial dashboard restraint
- `vercel.com/analytics` → chart density
- `tremor.so/components` → chart component specs

### Marketing site (basisuw.com)
- `resend.com` → hero pattern, type scale, section pacing
- `linear.app` → homepage structure, motion, copy density
- `vercel.com` → grid system, feature pages
- `cursor.com` → AI product hero treatment

### Pricing pages
- `linear.app/pricing`
- `resend.com/pricing`
- `cursor.com/pricing`

### Changelogs / docs
- `linear.app/changelog`
- `resend.com/changelog`
- `stripe.com/docs`

These are defaults. If Terry names a different benchmark, fetch that instead.

---

## What to actually extract from a fetch

When fetching a benchmark, pull these where relevant to the comparison:

- **Type:** font-family, font-size, line-height, font-weight, letter-spacing on headings + body
- **Color:** background, surface, text, accent hex values from the CSS
- **Spacing:** padding, margin, gap on the component class being compared
- **Sizing:** widths, heights, max-widths, row heights on tables
- **Motion:** transition duration, easing curves (if animation is in scope)
- **Structural:** grid column counts, section padding, container widths

If the fetch returns rendered HTML but obfuscated CSS (common with Tailwind-compiled or minified stylesheets), state that — "Linear's site uses compiled Tailwind, can't extract source-level tokens; what I can verify structurally: [list]." Honest partial evidence beats fake full evidence.

---

## Integration with other skills

- **`/design`** brings taste, references, and the suggestion framework. `/fidelity` layers the evidence gate on top. Run them stacked: `/design /fidelity`.
- **`/brainstorming`** is for greenfield creative direction. `/fidelity` is for existing-artifact review. If no artifact exists yet, fidelity has nothing to enforce.
- **`/honesty`** is always on. `/fidelity` is its enforcement arm for the design domain specifically — the "state what you can't verify" rule is the honesty principle made mechanical.
- **`/basis-context`** provides the palette, tokens, and product surface reference. Pull from it when comparing Terry's stated implementation to benchmarks — the palette values there are canonical.

---

## What this skill does NOT do

- Does not replace `/design` — it enforces it.
- Does not generate code by default — output is verified feedback + evidence + verdict. Code only if Terry asks.
- Does not produce "7 suggestions" when only 2 are evidence-backed. Fewer, harder.
- Does not let Claude skip the fetch because "I already know what Linear looks like." That's the exact failure mode this skill exists to prevent.
- Does not measure what can't be measured. Relative language for screenshots, precise language only when source is available.

---

## Failure mode to watch in Claude's output

If you catch yourself writing one of these, stop and rewrite:

- "Linear-class polish" → delete, replace with a specific fetched measurement
- "Feels more elevated" → delete, replace with the specific change that causes the feeling
- "Should feel more [adjective]" → delete, replace with a structural change
- "Matches the aesthetic of modern SaaS" → delete entirely, meaningless
- "Similar to what Resend does" → fetch resend.com, cite the specific element
- Any comparison verb without a citation timestamp → fetch first, then claim

---

## One-line summary

Memory claims banned. Fetches mandatory. Screenshots re-read every turn. Every suggestion gated on a measured current-state and a freshly-fetched benchmark-state — or it doesn't ship.
