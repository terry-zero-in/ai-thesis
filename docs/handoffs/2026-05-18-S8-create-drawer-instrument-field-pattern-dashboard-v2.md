# S8 Handoff — 2026-05-18 — PageCreateDrawer + Instrument-Field Pattern + Dashboard v2

**State verified at write-time (2026-05-18 19:30 CDT):**
- HEAD: `cce37ae09322a37b489506dbaebe601e7c71a461` (short `cce37ae`)
- Commits ahead of `origin/main`: **0** (all pushed)
- TSC clean: **YES** (exit 0)
- Prod alias: `https://ai-thesis-v2.vercel.app/` → HTTP/2 200 (marketing landing)
- Prod authed: `/portfolio` → HTTP/2 307 → /login (auth gate working)
- Working tree: clean except **6 untracked handoff docs** (S3-S8)

---

## §1 TL;DR

S8 shipped 5 commits implementing the cross-product visual standard. Terry's
verbatim trigger: the Portfolio Add-Position drawer is *"exactly how the
entire app should look. This looks much sharper than the rest of the app."*

Three artifacts now exist:
1. **`PageCreateDrawer`** primitive (canonical reference surface for the rule)
2. **`docs/design/instrument-field-pattern.md`** — the 277-line visual standard
   spec that codifies what makes the drawer "sharper"
