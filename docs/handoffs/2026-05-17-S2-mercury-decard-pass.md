# Handoff — 2026-05-17 S2 — Mercury decard pass

## 1. TL;DR

Shipped a full Mercury "format on canvas, no cards" decard pass across all 5 main surfaces (`/dashboard`, `/universe/[ticker]`, `/regime`, `/aiq/[ticker]`, `/portfolio`). Added 5 Mercury pattern primitives (AlertCallout, hero+supporting-strip header, KPI hairline strip, faint-row-divider table, side-by-side hero+chart header). HeroNumber primitive extended with `prefix` for currency. 8 commits this session. Right rail untouched per Terry's mid-session directive. Branch is 16 commits ahead of origin/main, not pushed, all typecheck-clean.

## 2. Architectural pivot or major decision

**Mid-session pivot from card-heavy Reticle-inherited chrome → Mercury canvas formatting.**

Terry sent a 325-line Basis design-reference doc + 95 Mercury screenshots and asked: apply the Mercury patterns to AI Thesis via /lambo. This contradicted my recent work — the dashboard IA realignment I'd just shipped (commits `07b717f` + `16b7b6a`) was card-heavy by default (Reticle pattern). I named the conflict explicitly and asked the scope question. Terry's answer: full pass across all 5 surfaces, /lambo decides per-surface. I executed autonomously from there.

**Why:** "Mercury-grade density. Extremely data-dense AND uncluttered." + "Current Basis is too cramped. Aim for the Mercury minimalist look — generous spacing on the canvas itself, formatted directly on the canvas, not buried in cards/boxes everywhere." (DESIGN_REFERENCE.md lines 11-12 verbatim.)

**Tradeoff accepted:** Two dashboard commits from earlier this session (`07b717f` and `16b7b6a`) stayed in git history; commit `9ec57ad` superseded their chrome but preserved their IA + data wiring. Cleaner than rewriting history.

## 3. State of the world

### Git state

| Field | Value |
|---|---|
| Working dir | `/Users/terryturner/Projects/ai-thesis` |
| Branch | `claude/lambo-design-finish` |
| HEAD SHA | `16c83f69f30a88a08130c0714ed6b188da79b16f` |
| Commits ahead of `origin/main` | 16 |
| Pushed to remote | NO |
| Working tree | Clean (handoff doc is the only uncommitted item until this file gets added) |

### Dev server / processes

| Process | State | Detail |
|---|---|---|
| Next dev server (port 3003) | UP, HTTP 200 verified at 12:31 CDT 2026-05-17 | Background task ID from S1: `bw3hy4o16` (carried across compacts — verify before assuming) |

### External integrations

| System | State |
|---|---|
| Supabase | Fixture mode (no env configured) — all surfaces gracefully degrade. Empty-state messaging shipped throughout |
| FMP / Polygon | N/A for this session — no ingestion touched |

### DB state changes

None this session.

### Secrets touched

None this session.

### Scheduled jobs

None this session.

## 4. Action / API reference

None this session — no endpoints touched. All work was UI / presentation layer.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/app/page.tsx` | MODIFIED | Dashboard Mercury decard — Section, KpiRow, MoversTable, AlertCallout |
| `web/src/components/name/NameHeader.tsx` | MODIFIED | Side-by-side hero + chart header (Mercury Pic 19 b2); meta strip flex-wrap |
| `web/src/components/name/Sparkline.tsx` | MODIFIED | Card chrome stripped; inline-flow ready for embedding in NameHeader |
| `web/src/components/name/FactorPanels.tsx` | MODIFIED | 4-up card grid → KPI strip with vertical hairlines (Mercury Pic 17 b2). Hardcoded `#FACC15` + `#A78BFA` swapped to `var(--warning)` / `var(--info)` per spec §2.1 |
| `web/src/components/name/DepFlagsList.tsx` | MODIFIED | Card chrome stripped; section header + hairline + canvas content |
| `web/src/components/name/DataPendingCard.tsx` | MODIFIED | Dashed card → strip cell with optional left border via `isFirst` prop |
| `web/src/app/universe/[ticker]/page.tsx` | MODIFIED | Decarded canvas, removed standalone Sparkline call (now in header), DataPending strip with hairlines |
| `web/src/app/regime/page.tsx` | MODIFIED | "How the multiplier applies" decarded; canvas padding bumped |
| `web/src/app/regime/MultiplierBanner.tsx` | MODIFIED | Outer card stripped; top + bottom hairlines + vertical cell divider |
| `web/src/app/aiq/[ticker]/AiqEditor.tsx` | MODIFIED | Total hero decarded; DimRow + Field card-per-row chrome stripped; row dividers via hairlines |
| `web/src/app/aiq/[ticker]/AiqHistory.tsx` | MODIFIED | Outer aside card stripped; legacy plasma-cyan latest-row highlight swapped to `var(--accent-soft)` |
| `web/src/app/portfolio/AggregateBar.tsx` | MODIFIED | Rewritten — Market Value as HeroNumber protagonist + 4-cell supporting strip below |
| `web/src/app/portfolio/PositionsTable.tsx` | MODIFIED | Outer card stripped; legacy plasma-cyan + plasma-pink rgbas swapped to spec tokens |
| `web/src/app/portfolio/ReservePanel.tsx` | MODIFIED | Both sub-sections decarded; `cardStyle` helper renamed `sectionStyle` |
| `web/src/app/portfolio/page.tsx` | MODIFIED | AddPositionForm wrapper section stripped (form has its own internal header) |
| `web/src/components/primitives/HeroNumber.tsx` | MODIFIED | New optional `prefix` prop ("$", "€") with locale-aware thousands separators |
| `docs/design/mercury-references.md` | CREATED | Cross-session reference doc — pattern map, paths to source ref doc + screenshots, /lambo architectural decisions |
| `~/.claude/skills/sch/SKILL.md` | CREATED | `/sch` skill — same-chat-handoff protocol (12-section disk doc + Block B paste-ready text). Lives in `~/.claude/`, NOT in repo |

