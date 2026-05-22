# Motion Audit — 2026-05-21

**Scope:** every CSS animation, transition, keyframe, and inline motion style in `web/src/`.
**Method:** static grep + per-site cost analysis. No runtime profiling.
**Codebase state:** AI Thesis v2, post-S22 hover-token lockdown (2026-05-20).

---

## Executive summary

- **~57 motion sites** found across **24 files**: 22 CSS `@keyframes`, ~12 CSS class-scoped `transition` rules, ~30 inline `transition`/`animation` styles in TSX, 1 RAF-driven number tween (`AnimateNumber`).
- **`will-change`** appears 3 times — all correctly scoped to short-lived modal/page mount surfaces (`Modal`, `CmdPalette`, `Shell`). Not overused.
- **`prefers-reduced-motion`** is honored at the global CSS level (`*` selector caps animations to `.01ms`, transitions to `60ms`) and explicitly in `AnimateNumber.tsx` + `useReducedMotion.ts`. Good baseline.
- **Overall grade: B+ / A−**. The system is disciplined: tokens are mostly respected, easings are mostly the locked palette, most animated properties are compositor-tier (opacity / transform). The bulk of work that earns the grade was already done in the `.row-hov` / `.kpi-hov` / `.rail-row-hov` lockdown. Remaining issues are tightly scoped: a handful of arbitrary-duration inline styles, several dead keyframes shipping with no callsites, one suspicious `cubic-bezier(0.32, 0.72, 0, 1)` override in `MovingPillTabs`, and one paint-tier `backdrop-filter` blur transition in the modal backdrop keyframe.

### P0 issues (fix before any further motion work)

