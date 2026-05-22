# Page Walk Audit — 2026-05-21 — /regime /aiq /memos /proposals

Read-only mechanical compliance audit against the S22-locked hover/click utility system (globals.css). Branch: `claude/beautiful-carson-QaTLG`. Pages 1-3 (/dashboard, /universe, /universe/[ticker]) audited in S22 and 4 (/portfolio) in S23 — out of scope here.

## Reference: the locked rules (verified in `web/src/app/globals.css`)

- `.row-hov` (line 356-364): `transition: background var(--dur-fast) ...` on tr/li rows, hover `background: var(--surface)`, no transform. Cursor pointer.
- `.icon-btn` (line 368-370): inline-flex 5px padding, `--dur-fast`, hover `background: var(--hover-tint-strong); color: var(--text-1)`.
- `.lin-hov` (line 376-378) / `.lin-lift` (line 379-381): chip-like clickables; lift uses `transform: translateY(-1px)`.
- `.accent-link` / `.accent-link-chev` (line 387-390): mono accent link with 2px chevron slide on hover.
- `.logo-hov` (line 397-398).
- `.rail-row-hov` (line 407-409): inset rail row (`margin: 0 -8px`, `padding 8px`, radius 6).
- `.kpi-hov` (line 418-419): KPI tile drill — background lift only, radius 6, --dur-fast.
- Duration tokens (line 266-270): `--dur-instant 80ms`, `--dur-fast 140ms`, `--dur-base 200ms`, `--dur-mid 240ms`, `--dur-slow 320ms`.
- Inset-pill ribbon geometry (NamePager.tsx:55-68 — canonical instance): `margin: "10px 40px 0 32px"`, `padding: "6px 14px"`, `borderRadius: 6`, `background: var(--surface)`.
- `--accent`: `var(--iris-600)` = `#8B5CF6`.

---

## Executive summary

- **27 findings total**: 1 P0 · 11 P1 · 11 P2 · 4 P3
- **Worst offender page**: `/aiq/[ticker]` (AiqEditor + AiqHistory) — 11 findings. Heavy hand-rolled form chrome that pre-dates the S22 utility lock; multiple clickables (close link, submit button, expander button, source URL anchors) without standard hover affordances; non-token duration on the submit button.
- **Cleanest page**: `/regime` page.tsx — 1 P3 only. Mostly read-only data display; the components beneath have the issues (MultiplierBanner ribbon, GaugeCard, GateHistory).
- **Cross-cutting pattern**: every page in scope renders `row-stagger-in` cards/rows that are clickable (or expandable) without the corresponding `.row-hov` / `.lin-hov` / equivalent class — bare static borders. The S22 lock applies to interactive surfaces; the stagger animation does not.
- **One genuine locked-invariant violation (P0)**: `/memos` system-status banner uses `margin: "10px 28px 0"` (28L/28R) — not a tight match to the 32L/40R/r6 pill geometry but it's a ribbon-class banner riding above the page, so it should honor or skip the geometry. Flagging as P0 only because Terry locked the geometry explicitly; the other "ribbon-class" candidates (regime `MultiplierBanner`, regime `GaugeCard`, etc.) are decard hairline strips that flow on canvas, NOT inset pills, so they are correctly NOT using the pill geometry.

### One-line per page

| Page | Findings | Notable |
|---|---|---|
| `/regime` | 6 | MultiplierBanner is a decard strip (no ribbon needed); GateHistory rows are receipts, not clickable — correct as is. Surface card chrome on GaugeCard / RegimeTrendChart is fine. The 28px/22px paddings on `MultiplierBanner` and `AiqEditor` decards diverge from the S22 32L (P2). |
| `/aiq` (index) | 5 | Two clickable Links inside each row hand-roll `textDecoration: none` and `color: var(--accent)` without `.accent-link` — no chevron slide affordance. Filter Link chips: no hover treatment. |
| `/aiq/[ticker]` | 11 | Editor close-link uses `.lin-hov` (correct); submit button uses `--dur-instant` (correct per "microtransition"); reset/discard button missing hover; source URL `<a>` in AiqHistory missing accent-link treatment; "Connect Supabase" inline link missing accent-link. |
| `/memos` | 4 | System-status banner: edge-asymmetric margin (P0). Filter chips: no hover. MemoCard expand button: bare cursor pointer, no hover (P1). |
| `/proposals` | 1 | Card-only, no clickables. Empty `ProposalCard` rendering — clean. |

