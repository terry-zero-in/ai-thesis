# Handoff — 2026-05-17 · S1 · lambo-design-finish

> **Pickup rule:** read §1 + §7 + §10 first. Section 7 is the most important.
> Treat every claim here as a hypothesis to verify against live state before acting.

---

## 1 · Header

| Field | Value |
|---|---|
| Date | 2026-05-17 (continued from 2026-05-16; date rolled mid-session) |
| Session | S1 (first Claude Code session on this project for Terry) |
| Slug | `lambo-design-finish` |
| Agent | Claude Code · Opus 4.7 (1M context) |
| Project | AI Thesis v2 (`/Users/terryturner/Projects/ai-thesis`) |
| Working branch | `claude/lambo-design-finish` (5 commits ahead of `origin/main`) |
| Origin main SHA | `84115cd` (verified `git rev-parse origin/main`) |
| Branch HEAD SHA | `2044a6b` (verified `git rev-parse HEAD`) |
| Dev server | Running at http://localhost:3003 (background task `bw3hy4o16`, started this session) |
| Linear ticket | None — work is design-review-driven, not a THS ticket |
| Reason for compact | Long executing session; Terry called for fresh context to continue execution |

---

## 2 · Where we started (cold-start context)

Terry asked for an **extremely thorough /LAMBO design finish review** of the AI Thesis Next.js portal at `http://localhost:3003`, then said **"run all in the order you think makes the most sense"** to execute the review's recommended fixes autonomously.

Inputs the review was built against:
- `docs/AI-Thesis-v2-Master-Design-Spec.md` v1.0 (Cypher Indigo `#4D5BFF` accent locked; warmer-gray surface ladder; hairlines only; JetBrains Mono tabular-nums; 6px max radius; 220/48/280 chrome; no shadows / glassmorphism / `rounded-2xl`).
- `DESIGN_REFERENCES.md` 4-tier hierarchy (Reticle = chrome / Basis Proforma = canvas / Investment Portal = supplementary / Q-series = mining).
- `/lambo` posture skill (Bloomberg + Linear/Vercel + Lamborghini blend).
- `/linear` doctrine skill (minimalism front door, density building; hover/click iceberg; inputs ≠ displays; pixel-level precision).
- `/test-driven-development` skill (RED → GREEN → REFACTOR for any code change).
- Stack: Next.js 16.2.6 + React 19 + Turbopack + TypeScript. **`web/AGENTS.md` warns "This is NOT the Next.js you know"** — read `node_modules/next/dist/docs/` before writing any Next-specific code.

Terry's locked operating posture for this project (in `CLAUDE.md`):
- Autonomous by default — pick the next ticket and build it; don't ask permission to start each one.
- Commit often, single-purpose per commit, reference the work area in the message.
- Tests yes for engine / data work; tests-after acceptable on UI primitives where pre-existing patterns lack coverage and adding a framework is out of scope (TDD via runtime Playwright assertion is the substitute here).

---

## 3 · What changed this session (5 commits on branch)

| SHA | Title | Files | Net (+ / −) |
|---|---|---|---|
| `6300690` | design: swap chromatic tokens to spec §2.1 — Cypher Indigo + AI Thesis semantic palette | 2 | +29 / −57 |
| `366ecb7` | design: strip Reticle multi-theme switcher infrastructure (1,250 lines dead code) | 19 | +1 / −1250 |
| `5dcfbc9` | design: hide right rail on pages with no spec §6 rail content (Phase 4a) | 9 | +43 / −3 |
| `7f9f720` | design: bind hardcoded semantic colors to spec §2.1 tokens across all surfaces | 22 | +66 / −63 |
| `2044a6b` | design: add HeroNumber + DerivationStrip primitives; apply to /universe/[ticker] | 3 | +287 / −67 |