3. **`docs/design/insights-primitive-and-dashboard.md`** — 255-line brainstorm
   capturing the Universe-Insights primitive direction + Dashboard redesign
   (response to Terry's Linear Insights screenshot + "Dashboard is not Lambo")

Plus two builds: Dashboard surface-fill lift (4 cards lifted to `var(--surface)`),
then Dashboard v2 consolidation (8 sections → 4, dropped TodayThesisCard +
MorningBrief + CompactGateStrip + AlertCallout, merged into EngineStateStrip).

Outstanding: Terry's eye on Dashboard v2 + 11 Open Qs in brainstorm doc
before Universe Insights Phase 2 can start. Three operational footguns
still live (broken webhook, wrong repo-root .vercel link, untracked handoffs).

---

## §2 Architectural pivot or major decision

**The Instrument-Field Pattern is now the cross-product visual standard.**

Before S8: visual conventions were piecemeal. Drawer chrome / card chrome /
input chrome had no codified ruleset; new surfaces inherited shadcn defaults
or copied nearby code by inference. Terry's "everything should look like the
drawer" directive crystallized that the drawer is not a one-off — it's the
template.

`docs/design/instrument-field-pattern.md` locks three layered patterns:
- **§1 Mono Meta** — typography hierarchy (mono uppercase labels, `.06-.08em`)
- **§2 Instrument Field** — input/control chrome (28px height, segmented
  toggles with `--accent-soft` fill, voltage CTA bottom-left)
- **§3 Inset Surface** — card/drawer/popover chrome. Key rule: cards use
  `var(--surface)` not `var(--canvas)`. Floating overlays get stronger border +
  drop-shadow; inset cards get subtle border, no shadow.
- **§4 Mercury format-on-canvas exception** — preserved for KPI strip +
  MonoMetaSpine ONLY; everything else lifts off canvas.

The doc supersedes prior visual conventions where conflicts exist. Mercury
"format on canvas" rule retired as the default. Per-surface audit + lift is
a single-purpose commit each (§7 of spec has roll-out map).

**Secondary pivot: Universe is the natural home for the Linear-Insights
state-shaping rail, NOT Dashboard.** Dashboard's Score Movers shows 8 rows —
filtering 8 rows isn't compelling. The 255-line brainstorm doc commits to:
Phase 2 ship Universe Insights → Phase 3 Dashboard consolidation (DONE this
session) → Phase 4 Dashboard mini-Insights via the same primitive.

---

## §3 State of the world

**Working directories:**
- Code: `/Users/terryturner/Projects/ai-thesis/web`
- Git: `/Users/terryturner/Projects/ai-thesis`

**Branch / commits:**
- `main` @ `cce37ae` (0 ahead of origin)
- 5 commits this session, all pushed

**TSC:** clean (exit 0) at `web/`

**Production:**
- Alias: `https://ai-thesis-v2.vercel.app/`
- Latest deploy: `ai-thesis-v2-shlqe848r-terry-8893s-projects.vercel.app`
  (39s build, 19:25 CDT)
- Marketing landing (`/`): HTTP/2 200, all 4 markers present
- Operator surfaces (`/portfolio`, `/`): auth-gated 307 → /login

**Vercel projects (CRITICAL — see §11 Pitfall #2):**
- CORRECT project: `ai-thesis-v2` (id `prj_YkjioJcd1aEBmr1becSngnv9g8wP`),
  linked in `web/.vercel/project.json`
- WRONG project at repo root: `ai-thesis` (id `prj_D9olPvBb2W0h7l5oYGgkAnzuHRKs`)
- THIRD project surfaced this session: `ai-thesis-three.vercel.app` (deploy
  `ai-thesis-gnonbkndz`) — I deployed to it accidentally; never updated the
  v2 alias. Re-deployed from `web/` to fix.

**Supabase:** unchanged from S7 baseline. No schema migrations this session.

**Routines (THS-71):** unchanged from S6/S7. e80 migration not yet applied
to Supabase Studio; 4 routines not yet created on claude.ai/code. Blocks
Pending tab + thesis_broken alert finish.

---

## §4 Action / API reference

None — no endpoints touched this session.

---

## §5 Files created or modified

| Path | Action | One-line rationale |
|---|---|---|
| `web/src/components/primitives/PageCreateDrawer.tsx` | NEW | Canonical "create" affordance — page-header upper-right pill expands to anchored overlay; ⌘N shortcut; render-prop close(); ESC/click-outside dismissal |
| `web/src/app/portfolio/PortfolioAddDrawer.tsx` | NEW | Thin client wrapper composing PageCreateDrawer + AddPositionForm (page.tsx is server, can't pass render-prop fn across boundary) |
| `web/src/app/portfolio/AddPositionForm.tsx` | MOD | Added optional `onSuccess?: () => void` prop; ref-gated effect fires once per false→true `state.ok` transition with 1.2s delay so green success banner is visible before drawer dismisses |
| `web/src/app/portfolio/page.tsx` | MOD | Removed `.portfolio-grid` wrapper + bottom-form placement; PortfolioAddDrawer hoisted into page header; positions table claims full canvas width unconditionally |
| `web/src/app/globals.css` | MOD | Killed `.portfolio-grid` + `.portfolio-form-col` rules + 1600px breakpoint hack; replaced with comment explaining hoist |
| `docs/design/instrument-field-pattern.md` | NEW | 277-line spec codifying the visual standard (3 patterns + Mercury exception + roll-out map + DO/DON'T) |
| `web/src/components/dashboard/TodayThesisCard.tsx` | MOD | Surface fill lifted `var(--canvas)` → `var(--surface)` per spec §3.1 (later this session: card was DROPPED from Dashboard canvas; file retained for potential /memos reuse) |
| `web/src/app/page.tsx` | MOD (twice) | First: AlertCallout + CompactGateStrip lifted to `var(--surface)`. Second: 240 lines of dead code stripped + 3 sections dropped + EngineStateStrip swap-in |
| `web/src/components/dashboard/MorningBrief.tsx` | MOD | PanelShell surface fill lifted (then later: MorningBrief removed from Dashboard canvas) |
| `docs/design/insights-primitive-and-dashboard.md` | NEW | 255-line brainstorm doc — Insights primitive spec + Dashboard redesign + 11 Open Qs awaiting Terry |
| `web/src/components/dashboard/EngineStateStrip.tsx` | NEW | Merges MonoMetaSpine engine-state segments + AlertCallout severity into one row; inline `▶ Review regime` link only when gates>0 |
| `web/src/components/rails/DashboardTodayRail.tsx` | MOD | Dropped Calendar placeholder section per Linear "absence reads scoped" principle |
| `docs/handoffs/2026-05-18-S8-…md` | NEW | This handoff |

---

## §6 Decisions locked

### Lock 6.1 — Instrument-Field Pattern as visual standard
- **Rule:** Every CRUD/control surface renders against the three patterns
  codified in `docs/design/instrument-field-pattern.md`. Mercury "format on
  canvas" retired as default; survives only for strip-level chrome (§4).
- **Why:** Terry's verbatim — the drawer is "exactly how the entire app
  should look." Without a written standard, every new surface drifts to
  shadcn defaults.
- **Tradeoff accepted:** Existing surfaces (Regime, Portfolio AggregateBar,
  AIQ Editor, etc.) are now on-record as "off-pattern, pending audit." Spec
  §7 lists 6+ unaudited surfaces. Per-surface lifts are single-purpose
  commits, will accumulate as backlog.

### Lock 6.2 — Universe is the canonical home for the Insights primitive
- **Rule:** Linear's "click bar to filter canvas" pattern lands on Universe
  first (50 names, 4-5 slice dimensions). Dashboard gets a compressed
  single-axis version downstream. Portfolio adopts after Universe.
- **Why:** Dashboard's Score Movers table shows 8 rows — filtering 8 rows
  doesn't earn the primitive. Universe's 50 names × 4 slice dimensions does.
- **Tradeoff accepted:** Dashboard polish (Phases 3+4) is partial until the
  primitive ships on Universe.

### Lock 6.3 — Dashboard consolidates 8 sections → 4
- **Rule:** Canvas = Greeting + EngineStateStrip + KpiRow + ScoreMoversTable.
  TodayThesisCard, AlertCallout, MorningBrief, CompactGateStrip dropped
  from `/`. AlertCallout merged inline into EngineStateStrip as
  severity-toned suffix segment with single `▶ Review regime` link.
- **Why:** Same macro/regime fact was rendered 3-4 times across multiple
  cards. Linear "calmer interface" principles Terry shared (don't compete
  for attention, structure felt not seen, less is more).
- **Tradeoff accepted:** TodayThesisCard (THS-74, S6) is now orphaned —
  retained as a file but not rendered anywhere. Reuse target: /memos when
  that page lifts.

### Lock 6.4 — Calendar placeholder removed from rail
- **Rule:** Rail surfaces with no data render NOTHING, not a "v1.1
  placeholder" message.
- **Why:** Linear "absence reads scoped; placeholder reads incomplete."
- **Tradeoff accepted:** When v1.1 ships the earnings/macro calendar,
  the rail section needs to be re-added.

### Lock 6.5 — Two-commit split when in doubt
- **Rule:** Spec doc + applying-the-spec-to-Dashboard shipped as TWO
  commits (`ca0a0f3` spec, `dc9c1cb` surface-fill apply). Same for
  brainstorm + Dashboard v2 (`0a76b7a` brainstorm, `cce37ae` build).
- **Why:** [[feedback_two_commit_when_in_doubt]].
- **Tradeoff accepted:** More commits, finer-grained history.

---

## §7 NEXT-SESSION TEST PLAN (most important section)

### §7.1 Read-only verification (<60s)

Paste-and-run from any directory:

```bash
cd /Users/terryturner/Projects/ai-thesis && \
  echo "=== git state ===" && \
  git rev-parse HEAD && \
  git log --oneline origin/main..HEAD 2>/dev/null | wc -l | xargs echo "ahead:" && \
  git status --short | head -10 && \
  echo "=== TSC ===" && \
  cd web && npx tsc --noEmit 2>&1 | tail -3 && echo "tsc exit: $?" && \
  echo "=== prod (marketing) ===" && \
  curl -sI https://ai-thesis-v2.vercel.app/ | head -1 && \
  curl -s https://ai-thesis-v2.vercel.app/ | grep -oE "(Notify me|Starter|research terminal|HIGH ≥)" | sort -u && \
  echo "=== prod (auth-gated) ===" && \
  curl -sI https://ai-thesis-v2.vercel.app/portfolio | head -1 && \
  echo "=== latest deploy alias ===" && \
  vercel ls 2>/dev/null | head -8
```

**Expect:**
- HEAD `cce37ae09322a37b489506dbaebe601e7c71a461`
- ahead: `0`
- working tree clean except **6 untracked handoff docs** (S3-S8)
- TSC exit `0`
- `/` → HTTP/2 200, all 4 marketing markers present
- `/portfolio` → HTTP/2 307 (auth gate alive)
- Latest deploy in `vercel ls` should be `ai-thesis-v2-shlqe848r-…`

### §7.2 Visual / UI verification (Terry must do — requires auth session)

Open https://ai-thesis-v2.vercel.app/ logged in. Expect Dashboard renders
with EXACTLY 4 canvas sections, top to bottom:

1. **Greeting** — "Good evening, Terry" + date + market clock
2. **EngineStateStrip** — single mono row:
   ```
   as_of 2026-05-09 · engine composite v1.0 · mode STUBBED · regime ● NEUTRAL · 1.00× · 0/3 gates · weekly chain Sat 22:00 UTC
   ```
   When gates>0, last segment swaps to `▶ Review regime` in severity color.
3. **KpiRow** — 4 KPI cells (Portfolio / P&L / 30D / High-tier names) OR
   onboarding card if portfolio empty
4. **Score Movers** — table, 8 rows max, sortable

**Right rail expect (top to bottom):** TODAY (with live clock) → INSIDER →
MACRO GATES → footer "Data as of …"

**NOT expected (anywhere):** TodayThesisCard, separate AlertCallout, MorningBrief,
CompactGateStrip, Calendar placeholder.

### §7.3 Portfolio Add-position drawer verification

Open `/portfolio`. In page-header upper-right, expect `+ Add position ▼` pill.
Click → 460px overlay drops down anchored to trigger. Form renders inside.
Escape / click-outside / × glyph close. `⌘N` toggles. Successful save
auto-dismisses after ~1.2s.

`/portfolio?edit=AAPL` should open the drawer pre-hydrated.

---

## §8 Budget / quota tracking

Vercel deploys this session: 7 total (5 successful + 1 wrong-project +
1 re-deploy fix). All within free tier.

No external API spend (FMP, Polygon, etc.) this session.

No Anthropic Routines fired (THS-71 still blocked on manual setup).

---

## §9 Known issues / backlog

### 9.1 Awaiting Terry input (blocks me)
1. **Eyes on Dashboard v2 live** — confirm it's at the bar OR name what's
   not, so Phase 3 polish scope is known
2. **11 Open Qs in `docs/design/insights-primitive-and-dashboard.md` §6** —
   recommended-defaults provided; fast path is "go with defaults" → I update
   doc status to LOCKED → next session opens with Universe Insights spec
   ready to build
3. **THS-71 manual steps:** apply e80 migration in Supabase Studio + create
   4 routines on claude.ai/code per `docs/routines/setup-guide.md`

### 9.2 In-flight / queued (mine to do, ordered)
4. **Universe Insights primitive** (Phase 2) — 4-6h, gated on Open-Qs
5. **Dashboard mini-Insights** (Phase 4) — 1-2h, gated on Phase 2
6. **Portfolio Insights adoption** (Phase 5) — 2-3h, gated on Phase 2
7. **Per-surface audit + lift to Instrument-Field Pattern** — single-purpose
   commit each, ~30-60min per surface. Surfaces: Regime, Portfolio
   AggregateBar, AIQ Editor, AIQ Drafts, Decisions, Memos, Backtest, Settings.
   See `instrument-field-pattern.md §7` for the rollout map.
8. **MorningBrief relocation to /memos** when /memos page lifts
9. **TodayThesisCard** — orphan file, decide reuse target or delete
10. **THS-75 / 76 / 77** — specs pending from Terry
11. **THS-85 Auth + Stripe** — High priority, billing risk, gated on direction
12. **THS-87 backtest** + delete duplicate THS-87 in Linear
13. **Palette v1.2 refinement** — deferred until Terry directs

### 9.3 Operational debt (footguns still live)
14. **GitHub→Vercel auto-deploy webhook BROKEN** — every commit requires
    manual `cd web && vercel deploy --prod --yes`. Hit this every session
    until you fix it in Vercel project settings UI.
15. **Repo-root `.vercel/project.json` points to `ai-thesis`** (wrong) —
    deploy from repo root sends build to wrong project, prod alias doesn't
    update. Either delete the root file or re-point it.
16. **6 untracked handoff docs** in `docs/handoffs/` (S3-S8) — Terry has
    indicated single docs-housekeeping commit cadence.

### 9.4 Cosmetic / followup
17. Dashboard polish per Linear "calmer" principles further: KpiRow framing
    borders → drop, hover-only hairlines on MoversTable rows, GreetingStrip
    quieter — only if Terry signals he wants more after seeing v2

---

## §10 Quick-reference IDs

**Repos / projects:**
- Repo: `git@github.com:terry-zero-in/ai-thesis.git`
- GitHub repo: `terry-zero-in/ai-thesis`
- Vercel project (CORRECT): `ai-thesis-v2` (id `prj_YkjioJcd1aEBmr1becSngnv9g8wP`)
- Vercel project (WRONG, repo-root): `ai-thesis` (id `prj_D9olPvBb2W0h7l5oYGgkAnzuHRKs`)
- Vercel project (THIRD, exists): `ai-thesis-three.vercel.app`

**URLs:**
- Prod: https://ai-thesis-v2.vercel.app/
- Latest deploy (S8): `ai-thesis-v2-shlqe848r-terry-8893s-projects.vercel.app`
- Vercel project page: https://vercel.com/terry-8893s-projects/ai-thesis-v2/

**Commit SHAs (S8, in order):**
- `da2531c` — THS-76 PageCreateDrawer + Portfolio adoption
- `ca0a0f3` — Instrument-Field Pattern spec doc
- `dc9c1cb` — THS-78 Dashboard surface-fill lift
- `0a76b7a` — Insights primitive + Dashboard brainstorm doc
- `cce37ae` — THS-79 Dashboard v2 calmer 4-section consolidation
- HEAD = `cce37ae09322a37b489506dbaebe601e7c71a461`

**Pre-S8 state:** `9a5c952` (S7 close)

**Linear:**
- THS-76 (PageCreateDrawer) — used as commit prefix
- THS-78 (Dashboard surface-fill) — used as commit prefix
- THS-79 (Dashboard consolidation) — used as commit prefix
- Ticket IDs may not exist as Linear issues — verify before treating as cross-reference

**Files of session significance:**
- `web/src/components/primitives/PageCreateDrawer.tsx` (NEW canonical primitive)
- `web/src/components/dashboard/EngineStateStrip.tsx` (NEW)
- `web/src/app/portfolio/PortfolioAddDrawer.tsx` (NEW)
- `docs/design/instrument-field-pattern.md` (NEW spec — 277 lines)
- `docs/design/insights-primitive-and-dashboard.md` (NEW brainstorm — 255 lines)

**Paths next session needs:**
- Project: `/Users/terryturner/Projects/ai-thesis`
- Code dir: `/Users/terryturner/Projects/ai-thesis/web`
- Specs: `/Users/terryturner/Projects/ai-thesis/docs/design/`
- Handoffs: `/Users/terryturner/Projects/ai-thesis/docs/handoffs/`

---

## §11 Pitfalls / gotchas

1. **GitHub→Vercel auto-deploy webhook broken.** Every commit needs manual
   deploy. Verified S7 + S8 — last auto-deploy was 21h before S7 start.

2. **REPO-ROOT `.vercel/project.json` POINTS TO WRONG PROJECT.** This bit
   me again this session. The deploy command must be run from
   `/Users/terryturner/Projects/ai-thesis/web`. Bug pattern that bit me:
   ```bash
   # WRONG — `&&` chain stays in repo root after first `cd`:
   cd /path/to/repo && git push && vercel deploy --prod --yes
   ```
   The `cd` is for git operations; the vercel command stays in repo root,
   deploys to wrong project. Correct pattern:
   ```bash
   # CORRECT — explicit re-cd before vercel:
   cd /path/to/repo && git push && cd web && vercel deploy --prod --yes
   ```
   When this footgun fires, the prod alias `ai-thesis-v2.vercel.app` does
   NOT update; deploy lands on `ai-thesis-three.vercel.app` instead. To
   recover: re-deploy from `web/`. Verify with `curl -sI` against the
   v2 alias.

3. **Next.js 16 proxy pattern.** `web/src/proxy.ts` (formerly `middleware`)
   has carve-outs for `/` (marketing landing) and `/login`. Adding a new
   public route requires updating `PUBLIC_PREFIXES` array.

4. **TodayThesisCard / MorningBrief / AlertCallout / CompactGateStrip
   ORPHANED.** Files exist in repo but no longer rendered on Dashboard.
   `AlertCallout` + `CompactGateStrip` + `CompactGateRow` were DELETED
   from `page.tsx` outright (240 LOC stripped). `TodayThesisCard.tsx` and
   `MorningBrief.tsx` files retained for /memos graduation. If you're
   grepping for usage and find none, that's expected.

5. **`PageCreateDrawer` render-prop pattern requires client wrapper.**
   `<PageCreateDrawer>{({ close }) => <Form .../>}</PageCreateDrawer>`
   can't be called from a Server Component (functions don't cross the
   boundary). Pattern: thin client wrapper (e.g. `PortfolioAddDrawer.tsx`)
   composes the primitive + form; page.tsx server-renders the wrapper.
   Same pattern needed for Decisions/Memos/AIQ-Drafts adoption.

6. **`EngineStateStrip` consumes `MonoMetaSpine` segments[].** Adding a
   segment with `label: ""` renders an empty span but keeps the `·`
   separator before it — useful for an unlabelled suffix segment (the
   `▶ Review regime` link uses this trick).

7. **`getMorningBrief` no longer called on Dashboard.** If you re-add it
   on /memos, remember to import `getMorningBrief` from `@/lib/routine-outputs`.

8. **AlertItem type + alertItemsFromRegime helper DELETED.** If a future
   surface wants per-gauge alert items, re-derive — the helper is gone.

9. **`var(--canvas)` vs `var(--surface)` rule (Instrument-Field §3.1):**
   floating overlays use `--surface` + `--border` (strong) + drop-shadow;
   inset cards use `--surface` + `--border-subtle` (subtle) + no shadow;
   strips use transparent + hairlines only (Mercury exception). DO NOT use
   `--canvas` as a card background — that's the pre-S8 anti-pattern.

10. **`PortfolioAddDrawer` default-opens on `?edit=<TICKER>`.** The query
    param is decoded by `page.tsx` (`initialTicker`) and passed through.
    Successful submit auto-closes drawer after 1.2s; the form's `state.ok`
    transitions false→true exactly once per save.

11. **Brainstorm doc has 11 Open Qs awaiting Terry.** Without those locked,
    Universe Insights Phase 2 cannot start (slice dimensions, multi-select
    behavior, persistence model are all unresolved).

12. **Honest /lambo grade on Dashboard v2 is pending Terry's eye.** Could
    still be "not Lambo enough" after seeing live. If so, Phase 3 polish
    work emerges: KpiRow framing borders, hover-only hairlines, etc.

---

## §12 Next-session pickup point

**First action on pickup:**

Run §7.1 verification block (paste-and-run, 5 commands, <60s). Expect:
HEAD `cce37ae`, 0 ahead, TSC clean, prod HTTP/2 200 + all marketing
markers, /portfolio 307.

**Then ask Terry:**

> *"S8 closed with Dashboard v2 + the Instrument-Field Pattern locked.
> Three things blocked on you: (1) eyes on Dashboard v2 at
> https://ai-thesis-v2.vercel.app/ — Lambo or needs more? (2) 11 Open Qs
> in `docs/design/insights-primitive-and-dashboard.md` §6 — say 'go with
> defaults' or mark up specifics, then I can start Universe Insights
> Phase 2 (~4-6h build). (3) THS-71 manual setup (e80 migration + 4
> routines on claude.ai/code). Which first?"*

Do NOT start Universe Insights Phase 2 without Terry locking Open Qs.

Do NOT proceed to other surface lifts (Regime, AIQ, Decisions, etc.)
without Terry confirming Dashboard v2 first — same pattern applied
incorrectly across 8 surfaces would be 8× the cleanup.

**Default if Terry says "go on autonomous mode"** (per CLAUDE.md):
1. Lock Open Qs with all recommended defaults
2. Start Universe Insights Phase 2 build
3. Commit the 6 untracked handoff docs as a single docs-housekeeping commit

**Operational tax to pay every session until fixed (§11):** `cd web/`
before `vercel deploy`, otherwise wrong-project deploy.
