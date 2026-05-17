# Mercury Design References — pickup for future sessions

**Why this doc exists:** Terry sent a 325-line Basis design-reference doc plus
a zip of 95 Mercury screenshots on 2026-05-17 (S2). The pixel data of those
screenshots does NOT survive a `/compact` — the compacter summarizes my
conversation to text, losing image bytes. This doc captures the paths +
synthesis so the next session can pick up cold without re-uploading.

If you are reading this in a future session, you can re-view any Mercury
screenshot via the Read tool using the paths in §1.

---

## 1. Source paths (permanent on disk)

| Resource | Path | Notes |
|---|---|---|
| Design reference doc | `/Users/terryturner/Documents/Archives/Basis - Reticle (Remix) (Remix)/DESIGN_REFERENCE.md` | 325-line index of all 49 pics across 3 batches (m0007, m0009, m0011). Per-pic captions + Terry's directives. |
| Original zip | `/Users/terryturner/Documents/Archives/Basis - Reticle (Remix) (Remix)/uploads.zip` | ~37 MB. Contains all 49 Mercury screenshots + a few HTML mockups + RentRoll.tsx. |
| Extracted screenshots | `/tmp/basis-design-ref/uploads/CleanShot 2026-05-16 at *.png` | Extracted via `unzip` to /tmp. May vanish on machine reboot; re-extract from zip if missing. |
| Re-extract command | `mkdir -p /tmp/basis-design-ref && unzip -o "/Users/terryturner/Documents/Archives/Basis - Reticle (Remix) (Remix)/uploads.zip" -d /tmp/basis-design-ref` | One-liner to restore extracted files. |

**Caveat:** the design ref doc is for the **Basis** project (a different
codebase — rent-roll / pro-forma tool). Terry asked us to apply the
**Mercury patterns** from that doc to **AI Thesis** via /lambo. The
Basis-specific decisions in §"Synthesized decision inputs" of the doc
(Unit detail surface, Rent Roll filters, Flags tab, Mapping, etc.) are
NOT directly relevant to AI Thesis — but the underlying Mercury patterns
ARE.

## 2. Patterns applied to AI Thesis this session (S2, 2026-05-17)