1. **`globals.css:297` `@keyframes modalBackdrop` animates `backdrop-filter` from `blur(0)` → `blur(6px)`** — paint+filter cost on every fired modal, on every paint frame for 140ms. Backdrop-filter is the single most expensive property in the system right now. Grade: **D**.
2. **`globals.css:305` `@keyframes expand` animates `max-height` + padding** — declared but unreferenced anywhere in TSX. Should be deleted, but if it ever gets wired up it would layout-thrash. Grade if used: **F**. Current status: dead code (Grade: C — dead-code tax).
3. **`MovingPillTabs.tsx:75` hand-rolled `cubic-bezier(0.32, 0.72, 0, 1)`** — bypasses the locked easing tokens. Visually fine (it's a Linear/Apple ease), but it breaks the "all motion through `--ease-*` tokens" contract.

### Motion Plus Pack upgrade opportunities (in priority order)

1. **`AnimateNumber.tsx` count-up** — currently RAF + `setState` per frame, paint-tier (C). Motion's `useMotionValue` + `useTransform` + a tape of per-digit `translateY` transforms would push this to S-tier compositor-only. Highest-visibility surface (Dashboard KPI hero numbers).
2. **`MovingPillTabs.tsx` pill slide** — currently CSS `transition: transform, width` driven by `useLayoutEffect`-measured bounds. Motion's layout animations (`layout` prop + `LayoutGroup`) make this a one-liner with FLIP-correct first-paint.
3. **`Modal.tsx` content `scale(.97) → scale(1)` + translateY** — currently a CSS spring with `cubic-bezier(.34,1.56,.64,1)` overshoot. Motion's `useSpring` with damping/stiffness gives a physical spring rather than a fixed-curve cubic-bezier approximation.
4. **Sidebar collapse (`Sidebar.tsx:65`)** — currently `transition: width 240ms var(--ease)`. Width animations are layout-thrash. Motion can animate the inner content via `scaleX` while masking, getting the same visual at compositor cost.
5. **Row stagger-in (`globals.css:344` `.row-stagger-in`)** — CSS-only `--row-i` cascade is fine for ≤20 rows; for larger lists (Universe 70 names, Memos drafts), Motion's `staggerChildren` + `AnimatePresence` exit would give us exit-animations on filter changes (currently we have no exit, just abrupt unmount).

---

## Findings by file

### `web/src/app/globals.css`

#### Keyframes (22 total)

| Line | Name | Animated properties | Grade | Notes |
|---|---|---|---|---|
| 287 | `pulse` | `opacity`, `transform: scale()` | **A** | Compositor-only. Infinite. Used by `GoToPill` indicator dot. |
| 288 | `blink` | `opacity` | **A** | Compositor-only. Used by `.caret` (text-cursor analog). Steps function avoids interpolation cost. |
| 289 | `fadeUp` | `opacity`, `transform: translateY(7px→0)` | **S** | Compositor-only. The system's workhorse arrival. |
| 290 | `fadeUpSm` | `opacity`, `transform: translateY(4px→0)` | **S** | Same as above, smaller travel. |
| 291 | `fadeOut` | `opacity` | **C** | Dead — no callsites in TSX. Token-only export. Either delete or document as a public utility. |
| 292 | `fadeIn` | `opacity` | **A** | Compositor-only. Used by `PageCreateDrawer` scrim, `CmdPalette` empty state. |
| 293 | `pulseWarn` | `box-shadow` | **D** | Dead. `box-shadow` is paint-tier — every frame triggers a re-paint of the shadow buffer. If ever revived, swap to a sibling `::after` with `transform: scale()` for the ring instead. |
| 294 | `onlinePulse` | `box-shadow` (double-stop, includes static 1.5px inner ring) | **C** | Used by `Sidebar.tsx:228` (presence dot). Paint-tier but tiny (6×6 dot), infinite at 2.4s. Cost is bounded. Acceptable but not S. |
| 295 | `barFill` | `transform: scaleX()` | **S** | Compositor-only. Per the spec choreography note — initial paint only. Not currently invoked from any TSX I found; verify a chart component consumes it or delete. **needs runtime profiling to confirm callsite.** |
| 296 | `scaleIn` | `opacity`, `transform: scale()` (with .4→1.15→1 overshoot) | **C** | Dead — no callsites. Compositor-tier if used, but currently dead-code tax. |
| 297 | `modalBackdrop` | `opacity`, **`backdrop-filter: blur(0→6px)`** | **D** | **P0.** Animating `backdrop-filter` interpolates a GPU-blur over time. Paint+filter tier. On modal fire, every frame re-runs the convolution. Fix: animate `opacity` only on the scrim, set `backdrop-filter: blur(6px)` as a static initial value (or apply it after the fade-in completes via `animation-fill-mode: forwards` on a 0ms keyframe). |
| 298 | `modalContent` | `opacity`, `transform: translateY() scale()` | **S** | Compositor-only. Used by `Modal.tsx:75` and `CmdPalette.tsx:105` with `var(--spring)` overshoot. |
| 299 | `slideRight` | `opacity`, `transform: translateX(-6px→0)` | **S** | Used by `Toast.tsx:48`. |
| 300 | `spin` | `transform: rotate()` | **S** | Compositor-only. Used by `.spinner` class on Name Detail loading state. |
| 301 | `shimmer` | `background-position` | **C** | Paint-tier — every frame triggers a paint of the gradient. Industry-standard skeleton pattern; acceptable cost when bounded to small `.skel` placeholder areas, but should be capped (don't ship 50 simultaneous shimmers). Linear-infinite at 1.6s. |
| 302 | `sweep` | `transform: translateX(-100%→100%)` | **S** | Compositor-only. Dead — no callsites found. |
| 303 | `ringPulse` | `box-shadow` | **D** | Dead. Same problem as `pulseWarn`. |
| 304 | `marketDotPulse` | `box-shadow` | **C** | Used by `GreetingStrip.tsx:121` (NYSE market-open dot). Paint-tier but bounded (6×6 dot, only when market is open). Acceptable. |
| 305 | `expand` | `opacity`, **`max-height`**, **`padding-top`**, **`padding-bottom`** | **F** | **P0 if ever wired up.** Animating `max-height` is the canonical layout-thrash bug — it triggers a full layout pass per frame on every descendant. Animating `padding` is also layout-tier. Currently dead — delete it. Fix-if-needed: use `transform: scaleY()` with `transform-origin: top` and a `::before` spacer, or measure to a fixed pixel height with JS and animate `height` (still layout, but bounded). |
| 344 | `row-stagger-in` | `opacity`, `transform: translateY()` | **S** | Compositor-only. Custom-property cascade. |
| 349 | `chip-fade-in` | `opacity`, `transform: translateX()` | **S** | Compositor-only. |
| 357 | `hero-arrive` | `opacity`, `transform: translateY()` | **S** | Compositor-only. Documented replacement for the count-up jitter. |

#### Transitions / utility classes

| Line | Selector | Properties | Grade | Notes |
|---|---|---|---|---|
| 48 | `input[type=date|time|month|week]::-webkit-calendar-picker-indicator` | `opacity 120ms ease` | **B** | 120ms is off the locked scale (no `--dur-X` for 120). One-off browser-native input; arguably acceptable since it's a webkit-pseudo-element that doesn't take CSS vars in all engines. **Flag for token compliance.** |
| 310 | `button:focus-visible, a:focus-visible, …` | `box-shadow 140ms` | **A** | `box-shadow` for the focus-ring transition is paint-tier, but it only fires on Tab focus changes (rare, non-continuous). Acceptable. |
| 320 | `@media (prefers-reduced-motion: reduce) *` | caps `animation-duration:.01ms !important`, `transition-duration:60ms !important` | **B+** | **Subtle issue.** The blanket `transition-duration:60ms !important` *raises* the duration of intentionally fast transitions (e.g. `Btn.tsx:104`'s `transform 60ms` is already 60ms — fine; `icon-btn`'s `transform 60ms` is also already 60ms — fine) but *lowers* normal hover transitions, which is the point. The hazard: if any future inline style uses `transition: ... 40ms ease` (below 60ms), the global cap would *slow it down* in reduced-motion mode. Low risk today, but a footgun. Consider scoping to `transition-duration: min(60ms, var(--actual)) !important` — though CSS can't express that, so the realistic fix is policy: "no transitions below 60ms anywhere." |
| 323 | `.caret` | `animation: blink 1s steps(2,start) infinite` | **A** | Compositor-only opacity. |
| 324 | `.skel` | `animation: shimmer 1.6s linear infinite` | **C** | See `shimmer` above. |
| 325 | `.spinner` | `animation: spin .8s linear infinite` | **S** | Compositor transform-rotate. |
| 336 | `.k.hov` | `transition: opacity, max-width, padding, margin, border-color (all 140ms)` | **D** | **`max-width` + `padding` + `margin` are all layout-tier.** The hover-reveal kbd-chip pattern animates four layout properties simultaneously. On a row with 5+ chips, that's 5 layout passes per frame for 140ms. Acceptable cost given low chip count in practice (1–2 per row), but **does not scale**. Fix candidate: use `transform: scaleX()` with `transform-origin: right` on the chip, or use the new `interpolate-size: allow-keywords` + `transition-behavior: allow-discrete` pattern (Chromium 129+) to animate from `width: 0` to `width: auto` compositor-friendly via `calc-size()`. Lower-effort fix: pre-allocate width with `transform: translateX()` for the slide. |
| 363 | `.row-hov` | `transition: background, color, box-shadow 140ms` | **B+** | All three are paint-tier (especially `box-shadow`), but the class no longer applies a shadow (looking at the actual selectors at L368 there's only a `background` change). Recommend dropping `box-shadow` from the transition list — pruning unused properties from transition shorthand is the cheapest win in the file. |
| 370 | `.row-hov .row-actions` | `transition: opacity 120ms, transform 140ms` | **S** | Compositor-only. Two different durations on related properties (120 vs 140) is intentional micro-choreography per the spec. 120ms is off-token; should be `var(--dur-instant)` (80ms) or `var(--dur-fast)` (140ms). **Flag for token compliance.** |
| 375 | `.icon-btn` | `transition: background, color, opacity 140ms, transform 60ms ease-in` | **A** | Mixed durations are deliberate — bg/color settle at 140ms, press uses 60ms snap. Good practice. |
| 383 | `.lin-hov` | `transition: background, color, border-color 140ms` | **A** | All compositor or paint-light. |
| 386 | `.lin-lift` | `transition: transform, background, border-color 140ms` | **S** | `transform: translateY(-1px)` on hover is compositor-only. |
| 394 | `.accent-link` | `transition: color 140ms` | **A** | Paint-light. |
| 396 | `.accent-link>.accent-link-chev` | `transition: transform 140ms` | **S** | Compositor. |
| 404 | `.logo-hov` | `transition: color, background 140ms` | **A** | Paint-light. |
| 414 | `.rail-row-hov` | `transition: background 140ms` | **A** | Single paint. |
| 425 | `.kpi-hov` | `transition: background 140ms` | **A** | Single paint. |

---

### `web/src/components/primitives/Btn.tsx`

- **L103-104** `transition: "background var(--dur-instant), color var(--dur-instant), border-color var(--dur-fast), transform 60ms var(--ease-in), box-shadow var(--dur-fast)"` — **Grade: A−**
  - Five-property transition. `box-shadow` is paint-tier; the others are paint-light or compositor. The `transform 60ms` snap on press is deliberate and well-tuned. Minor: if no `box-shadow` ever changes on hover/press (look-up: doesn't appear it does — the Btn doesn't render a shadow), drop it from the transition list. Otherwise solid.

### `web/src/components/primitives/MovingPillTabs.tsx`

- **L74-76** `transition: initialized ? "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), width 220ms cubic-bezier(0.32, 0.72, 0, 1)" : "none"` — **Grade: C**
  - **Token violation.** Uses a literal `cubic-bezier(0.32, 0.72, 0, 1)` instead of `var(--ease-out)` or similar. This is the Apple "smooth" curve and visually it works, but the system doctrine says all easings come from the locked token palette.
  - **`width` is layout-tier.** Animating the pill's width triggers a layout pass on every frame. The transform is compositor-only, but the simultaneous width animation drags the whole transition into the main thread. Fix: animate `scaleX()` with a measured base width instead — Motion's `layout` prop does this automatically.
  - 220ms is off-token (closest token is `--dur-base: 200ms` or `--dur-mid: 240ms`).
- **L106** `transition: "color 140ms var(--ease-out)"` — **Grade: B+**
  - Hard-coded 140ms instead of `var(--dur-fast)`. Token violation, but equivalent value.

### `web/src/components/primitives/PageCreateDrawer.tsx`

- **L129** `animation: "fadeIn 120ms ease-out both"` — **Grade: C**
  - 120ms is off the locked scale (no `--dur-X` for 120). Uses literal `ease-out` instead of `var(--ease-out)`. Two token violations in one line. Visually identical to a compliant version.
- **L162-163** `transition: "background var(--dur-instant, 90ms) var(--ease-out, ease-out), color var(--dur-instant, 90ms) var(--ease-out, ease-out)"` — **Grade: B**
  - **The `90ms` fallback is wrong.** `--dur-instant` is `80ms` (globals.css:266), not 90ms. The fallback only fires if the token is unavailable, which it never is for in-app surfaces, so this is cosmetic — but it suggests an outdated copy-paste from an earlier value. Should be `80ms` or no fallback.
- **L174** `transition: "transform var(--dur-fast, 150ms) var(--ease-out, ease-out)"` — **Grade: B**
  - Same fallback drift — `--dur-fast` is `140ms`, not `150ms`. Cosmetic but indicates stale fallbacks.

### `web/src/components/overlays/Modal.tsx`

- **L60** `animation: "modalBackdrop 140ms var(--ease-out) both"` — **Grade: D** (inherited from keyframe)
  - The animation reference itself is correct (token duration, token easing). The cost is in the keyframe — see `modalBackdrop` above. If you can't change the keyframe, you can mitigate by setting `backdrop-filter: blur(6px)` directly on the element and only animating `opacity` in the keyframe.
- **L75** `animation: "modalContent 240ms 40ms var(--spring) both"` — **Grade: S**
  - Compositor-only transform + opacity, locked spring token, 40ms stagger after backdrop. Textbook.
- **L79** `willChange: "transform,opacity"` — **Grade: A**
  - Correctly scoped to a short-lived modal. Will be garbage-collected when the dialog unmounts. Not abused.

### `web/src/components/shell/CmdPalette.tsx`

- **L88** `animation: "modalBackdrop 140ms var(--ease-out) both"` — same as Modal (Grade: D for the backdrop-filter keyframe issue).
- **L105** `animation: "modalContent 220ms 40ms var(--spring) both"` — **Grade: A−**
  - Inconsistent with `Modal.tsx:75` which uses 240ms for the same keyframe. Per spec choreography note (globals.css:253: "content scaleUp 240ms"), 240ms is the canonical value. Bug or intentional?
- **L106** `willChange: "transform,opacity"` — **Grade: A**
- **L146** `animation: "fadeIn var(--dur-fast) var(--ease-out) both"` — **Grade: S**
- **L164-165** `transition: "background var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out)"` — **Grade: A**
- **L167** `animation: \`fadeUpSm var(--dur-fast) ${staggerDelay(i, reduced, 24, 10)}ms var(--ease-out) both\`` — **Grade: S**
  - JS-orchestrated stagger respects reduced-motion via the `reduced` parameter. Compositor-only.
- **L179, L190** `transition: "color var(--dur-instant) var(--ease-out)"` — **Grade: A**

### `web/src/components/shell/Shell.tsx`

- **L108** `animation: "fadeUp 220ms 8ms var(--ease-out) both"` — **Grade: A−**
  - 220ms is off-token (closest: `--dur-base: 200ms`). Otherwise compositor-only.
- **L109** `willChange: "transform,opacity"` — **Grade: B**
  - Applied to the entire page-content container on every navigation. The `willChange` will persist for the lifetime of the route — not just during the 228ms animation. **Recommend removing after animation completes** via `onAnimationEnd` (cheap), or accept the bounded cost since it's a single root container.

### `web/src/components/shell/Sidebar.tsx`

- **L65** `transition: "width 240ms var(--ease)"` — **Grade: C**
  - **`width` is layout-tier.** Sidebar collapse triggers a re-layout of every descendant on every frame for 240ms. On a 70-row Universe page, that's a full layout pass × 14 frames. Currently visually fine because the sidebar is small and content reflows acceptably, but this is the single highest-cost transition in the system at the moment. Motion Plus upgrade target.
- **L269** `transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)"` — **Grade: A**
- **L284** `transition: "color var(--dur-fast), opacity var(--dur-fast)"` — **Grade: A**
- **L290** `transition: "opacity var(--dur-base) 60ms var(--ease-out)"` — **Grade: A−**
  - Label fade-in 200ms with 60ms delay during collapse. Coordinated with the 240ms width animation. Compositor.
- **L301** `transition: "color var(--dur-instant) var(--ease-out)"` — **Grade: A**

### `web/src/components/shell/TopBar.tsx`

- **L92** `transition: "background var(--dur-fast), color var(--dur-fast)"` — **Grade: A**. Token-compliant, paint-light.

### `web/src/components/shell/GoToPill.tsx`

- **L39** `animation: "fadeUpSm 140ms var(--ease-out) both"` — **Grade: S**
- **L51** `animation: "pulse 1.2s var(--ease) infinite"` — **Grade: A**. Compositor (opacity + scale), bounded to 6×6 dot.

### `web/src/components/shell/Tip.tsx`

- **L107** `animation: "fadeUpSm 140ms var(--ease-out) both"` — **Grade: S**.

### `web/src/components/shell/ShortcutsOverlay.tsx`

- **L47** `animation: \`fadeUpSm var(--dur-fast) ${gi * 40}ms var(--ease-out) both\`` — **Grade: S**. Compositor, JS-staggered.

### `web/src/components/overlays/Toast.tsx`

- **L48** `animation: "slideRight 220ms var(--ease) both"` — **Grade: A−**
  - 220ms off-token. Otherwise compositor.

### `web/src/components/primitives/AnimateNumber.tsx`

- **Whole file** — **Grade: C**
  - Self-documented as paint-tier (line 17–20 of the file explicitly notes this). RAF + `setState` per frame causes ~48 re-renders per 800ms tween. Single element, no layout, bounded cost — but it *is* main-thread JS doing the work. Honors `prefers-reduced-motion` correctly. **Motion Plus upgrade target #1.** Replace with `useMotionValue` + per-digit `<motion.span style={{ y }}>` tape (compositor-only translateY per digit).

### `web/src/components/primitives/HeroNumber.tsx`

- **No active animation** — S17 deliberately removed the AnimateNumber wrapping to fix the digit-width-reflow jitter (see comment at L89-95). Static render. Good call. **Grade: N/A** (no motion to grade).

### `web/src/components/primitives/PageStub.tsx`

- **L24** `animation: "fadeUp var(--dur-base) var(--ease-out) both"` — **Grade: S**.

### `web/src/components/primitives/ScoreMathPopover.tsx`

- **L126** `animation: "fadeUp 140ms var(--ease-out) both"` — **Grade: A−**. 140ms is `--dur-fast` but hard-coded; token compliance would prefer `var(--dur-fast)`.

### `web/src/components/universe/UniverseTable.tsx`

- **L251** `animationDelay: \`${delayMs}ms\`` on `.row-stagger-in` — **Grade: S**. Compositor-only CSS animation cascaded via JS-computed delay. Good.
- **L316, L333** `transition: "border-color var(--dur-instant) var(--ease-out)"` — **Grade: A**. Score-math dotted-underline reveal. Paint-light.
- **L460-461** `transition: "color var(--dur-fast) var(--ease-out)"` — **Grade: A**.
- **L471** `transition: "color var(--dur-fast) var(--ease-out)"` — **Grade: A**.

### `web/src/components/universe/UniverseInsightsRail.tsx`

- **L312-313** `transition: "opacity var(--dur-fast), background var(--dur-fast)"` — **Grade: A**.
- **L323, L336** `transition: "color var(--dur-fast)"`, `transition: "filter var(--dur-fast)"` — **Grade: B**.
  - Note L336 animates **`filter: saturate()`**. Filter transitions are paint+filter tier — every frame re-runs the saturate convolution. Bounded to 4–6 small tier bars on a single rail; acceptable cost. **Flag for runtime profiling** if rail grows.
- **L425-426** `transition: "background, opacity, color all var(--dur-fast)"` — **Grade: A**.
- **L444, L454** `transition: "color var(--dur-fast)"` — **Grade: A**.
- **L592-593, L713-714** `transition: "background, color, border-color all var(--dur-fast)"` — **Grade: A**.

### `web/src/components/universe/UniverseFilterRail.tsx`

- **L308** `transition: "background var(--dur-instant), color var(--dur-instant), border-color var(--dur-instant)"` — **Grade: A**. All 80ms paint-light.

### `web/src/components/name/PortfolioContextStrip.tsx`

- **L177** `transition: "background var(--dur-fast) var(--ease-out)"` — **Grade: A**.

### `web/src/components/rails/DashboardTodayRail.tsx`

- **L337-338** `transition: "opacity var(--dur-instant), filter var(--dur-instant)"` — **Grade: B**.
  - Animates `filter: saturate()` on tier bars when toggled. Paint+filter tier, but bounded to 4 small bars on a single rail. Cost acceptable, flag if it scales.
- **L432-433** `transition: "background, color, opacity all var(--dur-fast)"` — **Grade: A**.

### `web/src/app/page.tsx` (Dashboard)

- **L695** `transition: "border-color var(--dur-instant) var(--ease-out)"` — **Grade: A**. Score-math dotted underline.

### `web/src/app/login/LoginForm.tsx`

- **L52** `transition: "background var(--dur-instant) var(--ease-out)"` — **Grade: A**.

### `web/src/app/portfolio/AddPositionForm.tsx`

- **L268** `transition: "background var(--dur-instant) var(--ease-out)"` — **Grade: A**.

### `web/src/app/aiq/[ticker]/AiqEditor.tsx`

- **L108** `transition: "background var(--dur-instant) var(--ease-out)"` — **Grade: A**.

### `web/src/app/aiq-drafts/DraftCard.tsx`

- **L173** `transition: "background var(--dur-instant) var(--ease-out)"` — **Grade: A**.

### `web/src/app/decisions/AlertRow.tsx`

- **L29** `transition: "opacity .15s var(--ease)"` — **Grade: C**
  - **Off-token duration (.15s = 150ms; closest tokens are `--dur-fast: 140ms` or `--dur-base: 200ms`).** Uses `var(--ease)` which is the system "decel/settle" curve — appropriate for an ack-fade. Just the duration. Fix to `var(--dur-fast)`.

### `web/src/components/marketing/WaitlistForm.tsx`

- **L164** `transition: "background var(--dur-instant) var(--ease-out)"` — **Grade: A**.

### `web/src/app/proposals/page.tsx`

- **L40** `animationDelay: \`${Math.min(i * 50, 600)}ms\`` on `.row-stagger-in` — **Grade: A−**
  - 50ms stride is off the spec which calls for 30ms (≤8 items) / 18ms (>8 items) at globals.css:257. Proposals may have a different list shape that justifies a longer stride, but document the rationale.

### `web/src/app/decisions/page.tsx`

- **L173** `animationDelay: \`${Math.min(i * 30, 1000)}ms\`` on `.row-stagger-in` — **Grade: S**. Token-aligned 30ms stride.

### `web/src/app/aiq/page.tsx`

- **L169** `animationDelay: \`${Math.min(i * 25, 1200)}ms\`` on `.row-stagger-in` — **Grade: A−**. 25ms stride is between the spec's 18 and 30 values — pick one for consistency.

### `web/src/app/memos/page.tsx`

- **L263** `animationDelay: \`${Math.min(i * 40, 800)}ms\`` on `.row-stagger-in` — **Grade: A−**. 40ms off the spec values.

### `web/src/app/GreetingStrip.tsx`

- **L121** `animation: open ? "marketDotPulse 1.6s ease-out infinite" : "none"` — **Grade: C** (inherited from `marketDotPulse` keyframe).
  - Animates `box-shadow` for the ring pulse. Paint-tier but bounded to a 6×6 dot. Conditional on market-open. Uses literal `ease-out` rather than `var(--ease-out)` — minor token drift.

### `web/src/components/shell/Sidebar.tsx` (online dot)

- **L228** `animation: "onlinePulse 2.4s var(--ease) infinite"` — **Grade: C**. Box-shadow paint, bounded to a 6×6 dot. Always-on. Cost is real but tiny.

### `web/src/components/marketing/MarketingLanding.tsx`

- **L71** `backdropFilter: "blur(12px)"` — **Grade: B**. Static `backdrop-filter`, not animated. Marketing-only. Paint-once at mount; acceptable but expensive if marketing page has parallax scroll triggering re-paints. **needs runtime profiling under scroll.**

---

## Cross-cutting recommendations

### 1. Delete dead keyframes (no-risk cleanup)

These five keyframes are declared in `globals.css` and have **zero TSX/CSS callsites**:

- `fadeOut` (L291)
- `pulseWarn` (L293)
- `scaleIn` (L296)
- `sweep` (L302)
- `ringPulse` (L303)
- `expand` (L305) — **especially this one**, since it would be layout-thrash if ever wired up

Deleting them is a 6-line PR. Removes the temptation to grab `expand` for a future accordion and pay the layout cost.

Also flag `barFill` (L295) as **needs runtime confirmation** — search returned no TSX usage but the spec doc references it; either there's a missing implementation or it's also dead.

### 2. Fix the modal backdrop-filter animation

Highest-cost site in the system. Change `globals.css:297` from:

```css
@keyframes modalBackdrop{from{opacity:0;backdrop-filter:blur(0)}to{opacity:1;backdrop-filter:blur(6px)}}
```

to:

```css
@keyframes modalBackdrop{from{opacity:0}to{opacity:1}}
```

And set `backdrop-filter: blur(6px)` directly on the modal-scrim element in `Modal.tsx` and `CmdPalette.tsx`. The visual difference is imperceptible (140ms is too short for the blur ramp to register cognitively), the cost drops from paint+filter+convolution to compositor opacity.

### 3. Token-compliance sweep

The following sites use literal millisecond values where a token exists. Fix-as-touch:

| Site | Current | Should be |
|---|---|---|
| `globals.css:48` | `opacity 120ms ease` | `opacity var(--dur-fast) var(--ease-out)` (or document 120ms exception) |
| `globals.css:336` | `120ms`, `140ms` mix | unify to tokens |
| `globals.css:370` | `opacity 120ms, transform 140ms` | `opacity var(--dur-instant)*1.5? or var(--dur-fast)`, `transform var(--dur-fast)` |
| `MovingPillTabs.tsx:75` | `cubic-bezier(0.32, 0.72, 0, 1)` literal | `var(--ease-std)` or `var(--ease)` (verify visual match) |
| `MovingPillTabs.tsx:106` | `140ms` literal | `var(--dur-fast)` |
| `PageCreateDrawer.tsx:129` | `120ms ease-out` | `var(--dur-fast) var(--ease-out)` |
| `PageCreateDrawer.tsx:163` | `--dur-instant, 90ms` fallback | drop fallback or fix to `80ms` |
| `PageCreateDrawer.tsx:174` | `--dur-fast, 150ms` fallback | drop fallback or fix to `140ms` |
| `Shell.tsx:108` | `220ms` literal | `var(--dur-base)` (200ms) or `var(--dur-mid)` (240ms) — pick one |
| `Toast.tsx:48` | `220ms` literal | `var(--dur-base)` |
| `Modal.tsx:75` vs `CmdPalette.tsx:105` | 240ms vs 220ms for same keyframe | unify to 240ms per spec |
| `ScoreMathPopover.tsx:126` | `140ms` literal | `var(--dur-fast)` |
| `AlertRow.tsx:29` | `.15s` literal | `var(--dur-fast)` |
| `GreetingStrip.tsx:121` | `ease-out` literal | `var(--ease-out)` |
| stagger-stride values across `proposals` (50ms), `aiq` (25ms), `memos` (40ms) | various | pick 18ms or 30ms per spec at globals.css:257 |

None of these are correctness bugs; they're contract drift. A single sweep PR closes them.

### 4. Audit `box-shadow` animations

Three places animate `box-shadow`: `onlinePulse`, `marketDotPulse`, the focus-ring transition. All are bounded (small dots, infrequent fires) and acceptable. But shadow animation is paint-tier — if the system ever adds a "highlight pulse" on a larger surface (a row, a card), it should use `transform: scale()` on an absolutely-positioned ring overlay, not `box-shadow`.

### 5. Sidebar `width` transition is the next refactor target after the backdrop

`Sidebar.tsx:65` is the only large-surface layout-tier transition in the system. 240ms × every Universe table descendant = real cost. Motion Plus's `layout` prop with a width-masked inner content (animate `scaleX`, not `width`) is the canonical fix.

### 6. `will-change` is well-managed

Three usages, all on short-lived modal/page-transition surfaces. Not leaked, not abused. Good.

### 7. Reduced-motion is honored but could be tighter

The global `*` cap at `60ms` for transitions is the right pattern. `AnimateNumber` and `useReducedMotion` add explicit handling for JS-driven motion. One refinement worth considering: the CmdPalette stagger (`CmdPalette.tsx:167`) calls `staggerDelay(i, reduced, 24, 10)` — make sure `reduced=true` collapses delay to 0 (verify in `useReducedMotion.ts`). **Needs runtime confirmation.**

---

## Motion Plus Pack upgrade targets (ranked by ROI)

| Target | Current grade | Post-Motion grade | ROI | Effort |
|---|---|---|---|---|
| **`AnimateNumber` digit tape** | C (paint-tier RAF re-render) | S (compositor per-digit translateY) | High — fires on every Dashboard hero KPI | Medium |
| **`MovingPillTabs` pill slide** | C (animates `width` + literal cubic-bezier) | S (`layout` prop FLIP) | Medium — fires on every tab switch | Low |
| **Sidebar `width` collapse** | C (layout-tier) | A (scale + mask) | Medium — fires when user toggles sidebar | Medium |
| **Modal content spring** | A (CSS spring) | A+ (physical spring) | Low — works fine today, but Motion's spring is closer to native iOS feel | Low |
| **Row stagger w/ exit** | S (CSS) → no exit animation | S w/ exit (`AnimatePresence`) | Low-Medium — improves filter-change feel on Universe (70 names) | Medium |
| **Marketing landing scroll/parallax** | N/A (not yet built) | Use Motion's `useScroll` + `useTransform` for hero parallax | High when building Epic 6 marketing pages | n/a |

The non-negotiable Motion Plus deploy is `AnimateNumber` — it's both the most-visible motion in the app AND the worst-graded compositor cost. Everything else is polish.

---

## What this audit did NOT cover

- **Runtime profiling.** No Chrome DevTools Performance traces taken. Grades are based on static property analysis. Sites flagged "needs runtime profiling" require a perf-trace to confirm.
- **The `barFill` keyframe** appears to be a phantom — declared but no TSX callsite found. Could not confirm whether a chart component consumes it via a CSS class indirection. Verify before deleting.
- **Hover state machines driven by React `useState`** (e.g., `MovingPillTabs.tsx:90-94`, every `[hov, setHov]` pattern in rails/legends). Setting inline-style colors via JS on mouse events triggers a paint and is acceptable for occasional interactions, but at scale (50+ rows with per-row hover state) the React render cost dominates. These are not animations per se, but they interact with the motion budget. Not graded here.
- **Tailwind utility-class transitions.** No `transition-*` or `animate-*` Tailwind classes were found in the codebase — the app uses inline-style and CSS-class transitions exclusively. So no Tailwind audit was needed.

---

**End of audit.**