---

## /regime

### Files audited
- `web/src/app/regime/page.tsx` (136 LOC)
- `web/src/app/regime/MultiplierBanner.tsx` (126 LOC)
- `web/src/app/regime/GaugeCard.tsx` (124 LOC)
- `web/src/app/regime/GaugeBar.tsx` (151 LOC)
- `web/src/app/regime/RegimeTrendChart.tsx` (351 LOC, client component)
- `web/src/app/regime/GateHistory.tsx` (123 LOC)
- `web/src/components/rails/RegimeLegendRail.tsx` (162 LOC)

### Findings

- [P2] `web/src/app/regime/page.tsx:70` — canvas wrapper uses `padding: "24px 32px 40px"`. Matches dashboard/universe convention but be aware S22 ribbon-inset uses 32L/40R; the canvas padding here is 32L/32R. Not a violation (this is canvas padding, not a ribbon) — flagging only because it's the same horizontal rhythm the ribbon rule is encoded against, and if a ribbon ever lands inside this canvas section it must shift to 40R.
- [P3] `web/src/app/regime/MultiplierBanner.tsx:31-36` — top/bottom hairline decard ("Mercury decard") strip. Correctly not using `.ribbon-inset` because this is a full-width decard (not a pill) per the comment line 27. Confirming "correctly not used."
- [P2] `web/src/app/regime/MultiplierBanner.tsx:65` — title attribute is good ("Approaching · {name} {pts} pts to gate · next {mult}×"); the chip itself uses a warning-tinted border/fill that's correct (--warning-text-*), but the chip has no hover affordance even though it carries explanatory information. Could remain static (informational, not actionable) — flag as P3 if you want a `title`-only static chip, P2 if you want it to become a click-target to /regime gauges. Stand-down: title attribute carries the explanation. Correctly static.
- [P1] `web/src/app/regime/GaugeCard.tsx:30-41` — gauge card is a surface-elevated card (`background: var(--surface)`, `border`, `padding`). It's NOT currently clickable (no href, no onClick) but the gate-hit chip (line 55-71) suggests a likely future affordance (click to drill into a per-gauge detail page). Currently terminal — `.kpi-hov` would be wrong. Flag as **correctly not using `.kpi-hov`** (no destination), with a note: if you later make these clickable to per-gauge histories, this is the place to add `.lin-lift` (chip-like clickable, per S22).
- [P2] `web/src/app/regime/GateHistory.tsx:39-49` — history rows are receipts (per docstring line 14, "no badges — just receipts"). Correctly not clickable, correctly not using `.row-hov`. Confirming "correctly not used."
- [P2] `web/src/app/regime/RegimeTrendChart.tsx:94-104` — Surface card chrome (var(--surface), border, radius 6). Static chart, no hover. Correctly not using `.kpi-hov`. Confirming correct.
- [P3] `web/src/app/regime/RegimeTrendChart.tsx:235` — series labels at right edge are connected to data points via SVG paths. No hover state on lines (would require client-side hit testing) — out of scope, acceptable.
- [P1] `web/src/components/rails/RegimeLegendRail.tsx:120-160` — `LegendRow` is informational only (gate label + value + threshold + blurb). NOT currently using `.rail-row-hov`. **Correct decision** if these are non-clickable (no per-gauge drill yet). If clickable later, must add `.rail-row-hov` per S22.
- [P2] `web/src/components/rails/RegimeLegendRail.tsx:55-94` — multiplier-table rows: similar receipts pattern. Active row uses color contrast to indicate state (good). No hover needed. Correctly not using `.row-hov`.

---

## /aiq (index)

### Files audited
- `web/src/app/aiq/page.tsx` (259 LOC)

### Findings