## 6. Decisions locked

### D1: Right rail is OFF-LIMITS for the Mercury pass

**Rule:** Apply Mercury decard ONLY to main canvas content. Do not touch the right rail (CtxPanel / Shell.tsx).

**Why:** Terry stated mid-session, verbatim: *"I do like the right rail though that I have as part of MY DESIGN. Leave that."*

**Tradeoff accepted:** Inconsistency between main-canvas style (Mercury-decarded) and right-rail style (existing chrome). Terry explicitly accepts this — the rail is his lock.

### D2: GaugeCards keep their card chrome; Section wrappers around them do not

**Rule:** Multi-part instruments (GaugeCard: label + GATE HIT chip + value + sparkline + threshold-history footer) retain card chrome. The section wrapper grouping them does not.

**Why:** /lambo "earn its place" — gauges are logical composites with 5+ sub-elements; the boundary is functional, not decorative.

**Tradeoff accepted:** Slight visual inconsistency where the gauges look "bordered" inside an otherwise canvas-flow page. Reads as intentional ("these are instruments").

### D3: AlertCallout uses a thin border, not zero chrome

**Rule:** The dashboard's top alert callout has a 1px subtle border, no bg fill.

**Why:** Mercury Pic 11 b2 "Suggested actions" — the subtle border signals "this is a callout group worth a glance" vs. flat canvas content. Stripping it would lose the affordance.

**Tradeoff accepted:** This is the ONE place on /dashboard that has a border. Justifiable because alerts are by definition the most important thing on the page when present.

### D4: `<Cell isFirst>` boolean pattern for hairline strips

**Rule:** Strip-style components (KpiRow cells, FactorPanels Panel, ReservePanel TriggerRow, DataPendingCard, AggregateBar Kpi) pass an explicit `isFirst` boolean to suppress the leftmost cell's `borderLeft`. NOT CSS `:first-child`.

**Why:** Server-rendered. Explicit prop is more legible at the call site than scanning for nth-of-type rules. Consistent across the codebase.

**Tradeoff accepted:** Minor prop-drilling. Worth it for clarity.

### D5: HeroNumber `prefix` is the path for currency rendering

**Rule:** When a HeroNumber represents a currency value, pass `prefix="$"`. The primitive uses `toLocaleString` for thousands separators when prefix is `$` or `€`; falls back to `toFixed(precision)` otherwise.

**Why:** Avoids forking a `CurrencyHero` variant primitive. Single source of truth for hero formatting.

**Tradeoff accepted:** The primitive's API now has both `prefix` and `unit` — easy to confuse. Documented in the JSDoc.

## 7. Next-session test plan — MOST IMPORTANT

### 7.1 Read-only verification (<60s, no mutations)

```bash
# Verify branch + HEAD match this handoff
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD
# Expected: 16c83f69f30a88a08130c0714ed6b188da79b16f (or a newer commit if work continued)
git log --oneline origin/main..HEAD | head -20
# Expected: top entry is `16c83f6 docs: add Mercury reference index for cross-session continuity`

# Verify dev server still up
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/
# Expected: 200
# If not 200: cd web && npm run dev  (background it)

# Verify typecheck clean
cd web && npx tsc --noEmit
# Expected: no output (no errors)

# Confirm Mercury reference doc landed
ls /Users/terryturner/Projects/ai-thesis/docs/design/mercury-references.md
ls /Users/terryturner/Projects/ai-thesis/docs/design/lambo-review-2026-05-17.md
```

