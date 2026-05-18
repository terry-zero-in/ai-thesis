# Instrument-Field Pattern — The Visual Standard

**Status:** LOCKED — Terry, 2026-05-18, S8 (post-PageCreateDrawer ship).
**Reference surface:** the Portfolio Add-Position drawer (`web/src/components/primitives/PageCreateDrawer.tsx` + `web/src/app/portfolio/AddPositionForm.tsx`).
**Authority:** This document supersedes any pre-2026-05-18 visual convention in `docs/design/` where conflicts exist. Mercury "format on canvas" carve-out preserved for strip-level chrome only — see §4.

Terry's verbatim directive: *"This box and font and formatting and use of shades and different colors is exactly how the entire app should look. This looks much sharper than the rest of the app."*

Every CRUD/control surface in AI Thesis renders against these patterns. Three patterns layered:

1. **Mono Meta** — typography and label hierarchy
2. **Instrument Field** — input/control chrome
3. **Inset Surface** — card/drawer/popover/modal chrome

The three are not separable. A surface that uses one without the others reads as either generic or inconsistent. They compound; ship them together.

---

## §1 — Mono Meta (typography hierarchy)

Every label, every section header, every status hint, every shortcut hint is **JetBrains Mono** uppercase.

| Role | Spec |
|---|---|
| Field label (above an input) | 10.5px · JetBrains Mono · `.06em` letter-spacing · uppercase · `--text-3` |
| Section header inside a card | 11px · JetBrains Mono · `.06-.08em` · uppercase · `--text-3` |
| Page sub-header / chrome label | 10.5px · JetBrains Mono · `.08em` · uppercase · `--text-3` |
| Shortcut hint (right of label) | 10px · JetBrains Mono · `--text-4` · `.04em` |
| Meta-strip segments (MonoMetaSpine) | 11px · JetBrains Mono · `--text-3` for label, `--text-2` for value |
| Numeric values (anywhere) | JetBrains Mono · `font-variant-numeric: tabular-nums` · right-aligned in columns |

**DO use sans (Geist via `var(--f)`) for:**
- Card titles that read as headlines (e.g. "Today's thesis" at 14px sans 600)
- Hero numbers that anchor a card (e.g. KPI cell values at 24px sans 600)
- Body prose / narrative copy (12.5-13px sans 400, `--text-2`)
- Marketing surfaces (different design lineage entirely)

**DO NOT use sans for:**
- Field labels (always mono)
- Status pills (always mono)
- Numbers in tables (always mono + tabular-nums)
- Timestamps, IDs, source attributions (always mono — institutional texture)

---

## §2 — Instrument Field (input/control chrome)

Every editable control reads as a *tool*, not friendly SaaS chrome.

### 2.1 Text / number / select inputs

```
height:            28px (text/number), 30px (select), ~36px (date)
padding:           0 8px (text), 0 8px with 20px pl for $-prefixed
font-size:         12.5px
font-family:       var(--f) for free-text, var(--m) for numeric
color:             var(--text-1)
background:        rgba(255,255,255,.02)
border:            1px solid var(--border)
border-radius:     4px
outline:           none (focus = subtle accent ring, not browser default)
```

### 2.2 Field stack rhythm

```
field-to-field gap:        10px
label-to-input gap:        4px
section divider:           1px solid var(--border-subtle), padding above/below 10px
```

### 2.3 Segmented toggle (2-3 options)

When the user picks among 2-3 mutually exclusive modes (Dollar / Shares, Add / Edit, Universe / Watchlist):

```
container:         inline-flex, border 1px solid var(--border),
                   border-radius 4px, padding 2px, bg rgba(255,255,255,.02)
each option:       padding 4px 12px, font-size 11.5px, var(--f),
                   border-radius 3px
active option:     background var(--accent-soft), color var(--accent), weight 500
inactive option:   color var(--text-2), background transparent
disabled option:   color var(--text-4), opacity .5, cursor not-allowed
```

**Not pill switches. Not radio buttons. Not dropdowns.**

### 2.4 Currency prefix

`$` glyph as `position: absolute, left: 8px, top: 50%, transform: translateY(-50%)`, `--text-3`, `var(--m)`, `pointer-events: none`. Input gets `padding-left: 20px`. NEVER render the prefix inside a separate rendered box.