- [P1] `web/src/app/aiq/page.tsx:68-83` — "Drafts queue ›" Link in PageHeader action slot. Hand-rolled chip styling: `border: 1px solid var(--accent-border)`, `padding: 4px 10px`, no hover class. Should use `.lin-hov` (or `.lin-lift` if intended as a button-class chip) plus `.accent-link` semantics for the chevron. Currently zero hover affordance on a primary "navigate away" button.
- [P1] `web/src/app/aiq/page.tsx:103-122` — filter Link chips (Scored/Unscored/All). Bare `Link` with inline style; active state distinguished by `background: var(--hover-tint)` but **no hover state** for inactive chips. Should use `.lin-hov` (border-less tint on hover) or build a proper segmented-control component. Currently the chips look static until you click them.
- [P2] `web/src/app/aiq/page.tsx:160` — `<tr className="row-hov row-stagger-in">` — **correctly uses `.row-hov`**. Confirming compliance.
- [P1] `web/src/app/aiq/page.tsx:173-178` — ticker cell inner Link: `color: var(--text-1), textDecoration: none, fontWeight: 600`. No hover treatment. The whole `<tr>` has `.row-hov` so the row tint covers it, but the link itself doesn't lift to accent on hover (which is the standard "click-target inside hover-row" treatment — the row tints, the cell text-1 stays, but the explicit link inside should hint at accent). P1 because it's currently the same color as muted Td text — operators can't tell at a glance which cell is the click anchor inside the row.
- [P1] `web/src/app/aiq/page.tsx:198-207` — "Edit ›" Link in last column: `color: var(--accent)`, no `.accent-link` class, no chevron-slide affordance. Should use `.accent-link` so the `›` slides 2px on hover. Currently the only feedback is row-tint.

---

## /aiq/[ticker]

### Files audited
- `web/src/app/aiq/[ticker]/page.tsx` (133 LOC)
- `web/src/app/aiq/[ticker]/AiqEditor.tsx` (386 LOC, client)
- `web/src/app/aiq/[ticker]/AiqHistory.tsx` (226 LOC, client)
- `web/src/components/rails/AiqHistoryRail.tsx` (148 LOC)

### Findings