### 7.2 Fresh end-to-end test

Not applicable — UI session. No endpoints, no engine changes, no ingestion.

### 7.3 Visual / UI verification

Re-screenshot all 5 main surfaces and confirm no card chrome regression:

```bash
python3 /tmp/lambo-review-2026-05-16/reshot.py
# Outputs /dashboard, /universe, /universe/TSM, /regime, /login to /tmp/lambo-review-2026-05-16/after_tokens/

python3 /tmp/lambo-review-2026-05-16/shot_aiq.py
# Outputs /aiq/TSM

python3 /tmp/lambo-review-2026-05-16/shot_portfolio.py
# Outputs /portfolio (1440x1400 tall viewport)

# If any script is missing from /tmp (machine reboot wipe), re-extract:
mkdir -p /tmp/basis-design-ref && unzip -o "/Users/terryturner/Documents/Archives/Basis - Reticle (Remix) (Remix)/uploads.zip" -d /tmp/basis-design-ref
# That restores the Mercury reference screenshots. The reshot scripts are simple Playwright calls — re-create if missing per the inline source in /tmp.
```

Expected appearance per surface — these are the visual contract:

- **`/dashboard`**: Greeting + AlertCallout (when gates hit) + decarded KPI strip with vertical dividers + Score Movers table with faint row dividers + Regime section header with summary right-aligned + 3 GaugeCards (still bordered — earn their chrome).
- **`/universe/TSM`**: Side-by-side header (hero left, 12-week sparkline right) + 4-cell FactorPanels strip + DepFlagsList only when flags > 0 + 3-cell DataPending strip at bottom. NO outer card chrome anywhere except inside the FactorPanels strip dividers.
- **`/regime`**: MultiplierBanner as a hairline strip (no outer card) with vertical divider between hero cell and ladder cell + 3 GaugeCards bordered + "How the multiplier applies" decarded prose.
- **`/aiq/TSM`**: Total hero at top in hairline frame + 6 DimRows flowing on canvas with hairline separators + History aside decarded with top/bottom hairlines.
- **`/portfolio`**: Market Value `$0` hero (muted in empty state) with derivation/attribution + 4-cell supporting strip + Reserve section decarded with progress bar + Triggers section decarded + AddPositionForm.

If any surface shows a `border: 1px solid var(--border)` + `borderRadius: 6` + `background: var(--surface)` triplet on a section wrapper, that's a regression — grep the file and check against this session's commits.

## 8. Budget / quota tracking

Not applicable.

## 9. Known issues / backlog

### Open queue (locked order from S1 review + S2 additions)

1. **Task #4 Phase 4b — Right-rail content fan-out (5 sub-builds).** Right rail itself is LOCKED per D1; what surfaces INTO the rail per-page is still in scope: Today / Activity / Reserve+Triggers / Legend / History.
2. **Task #8 P1/P2 residuals.** Most original review items were absorbed into the Mercury pass. Still open: `/universe` table sticky scroll (Mercury Pic 5 b2), and any per-page items in `docs/design/lambo-review-2026-05-17.md` §2 tables not yet shipped.
3. **Task #9 P3 polish.** Lowest priority.

### Mercury patterns deferred (not yet applied, no current surface needs them)

Per `docs/design/mercury-references.md` §2a:
- Pattern #7 Sticky scroll → eligible for `/universe` table
- Pattern #8 Sidebar sub-items → speculative
- Pattern #9 3-sub-tab + scrubber → future `/history` or `/memos`
- Pattern #10 3-dot menu → future `/settings`
- Pattern #11 Modal blurred bg → no modals exist yet
- Pattern #12 Detail pane → speculative drill-down

### No blockers

## 10. Quick-reference IDs

