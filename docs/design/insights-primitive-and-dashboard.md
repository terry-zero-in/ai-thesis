# Insights Primitive + Dashboard Redesign

**Status:** LOCKED — Open Questions §6 answered by Terry S9 ("go"). Phase 2 build greenlit.
**Authored:** 2026-05-18, S8. **Locked:** 2026-05-18, S9.
**Origin:** Terry sent the Linear Insights screenshot saying "Dashboard needs some work. Its not Lambo." This doc captures the response: where the Linear pattern actually wants to live, how it threads back to Dashboard, and what to lock before any code ships.

---

## §1 — The honest framing

Two problems are being conflated and they deserve separate treatment:

**Problem A** — Dashboard is not Lambo. Eight stacked sections, redundant info repeated 3-4 times across surfaces, entirely passive (zero click-to-filter), no signature pattern that propagates. Polish alone (surface-fill, mono labels) won't fix it. Needs structural consolidation.

**Problem B** — The product has no state-shaping rail anywhere. The right rail today is awareness widgets (clock, gauges, insider list). Linear's Insights pattern proves the rail can be analytical — visualizations as the filter UI, click any bar segment to slice the canvas.

Solving B on Dashboard is a forced fit (Score Movers shows 8 rows — filtering 8 rows isn't compelling). Solving B on **Universe** (50 names, 4-5 slice dimensions) is the natural home. Then a compressed version threads back to Dashboard once we know the right shape.

**Sequencing this doc commits to:** doc-lock now → Universe Insights ships next session → focused Dashboard pass after.

---

## §2 — The Insights primitive (Universe is canonical home)

Decompose the Linear Insights pattern into four layered principles. Pixels are downstream of principles.

### 2.1 Four principles

1. **The rail becomes analytical, not metadata.** Same right-rail real estate; completely different role. Today's UniverseFilterRail (Layer/Tier chips) graduates into the InsightsRail.
2. **Visualization is the affordance.** The chart isn't a chart — it's the filter UI. Click a bar segment, canvas filters.
3. **Three primitive selectors.** Measure (what to count) · Slice (what to group by) · Segment (what to color by). Three controls compose any cut without a custom modal per cut.
4. **Legend table = synchronized control surface.** Below the chart: same data, numeric form, second affordance for numerics-preferring users. Click row = same filter behavior.

### 2.2 Universe data shape (confirmed via `src/lib/universe-data.ts:23`)

`UniverseRow` fields available for slicing:

| Field | Type | Use as slice |
|---|---|---|
| `tier` | "High"\|"Medium"\|"Low"\|"Avoid" \| null | ✅ Primary categorical |
| `layer` / `layer_label` | number / string (e.g. "L1 Compute") | ✅ Primary categorical |
| `composite` | number \| null | Measure (avg) |
| `final_score` | number \| null | Measure (avg) |
| `q`, `g`, `v`, `aiq` | number \| null | Slice (bucketed) and Measure (avg) |
| `delta` | number \| null | Measure (mean Δ7d) |
| `macro_gates_hit` | number (0-3) | ✅ Categorical (active/inactive) |
| `macro_multiplier` | number | Derived from gates_hit, not its own slice |

**NOT in current shape:** sector, industry, market-cap bucket. If we want "Sector" as a slice dimension we need either (a) a `sector` column on `universe` table or (b) derivation from layer_label sub-string. Defer to §6 Open-Q.

### 2.3 Selectors — three controls

```
MEASURE                      SLICE                       SEGMENT (optional)
┌─────────────────────┐      ┌─────────────────────┐      ┌─────────────────────┐
│ name count        ▼ │      │ Tier              ▼ │      │ (none)            ▼ │
└─────────────────────┘      └─────────────────────┘      └─────────────────────┘
  ▶ avg composite               ▶ Layer                     ▶ Layer
  ▶ avg final score             ▶ AIQ band                  ▶ Tier
  ▶ avg AIQ                     ▶ Macro gate active         ▶ AIQ band
  ▶ mean Δ7d composite          ▶ (Sector — pending §6)
```

Default: **Measure=name count · Slice=Tier · Segment=Layer**. That answers the first question every operator opens the app to ask: *"how many High-tier names do I have, and how do they split across layers?"*

### 2.4 Chart — stacked bar

Stacked vertical bar, one bar per Slice value, colored by Segment value. Tier-colored when Segment=Tier (High=accent, Med=warning, Low=info, Avoid=danger per `TIER_COLORS` in `app/page.tsx:26`). Layer-colored when Segment=Layer (palette TBD §6).

Bars sit on a calm baseline grid, value labels in mono on hover, count labels at top of each bar in mono `--text-3`. NO axis ticks (too SaaS); just a hairline baseline.

Hover any segment → tooltip with `slice · segment: count` and "click to filter".
Click any segment → canvas filters to the intersection. URL param updates (§2.6).

### 2.5 Legend table — synchronized

Below the chart, a 2-3 column mono table:

```
LEGEND
● High      14    avg 78.3
● Medium    18    avg 67.1
● Low       11    avg 52.4
● Avoid      7    avg 38.6
```

Columns: Slice value (with color dot) · Measure value · optional secondary stat. Click any row → same filter behavior as clicking the bar. Active row highlights with `--surface-hover` background + 2px `--accent` left rail (per `feedback_active_state_indicator_2px_floor`).

### 2.6 Click-to-filter contract

Single click = REPLACE filter with this slice value. Cmd/Ctrl-click = ADD to filter (multi-select). Click currently-active = REMOVE (toggle).

State persists via URL search param so back-button + deep-link work:
- `?tier=High` (single slice)
- `?tier=High,Medium&layer=L1,L2` (multi-slice across dimensions)
- `?clear=1` or no params = full universe

Active filter shows a clearable chip strip above the canvas table: `Tier: High ×` `Layer: L1, L2 ×` `[ Clear all ]`. Clicking the × on a chip removes that dimension's filter. ESC anywhere on the page clears all.

### 2.7 Composability — the rail is one primitive across surfaces

`<InsightsRail config={...} data={...} onFilter={...} />` is the SAME component on Universe and Portfolio. Each page passes:
- Available slice dimensions (config)
- Pre-aggregated data per slice (data)
- Filter callback that updates THAT page's canvas state

Portfolio uses different slice options (Sector / Layer-at-entry / Tier-at-entry / P&L bucket / Held duration). Same chart + legend + click-to-filter. Same primitive, different config.

---

## §3 — Dashboard redesign (Move 1: canvas consolidation)

Dashboard's job is to answer in 10 seconds: *"what's the state of my research right now, and what changed since yesterday?"* Currently it takes 30+ seconds of scrolling to assemble that answer. Consolidate.

### 3.1 Current section inventory (8 sections, 2-3 viewports tall)

| # | Section | Verdict |
|---|---|---|
| 1 | GreetingStrip | Keep — operator anchor |
| 2 | MonoMetaSpine | Keep — engine state strip |
| 3 | TodayThesisCard | **Drop** — duplicates MonoMetaSpine + AlertCallout |
| 4 | AlertCallout (when active) | Keep — merge into MonoMetaSpine row visually |
| 5 | MorningBrief | **Move to /memos** — different cognitive surface |
| 6 | KpiRow | Keep — the four numbers |
| 7 | Score movers table | Keep — the canvas anchor |
| 8 | CompactGateStrip | **Drop** — right rail has it |

Net: 8 sections → 4. One viewport at 1440px tall.

### 3.2 Proposed structure

```
┌────────────────────────────────────────────────────────────────────┐
│  GreetingStrip                                                      │
│  Good evening, Terry · Mon May 18 · NYSE closed · opens 8:30 AM    │
├────────────────────────────────────────────────────────────────────┤
│  ENGINE STATE                                                        │
│  as_of 2026-05-18 · engine composite v1.0 · mode LIVE ·             │
│  macro NEUTRAL · 1.00× · 0/3 gates · weekly chain Sat 22:00 UTC    │
│  (when gates>0, an inline alert badge appears: "1 of 3 gates hit")  │
├────────────────────────────────────────────────────────────────────┤
│  ┌────────────┬────────────┬────────────┬────────────┐              │
│  │ PORTFOLIO  │ P&L · TDY  │ 30D RETURN │ HIGH-TIER  │              │
│  │ $77,992    │ +$1,240    │ +4.2%      │ 14         │              │
│  │ market val │ +1.59%     │ vs SPY +2% │ 14/50 · ↑3 │              │
│  └────────────┴────────────┴────────────┴────────────┘              │
├────────────────────────────────────────────────────────────────────┤
│  SCORE MOVERS · LAST 7 DAYS                              View all › │
│  ─────────────────────────────────────────────────────────────────  │
│  TICKER  LAYER         COMPOSITE   Δ 7D   DRIVER                    │
│  AVGO    L1 Compute        82.2   +3.2    capex revision +2.1       │
│  NVDA    L1 Compute        78.1   −1.1    macro gate     −0.9       │
│  …                                                                   │
└────────────────────────────────────────────────────────────────────┘
```

That's it. Greeting + Engine state strip + KPI + Score Movers. Four sections, scannable in 10 seconds, one viewport.

### 3.3 Engine state strip — the AlertCallout merge

Today AlertCallout is its own card with title, regime pill, and a list of items (each item: notable text + action link). On Dashboard the items are always "review regime gauges" — pure deflection. Merge into MonoMetaSpine:

- MonoMetaSpine becomes a denser strip with regime pill INLINE: `as_of 05/18 · engine composite v1.0 · mode LIVE · regime TIGHTENED 0.95× (1/3) · weekly chain Sat 22:00`
- When `macro_gates_hit > 0`, an inline severity-toned suffix appears: `▶ Review regime` (link to /regime). One affordance, no duplicate card.

### 3.4 Right rail — what fills the freed CompactGateStrip slot

Right rail today: Today (clock) · Calendar (placeholder) · Insider · Macro gates. Proposed rail:

- **Today** clock — keep
- **Score distribution** (the compressed Insights surface) — NEW, replaces the redundant gate strip
  - Single stacked bar: Tier count, colored by Tier
  - 4 legend rows mono-tabular
  - Click any bar / legend row → filters Score Movers in canvas to that tier
  - This is the THIN version of the full Insights primitive; full version lives on /universe
- **Insider · recent** — keep
- **Macro gates** — keep (the rail's gauge readout is the source-of-truth instance; the canvas duplicate goes away)

---

## §4 — Sequencing

**Phase 1 — this doc lock + Open-Q answers (now).** Terry reads §6, answers Open-Qs. Doc updates to LOCKED status.

**Phase 2 — Universe Insights primitive (next session, ~4-6h).** Build the full primitive on /universe. Three selectors, stacked bar, legend table, click-to-filter, URL persistence, active-chip strip, ESC-to-clear.

**Phase 3 — Dashboard consolidation (session after, ~1-2h).** Apply §3.1 cuts + §3.3 merge + §3.4 rail. Drops 3 sections, merges 1.

**Phase 4 — Dashboard mini-Insights (same session as 3 or next, ~1-2h).** Compose `<InsightsRail config=dashboardConfig />` with single-axis tier config.

**Phase 5 — Portfolio Insights adoption (later).** Same primitive, Portfolio-specific slice config.

---

## §5 — Why this answers "not Lambo"

Mapped to /lambo skill's three signature-pattern tests:

| Property | InsightsRail |
|---|---|
| Reusable | Universe + Portfolio + Dashboard (compressed) — 3 surfaces minimum, plus Regime/Backtest possibility later |
| Recognizable | Same selectors, same chart shape, same legend, same click-to-filter contract every time |
| Earned | Solves the real "I need to slice 50 names by 5 dimensions" problem that today requires opening filter chips one at a time |

And it gives Dashboard what it lacks today: a non-passive moment. Click a bar, the table changes. The operator IS the analyst, not a reader of pre-built reports.

---

## §6 — Open Questions — LOCKED 2026-05-18, S9

Terry greenlit defaults via "go" after Q-A (sequencing) + Q-B (Tier as default Slice) discussion. Locked answers below.

**Q-INS-1.** Sector as a slice dimension — **LOCKED: defer to v1.1.** v1 ships with Tier as primary Slice. Layer/AIQ-band/Macro-gate available as future Slice options once Segment selector lands. Sector requires schema migration; not in scope.

**Q-INS-2.** Chart type — **LOCKED: stacked vertical bar.** Matches Linear pattern Terry referenced via screenshots S9. v1 ships as single-color bars (Slice=Tier, Segment=none); stacked-by-Segment activates when Segment selector lands.

**Q-INS-3.** Selector UI — **LOCKED: dropdowns above chart, 30px height per Instrument-Field §2.1.** v1 hides Slice + Segment dropdowns (Tier-only fixed); Measure dropdown ships in v1.1 when alternate measures (avg composite, avg AIQ) wire up.

**Q-INS-4.** Multi-select behavior — **LOCKED: single click REPLACES; Cmd/Ctrl-click ADDS; click-active REMOVES (toggle).** Matches Linear's behavior in the screenshots Terry sent S9 (clicking green frontend bar → only frontend bar stays solid, others dim).

**Q-INS-5.** Persistence — **LOCKED: URL search params.** `?tier=High` for single; `?tier=High,Medium` for multi. Back-button + deep-link work. Active filter chip strip above canvas table with × to clear per dimension; ESC clears all.

**Q-INS-6.** Default config — **LOCKED: Measure=count · Slice=Tier · Segment=none (v1).** Tier as Slice is the decision-relevant cut (HIGH/MEDIUM/LOW/AVOID = how operator acts). Segment=Layer wires up in v1.1 when stacked-bar rendering lands.

**Q-DASH-1.** Drop TodayThesisCard — **LOCKED: dropped from Dashboard.** File retained for /memos reuse (S8 cce37ae shipped this).

**Q-DASH-2.** Move MorningBrief to /memos — **LOCKED: yes, deferred to /memos page rebuild.** S8 cce37ae dropped from Dashboard; not yet relocated (waiting on /memos surface lift).

**Q-DASH-3.** Drop CompactGateStrip from canvas — **LOCKED: dropped.** S8 cce37ae shipped this.

**Q-DASH-4.** AlertCallout merge — **REVISED LOCK S9: kill EngineStateStrip entirely.** Original lock was "inline severity badge on MonoMetaSpine" (shipped as EngineStateStrip cce37ae). Terry pushed back: "If thats it I didnt like it." Replacement: MACRO MULTIPLIER promoted to KPI tile (5th tile), absorbing engine-state visibility without a dedicated chrome row.

**Q-DASH-5.** Right rail "Score distribution" mini-Insights — **LOCKED: single-axis Tier-only on Dashboard rail.** Phase 4 — ports compressed bar-chart-with-filter from Universe primitive. Out of scope for v1 Dashboard rail (which stays simple: Today + Insider + Macro gates).

**Q-DASH-6.** Calendar section in rail — **LOCKED: removed.** S8 cce37ae shipped this.

### S9-specific additions (Dashboard v3 composition, after Q-DASH-4 revision)

**Q-DASH-7.** 5th KPI tile content — **LOCKED: MACRO MULTIPLIER.** Rejected COMPOSITE AVG (averaging scores across a portfolio is decision-meaningless — a (90, 38) portfolio averages 64, which underwrites nothing). MACRO MULTIPLIER (e.g., `1.00× / 0.95×`) is decision-useful AND absorbs the engine-state row that EngineStateStrip was trying to carry.

**Q-DASH-8.** Sparklines on KPI tiles — **LOCKED: time-series tiles only.** PORTFOLIO (30d trend), 30D RETURN (trajectory), MACRO MULTIPLIER (regime history). NO sparkline on P&L TODAY (single-day value — fake polish) or HIGH-TIER NAMES (integer count — jagged step chart, zero signal).

**Q-DASH-9.** Bottom-row content on Dashboard — **LOCKED: Score Movers + Top Positions, stacked.** Two different lenses: Movers = market activity, Positions = your exposure. Both belong on morning surface; one is no substitute for the other.

**Q-DASH-10.** Bottom-row container — **LOCKED: rows on canvas (Strip role per Instrument-Field §3.1), NOT cards.** Long ranked lists are edge-to-edge canvas with hairline dividers. Cards earn the container role for contained micro-surfaces (KPI tile, chart with its own controls).

**Q-DASH-11.** Chart container — **LOCKED: card (Inset role per Instrument-Field §3.1).** PORTFOLIO VALUE line chart with range pills (1D/5D/1M/6M/YTD/1Y/All) wrapped in `var(--surface)` card. Maintains Instrument-Field standard; consistent with Add Position drawer pattern.

---

## §7 — What this doc does NOT decide

- Exact pixel-level chart styling (axis labels y/n, bar gap %, hover-state tooltip shape) — handled at Phase 2 build time inside `/lambo` constraints
- Color palette for Layer segments — defer to Phase 2; need Terry's eye on a live render
- Mobile behavior — defer; Dashboard + Universe are desktop-first per session-level convention
- Backtest Insights adoption — separate doc when we get to it
- Memos page redesign for the imported MorningBrief — separate doc when we get to it

---

## §8 — Companion artifacts

- `docs/design/instrument-field-pattern.md` — visual standard the Insights primitive renders against
- `web/src/components/primitives/PageCreateDrawer.tsx` — example of a primitive that propagates cross-surface (the model for InsightsRail)
- `web/src/lib/universe-data.ts:23` — UniverseRow shape (source of available slice dimensions)
- `web/src/app/page.tsx` — current Dashboard, target of Phase 3 consolidation
- Linear's Insights screenshot Terry sent S8 — visual reference for the primitive shape (not pixel-copy)
