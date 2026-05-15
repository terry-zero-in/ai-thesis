# AI Thesis v2 — Master Design Spec

**For:** Claude Design (mockup + prototype handoff)
**By:** Terry Turner with Perplexity
**Date:** May 15, 2026
**Version:** 1.0

---

## 0. Purpose

This document specifies the **visual system, layout shell, and per-page wireframes** for AI Thesis v2 — a multi-factor AI-investing scoring engine that ranks ~70 public-equity names across 5 layers and drives a $100K portfolio.

The functional scope is locked in `AI-Thesis-v2-Algorithm-and-Deployment.md`. This document is **how it looks and feels**. It does not redefine features, weights, or data flows — those are in Linear tickets THS-29 through THS-67.

This spec is the source of truth for design. If anything below conflicts with the Linear tickets on visual matters, this document wins. If anything below conflicts on functional matters, the algorithm doc wins.

---

## 1. Design principles (the operating posture)

1. **Calm at the chrome, precise at the data.** App-frame elements (nav, headers, page chrome) breathe like Linear or Mercury. Numeric cells, tickers, IDs, timestamps, and tabular data are tight, monospaced, and unambiguous.
2. **Hairlines, not boxes.** Composition is created by 1px borders and spacing — not by rounded cards, shadows, or panels with backgrounds different from their canvas. Where surfaces do change, they change by 1 step on the gray ladder, no more.
3. **Monochrome with one accent.** Cypher Indigo `#4D5BFF` is the only chromatic accent. Status colors (success / warning / danger / info) are reserved exclusively for *signals*, never for decoration.
4. **Mono for measured, sans for written.** Every number, ticker, timestamp, ID, percentage, basis points, hex, or otherwise-fixed value is JetBrains Mono. Every prose label, header, button, and body word is Geist Sans.
5. **Density without aggression.** Tables run 38–44px row height with 14.5px sans cells and 13px mono numerics. No alternating zebra stripes. Hover is the only background change.
6. **Disclosure over decoration.** Hovering a score reveals its decomposition. Hovering a name reveals its bear case. The screen is quiet until you ask it to talk.
7. **The score is the protagonist.** Every screen in the product points at the composite score, its factor decomposition, or its trajectory. Anything that does not serve that hierarchy is supporting cast.

---

## 2. Design tokens

These are the locked tokens. Implement as CSS custom properties at `:root`.

### 2.1 Color

```css
/* Surfaces — warmer-gray ladder, no pure black */
--bg:               #0B0C0F;   /* canvas */
--surface:          #15171C;   /* primary surface (panels, table bg on hover-row groups) */
--surface-2:        #1B1E25;   /* inset / secondary surface (tag chips, pulse bars) */
--surface-elevated: #22262E;   /* modal / popover / dropdown */
--surface-hover:    #232730;   /* row hover */
--border:           #2A2F38;   /* visible divider */
--border-subtle:    #1F2229;   /* hairline; the default border throughout */

/* Text */
--text-1: #ECEDEF;   /* primary text, headers, ticker symbols */
--text-2: #CFD3DA;   /* body, secondary labels */
--text-3: #7A818D;   /* tertiary, column headers, meta, placeholders */

/* Accent — Cypher Indigo, locked */
--accent:       #4D5BFF;
--accent-soft:  rgba(77, 91, 255, 0.10);   /* badge backgrounds, active states */
--accent-glow:  rgba(77, 91, 255, 0.18);   /* focus rings, faint highlights */
--accent-hover: #6573FF;

/* Semantic — desaturated, never decorative */
--success:      #5BB880;   /* positive deltas, "approved" states, in-range gauges */
--success-soft: rgba(91, 184, 128, 0.10);
--warning:      #DDA85A;   /* gauge approaching threshold, Medium tier, caution */
--warning-soft: rgba(221, 168, 90, 0.10);
--danger:       #E07878;   /* negative deltas, Avoid tier, fired alerts, gate hits */
--danger-soft:  rgba(224, 120, 120, 0.09);
--info:         #6594E8;   /* neutral signals, in-range warnings */
--info-soft:    rgba(101, 148, 232, 0.07);
```