### 2.5 Primary action button (the ONE per surface)

```
height:            32px
padding:           0 18px
font-size:         12px
font-weight:       600
font-family:       var(--f)
background:        var(--voltage) (the single voltage moment per page)
color:             var(--voltage-ink)
border:            none
border-radius:     9999px (rounded-full)
align-self:        flex-start (bottom-left of form, never center, never right)
```

When a surface has BOTH a primary save action AND a destructive action (delete, discard), the destructive button is GHOST chrome — 1px border, transparent bg, `--text-3` text, same height/radius. Voltage is reserved for the affirmative path.

### 2.6 Use-current / inline chip affordances

Small chips that surface a one-tap helper value (e.g. "use current $384.55"):

```
align-self:        flex-start
font-size:         10px
font-family:       var(--m)
color:             var(--text-3)
background:        transparent
border:            1px solid var(--border)
border-radius:     3px
padding:           1px 6px
```

---

## §3 — Inset Surface (card / drawer / popover / modal)

### 3.1 Two surface roles — pick deliberately

The key choice: does the surface FLOAT over the canvas, or does it SIT on the canvas?

| Role | Background | Border | Shadow | Use for |
|---|---|---|---|---|
| **Floating** | `var(--surface)` | 1px `var(--border)` | Drop-shadow | Drawers, popovers, modals, command palette, dropdowns |
| **Inset card** | `var(--surface)` | 1px `var(--border-subtle)` | None | Headline cards on the canvas (Today's Thesis, Alert callout, gate strip) |
| **Strip / format-on-canvas** | none (transparent) | hairline dividers only | None | KPI strip cells, MonoMetaSpine, section headers |

**The visual differential between `var(--canvas)` and `var(--surface)` is what makes a card READ as a card.** A card with `background: var(--canvas)` is invisible — it relies entirely on the border to exist, which makes it feel weak.

**Pre-2026-05-18 anti-pattern:** Cards rendered as `background: var(--canvas) + border: 1px var(--border-subtle)` (canvas-on-canvas). They blend into the canvas and feel wispy. **Lift them all to `var(--surface)` + same subtle border.** Mercury "format on canvas" rule is retired as the default; it survives only for strip/spine chrome (§4).

### 3.2 Interior padding

```
floating header strip (drawer chrome):     10px 14px
floating body padding:                     14px 16px
inset card padding:                        16px 20px (headline), 12px 16px (compact)
internal divider:                          1px solid var(--border-subtle)
border-radius:                             6px (consistent across all surfaces)
```

### 3.3 Drop-shadow recipe (floating only)

```
box-shadow: 0 10px 32px rgba(0,0,0,.45), 0 2px 8px rgba(0,0,0,.30);
```

Two-stop shadow — heavy ambient + tight contact. Inset cards get NO shadow; the surface-fill differential carries the depth.

### 3.4 Header pattern (overlays + cards)

```
display: flex, align-items: baseline
left:  mono uppercase label (§1)
right: action affordance (× close for overlays, "Open X ›" link for inset cards)
padding-bottom: 8-10px
border-bottom: 1px solid var(--border-subtle)
```

---

## §4 — Mercury format-on-canvas exception

The KPI strip (`web/src/app/page.tsx:KpiRow`) and MonoMetaSpine remain `var(--canvas)` (transparent) by deliberate choice:

- These are *strip-level* chrome, not cards. They render a row of cells separated by 1px vertical hairlines, with a top + bottom hairline framing the strip.
- The strip ITSELF is the chrome; the cells are content within. Adding fill would make them feel like a row of cards, which is wrong for the role.
- Mercury Pic 17/19 b2 lock — confirmed working pattern, do not change.

Anything that is NOT a strip and is currently `var(--canvas)` should be lifted to `var(--surface)` per §3.1.

---

## §5 — Color discipline (the "use of shades and different colors")

### 5.1 Accent budget — one moment per surface

Accent (`var(--accent)`) is precious. Per surface:

- **One** primary action (the Voltage CTA, NOT accent)
- **One or two** in-prose navigation moments (e.g. "Open regime ›", "View all ›")
- **Zero** decorative accent usage

If a surface has 5+ accent-colored "Open X ›" links scattered across it, that surface has FAILED color discipline. Combine, hoist to a single section right-slot, or demote to `--text-3` chrome.

### 5.2 Severity tokens — only at severity moments

```
--success  for genuine positive numerics (P&L positive, ↑ deltas)
--warning  for "calibrate-state" signals (Stubbed mode, gate-hit warnings)
--danger   for negative numerics + real failures
--info     for editorial/info pills (the violet accent — used sparingly)
```

Never use severity tokens as decoration. A "Today's date" timestamp does not need green. A label does not need amber.

### 5.3 Text hierarchy

```
--text-1   primary numbers, headlines, active-state labels, input values
--text-2   secondary body text, inactive segmented options, prose
--text-3   labels, metadata, source attributions, "open X ›" links at rest
--text-4   shortcut hints, ghost states, "no data" placeholders
```

Promote on hover (e.g. `--text-3` link → `--text-2` on hover) for affordance; never promote at rest.

---

## §6 — DO / DON'T quick reference

**DO:**
- Use `var(--surface)` for any card/overlay that should READ as a card
- Use 10.5px mono uppercase `.06-.08em` for all labels
- Use mono + tabular-nums for every number on screen
- Pick ONE primary action and ONE accent moment per surface
- Use segmented toggles for 2-3 option choices
- Use `--border-subtle` for INTERIOR dividers; `--border` for surface chrome

**DON'T:**
- Render cards on `var(--canvas)` (they blend, feel wispy) — lift to surface
- Use sans-serif for field labels (always mono)
- Use multiple voltage CTAs on the same page (the ONE rule)
- Use accent for decorative emphasis (it's the active-state moment)
- Use heavy borders on inset cards (subtle only; floating overlays get the heavier border)
- Use shadcn defaults — rounded-xl, soft gradients, friendly purple all banned

---

## §7 — Surface roll-out map (as of S8 ship)

| Surface | State | Required action |
|---|---|---|
| Portfolio Add-Position drawer | ✅ Canonical reference | None |
| Score Math popover (THS-73) | ✅ Likely on-pattern | Verify §3.1 surface-fill |
| Universe filter rail | ⚠️ Partially | Audit §1 + §3 |
| Dashboard TodayThesisCard | 🔴 Off — `--canvas` bg | Lift to `var(--surface)` |
| Dashboard AlertCallout | 🔴 Off — no bg | Add `var(--surface)` bg |
| Dashboard CompactGateStrip | 🔴 Off — no bg | Add `var(--surface)` bg |
| Dashboard MorningBrief panels | 🔴 Off — `--canvas` bg | Lift to `var(--surface)` |
| Dashboard KPI strip | ✅ Mercury exception §4 | None |
| Dashboard MonoMetaSpine | ✅ Mercury exception §4 | None |
| Regime page cards | ⏳ Unaudited | TBD |
| Portfolio AggregateBar | ⏳ Unaudited | TBD |
| AIQ Editor / AIQ Drafts | ⏳ Unaudited | TBD |
| Decisions inbox | ⏳ Unaudited | TBD |
| Memos | ⏳ Unaudited | TBD |
| Backtest | ⏳ Unaudited | TBD |
| Settings | ⏳ Unaudited | TBD |
| Marketing landing | ✅ Different lineage | None — consumer surface, separate /lambo bar |

Per-surface audit + lift is a single-purpose commit each. Do not bundle multiple surface lifts unless they're all part of the same page.

---

## §8 — How to verify a surface is on-pattern

Before claiming a surface conforms:

1. **Surface-fill check** — is the background `var(--surface)`, `var(--canvas)`, or transparent? Justify against §3.1.
2. **Label scan** — every uppercase label is JetBrains Mono?
3. **Number scan** — every numeric is mono + tabular-nums?
4. **Accent count** — at most one primary action + 1-2 nav links per surface?
5. **Severity audit** — severity tokens only at genuine severity moments?
6. **Visual diff** — open the surface side-by-side with the Portfolio Add-Position drawer. Does it read at the same density / chrome confidence? If not, name what's missing.

Failing any check = surface needs work before ship.