The Mercury "format on canvas, NOT in cards" principle (line 12 of the
ref doc, Pic 12 b2) was applied across all 5 main AI Thesis surfaces.
Right rail was explicitly excluded per Terry's instruction
("I do like the right rail though that I have as part of MY DESIGN.
Leave that.").

### 2a. Pattern map

| # | Mercury pattern | Source pic | AI Thesis application | Status |
|---|---|---|---|---|
| 1 | **Format on canvas, no card chrome** | Pic 12 b2 (Plan & Billing) — `CleanShot 2026-05-16 at 17.59.21@2x.png` | All 5 surfaces (`/dashboard`, `/universe/[ticker]`, `/regime`, `/aiq/[ticker]`, `/portfolio`). Section wrappers replaced with `border-top + border-bottom` hairlines or just label + hairline-under-label. | **Done** |
| 2 | **KPI strip with vertical cell-divider hairlines** | Pic 17 b2 (Financing/SAFEs) — `CleanShot 2026-05-16 at 18.21.33@2x.png` | `/dashboard` KpiRow, `/portfolio` AggregateBar supporting strip, `/universe/[ticker]` FactorPanels (Q/G/V/AIQ), `/regime` MultiplierBanner two-cell strip. Each cell uses `borderLeft: isFirst ? undefined : "1px solid var(--border-subtle)"` pattern. | **Done** |
| 3 | **Side-by-side header: hero LEFT + chart RIGHT** | Pic 19 b2 (Credit Card) — `CleanShot 2026-05-16 at 18.23.35@2x.png` | `/universe/[ticker]` NameHeader: HeroNumber + meta on left, 12-week Sparkline on right (1.35fr / 1fr grid). Sparkline component decarded so it flows inline. | **Done** |
| 4 | **Hero + supporting cells header (Pic 18 variant)** | Pic 18 b2 (Ops/Payroll) — `CleanShot 2026-05-16 at 18.23.25@2x.png` | `/portfolio` AggregateBar: Market Value as HeroNumber protagonist + 4-cell supporting strip below (Total Capital · Deployed · P&L · Reserve). | **Done** |
| 5 | **Alert Summary callout** | Pic 11 b2 (Account Security Suggested actions) — `CleanShot 2026-05-16 at 17.52.27@2x.png` | `/dashboard` top AlertCallout component. Thin border, NO bg fill, header row with "N active alerts", two-col rows (notable left, hyperlinked action right with `›` glyph). Fires only when `macroGatesHit > 0`. Surfaces per-gauge threshold breaches with deep-links to `/regime`. | **Done** |
| 6 | **Faint row dividers on tables** | Pic 7 b1 (Tasks) — `CleanShot 2026-05-16 at 16.41.02@2x.png` | `/dashboard` Score Movers table (`<table>` with `borderBottom: "1px solid var(--border-subtle)"` per row). `/portfolio` PositionsTable already had this pattern. | **Done** |
| 7 | **Sticky scroll: page chrome hides, table header sticks** | Pic 5 b2 (Advisors) — `CleanShot 2026-05-16 at 17.41.15@2x.png` | `/universe` table — NOT YET APPLIED. Would require sticky-positioning + scroll-listener on the table header. | **Pending** (Task #8 / Task #9) |
| 8 | **Sidebar sub-items with left bar** | Pic 14 b2 (Invoicing) — `CleanShot 2026-05-16 at 18.15.00@2x.png` | Speculative — `/portfolio` sub-screens (positions / reserve / triggers / history) OR a future `/insights` surface. NOT YET APPLIED. | **Deferred** — needs nav restructure |
| 9 | **3-sub-tab + date scrubber + side-by-side cards with internal tabs** | Pics 1-6 b3 (Insights) | Future `/history` or `/memos` surface. NOT YET APPLIED. | **Deferred** — no current surface needs it |
| 10 | **3-dot menu (Settings / Manage X)** | Pic 7-8 b3 | Future `/settings` enhancement. NOT YET APPLIED. | **Deferred** |
| 11 | **Modal with blurred background** | Pic 13 b2 + Pic 8 b3 | Future modals. NOT YET APPLIED — no modals exist yet. | **Deferred** |
| 12 | **Detail pane (sticky top, auto-hide scrollbar, 8px viewport gap)** | Pics 1-5 b2 (Advisors) | Speculative for drill-down patterns. NOT YET APPLIED. | **Deferred** |

### 2b. Architectural decisions (not in the ref doc but worth recording)

These are /lambo-driven choices I made when the Mercury pattern was ambiguous
or there were trade-offs:

1. **GaugeCards kept their card chrome on /dashboard and /regime.** Mercury
   Pic 12 b2 has no card chrome anywhere, but `GaugeCard` is a multi-part
   instrument (label + GATE HIT chip + 28px value + threshold reference +
   sparkline + threshold-history footer). Per /lambo "earn its place," the
   gauge card boundary is justified because each gauge is a logical
   composite. Section *wrapper* around the gauges was decarded, but the
   gauges themselves retained chrome.

2. **AlertCallout uses a thin border, not zero chrome.** Mercury Pic 11 b2
   "Suggested actions" has a subtle 1px border (no bg fill). I preserved
   this — it signals "this is a callout group worth a glance" vs. flat
   canvas content. Subtle but intentional. Don't reflexively strip it on
   the next pass.

3. **The HeroNumber `prefix` prop was added** for currency rendering on
   /portfolio Market Value. When `prefix` is `$` or `€`, the value uses
   `toLocaleString` for thousands separators. Other prefixes use
   `toFixed(precision)`. This is the cleanest path for /portfolio without
   forking a currency-variant primitive.

4. **`<Cell isFirst>` pattern** for hairline-divided strips: rather than
   CSS `:first-child`, I pass an explicit `isFirst` boolean prop to the
   cell component that suppresses the `borderLeft`. Used in KpiRow,
   FactorPanels, ReservePanel TriggerRow, DataPendingCard, AggregateBar
   Kpi. Pattern is consistent across the codebase.

5. **Section component on /dashboard** is the canonical "decarded section"
   primitive: label (10.5px small-caps --text-3 .08em) + hairline below +
   content. Reusable on any new surface; replicate the pattern.

## 3. Commits from this Mercury pass

(All on branch `claude/lambo-design-finish`, none pushed)

```
5ca1747 design: Mercury decard pass on /portfolio + HeroNumber prefix prop
9b5404b design: Mercury decard pass on /aiq/[ticker]
588671a design: Mercury decard pass on /regime
2a15179 design: Mercury decard pass on /universe/[ticker]
9ec57ad design: Mercury decard pass on /dashboard
```

## 4. What's pending (do NOT redo)

Per the §2a status column. Specifically still pending:

- **Pattern #7** — sticky scroll on /universe table (Task #8 territory; Pic 5 b2)
- **Patterns #8-12** — deferred until corresponding surfaces exist or are
  prioritized. Don't pre-build infrastructure for them.

Also pending from the original review (NOT Mercury work):

- Task #4 Phase 4b — 5 right-rail sub-builds (Today / Activity / Reserve+Triggers
  / Legend / History). Right rail itself is locked per Terry's instruction;
  what gets ADDED INTO the rail per surface is still in scope.
- Task #8 P1/P2 fixes from `docs/design/lambo-review-2026-05-17.md` §2.
- Task #9 polish.

## 5. How to verify the Mercury work renders correctly

```bash
# 1. Dev server (should already be running at :3003 per the active handoff)
cd /Users/terryturner/Projects/ai-thesis/web && npm run dev

# 2. Screenshot all five surfaces
python3 /tmp/lambo-review-2026-05-16/reshot.py          # /dashboard, /universe, /universe/TSM, /regime, /login
python3 /tmp/lambo-review-2026-05-16/shot_aiq.py        # /aiq/TSM
python3 /tmp/lambo-review-2026-05-16/shot_portfolio.py  # /portfolio (1440x1400 tall viewport)

# 3. Inspect the after-token shots
ls /tmp/lambo-review-2026-05-16/after_tokens/
```

If a screenshot looks wrong (card chrome still visible somewhere I
missed), grep the surface's component files for `border: "1px solid
var(--border)"` + `borderRadius: 6` + `background: "var(--surface)"`
triplets — those are the legacy card-chrome fingerprint. Replace with
hairline-only patterns per §2b.

## 6. The overarching principle to keep applying

> "Mercury-grade density. Extremely data-dense AND uncluttered."
> "Current Basis is too cramped. Aim for the Mercury minimalist look —
>  generous spacing on the canvas itself, formatted directly on the
>  canvas, not buried in cards/boxes everywhere."
> — DESIGN_REFERENCE.md lines 11-12, verbatim from Terry

When in doubt on any new surface: **format on canvas, hairline-divide for
hierarchy, only use card chrome when the contained artifact is a
multi-part instrument that earns its boundary.**