**Rules of use:**
- The accent indigo is the only color that signifies "active / selected / mine." It does not signify "good." Green does that.
- Success/warning/danger/info are reserved for **truth states**: a number went up, a gauge hit a threshold, a tier degraded. They do not appear on buttons, brand elements, or decorative chrome.
- Tier colors map: **High = accent indigo** (it's "ours"), **Medium = warning amber**, **Low = info blue**, **Avoid = danger red**. This is the only place `--info` and `--warning` are used semantically on a primary surface.

### 2.2 Typography

```css
--sans: 'Geist', system-ui, -apple-system, 'Segoe UI', sans-serif;
--mono: 'JetBrains Mono', ui-monospace, 'SF Mono', 'Menlo', monospace;
```

**Type scale:**

| Use | Family | Size | Weight | Letter-spacing | Line-height |
|---|---|---|---|---|---|
| Page title (h1) | Geist | 22px | 500 | -0.015em | 1.25 |
| Section title (h2) | Geist | 17px | 500 | -0.01em | 1.3 |
| Panel title | Geist | 13px | 500 | -0.005em | 1.4 |
| Body | Geist | 14.5px | 400 | 0 | 1.55 |
| Body-secondary | Geist | 13px | 400 | 0 | 1.5 |
| Column header / label | Geist | 11px | 500 | 0.06em uppercase | 1.4 |
| Caption / meta | Geist | 12px | 400 | 0 | 1.45 |
| Numeric large (KPI) | JetBrains Mono | 24px | 500 | -0.015em | 1.1 |
| Numeric medium (table) | JetBrains Mono | 13px | 400 | 0 | 1.4 |
| Numeric small (delta, meta) | JetBrains Mono | 11px | 400 | 0 | 1.4 |
| Code / IDs | JetBrains Mono | 12px | 400 | 0 | 1.4 |

**Numerals must be tabular** — apply `font-variant-numeric: tabular-nums` to every mono span. Tables align decimals.

### 2.3 Spacing

8px base. Layout grid uses 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48. Sidebar is **220px**. Topbar is **48px**. Right rail (when present) is **280px**. Page gutter is **32px horizontal**, sections separated by **20px vertical with a `--border-subtle` divider** (not whitespace alone — Reticle uses the divider).

### 2.4 Radius

```css
--radius-sm: 3px;   /* tag chips, kbd, badges */
--radius:    5px;   /* nav items, buttons, inputs */
--radius-md: 6px;   /* panels, search, large surfaces */
```

No radius larger than 6px. No `rounded-xl`. No pill buttons except tag chips and status pills.

### 2.5 Border

Default: `1px solid var(--border-subtle)`. Visible separator: `1px solid var(--border)`. Never wider than 1px. **There are no shadows in this product** — except the optional faint focus ring `0 0 0 2px var(--accent-glow)`.

### 2.6 Motion

| Transition | Duration | Easing |
|---|---|---|
| Background / color | 120ms | ease |
| Hover lift (sparkline color change, etc.) | 200ms | ease |
| Panel expand / accordion | 200ms | cubic-bezier(0.4, 0, 0.2, 1) |
| Tooltip in/out | 100ms / 80ms | ease |
| Page transition | none | — |

No spring animations. No bounces. No staggered fades. Motion is functional, not decorative.

---

## 3. Application shell

### 3.1 Grid

```
┌──────────────────────────────────────────────────────────────┐
│ TOPBAR (48px)                                                │
├────────┬─────────────────────────────────────────┬───────────┤
│        │                                         │           │
│ NAV    │  MAIN                                   │ RIGHT     │
│ 220px  │                                         │ RAIL      │
│        │  ── page gutter 32px left/right ──      │ 280px     │
│        │                                         │ (context) │
│        │                                         │           │
│        │                                         │           │
└────────┴─────────────────────────────────────────┴───────────┘
```

Right rail is **contextual and per-page** (see §6). It is not present on every page. When absent, MAIN extends to the right edge.

### 3.2 Topbar (48px)

Left to right:
- **Brand cluster** — Basis logo (height 20px), 1px vertical divider, product name "AI Thesis" in `--text-2` 13px Geist. Click brand → /dashboard.
- **Breadcrumb** — `Routes / Detail` style when not on a top-level page (Reticle pattern). 13px `--text-2`, separator `/` in `--text-3`.
- **Spacer**
- **Search** — 32px tall, max-width 480px, `--surface` bg, `--border-subtle` border, 6px radius. Magnifier icon left, placeholder "Search tickers, names, memos…", `⌘K` chip right-aligned. Hover → `--border` border + `--surface-2` bg.
- **Right cluster** — icon buttons 32×32, 6px radius, `--text-2`. Icons: alerts (with `--accent` dot when present), help, panel-toggle for right rail. Then `1px×20px` divider. Then avatar 28×28 with initials, 1px subtle border.

Background `--bg`, bottom border `--border-subtle`. Sticky.

### 3.3 Sidebar (220px)

```
─────────────────────
[ COMMAND CENTER ]    ← 11px uppercase --text-3 tracked-out
  ◐  Dashboard
  ▢  Universe              12        ← mono badge for count
  ⬢  Portfolio
  ⚐  Regime
  ⊞  Memos                 3
  ✓  Decisions

[ WORKSPACE ]
  ◇  AIQ Editor
  ⚙  Settings
─────────────────────

bottom:
  ⓣ  Terry Turner       ← avatar + name, click → profile menu
```

- Section labels: 11px Geist 500 uppercase, 0.06em tracking, `--text-3`, 12px top / 6px bottom padding.
- Nav items: 13px Geist 400 in `--text-2`, 7px vertical / 10px horizontal padding, 5px radius, 14×14 stroke-1.5 icon at `opacity: 0.85`.
- **Active state:** `--surface` background, `--text-1` color, and a 2px×16px indigo bar at `left: -8px` (Reticle's left-edge accent — do not switch to a fill).
- Hover: `--surface` background, `--text-1` color, no left bar.
- Badge: right-aligned 10px JetBrains Mono in `--surface-2` 3px-radius chip. When item is active, badge becomes `--accent-soft` bg + `--accent` text.

Sidebar bg matches `--bg` (no separate panel color). Right border is `--border-subtle`.

### 3.4 Right rail (280px, contextual)

Per page:
- **/dashboard** → "Today" rail: today's score movers (top 5 ↑ / ↓), insider Form 4 flagged today, macro-gate state.
- **/universe** → Filter rail: layer chips, tier chips, AIQ-min slider, depreciation-flag toggle, "show only High" toggle.
- **/n/[ticker]** → Activity rail: tier history, recent score changes with timestamps, insider events, news links.
- **/portfolio** → Reserve rail: $20K remaining, trigger 1 status, trigger 2 status, "Add tranche" cta when fired.
- **/aiq/[ticker]** → History rail: prior AIQ versions diffed, scored-by, source links.
- **/regime** → Gauge legend rail: NAAIM history bands, AAII threshold reference, F&G regime states.

Rail header pattern (consistent across pages):

```
─────────────────────
[ ICON ] CONTEXT LABEL    ← 11px uppercase --text-3
─────────────────────
content
─────────────────────
```

Rail is dismissable via topbar panel-toggle icon. State persists in localStorage.

---

## 4. Component inventory

### 4.1 Tier badge

```
┌─────────┐
│  HIGH   │   ← 10px Geist 500 uppercase, 0.05em tracking
└─────────┘
  bg: accent-soft, color: accent (HIGH)
  bg: warning-soft, color: warning (MEDIUM)
  bg: info-soft, color: info (LOW)
  bg: danger-soft, color: danger (AVOID)
  padding 2px 7px, radius 3px
```

### 4.2 Factor bar (Q/G/V/AIQ decomposition)

Horizontal bar per factor. Width = factor score / 100.

```
Q   ████████████████████░░░░░░░  78
G   ████████████████████████░░░  88
V   ██████████░░░░░░░░░░░░░░░░░  35
AIQ ████████████████████████░░░  87
```

- Label 11px Geist uppercase `--text-3`, 36px width.
- Bar 6px tall, `--surface-2` background, fill `--accent` (or `--warning` if penalty applied to V, `--danger` if score <40).
- Score 13px JetBrains Mono `--text-1` right-aligned, 30px width.
- 4px vertical gap between bars.

Hover any factor row → tooltip 240px wide shows sub-factor breakdown (e.g. Q → profitability 82, growth 76, safety 72, payout 80).

### 4.3 Macro gauge tile (NAAIM / AAII / F&G)

```
┌────────────────────────────┐
│ NAAIM EXPOSURE             │   ← 11px uppercase
│                            │
│  96.67    +3.07 wk-over-wk │   ← mono 24px / delta mono 11px
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 100      │   ← gauge bar, mono scale below
│  0       50       90 ▲ 100│
│                            │
│  GATE HIT  >90 top decile  │   ← warning bg, warning text
└────────────────────────────┘
```

- Tile bg `--bg`, border `--border-subtle`, radius 6px, 16px padding.
- Gauge bar 6px tall, `--surface-2` track, fill `--accent`. Threshold tick at gate value (90 for NAAIM, +30 for AAII spread, 80 for F&G) drawn as 2px `--warning` vertical line.
- Marker (current value) is a 2px `--text-1` vertical line.
- Gate-hit ribbon at bottom: 11px uppercase, `--warning-soft` bg, `--warning` text. Hidden when gate not hit.

### 4.4 KPI card (portfolio header)

```
┌─────────────────────────────────────────────┐
│ PORTFOLIO VALUE                              │
│                                              │
│ $87,420.50           +$1,240 today  +1.44%  │
│                                              │
│         ─╱╲╱╲─╲╱╲─╲╱─               (spark) │
└─────────────────────────────────────────────┘
```

- Padding 18px / 24px.
- Label 11px uppercase `--text-3` 0.06em.
- Value 24px JetBrains Mono 500 `--text-1`.
- Delta 11–12px JetBrains Mono, color `--success` or `--danger`, with up/down chevron 10px icon.
- Sparkline 80×32 px on the right, line `--success` for positive trend / `--danger` for negative / `--accent` for selected. Gradient fill below at 0.25 opacity → 0.

Cards align in a 4-column row, separated by 1px `--border-subtle` vertical dividers (not gutters). On hover, full card background lifts to `--surface`.

### 4.5 Tag chip

```
┌────────────┐
│ L1 COMPUTE │   ← 10px Geist 500 uppercase, 0.05em tracking
└────────────┘
  bg: surface-2, color: text-2
  padding 1px 5px, radius 3px (sm)
```

For neutral metadata (layer, AI segment, sector). Active/selected: `--accent-soft` bg + `--accent` color. Never use for actions — chips are not clickable buttons; they are filter affordances at most.

### 4.6 Status pill (with semantic state)

Wider than a tag, used for tier or recommendation. 2px 7px padding, 3px radius, 10.5px Geist 500 uppercase 0.05em.

| State | bg | color |
|---|---|---|
| HIGH / BUY / APPROVED | accent-soft | accent |
| BUY (action) | success-soft | success |
| MEDIUM / HOLD | warning-soft | warning |
| LOW / WATCH | info-soft | info |
| AVOID / SELL | danger-soft | danger |

(High conviction tier uses indigo because *we* believe in it; Buy actions are green because money goes up. Two different axes.)

### 4.7 Sparkline

```svg
<svg viewBox="0 0 80 24" preserveAspectRatio="none">
  <path d="M0,18..." fill="none"
        stroke="#5BB880" stroke-width="1.25"
        stroke-linecap="round" stroke-linejoin="round"/>
</svg>
```

- 1.25px stroke, round caps.
- Color: `--success` if end > start, `--danger` if end < start, `--text-3` if flat (±0.5%).
- 24–32px tall, 80–120px wide.
- No axes, no labels, no dots. Pure trace.

### 4.8 Conviction ticks (optional micro-viz)

10 vertical 4px×8px ticks, gap 1.5px. Filled = `--accent`. Unfilled = `--surface-2`. Right-aligned. Used in dense tables next to tier badge to show "8/10 conviction" without taking a numeric column.

### 4.9 Score-history sparkline (12-week)

Same primitives as 4.7 but 120×40, with a faint horizontal line at score=60 (Medium threshold) and score=75 (High threshold) drawn in `--border-subtle`.

### 4.10 Depreciation flag

```
⚠ Depreciation -10
```

Inline 11px Geist, `--warning` icon (or `--danger` if penalty ≥-7), value in mono. Click → opens tooltip with extension years, source URL, Burry overstatement %.

### 4.11 Data table

The signature density component.

- Width: 100% of main area.
- Wrapper: `--surface` bg, 1px `--border-subtle` border, 6px radius, `overflow: hidden`.
- Header row: `--bg` bg (one step darker than table), 12px / 16px padding, 11px Geist 500 uppercase 0.05em `--text-3`. Bottom border `--border-subtle`.
- Body row: 14–16px / 16px padding, 13px sans for prose, 13px mono for numerics. Bottom border `--border-subtle`. Last row no border.
- Hover: `--surface-hover` bg. Cursor pointer if row is navigable.
- Right-aligned numeric columns (`text-align: right`). Center-aligned status columns.
- Ticker cell: 13px JetBrains Mono 500 `--text-1`, with 12.5px Geist `--text-2` name beneath at 2px margin-top.
- Delta cells: mono, `--success` / `--danger` color, no chevron icon at 13px size (too noisy).

### 4.12 Empty state

```
              [outline icon 32×32 --text-3]

              No depreciation flags
              for this layer

              Adjust filter or run rubric refresh.
                   [ Refresh →  ]   ← link-style, --accent
```

Centered in the available area. Icon, then 14.5px Geist `--text-1` headline, then 13px `--text-3` explainer, then optional link action. No buttons. No illustrations.

### 4.13 Loading state

- Tables: skeleton rows (rectangles in `--surface-2`, no shimmer animation — just a 600ms fade-in cycle on opacity 0.4 → 0.7).
- Scores: dash placeholder `—` in `--text-3`, mono.
- Charts: dotted-line placeholder with "Loading…" 11px `--text-3` label.

### 4.14 Error state

Inline at the data origin. 12px Geist `--danger`, with an "Retry" link in `--accent`. Never use modal error dialogs.

### 4.15 Tooltip

`--surface-elevated` bg, 1px `--border` border, 5px radius, 8px / 10px padding, 12px Geist `--text-1`. Max 280px wide. Arrow optional (8px). Delay 350ms in / 80ms out.

### 4.16 Modal

`--surface-elevated` bg, 1px `--border` border, 6px radius. Backdrop `rgba(11,12,15,0.6)` (canvas alpha). Header: 16px Geist 500, close icon top right. Padding 20px / 24px. Max-width 540px for forms, 720px for content.

### 4.17 Button

| Variant | bg | color | border |
|---|---|---|---|
| Primary | `--accent` | white | none |
| Primary hover | `--accent-hover` | white | none |
| Secondary | `--surface-2` | `--text-1` | 1px `--border` |
| Ghost | transparent | `--text-2` | none |
| Danger | `--danger-soft` | `--danger` | 1px `--danger` (alpha 0.4) |

All buttons: 32px tall, 12px horizontal padding, 13px Geist 500, 5px radius. Icon-only button: 32×32. Focus ring: `0 0 0 2px var(--accent-glow)`. No raised shadow ever.

---

## 5. Page-by-page wireframes

Each page is described as a markdown wireframe with annotated regions. Claude Design should treat these as the structural skeleton and dress them in the tokens from §2 and components from §4.

### 5.1 /dashboard

The "what's important right now" view. First thing on login.

```
┌── TOPBAR ──────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────┘
┌─ NAV ─┬─ MAIN ──────────────────────────────────────────────┬─ RAIL ──┐
│       │                                                     │         │
│       │  Good evening, Terry                                │ TODAY   │
│       │  Friday, May 15, 2026 · 23:24 CT                    │         │
│       │  ─────────────────────────────────────────────────  │ Top     │
│       │                                                     │ score   │
│       │  ┌── PORTFOLIO ──┬── DAY P&L ──┬── 30D RET ──┬── HIGH-│ movers │
│       │  │ $87,420.50    │ +$1,240     │ +4.81%      │ TIER  │  TSM ↑ │
│       │  │ +1.44% today  │ +1.44%      │ vs SPY +1.2%│ 4     │  NVDA ↑│
│       │  │  ───╱╲╱─      │  ─╱─╲─      │  ─╱╱╱─      │  4/12 │  PLTR ↓│
│       │  └───────────────┴─────────────┴─────────────┴───────┘ AAPL ↓ │
│       │                                                     │         │
│       │  ─────────────────────────────────────────────────  │ INSIDER │
│       │                                                     │ TODAY   │
│       │  Score movers · last 7 days                         │ — none  │
│       │                                                     │         │
│       │  ┌────────────────────────────────────────────────┐ │ MACRO   │
│       │  │ TICKER  LAYER   COMPOSITE   Δ 7D    DRIVER     │ │ GATES   │
│       │  ├────────────────────────────────────────────────┤ │ NAAIM   │
│       │  │ TSM     L1      82.2 ↑     +3.1    G  +5      │ │  96.7 ⚠ │
│       │  │ VST     L4      73.8 ↑     +2.4    Q  +3      │ │ AAII    │
│       │  │ PLTR    L3      64.4 ↓     −1.8    V  −2      │ │  +5.4   │
│       │  │ META    L2      61.4 →      0.0    —          │ │ F&G     │
│       │  └────────────────────────────────────────────────┘ │  66     │
│       │                                                     │ MULT    │
│       │  ─────────────────────────────────────────────────  │ 0.95×   │
│       │                                                     │         │
│       │  Regime · macro gate state                          │         │
│       │                                                     │         │
│       │  [NAAIM gauge] [AAII gauge] [F&G gauge]             │         │
│       │   96.67 GATE   +5.36         66                     │         │
│       │                                                     │         │
└───────┴─────────────────────────────────────────────────────┴─────────┘
```

**Notes:**
- KPI row uses component 4.4 (4 columns, dividers not gutters).
- Score movers table uses 4.11. Delta column is mono with arrow glyph in `--success`/`--danger`. Driver cell shows the top single factor that moved with `+5` magnitude.
- Three macro gauges side-by-side using component 4.3. Below them: one-line summary "1 of 3 gates hit · 0.95× multiplier active on High tier."
- Right rail uses the §3.4 spec.

### 5.2 /universe

The scoring table. The page Terry will spend the most time on.

```
┌── TOPBAR ──────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────┘
┌─ NAV ─┬─ MAIN ──────────────────────────────────────────────┬─ RAIL ──┐
│       │                                                     │         │
│       │  Universe                                            │ FILTER  │
│       │  70 tickers · scored as of May 15, 2026             │         │
│       │  ─────────────────────────────────────────────────  │ LAYER   │
│       │                                                     │ ☐ L1    │
│       │  [Layer ▾] [Tier ▾] [AIQ ≥ __] [Sort: Score ▾] [⟳] │ ☐ L2    │
│       │                                                     │ ☐ L3    │
│       │  ┌───────────────────────────────────────────────┐ │ ☐ L4    │
│       │  │TICKER NAME  LAY  Q  G  V AIQ  COMP Δ7D TIER  │ │ ☐ L5    │
│       │  ├───────────────────────────────────────────────┤ │         │
│       │  │TSM   Taiwan… L1  92 88 75 92  82.2 +3.1 HIGH │ │ TIER    │
│       │  │GOOGL Alphab… L2  90 78 75 74  77.7 +0.4 MED  │ │ ☐ High  │
│       │  │NVDA  NVIDIA  L1  88 95 60 87  79.7 +1.2 HIGH │ │ ☐ Med   │
│       │  │ASML  ASML    L1  88 75 70 88  79.0 −0.3 HIGH │ │ ☐ Low   │
│       │  │ANET  Arista  L1  82 92 50 85  76.6 +2.1 MED  │ │ ☐ Avoid │
│       │  │AVGO  Broadc… L1  85 92 55 84  74.1 +0.8 MED  │ │         │
│       │  │VST   Vistra  L4  78 88 70 78  77.7 +2.4 MED  │ │ AIQ MIN │
│       │  │GEV   GE Ver… L4  82 90 60 78  77.6 +1.5 MED  │ │ ▮▮▮▮░░  │
│       │  │CEG   Constel L4  80 78 65 78  74.6 +0.2 MED  │ │  60     │
│       │  │…     …       …   …  …  …  …    …    …    …   │ │         │
│       │  └───────────────────────────────────────────────┘ │ FLAGS   │
│       │                                                     │ ☐ Depr  │
│       │  Showing 12 of 70 · click row for detail           │ ☐ Burry │
│       │                                                     │ ☐ Macro │
└───────┴─────────────────────────────────────────────────────┴─────────┘
```

**Notes:**
- Filter row above table: 32px tall, ghost buttons with caret. Each opens a popover with checkbox list. Active filter = `--accent-soft` bg + `--accent` text.
- Column Q/G/V/AIQ cells: factor scores in 13px mono `--text-2`. Background of cell tinted `--accent-soft` if score ≥80, no tint otherwise.
- Composite column: 13px mono `--text-1` (brighter — it's the headline).
- Δ7D: mono with `--success`/`--danger` color, no arrow glyph (too noisy at table scale).
- Tier column: tier badge per 4.1.
- Row hover lifts to `--surface-hover`.
- Click row → /n/[ticker].

### 5.3 /n/[ticker] (name detail)

The deep view on a single name.

```
┌── TOPBAR ──────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────┘
┌─ NAV ─┬─ MAIN ──────────────────────────────────────────────┬─ RAIL ──┐
│       │                                                     │         │
│       │  Universe / TSM                                      │ ACTIV.  │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │ MAY 14  │
│       │  TSM    Taiwan Semiconductor                         │ +3.1 Q  │
│       │  L1 COMPUTE · scored May 15 · HIGH                   │ MAY 12  │
│       │                                                     │ AIQ +2  │
│       │  Composite  82.2  ↑ +3.1 (7d)                        │ MAY 08  │
│       │  Macro mult 0.95×  → 78.1 effective                  │ Q1 print│
│       │  ─────────────────────────────────────────────────  │ +revenue│
│       │                                                     │         │
│       │  FACTORS                                             │ INSIDER │
│       │  Q   ████████████████████░░░  92                     │ — none  │
│       │  G   ███████████████████░░░░  88                     │ recent  │
│       │  V   ████████████████░░░░░░░  75                     │         │
│       │  AIQ ████████████████████░░░  92                     │ NEWS    │
│       │  (hover for sub-factors)                             │ Apr 16  │
│       │  ─────────────────────────────────────────────────  │ Q1 2026 │
│       │                                                     │ +58%    │
│       │  AIQ RUBRIC                                          │ profit  │
│       │  Disclosure          18 / 20                         │         │
│       │  Defensibility       18 / 20                         │ Apr 10  │
│       │  Concentration       12 / 15                         │ +AAPL   │
│       │  Capex efficiency    15 / 15                         │ orders  │
│       │  Independent demand  14 / 15                         │         │
│       │  Accounting          15 / 15                         │         │
│       │  ─────────────  Total ─────────────  92 / 100        │         │
│       │  [edit rubric →]                                     │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
│       │  SCORE HISTORY · 12 weeks                            │         │
│       │  ╱──╲╱─╲──╱─╲──╱──╲─╱──── (sparkline 100% width)    │         │
│       │  75 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (HIGH threshold dashed)  │         │
│       │  60 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ (MED threshold dashed)   │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
│       │  POSITION (if held)                                  │         │
│       │  10 sh · cost $1,832 · value $1,945 · +$113 (+6.2%) │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
└───────┴─────────────────────────────────────────────────────┴─────────┘
```

**Notes:**
- Header strip uses Reticle's pattern: breadcrumb at top, then ticker + name h1, then small-caps metadata strip with bullets between items.
- Composite score is the largest type on the page (28px JetBrains Mono 500). Macro multiplier line beneath shows the math: `0.95× → 78.1 effective`.
- Factor bars per component 4.2.
- AIQ rubric is a borderless definition list. Right-aligned mono numbers, dashed underline between dimensions and total. "Edit rubric →" is a link-style action in `--accent`.
- Score history sparkline per 4.9.
- Position block only renders if the user holds the position; otherwise omitted (no empty state — just gone).

### 5.4 /portfolio

The $100K deployment tracker.

```
┌── TOPBAR ──────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────┘
┌─ NAV ─┬─ MAIN ──────────────────────────────────────────────┬─ RAIL ──┐
│       │                                                     │         │
│       │  Portfolio                                           │ RESERVE │
│       │  Deployed $80,000 · Reserve $20,000                  │         │
│       │  ─────────────────────────────────────────────────  │ $20,000 │
│       │                                                     │ in cash │
│       │  ┌── VALUE ────┬── DAY P&L ──┬── 30D ──┬── ALPHA ──┐│         │
│       │  │ $87,420.50  │ +$1,240     │ +4.81%  │ +449 bps  ││ TRIGGER │
│       │  │ +1.44% day  │ +1.44%      │ vs SPY  │ vs SPY    ││ 1 — pos │
│       │  │  ───╱╲╱─    │  ─╱─╲─      │  ─╱╱─   │           ││ −7% from│
│       │  └─────────────┴─────────────┴─────────┴───────────┘│ cost    │
│       │                                                     │ ✓ none  │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │ TRIGGER │
│       │  Positions · 12                                      │ 2 —     │
│       │                                                     │ SPY -5% │
│       │  ┌───────────────────────────────────────────────┐ │ OR VIX  │
│       │  │TICKER LAY %BK COST PX VALUE P&L%   COMP TIER │ │ >25 (3d)│
│       │  ├───────────────────────────────────────────────┤ │ ✓ no    │
│       │  │TSM    L1 11.5 $185 $194 $11,486 +4.9 82.2 H  │ │         │
│       │  │GOOGL  L2 10.4 $172 $178 $10,408 +3.5 77.7 M  │ │ [+ Add  │
│       │  │NVDA   L1  9.2 $885 $920  $9,200 +3.9 79.7 H  │ │  tranche│
│       │  │VST    L4  8.1 $112 $121  $8,107 +8.0 77.7 M  │ │  → dis- │
│       │  │GEV    L4  6.9 $510 $530  $6,890 +3.9 77.6 M  │ │  abled] │
│       │  │ASML   L1  6.5 $920 $940  $6,498 +2.2 79.0 H  │ │         │
│       │  │…      …  …    …    …    …       …    …    …  │ │         │
│       │  └───────────────────────────────────────────────┘ │         │
│       │                                                     │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
│       │  Allocation by layer                                 │         │
│       │  L1 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 38%                   │         │
│       │  L4 ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 22%                              │         │
│       │  L2 ▓▓▓▓▓▓▓▓▓▓▓ 14%                                   │         │
│       │  L3 ▓▓▓ 4%                                            │         │
│       │  L5 ▓▓ 3%                                             │         │
│       │  Cash ▓▓▓▓▓▓▓▓▓▓▓ 14% (reserve)                       │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
│       │  Concentration · L1 38% · approaching 35% cap ⚠     │         │
│       │                                                     │         │
└───────┴─────────────────────────────────────────────────────┴─────────┘
```

**Notes:**
- KPI row matches /dashboard's, but tailored to the position book (value / day P&L / 30d / alpha).
- Positions table: %BK column = position % of full $100K (not just deployed). COST and PX columns are mono. P&L% has color. COMP is the live composite from the scoring engine (joins position to score data).
- Allocation bars: layer label 11px uppercase, bar with `--accent` fill, mono percentage right-aligned. Cash uses `--text-3` 0.6 opacity (semantically neutral).
- Concentration line at bottom: 12px Geist `--warning` if any layer >30% (warning state), `--danger` if any >35% (hit cap).
- Right rail tracks the two pre-committed triggers from the deployment plan. When trigger fires, button enables; otherwise disabled with ✓.

### 5.5 /regime

The macro state page.

```
┌── TOPBAR ──────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────┘
┌─ NAV ─┬─ MAIN ──────────────────────────────────────────────┬─ RAIL ──┐
│       │                                                     │         │
│       │  Regime                                              │ LEGEND  │
│       │  Macro gate state · updated May 15 23:24 CT          │         │
│       │  ─────────────────────────────────────────────────  │ NAAIM   │
│       │                                                     │ 0-30    │
│       │  Multiplier 0.95× active on High tier (1 of 3 gates) │ bottom  │
│       │  ─────────────────────────────────────────────────  │ 30-90   │
│       │                                                     │ neutral │
│       │  ┌── NAAIM EXPOSURE ───┬── AAII BULL-BEAR ──┬── F&G┐│ >90     │
│       │  │ 96.67           ⚠   │  +5.36              │  66 ││ top dec │
│       │  │ +3.07 wk           │  vs +6.28 long avg  │ greed││         │
│       │  │                    │                     │      ││ AAII    │
│       │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓ ⚊ ▓▓ │ ─▓▓▓▓▓▓▓▓▓▓─        │ ▓▓▓▓▓││ <-20    │
│       │  │ 0    50    90 ▲100 │ -30  0    +30      │ 0   80│ floor   │
│       │  │ GATE HIT >90       │ not hit             │ not hit  -20+30 │
│       │  └────────────────────┴─────────────────────┴──────┘│ normal  │
│       │                                                     │ >+30    │
│       │  ─────────────────────────────────────────────────  │ frothy  │
│       │                                                     │         │
│       │  12-month trend                                      │ F&G     │
│       │                                                     │ 0-20    │
│       │  NAAIM ─╱╲─╱╲╱╲──╱──╱╲──╱╲╲─╱╲╱ (line chart 100%)   │ extreme │
│       │  AAII  ────────────────────                          │ fear    │
│       │  F&G   ╱╲╱╲╱╲╱╲╱╲╱╲╱╲                                │ 20-60   │
│       │                                                     │ neutral │
│       │  Threshold lines dashed in --warning at gate values  │ 60-80   │
│       │  Markers (today) labeled in --text-1                 │ greed   │
│       │                                                     │ >80     │
│       │  ─────────────────────────────────────────────────  │ extreme │
│       │                                                     │ greed   │
│       │  History · last 5 gate-state changes                 │         │
│       │                                                     │         │
│       │  May 8   NAAIM crossed 90  → 0.95× from 1.00×        │         │
│       │  Apr 2   F&G dropped <20   → 1.00× from 0.95×        │         │
│       │  Mar 15  F&G crossed 20    → 0.95× from 0.90×        │         │
│       │  Mar 6   AAII spread > 30  → 0.90× from 0.95×        │         │
│       │  Feb 18  NAAIM crossed 90  → 0.95× from 1.00×        │         │
│       │                                                     │         │
└───────┴─────────────────────────────────────────────────────┴─────────┘
```

**Notes:**
- Three gauges row uses component 4.3.
- Trend chart: 3 thin lines, color-coded subtly (NAAIM `--accent`, AAII `--info`, F&G `--text-2`). Threshold lines dashed `--warning` at the gate value for each. Today markers are 2px vertical lines in `--text-1` with the value labeled at the right edge.
- History list: monospace timestamps, plain prose, no badges. Just receipts.

### 5.6 /aiq/[ticker] (rubric editor)

```
┌── TOPBAR ──────────────────────────────────────────────────────────────┐
└────────────────────────────────────────────────────────────────────────┘
┌─ NAV ─┬─ MAIN ──────────────────────────────────────────────┬─ RAIL ──┐
│       │                                                     │         │
│       │  Universe / TSM / AIQ                                │ HISTORY │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │ May 15  │
│       │  AIQ Rubric · TSM                                    │ current │
│       │  Last scored May 15 · 92 / 100                       │  92     │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │ Feb 14  │
│       │  Dimension 1 — Disclosure (0-20)                     │  91 +1  │
│       │  [ 18 ]                                              │ TSM HPC │
│       │  HPC segment explicit at 61% of revenue per          │ from 58%│
│       │  Q1 2026 earnings. Source: TSMC IR release Apr 16.   │ to 61%  │
│       │  Source URL: [tsmc.com/ir/q1-2026]                   │         │
│       │  ─────────────────────────────────────────────────  │ Nov 14  │
│       │                                                     │  88 +3  │
│       │  Dimension 2 — Defensibility (0-20)                  │ ramp on │
│       │  [ 18 ]                                              │ N2      │
│       │  Leading-edge EUV monopoly; 2nm ramp on schedule.    │         │
│       │  Source: ASML earnings transcripts, TSMC capex…     │         │
│       │  Source URL: [….]                                    │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
│       │  [... 4 more dimensions ...]                         │         │
│       │                                                     │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │  TOTAL                                          92   │         │
│       │  ─────────────────────────────────────────────────  │         │
│       │                                                     │         │
│       │  [Discard]                              [Save → 93] │         │
│       │                                                     │         │
└───────┴─────────────────────────────────────────────────────┴─────────┘
```

**Notes:**
- Each dimension is an inline-editable group: number field on the left (`--surface-2` bg, 1px `--border-subtle` border, 5px radius, 12px mono center-aligned, 48px wide), notes textarea below (3 rows, autosizing), source URL field at bottom (placeholder "https://…", styled like inline link).
- Total row is non-editable, computed live.
- Save button: shows projected new score if any dimension changed. Disabled if no changes. On save, writes a new row to `aiq_rubric` with new `scored_at` timestamp (never overwrites).
- Right rail: prior versions with delta and one-line reason. Click → opens diff view in main.

### 5.7 /memos (optional, post-launch)

Out of scope for v1 launch. Tickets exist (E6.3 Sonnet daily memo) but the UI lands in v1.1.

---

## 6. Right-rail spec per page

| Page | Rail content | Width | Dismissable |
|---|---|---|---|
| /dashboard | Top score movers (5), insider today, macro gates summary | 280px | yes |
| /universe | Layer/Tier/AIQ/Flag filters | 280px | yes |
| /n/[ticker] | Activity log, recent score changes, insider events, news links | 280px | yes |
| /portfolio | Reserve tracker + two pre-committed triggers | 280px | yes |
| /regime | Threshold legend for NAAIM/AAII/F&G | 280px | yes |
| /aiq/[ticker] | Prior-version history with deltas | 280px | yes |
| /settings | None (no rail) | — | — |

Topbar panel-toggle icon collapses/expands the rail. Collapsed state persists in localStorage per page.

---

## 7. Interaction patterns

### 7.1 Selection model

The currently-selected ticker is global state. Selecting a ticker (clicking a row anywhere) sets `selectedTicker` in app state. Many pages — /n/[ticker], /aiq/[ticker], parts of /portfolio — bind to it.

Selection indicator: `--surface-hover` row background + 2px `--accent` left edge on the selected row, identical to the active-nav-item treatment.

### 7.2 Keyboard

Mandatory keyboard surface:
- `⌘K` — global search / command palette (opens from topbar search box).
- `⌘1`..`⌘7` — jump to nav items in order (Dashboard, Universe, Portfolio, Regime, Memos, AIQ Editor, Settings).
- `J` / `K` — next / previous row in any table.
- `Enter` — open detail of selected row.
- `R` — refresh scores (cron-trigger override).
- `Esc` — close modal, dismiss tooltip, deselect row.

Show keyboard hints in the command palette and as `kbd` chips next to clickable affordances when hovered with `⌘` held down (Linear pattern).

### 7.3 Real-time updates

- Score refresh: weekly (Sunday eve) is the source of truth. But macro gauges + position prices update every 30s during market hours. Visual treatment: value briefly flashes `--accent` color (200ms) on update, then returns to `--text-1`.
- No "live!" banner. No connection indicators. Updates are silent. The live-dot in /dashboard's greeting strip is the only persistent "we're connected" affordance.

### 7.4 Tooltips and popovers

- Tooltips: information only (hover delay 350ms). Never interactive.
- Popovers: actions and lists (filter menus, ticker history, AIQ source links). Click to open, click outside to close, `Esc` dismisses.
- Both render at `--surface-elevated` per §4.15 / §4.16.

### 7.5 Loading + errors

- Initial page load: skeleton rows (no shimmer). Resolves in <500ms for table pages.
- In-place data refresh (e.g. polling): value briefly fades to 0.4 opacity, then back. No spinner.
- Error: inline `--danger` text with `Retry` link. No modals. Never block the page.

---

## 8. Responsive behavior

**Desktop-first.** Minimum viewport: 1280px. Below that, the right rail collapses by default (still toggleable). Below 1024px, the table simplifies to ticker / composite / tier / Δ only; remaining columns hidden behind a "..." overflow menu.

**Mobile is out of scope for v1.** This is a tool Terry uses at a desk, on his Logitech setup. We will not optimize for phone reading until the product is mature.

---

## 9. Reference benchmarks

What "good" looks like for this product:

- **Linear** (linear.app) — for chrome calm, nav restraint, motion discipline, the left-edge accent on active items
- **Mercury** (mercury.com) — for tabular data, mono numerics, gentle hierarchy in dashboards
- **Stripe Dashboard** (dashboard.stripe.com) — for the use of color as truth-state-only-signal, never as decoration
- **Vercel Dashboard** (vercel.com/dashboard) — for monochrome with a single accent, hairline composition
- **Reticle (Terry's reference screenshots, May 15 2026)** — for the breadcrumb-detail page header, contextual right rail, tag chip style, and column-header treatment
- **Basis Investment Portal HTMLs (Terry's reference, May 15 2026)** — for the locked color tokens, type scale, KPI row pattern, sparkline treatment, table density, and proximity-bar idiom

What "bad" looks like:

- Robinhood (too consumer, gamified colors, no density)
- Yahoo Finance (advertising-noise visual hierarchy)
- Bloomberg Terminal (too dense, no calm, no design system)
- TradingView (too many primary colors, ornate borders)
- Anything with glassmorphism, gradient meshes, or `rounded-2xl` defaults

---

## 10. Asset / icon library

Use Lucide icons (lucide.dev) at 14×14 stroke-1.5 default, 16×16 stroke-1.5 in icon-buttons. Allowed icons:

| Use | Icon |
|---|---|
| Dashboard | `layout-dashboard` |
| Universe | `grid` |
| Portfolio | `briefcase` |
| Regime | `gauge` |
| Memos | `file-text` |
| Decisions | `check-square` |
| AIQ Editor | `sliders` |
| Settings | `settings` |
| Search | `search` |
| Alerts (with dot) | `bell` |
| Help | `help-circle` |
| Panel toggle | `panel-right` |
| Filter | `filter` |
| Refresh | `refresh-cw` |
| Up arrow (delta) | `trending-up` (stroke 2.5px, 10px size) |
| Down arrow (delta) | `trending-down` (stroke 2.5px, 10px size) |
| Warning / flag | `alert-triangle` |
| Info | `info` |
| Edit | `pencil` |

No filled icons. No two-tone. No custom illustrations. Brand logo is the only image asset.

---

## 11. What Claude Design should produce

### Phase 1 (mockups) — by EOW May 22

For each route in §5, produce a high-fidelity static mockup at 1440×900:
1. /dashboard
2. /universe
3. /n/[ticker]
4. /portfolio
5. /regime
6. /aiq/[ticker]

Plus:
- Empty state for /universe (no names match filter)
- Loading state for /universe (skeleton)
- Modal example (e.g. AIQ rubric edit confirmation)
- Tooltip example (factor decomposition on hover)

Hand-off as Figma file with the design tokens (§2) defined as styles + variables. Component library (§4) as components in Figma.

### Phase 2 (prototype) — by May 29

Interactive prototype of:
- Sidebar nav flow (click between pages)
- /universe → /n/[ticker] row click
- /universe filter rail interactions
- /n/[ticker] → /aiq/[ticker] rubric edit
- Macro gauge hover → tooltip
- Score factor row hover → sub-factor tooltip

Prototype is in Figma (no code required).

### Phase 3 (handoff to engineering)

After prototype approval, Claude Design hands off:
- Final Figma file with all states
- Design token export (JSON or CSS vars)
- Asset bundle (logo + any non-Lucide icons, if added)
- Annotated component spec covering edge cases not visible in mockup

Engineering picks up from Linear THS-32 (Portal UI epic) and its sub-issues.

---

## 12. Acceptance criteria (what makes this "done")

- All 6 routes from §5 render at 1440×900 in mockups
- Token system (§2) is implemented as Figma styles and CSS variables
- Every component in §4 has a Figma component
- Empty + loading + error states are specified for /universe and /n/[ticker]
- Keyboard interaction surface (§7.2) is documented in the Figma file
- A walkthrough video (3-5 min) explains the interaction model

---

## 13. Out of scope for v1 launch

- Mobile / responsive below 1024px
- Multi-user collaboration features
- Public-share / read-only links
- Customizable layout (drag-resize panels, hide columns)
- Themes other than dark
- Localization
- Onboarding tour / coach marks
- Memos UI (the cron exists in Epic 6; the page lands in v1.1)
- Decisions workflow (approve/reject memo flow)
- Backtest UI (data exists in Epic 6; visualization lands in v1.1)

These are deliberate cuts. Re-evaluate after v1 ships.

---

## 14. Open questions for Terry

1. Brand mark: use existing Basis logo asset, or design a distinct "AI Thesis" mark? Default: use Basis logo + product name "AI Thesis" per §3.2.
2. Should /portfolio integrate with a live brokerage (Schwab, Fidelity) for cost basis, or stay manual entry for v1? Default: manual entry, v1.1 connects a brokerage if Plaid coverage is reliable.
3. Notification channel — in-app only, or also email/SMS for tier changes? Default: in-app only for v1. Add email digest in v1.1.

---

## End of spec