**Plus the untracked review artifact:** `docs/design/lambo-review-2026-05-17.md` — the full review report, §1-§10 with /linear amendment + interaction-pass result. Not committed yet (intentionally — it's a reference doc, not part of the design-finish commit chain).

---

## 4 · Verification status

Each commit passed before landing:

| Gate | Method | Result |
|---|---|---|
| Token runtime | `python3 /tmp/lambo-review-2026-05-16/verify_tokens.py` — Playwright asserts `getComputedStyle(:root)` for 6 chromatic tokens | PASS after 6300690 (RED before) |
| TypeScript | `npx tsc --noEmit` in `web/` | Clean after every commit including `2044a6b` |
| Console | Playwright walks all 13 routes, captures console errors / warnings / page errors | 0/0/0 after every commit |
| Visual diff | Re-screenshot at 1440×900 2× after each commit; saved to `/tmp/lambo-review-2026-05-16/after_tokens/` and `after_norail/` | Confirmed: HIGH tier badge coral → indigo; GATE HIT ribbon coral → amber; Plasma Cyan everywhere → Cypher Indigo; topbar ThemeSwitcher artifact gone; rail-empty pages now full-width |

**The HeroNumber + NameHeader integration (`2044a6b`) is typecheck-clean but visually unverified.** First post-compact action is to screenshot `/universe/TSM` and confirm the hero treatment renders as designed (or iterate the primitive's sizing/breathing per /lambo's 60%-empty-space rule).

---

## 5 · Open decisions

None pending Terry input — the task list (TaskList tool, IDs 1-9) holds the operational state.

Implicit choices already made under autonomous authority that Terry should sanity-check at next pause:

1. **Reordered Task #5 ahead of Task #4 Phase 4b.** Hero Number primitive is foundational (propagates to 4 surfaces, prerequisite for dashboard IA realignment) and was higher-leverage than building 5 independent rail contents in sequence. Documented in TaskUpdate to Task #4. Phase 4b deferred.
2. **Multi-theme stripped wholesale** (1,250 lines including the entire `src/components/tweaks/` directory). All of it was Reticle scaffolding never wired into AI Thesis. Per /linear §4 anti-pattern "differentness for its own sake" + spec §13 "Themes other than dark = OOS".
3. **Hardcoded color cleanup was full-codebase sed sweep**, not per-file Edit. Justified because (a) clear mechanical substitution; (b) 22 files would be 44+ Edit calls vs 1 sed; (c) verified post-hoc with grep that no false hits remained.
4. **Stripped the stale "Theme" section in `/settings`** that referenced the removed top-bar palette swatch. Dead reference once the switcher was gone.

---

## 6 · Pending work (TaskList state — IDs persist post-compact)

```
#1 [completed] Interaction pass — verify hover/click depth
#2 [completed] Token swap to spec §2.1
#3 [completed] Strip multi-theme switcher
#4 [in_progress] Right-rail content fan-out — Phase 4a done (5dcfbc9); Phase 4b PENDING
#5 [in_progress] HeroNumber + DerivationStrip primitives — built + first integration (NameHeader); pending visual verification + propagation to 4 more surfaces
#6 [pending] Dashboard IA realignment to spec §5.1 (depends on Task #5 Hero Number)
#7 [pending] Multiplier Ladder primitive — generalize /regime Curve
#8 [pending] Per-page P1/P2 fixes from review §2 tables
#9 [pending] Polish pass — P3 items
```

Task #4 description was rewritten via TaskUpdate to reflect Phase 4a/4b split.

---

## 7 · ⚡ EXACT PICKUP POINT (read this first when resuming)

**You are 5 commits deep on `claude/lambo-design-finish`. Resume with these exact steps:**

1. `cd /Users/terryturner/Projects/ai-thesis && git log --oneline -7` — verify HEAD is `2044a6b design: add HeroNumber + DerivationStrip primitives ...`. If not, you're on the wrong branch / state.
2. Confirm the dev server is still running:
   ```bash
   curl -sf http://localhost:3003/universe/TSM > /dev/null && echo "dev server up" || echo "dev server DOWN — restart with: cd web && npm run dev (background)"
   ```
   Background task ID from this session: `bw3hy4o16` (may have died across compact — verify before assuming).
3. **First action: visual verification of the Hero Number integration.** Run:
   ```bash
   python3 /tmp/lambo-review-2026-05-16/reshot.py
   ```
   Then `Read /tmp/lambo-review-2026-05-16/after_tokens/universe_TSM.png` and inspect:
   - Is the Final score rendering at 48px JetBrains Mono with tabular-nums?
   - Is the derivation chain `Raw 87.0 · ×0.95 macro (1 gate hit) · = 82.6 effective` visible immediately beneath?
   - Is the 7-day delta `↑ +X.X (7d)` rendering with color (--success / --danger)?
   - Is the attribution strip `scored 2026-05-09 · composite engine · fixture` visible at the bottom?
   - Does the hero block have ≥60% surrounding breathing room (the /lambo bar)?
   - Has the tier badge moved cleanly to the meta strip without overlap?
4. **If hero looks right:** mark Task #5 progress note + continue to propagate HeroNumber to 4 more surfaces (in this priority order):
   - `/regime` MultiplierBanner — replace the inline 32px mono with `<HeroNumber value={d.macroMultiplier} unit="×" precision={2} label="Active multiplier" derivation="..." attribution="..." size="xl" />`. Touchpoint file: `web/src/app/regime/MultiplierBanner.tsx`.
   - `/aiq/[ticker]` TOTAL — currently shows `TOTAL · _ / 100` placeholder; wire to live sum + HeroNumber.
   - `/dashboard` (after dashboard IA realignment in Task #6).
   - `/portfolio` (when populated).
5. **If hero needs iteration:** adjust `web/src/components/primitives/HeroNumber.tsx` (probably size, padding, or derivation chain styling) — re-screenshot — commit a single-purpose tweak.
6. After Task #5 propagation is complete (4 surfaces), proceed in this order: Task #6 (Dashboard IA realignment) → Task #4 Phase 4b (build 5 rail contents) → Task #7 (Multiplier Ladder primitive) → Task #8 (per-page P1/P2) → Task #9 (polish).

**File paths for immediate context (all verified during this session):**
- Token authority: `web/src/app/globals.css` lines 13-32 (post-swap; spec §2.1 verbatim)
- Hero primitive: `web/src/components/primitives/HeroNumber.tsx` (just shipped — uses size="lg" default = 48px)
- Derivation primitive: `web/src/components/primitives/DerivationStrip.tsx` (built but not yet integrated anywhere)
- Hero first integration: `web/src/components/name/NameHeader.tsx` (refactored — `<HeroNumber />` replaces the two `<ScoreBlock />` instances)
- NoRail primitive: `web/src/components/shell/NoRail.tsx` (wired into 6 pages)
- TierBadge token-bound: `web/src/components/universe/TierBadge.tsx` lines 9-15

**Review report (read for full context):** `docs/design/lambo-review-2026-05-17.md` — 800+ lines, §1-§10 with /linear amendment + interaction-pass finding (zero tooltips revealed across 14 hover targets — meta-P0 #3, depth not built).

---

## 8 · Cascade dependencies + alternate paths

| If you hit | Then | Alternate |
|---|---|---|
| Dev server died across compact | Restart: `cd web && npm run dev` (background). Token verify script + screenshot scripts both require it on :3003. | If port 3003 is taken, Next auto-picks next free port (3004+); update `BASE` in `/tmp/lambo-review-2026-05-16/*.py` |
| Token verify script reports FAIL | Inspect `web/src/app/globals.css:13-32` against spec §2.1 + check whether someone re-introduced the old multi-theme code | Token authority is the CSS file directly; spec §2.1 lists the 6 chromatic values |
| Typecheck fails after a primitive edit | Diff against `2044a6b` for the primitive's intended type shape | Worst case: revert the primitive change, re-derive from spec |
| `web/AGENTS.md` warning means real Next 16 API differences | Read `node_modules/next/dist/docs/` for the specific area | Don't rely on training data for Next/React APIs past Jan 2026 |
| Visual hero doesn't hit /lambo's 60% breathing rule | Adjust `padding` on the wrapper div in `HeroNumber.tsx` (currently `8px 0` — likely too tight; try 20-32px vertical) | Worst case: rebuild as a larger container with explicit min-height |
| Derivation chain wraps awkwardly on narrow viewports | Hero block is desktop-only per spec §8 (1280px minimum); ignore mobile | If wrapping ugly at 1440, split chain into two lines |
| HeroNumber bound to wrong delta direction | Spec §5.3 wireframe shows `↑ +3.1 (7d)` for a positive delta; verify history ordering (`history[-1]` is latest, `history[-2]` is prior week) | Delta sign comes from `latest - prior`, so positive delta = score went UP = `↑` + `var(--success)` |

---

## 9 · Master checklist links

- Implementation plan / sequencing: `docs/design/lambo-review-2026-05-17.md §7` (10 steps, this session executed steps 1-3 + step 5 partial)
- Spec authority: `docs/AI-Thesis-v2-Master-Design-Spec.md`
- Design reference hierarchy: `DESIGN_REFERENCES.md`
- Local operating posture: `CLAUDE.md`
- Web-specific build warning: `web/AGENTS.md`
- Cutover runbook: `docs/CUTOVER.md` (separate concern — not touched this session)
- Algorithm spec: `docs/AI-Thesis-v2-Algorithm-and-Deployment.md` (not consulted this session — pure design work)
- Prior session notes: `docs/SESSION_NOTES.md` (1141 lines; not read this session — design context was sufficient from the spec + references)

---

## 10 · Domain context (CRE / multifamily / AI Thesis specifics)

AI Thesis is **NOT** Basis-app multifamily underwriting. Despite Terry's `/linear` skill referencing Basis tokens, this is a different product — a multi-factor AI-investing scoring engine over a 50-name universe across 5 layers (L1 Compute / L2 Hyperscaler / L3 App / L4 Power / L5 Incumbent). Drives a $100K portfolio.

Spec calls Cypher Indigo `#4D5BFF` (NOT Basis's `#2E5BFF`). Spec calls the warmer-gray `#0B0C0F` canvas (NOT pure black). Confirmed via `--chart-1` audit in §10.1 of the review: there is NO alternate brand-indigo token in this codebase — `--accent` IS the brand-accent slot (now bound to Cypher Indigo per `6300690`).

Key scoring vocabulary (used in UI surfaces):
- **Composite** — raw 4-factor score (Q quality + G growth + V value + AIQ rubric)
- **Final** — composite × macro multiplier
- **Macro multiplier** — derates composite when sentiment gates fire (1.00 / 0.95 / 0.90 / 0.85 ladder)
- **Tier** — High / Medium / Low / Avoid → bound to accent / warning / info / danger tokens per spec §2.1
- **AIQ** — 6-dimension rubric (Disclosure 20 / Defensibility 20 / Concentration 15 / Capex 15 / Indep 15 / Acct 15 = 100)
- **Gates** — NAAIM > 90, AAII spread > +30, F&G > 80; each hit shifts multiplier one step down

Fixture mode (no Supabase env): all routes degrade to read-only with `synthetic: true` flag on each snapshot.

---

## 11 · Files-touched inventory (all 5 commits combined)

```
NEW:
  web/src/components/primitives/HeroNumber.tsx          (2044a6b)
  web/src/components/primitives/DerivationStrip.tsx     (2044a6b)
  web/src/components/shell/NoRail.tsx                   (5dcfbc9)
  docs/design/lambo-review-2026-05-17.md                (uncommitted reference doc)
  docs/handoffs/2026-05-17-S1-lambo-design-finish.md    (this file)

DELETED (all from 366ecb7 — Reticle multi-theme dead code):
  web/src/lib/theme.ts
  web/src/components/shell/ThemeSwitcher.tsx
  web/src/components/tweaks/  (entire directory, 16 files)
  web/src/hooks/useTweaks.ts

MODIFIED:
  Token authority (6300690):
    web/src/app/globals.css
    web/src/lib/theme.ts  (later deleted in 366ecb7)
  Shell + topbar simplification (366ecb7):
    web/src/components/shell/Shell.tsx
    web/src/components/shell/TopBar.tsx
  CtxRailKey + no-rail wiring (5dcfbc9):
    web/src/hooks/ctx-panel-context.tsx
    web/src/app/{aiq,aiq-drafts,backtest,decisions,memos,settings}/page.tsx
  Hardcoded-color → token migration (7f9f720): 22 files across
    web/src/app/{page,aiq*,aiq-drafts,backtest,decisions,login,memos,portfolio,regime,settings}/...
    web/src/components/{name,universe}/...
  Hero integration (2044a6b):
    web/src/components/name/NameHeader.tsx
```

Build/test verification artifacts (NOT committed — `/tmp/`):
- `/tmp/lambo-review-2026-05-16/walk.py` — all-routes Playwright walker (used for console-error sweeps)
- `/tmp/lambo-review-2026-05-16/reshot.py` — 5-key-surfaces re-screenshot script
- `/tmp/lambo-review-2026-05-16/verify_tokens.py` — runtime token verification (assert `getComputedStyle(:root)` matches spec §2.1)
- `/tmp/lambo-review-2026-05-16/interact.py` — hover/click depth probe (showed 0 tooltips → meta-P0 #3)
- `/tmp/lambo-review-2026-05-16/{after_tokens,after_norail}/*.png` — visual diff screenshots

---

## 12 · Skill stack used + recommended for next session

**Used this session:**
- `using-superpowers` (session opener)
- `honesty` (every response)
- `lambo` (design posture — Bloomberg + Linear/Vercel + Lambo)
- `linear` (design doctrine — minimalism front door, density building)
- `test-driven-development` (substituted runtime Playwright assertion since no test framework installed — RED → swap → GREEN → screenshot diff → commit)
- `webapp-testing` (Playwright walker + interaction pass)

**Recommended for next session pickup:**
- `using-superpowers` (always)
- `honesty` (always)
- `lambo` — every primitive propagation needs this posture; the 60% breathing rule and "math reconciles end-to-end" come from here
- `linear` — every visual decision uses the doctrine; especially the §3.7 selection-state-earns-its-pattern test
- Optional: `frontend-design`, `ui-ux-pro-max`, `vercel-react-best-practices`, `web-design-guidelines` (Terry stacked these earlier for the original review — pull as needed for primitive iteration / new component design)
- For any new test additions: `test-driven-development`; for any debug session: `systematic-debugging`

**Don't load** unless specifically needed: `basis`, `basis-context`, `build-basis-rra`, `build-basis-marketing`, `ferrari` — this is AI Thesis, not Basis. Different product, different spec, different palette.

---

## End of handoff

> Next-session Claude: read §1 + §7 first. Run the dev-server check from §7 step 2. If `2044a6b` is HEAD, do step 3 (visual verification of HeroNumber integration). Iterate or propagate per §7 step 4. Stay opinionated; pull review report (`docs/design/lambo-review-2026-05-17.md`) for the full /lambo + /linear context.

> Terry: 5 commits landed cleanly on `claude/lambo-design-finish`. Branding fix complete (tokens + bindings + dead-code strip + rail-empty pages). HeroNumber primitive shipped + first integration on `/universe/[ticker]` — needs visual confirmation in next session. From there: propagate, then Task #6 Dashboard IA, then Task #4 Phase 4b rail content, then primitives + per-page polish. Branch is PR-able now or after more work — your call.