```
PROJECT ROOT:     /Users/terryturner/Projects/ai-thesis
WEB SUBDIR:       /Users/terryturner/Projects/ai-thesis/web
BRANCH:           claude/lambo-design-finish
HEAD SHA:         16c83f69f30a88a08130c0714ed6b188da79b16f
TRACKING:         origin/main (16 commits behind HEAD)
DEV SERVER:       http://localhost:3003
DEV SERVER TASK:  bw3hy4o16 (background task ID from S1; verify alive)

DESIGN REF DOC:   /Users/terryturner/Documents/Archives/Basis - Reticle (Remix) (Remix)/DESIGN_REFERENCE.md
DESIGN REF ZIP:   /Users/terryturner/Documents/Archives/Basis - Reticle (Remix) (Remix)/uploads.zip
MERCURY PICS:     /tmp/basis-design-ref/uploads/CleanShot 2026-05-16 at *.png  (re-extract from zip if /tmp wiped)
MERCURY MAP:      /Users/terryturner/Projects/ai-thesis/docs/design/mercury-references.md
LAMBO REVIEW:     /Users/terryturner/Projects/ai-thesis/docs/design/lambo-review-2026-05-17.md
PRIOR HANDOFF:    /Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S1-lambo-design-finish.md
THIS HANDOFF:     /Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S2-mercury-decard-pass.md
HANDOFF DESKTOP:  /Users/terryturner/Desktop/2026-05-17-S2-mercury-decard-pass.md

PLAYWRIGHT SCRIPTS:
  /tmp/lambo-review-2026-05-16/reshot.py          # /dashboard /universe /universe/TSM /regime /login
  /tmp/lambo-review-2026-05-16/shot_aiq.py        # /aiq/TSM
  /tmp/lambo-review-2026-05-16/shot_portfolio.py  # /portfolio at 1440x1400
SCREENSHOT OUTPUT DIR: /tmp/lambo-review-2026-05-16/after_tokens/

/SCH SKILL: ~/.claude/skills/sch/SKILL.md  (companion to memory [[compact-handoff-framework]])

KEY PRIMITIVES (use these; don't fork):
  web/src/components/primitives/HeroNumber.tsx       — props: value, prefix, unit, precision, delta, label, derivation, attribution, size, valueColor
  web/src/components/primitives/DerivationStrip.tsx  — props: source, period, timestamp, version, fontSize, color
  web/src/components/primitives/MultiplierLadder.tsx — props: steps (LadderStep[]), activeKey, gap
```

## 11. Pitfalls / gotchas

1. **/tmp wipe risk for Mercury screenshots.** The extracted PNGs live at `/tmp/basis-design-ref/uploads/`. If the machine rebooted, they're gone. The zip at `/Users/terryturner/Documents/Archives/...` is permanent — re-extract command is in §10.
2. **Mercury pic pixel data does NOT survive /compact.** The compacter summarizes my conversation; the image bytes get text-summarized. Next-Claude can re-Read individual screenshots via the paths in §10 if needed.
3. **Pic-numbering convention.** Terry calls them "Pic 11 batch 2" / "Pic 19 b2" — the DESIGN_REFERENCE.md doc has 3 batches (m0007 = 21 pics, m0009 = 19 pics, m0011 = 9 pics). The filename mapping is documented in that doc, NOT in this handoff — read the ref doc if Terry references a specific Pic number.
4. **Card-chrome regression test.** If reviewing this work, grep for `border: "1px solid var(--border)"` + `borderRadius: 6` + `background: "var(--surface)"` triplets — those are the legacy Reticle-pattern fingerprint that the Mercury pass replaced. Should NOT appear on any section wrapper in the 5 main surfaces.
5. **GaugeCard intentionally bordered.** Don't reflexively strip its chrome on a future pass — see D2 above. Same for AlertCallout's thin border — see D3.
6. **TWO dashboard commits from S2 were superseded but not reverted.** Commits `07b717f` + `16b7b6a` shipped the IA realignment with card chrome; `9ec57ad` stripped the chrome but preserved IA + data wiring. If reviewing git history, treat `9ec57ad` as the source of truth on dashboard appearance.
7. **The `/sch` skill saves to `~/.claude/skills/sch/SKILL.md`** — NOT to the repo. It's a user-level skill, available across all projects. Terry invokes it via `/sch` or `/SCH`.

## 12. Next-session pickup point

Two paths — Terry picks:

**Path A — continue building:** Pick up Task #4 Phase 4b (right-rail content fan-out). First action: read `docs/design/lambo-review-2026-05-17.md` §10 for the per-surface rail content spec, then build the `/dashboard` "Today" rail first. The right rail itself stays per D1, but what surfaces INTO each rail per-page is still open scope.

**Path B — push + review:** `git push origin claude/lambo-design-finish` (Terry must approve push explicitly per memory `feedback_no_assumptions`), then open a PR. Branch has 16 commits ahead of `origin/main` covering: token swap → Reticle theme strip → HeroNumber/DerivationStrip/MultiplierLadder primitives → Dashboard IA realignment → Mercury decard pass on all 5 surfaces → reference docs.

Default: ask Terry which path.