- [P1] `web/src/app/aiq/[ticker]/page.tsx:24` — "Back to Universe" Link in 404 state. Bare `color: var(--accent)`, no `.accent-link` class. Should slide chevron on hover (no chevron present here, easy add). P1.
- [P2] `web/src/app/aiq/[ticker]/page.tsx:92-106` — "↗ Detail" Link **correctly uses `.lin-hov`**. Confirming compliance.
- [P1] `web/src/app/aiq/[ticker]/AiqEditor.tsx:91-110` — Submit button. Inline `transition: "background var(--dur-instant) var(--ease-out)"` — uses token (good). But: no `:hover` declarations in inline style → no hover background lift. Inline-styled buttons can't express :hover without CSS-in-JS or a class — should be promoted to a class (`.btn-primary` or similar) so it gets a proper accent-hover lift. P1 because this is the page's primary CTA.
- [P1] `web/src/app/aiq/[ticker]/AiqEditor.tsx:113-130` — "Discard" reset button. No `transition` declared, no hover class, no hover :hover declarations. Bare inline styled. P1.
- [P2] `web/src/app/aiq/[ticker]/AiqEditor.tsx:108` — `transition: "background var(--dur-instant) var(--ease-out)"` — scoped to background (good, not `all`). Token-based duration (good). Confirming correct.
- [P3] `web/src/app/aiq/[ticker]/AiqEditor.tsx:217-238` — number input has no hover/focus visual lift beyond the implicit browser focus ring. Could add `.lin-hov` styling at the wrapper or a custom focus-ring. P3.
- [P2] `web/src/app/aiq/[ticker]/AiqEditor.tsx:241-243` — progress bar uses `var(--accent)` at opacity 0.7. Within S22 locked accent. Confirming correct.
- [P1] `web/src/app/aiq/[ticker]/AiqHistory.tsx:59-65` — `HistoryRow` outer div — no hover. The latest row gets `background: var(--accent-soft)` (correct accent-soft per S22). But historically the row is informational (no drill destination yet) — **correctly not using `.row-hov`** if non-clickable. P2: confirm whether the row will become clickable (drill to source URLs?) — if so, needs `.row-hov`.
- [P1] `web/src/app/aiq/[ticker]/AiqHistory.tsx:149-156` — Source URL `<a>` element. `color: var(--accent)`, `textDecoration: none`. No `.accent-link` class — no chevron slide. The `↗` glyph is part of the label text, not a chevron span, so the accent-link-chev animation wouldn't fire anyway. **P1**: should be `<a className="accent-link"><span>{slug}</span> <span className="accent-link-chev">↗</span></a>` so the arrow slides on hover.
- [P1] `web/src/app/aiq/[ticker]/AiqHistory.tsx:158-172` — "+N more" chip is a `<span>` with `title=` but no hover affordance. Currently inert (just shows a count). If the title is the only "tell," it's defensible — but the chip's pill chrome makes it look clickable. Either drop the chrome (it's an inert count) OR turn it into a popover trigger with `.lin-lift`. P1.
- [P2] `web/src/components/rails/AiqHistoryRail.tsx:93-101` — `HistoryRow` rail rows: no `.rail-row-hov`. Same disposition as canvas AiqHistory rows — currently informational. If they'll become clickable (drill into version diff), add `.rail-row-hov`. Confirming "informational, no hover" decision OR P2 if they should be clickable.

---

## /memos

### Files audited
- `web/src/app/memos/page.tsx` (291 LOC)
- `web/src/app/memos/MemoCard.tsx` (247 LOC, client)

### Findings

- [P0] `web/src/app/memos/page.tsx:122-150` — system-broken banner uses `margin: "10px 28px 0"`. The S22-locked inset-pill geometry is `margin: "10px 40px 0 32px"` (32L / 40R). This banner is a ribbon-class strip (sits above the filter bar, top-of-canvas alert). Either:
  - **(a)** Promote to a proper `.ribbon-inset` (32L/40R/r6, surface bg). The current `borderRadius: 5` should be 6.
  - **(b)** If it's intentionally NOT a ribbon (different posture for system-broken alerts), document that and use full-width edge-to-edge with no margin. The current 28L/28R asymmetric margin matches neither rule.
  - **Severity P0** because it's the only finding that breaks a locked-invariant geometry rule. Verify with Terry whether system-status banners are exempt or in-system.
- [P1] `web/src/app/memos/page.tsx:169-191` — KIND_TABS filter Links (All/Daily/Weekly). Bare Link with conditional active styling; **no hover state for inactive tabs**. Should use `.lin-hov` semantics. P1.
- [P1] `web/src/app/memos/page.tsx:215-230` — "Clear" Link in search row. No hover class. Bare inline style. Same as the AIQ Drafts queue chip — should adopt `.lin-hov`. P1.
- [P1] `web/src/app/memos/page.tsx:253-256` — "Clear filters" Link in empty state. `color: var(--accent)`, no `.accent-link`. Same as AIQ-detail back-link. P1.
- [P1] `web/src/app/memos/MemoCard.tsx:47-73` — MemoCard expand `<button>`. `cursor: "pointer"`, no transition, no hover lift, no class. The whole card is the expand affordance — should adopt `.lin-lift` (chip-like clickable, 1px lift) or a card-level `:hover` background. **Currently zero feedback on hover for the primary interaction on this page.** P1.
- [P2] `web/src/app/memos/MemoCard.tsx:40-46` — card uses `var(--border-subtle)`, `borderRadius: 6`, `background: var(--surface-1)`. Geometry within rule. No hover class — see MemoCard.tsx:47-73 above.
- [P3] `web/src/app/memos/page.tsx:263` — `animationDelay: ${Math.min(i * 40, 800)}ms` — pure animation, not transition. The stagger fires once on mount via the `.row-stagger-in` class. Out of scope for the hover-rule audit. P3 note: matches the existing stagger pattern across pages.

---

## /proposals

### Files audited
- `web/src/app/proposals/page.tsx` (203 LOC)

### Findings

- [P2] `web/src/app/proposals/page.tsx:75-150` — ProposalCard `<article>`: surface-elevated card with internal header/body/footer hairlines. Currently static (no expand, no drill). The footer says "approve actions ship in follow-up" — confirming the lack of click target is **intentional**. Card is correctly NOT using any hover class. Confirming compliance.
- [P3] `web/src/app/proposals/page.tsx:180-198` — individual ADD/TRIM item cards inside `ProposalList`. Each item card is `border: 1px solid var(--border-subtle), borderRadius: 5, padding: "8px 12px"`. Currently informational — once approve/dismiss actions ship, these likely become row-clickable (to expand the per-name reason). At that point, must adopt `.row-hov`. Confirming "correctly inert for now."

---

## Cross-cutting patterns

1. **`.lin-hov` is the missing utility class across all four pages.** Almost every "non-primary chip Link" (filter chips, breadcrumb back-links, drawer-queue chips) hand-rolls inline styling with no hover state. The single best fix is a global sweep: any Link that's not in a row and not a primary CTA should have `.lin-hov` on it. Estimated 10+ instances across `/aiq` index and `/memos` page.

2. **`.accent-link` is underused.** Inline `<a>` and `<Link>` in body copy (404 back-link, "Clear filters", source URLs in AiqHistory) all set `color: var(--accent), textDecoration: none` directly. Promoting to `.accent-link` gives them the 2px chevron slide that's signature of the design system. Five+ instances.

3. **Submit button hover affordances are zero.** AiqEditor's primary "Save scoring" button has a `--dur-instant` transition declared but no `:hover` rule because inline styles can't express :hover. This is a system-wide pattern problem — every form submit on the audited pages is impacted (only AIQ in the audited set, but Memos/Universe/Decisions form pages will all hit it). **Recommendation: extract a `.btn-primary` class to globals.css** with the accent fill, hover lift, pending state. Inline-styled buttons cannot satisfy the S22 hover lock.

4. **No non-locked purples found.** Searched for `#A78BFA`, `#7C3AED`, `#9333EA`, `#6D28D9`, `#5B21B6` — zero matches across audited pages. All accent usage routes through `var(--accent)`. Compliant.

5. **Duration literals are clean.** No `200ms`, `300ms`, raw `transition: all` strings found. The only literals in audited files are `animationDelay` calculations for the row-stagger entry animation (pure animation, not transition).

6. **Information vs action ambiguity** is the persistent design tension. Many surfaces (gauge cards, gate history rows, AIQ history rows, proposal cards) are currently informational but visually framed like cards (surface bg, border, radius). When operators are reading them, they probably try to click. Decision needed: either (a) reduce visual weight on inert surfaces (no surface bg, just hairlines + canvas — the "Mercury decard" pattern Terry already adopted on the MultiplierBanner) OR (b) make them clickable and adopt the corresponding hover class. The current state is "looks clickable, isn't" — which is the worst of both worlds for craft signaling.

---

## Next session implementation order (recommended)

1. **Fix P0**: `/memos` system-broken banner geometry (`web/src/app/memos/page.tsx:122-150`). Decide ribbon-or-not; either way the current 28L/28R asymmetric margin is wrong.
2. **Add `.lin-hov` to all bare Link chips** (10+ instances across `/aiq/page.tsx` and `/memos/page.tsx`): drafts queue button, filter chips, "Clear" button, "Clear filters" inline link, AIQ 404 "Back to Universe", AIQ-detail "Back to Universe" body link.
3. **Promote inline `<a color=var(--accent)>` to `.accent-link`** for AiqHistory source URLs (`AiqHistory.tsx:149-156`), AIQ "Edit ›" cell (`aiq/page.tsx:198-207`), and the empty-state "Clear filters" / "Connect Supabase" inline anchors.
4. **Extract `.btn-primary` and `.btn-secondary` classes to `globals.css`**, then refactor AiqEditor's Save / Discard buttons (`AiqEditor.tsx:91-130`) to use them. Adds hover lift to the page's primary CTA.
5. **Decide on MemoCard hover affordance** (`MemoCard.tsx:47-73`): card-level :hover background (recommended, `.lin-lift` semantics on the `<button>`), or accept that the cursor-pointer is the only tell. Given memos is the most-read page in the product, P1 fix here probably belongs above #4.
6. **Decide on the "informational card looks clickable" question** for GaugeCard, AIQ HistoryRow (canvas + rail), and ProposalCard items. If they will become clickable, add `.row-hov` / `.lin-lift` / `.rail-row-hov` as appropriate. If they will stay informational, reduce visual weight (drop surface bg, use Mercury decard hairlines only) to match Terry's intent on MultiplierBanner.
7. **Defer**: `RegimeTrendChart` series-line hover annotations (out of scope, would require client hit-testing).
