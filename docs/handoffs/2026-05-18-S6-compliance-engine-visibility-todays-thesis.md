# S6 — Compliance + Engine visibility + Today's Thesis + chrome consistency

**Session:** S6 · 2026-05-18 (afternoon, post-S5 compact)
**Project:** AI Thesis v2 · `/Users/terryturner/Projects/ai-thesis`
**Branch:** `main` @ `9543598`
**Commits this session:** 9 (all pushed)

---

## 1. TL;DR

All 3 Urgent tickets from the S5 Block B queue shipped: **THS-86 Compliance** (legal floor + footer disclosure + UI scrub), **THS-73 Engine visibility** (ScoreMath derivation popover wired into Dashboard + Universe + Name detail, Live/Stubbed mode pill propagated to 7 surfaces), and **THS-74 Today's Thesis** command-center card (Dashboard signature pattern #1). Also shipped Dashboard /lambo polish (THS-78, Page 1 of 8 done) and the Portfolio form/table overlap bug fix. Production is live at `https://ai-thesis-v2.vercel.app` returning HTTP 307. Terry deferred palette refinement (purple/yellow/green/chrome-lift) to a future session — captured verbatim in §6.

## 2. Architectural pivot or major decision

**None this session.** The Iris × Voltage v1.1 palette + Tier-A engine lock + monetization positioning lock from S5 all held. No architecture, schema, or algorithm changes shipped — purely UI / compliance / data-shape extensions on top of S5's foundation.

Palette refinement (purple too violet, yellow usage, washed-out green, chrome-lift direction) was raised by Terry mid-session and **deferred** to a future Palette v1.2 session — not acted on. See §6 decisions + §11 gotchas.

## 3. State of the world

**Local working directory:** `/Users/terryturner/Projects/ai-thesis`
**Branch:** `main`
**HEAD:** `9543598984519b7ff934e97b08251e55c055d27c25`
**Tracking:** `origin/main` — 0 commits ahead (all pushed via SSH agent)
**Working tree:** clean (3 untracked handoff docs only — S3/S4/S5)

**Web app:**
- Next.js 16 + React 19 + Tailwind v4
- TSC: clean (`exit 0` from `npx tsc --noEmit` in `web/`)
- Production: `https://ai-thesis-v2.vercel.app` → HTTP 307 (auth-gated; deploys auto-fire on `main` push)
- Vercel auto-deploy fired 9 times this session (one per commit)

**External services / secrets (names only — no values):**
- Supabase: AI Thesis project `nzcvjvuamddhjcaezvrh` (KEEP — this is the canonical app DB)
- Supabase: Reticle project `ydzvrosvkmqkdaqgsxtb` (KEEP — orthogonal, hosts Routines/Paperclip `oc_*` catalog)
- FMP API (financial data) — `FMP_API_KEY`
- Polygon (intraday) — not wired in v1
- Anthropic Routines (Claude Max account) — scheduled fire only; app never calls
- Vercel — `vercel --prod --yes` deploys via GitHub integration

**Scheduled jobs (DEFERRED — Terry has not configured yet):**
- Daily-batch routine (claude.ai/code) — NOT configured
- Weekly-rescore routine — NOT configured
- Monthly-curator routine — NOT configured
- Position-pulse routine — NOT configured

**DB state:** e80 migration NOT yet applied. Migration file at `supabase/migrations/20260518000200_e80_routines_pr1.sql` is atomic + idempotent; Terry must run it via Supabase Studio. Pre-migration: app reads existing `scores_history`, `macro_gauges`, `portfolio_positions`, etc. Post-migration: adds `user_id` scoping + 7 routine-output tables.

**Git state:**
- `HEAD = 9543598`
- `origin/main = 9543598` (synced)
- 9 commits ahead of last session's HEAD (`a4915d2` from S5)
- SSH agent loaded (push works)

## 4. Action / API reference

**None this session.** No new server actions, route handlers, or API endpoints. All work was presentation-layer (components/primitives) + lib data-shape extensions (`DashboardMover` extended with factor scores + macro state) + docs.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `docs/compliance/language-discipline.md` | created | THS-86 — legal-floor allow/ban word list, edge-case carve-outs, required-disclosures, routine prompt review, UI scrub log, self-audit grep |
| `web/src/components/shell/FooterDisclosure.tsx` | created | THS-86 — global compliance footer; mono fineprint, --text-4, LOCKED text |
| `web/src/components/shell/Shell.tsx` | modified | THS-86 — wired `<FooterDisclosure />` to render on every page below children |
| `web/src/app/portfolio/page.tsx` | modified | THS-86 scrub "Live deployment" → "Live tracking"; Portfolio bug fix responsive grid; added MonoMetaSpine |
| `web/src/app/portfolio/AggregateBar.tsx` | modified | THS-86 scrub "Deployed" → "Invested", "deployment cap" → "capital cap" |
| `web/src/app/portfolio/AddPositionForm.tsx` | modified | THS-86 scrub: dropped "Buy" mode button label, always "Add position" |
| `web/src/lib/memos-data.ts` | modified | THS-86 scrub fixture memo headline + action_rationale (no "Cut", no "redeploy") |
| `web/src/app/globals.css` | modified | Portfolio responsive grid CSS + score-math hover affordance CSS |
| `web/src/lib/scoring-weights.ts` | created | THS-73 — canonical v2 layer weights + Tier-A rescaling + macroMultiplierFor + classifyTier |
| `web/src/components/primitives/ScoreMath.tsx` | created | THS-73 — derivation ladder card (6 sections: inputs → weights → composite → multiplier → final → tier) |
| `web/src/components/primitives/ScoreMathPopover.tsx` | created | THS-73 — click-to-open float wrapper around ScoreMath; ESC + outside-click close |
| `web/src/lib/dashboard-data.ts` | modified | THS-73 — extended `DashboardMover` with q/g/v/aiq/composite/layer/macro fields |
| `web/src/app/page.tsx` | modified | THS-78 + THS-73 + THS-74 — greeting, KPI onboarding, ScoreMath wiring on MoverRow, Today's Thesis card, Live/Stubbed pill on MonoMetaSpine |
| `web/src/app/GreetingStrip.tsx` | modified | THS-78 D1 — three-line greeting with market clock subtitle |
| `web/src/app/greeting-compute.ts` | modified | THS-78 D1 — added "Up late" hours + NYSE market clock computation |
| `web/src/components/dashboard/TodayThesisCard.tsx` | created | THS-74 — 3-cell command center card (macro / high-tier / movers) |
| `web/src/components/rails/DashboardTodayRail.tsx` | modified | THS-78 D6/G6 — removed Top Movers, added Calendar v1.1 placeholder, live wall-clock, G7 footer cleanup |
| `web/src/app/universe/page.tsx` | modified | THS-73 — Live/Stubbed pill on Universe MonoMetaSpine |
| `web/src/components/universe/UniverseTable.tsx` | modified | THS-73 — Composite + Final cells wrapped in ScoreMathPopover |
| `web/src/components/name/NameHeader.tsx` | modified | THS-73 — Live/Stubbed pill on Name-detail MonoMetaSpine |
| `web/src/app/regime/page.tsx` | modified | THS-73 — Live/Stubbed pill on Regime MonoMetaSpine |
| `web/src/app/decisions/page.tsx` | modified | THS-73 — Live/Stubbed pill on Decisions MonoMetaSpine |
| `web/src/app/memos/page.tsx` | modified | Chrome consistency — added MonoMetaSpine with Live/Stubbed pill + chain cadences |

## 6. Decisions locked

### D1 — Compliance discipline is THE legal floor

**Rule:** Every routine output, UI string, fixture memo, and marketing claim must hold the line "AI Thesis is research and analysis software, not an investment advisor."
**Why:** SEC Marketing Rule 206(4)-1 + Investment Advisers Act §202(a)(11). Crossing into "personalized investment advice" triggers IAR/RIA registration, ADV filings, fiduciary duty.
**Tradeoff accepted:** Lose punchier directive language ("Buy NVDA", "Cut TSM", "Deploy capital into X"). Gain legal cover + a defensible product position. Canonical reference: `docs/compliance/language-discipline.md`.

### D2 — BUY/SELL labels for SEC Form 4 codes are KEEP

**Rule:** "BUY" / "SELL" appearing as labels for SEC Form 4 transaction codes (P = purchase, S = sale) stay — they describe filed insider behavior, not directives.
**Why:** They are factual past-tense descriptors of public-record events. Banning them would force ambiguous euphemisms for clearly-defined regulatory codes.
**Tradeoff accepted:** Some lexical overlap with the ban list — relies on context to disambiguate. Explicitly carved out in `docs/compliance/language-discipline.md` §"Edge cases — KEEP these".

### D3 — ScoreMath is signature pattern #2

**Rule:** Every composite/final-score number across the product is wrapped in `<ScoreMathPopover>` to make derivation one click away. Mono Meta Spine = signature pattern #1. Today's Thesis = signature pattern #1 (Dashboard-specific anchor). ScoreMath = signature pattern #2.
**Why:** /lambo doctrine — "math reconciles end-to-end" + "robust functionality tucked away, peel-back-the-layers." Audit-grade transparency without cluttering the at-rest read.
**Tradeoff accepted:** Adds a button-in-row pattern requiring restructure of <Link>-wrapped row components on Dashboard (MoverRow). Counterbalance: massive credibility lift for institutional users.

### D4 — Live/Stubbed mode pill on every analytical surface

**Rule:** Every page whose data has a `synthetic` flag gets a "Live" (green) or "Stubbed" (warning) pill in its MonoMetaSpine.
**Why:** Operator should never have to wonder whether they're reading engine output or fixture stubs. Quiet, honest signal.
**Tradeoff accepted:** Pages without a meaningful synthetic flag (`/aiq`, `/proposals`) don't get the pill — pattern is recognizable but not literally universal. Acceptable per /lambo "signature pattern works on ≥5 surfaces" threshold.

### D5 — Today's Thesis card replaces the AlertCallout as the Dashboard hero

**Rule:** TodayThesisCard renders above AlertCallout on Dashboard. AlertCallout still fires when `macroGatesHit > 0` but is now the secondary anchor.
**Why:** AlertCallout was conditional ("only when gates fire"). Today's Thesis is always-on engine state. The always-on card is the right top-of-page hero; the conditional callout is the right reactive surface.
**Tradeoff accepted:** Visual stack got taller on Dashboard. Two separate "what's the current macro state" reads. Mitigated by Today's Thesis being terse (3 cells, one row each).

### D6 — Palette v1.2 refinement is DEFERRED

**Rule:** Terry raised four palette concerns mid-session (purple too violet, yellow usage, washed-out green, chrome-lift direction) and explicitly deferred. Do NOT act on these without an explicit "do the palette work" directive.
**Why:** Terry verbatim: "Dont worry about that for now. I want us running pretty much autonomously right now. Just keep powering through all tickets unless there is something mission critical you need my feedback on. Lets just keep going."
**Tradeoff accepted:** Production palette stays at v1.1 (iris-300 `#5236DC`, voltage `#CCFF33`, jet `#050608`, sidebar/rail `#0B0C12`). Memory `basis_palette_shortlist` remains stale (says v1.0 still). Terry will re-raise when ready.

### D7 — Portfolio form/table layout is responsive-stack below 1280px

**Rule:** Portfolio canvas grid is `1fr` stacked below 1280px viewport (form moves under table) and `1fr / 320px` two-col with sticky form at 1280px+. Table wrapped in `overflow-x: auto` belt-and-suspenders.
**Why:** Below ~1280px the 10-column positions table can't fit alongside the form column. Original fixed `1fr / 300px` grid had the table visually bleeding into the form area — looked like a z-index bug, was actually a table-min-width overflow.
**Tradeoff accepted:** Two visual layouts. Wide-screen pattern (side-by-side) is the canonical Linear/Mercury pattern; narrow-screen stack is the fallback. Not a single fixed layout.

### D8 — THS-71 stays In Progress (Linear) until Terry's manual steps complete

**Rule:** Do not mark THS-71 (Routines plumbing) as Done until Terry has applied the e80 migration AND created the 4 routines on claude.ai/code AND verified first fires.
**Why:** Markdown sub-tasks are done in repo; the operational deliverable requires Terry's external actions.
**Tradeoff accepted:** Ticket stays In Progress for some time post-shipping. Honest state > closing prematurely.

## 7. Next-session test plan

### 7.1 Read-only verification (<60s, paste-and-run)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                              # expect 9543598984519b7ff934e97b08251e55c055d27c25
git status --short                              # expect only 3 untracked handoff docs
git rev-list --count origin/main..HEAD          # expect 0
git log --oneline -10                           # expect commits ae8b06d → 9543598
cd web && npx tsc --noEmit ; echo "tsc exit=$?" # expect 0
curl -sI https://ai-thesis-v2.vercel.app | head -1  # expect HTTP/2 307
```

### 7.2 Fresh end-to-end visual check (browser)

1. Open `https://ai-thesis-v2.vercel.app` in browser. Sign in.
2. **Dashboard /** — expect: market clock subtitle ("NYSE open · Xh Ym to close" or appropriate state), Today's Thesis card at top (3 cells: macro state · high-tier holdings · top movers), KPI tiles (Portfolio · P&L · 30D · High-tier), Score Movers table (clickable rows, Driver column populated), compact macro gate strip, right rail (Today header w/ live clock, Calendar v1.1 placeholder, Insider recent, Macro gates), footer DISCLOSURE strip bottom of page.
3. **Click any composite number** on Dashboard Score Movers → expect ScoreMath popover with derivation ladder (inputs, layer weights, weighted composite, macro multiplier, final, tier).
4. **/universe** — expect MonoMetaSpine with "mode Live/Stubbed" pill, composite + final cells in table clickable to ScoreMath popover.
5. **/portfolio** — expect MonoMetaSpine added, "Invested" label (not "Deployed"), Add position form sits beside table on wide viewports / below on narrow.
6. **/regime, /decisions, /memos** — expect Live/Stubbed pill on each MonoMetaSpine.
7. **/universe/[any ticker]** — expect Live/Stubbed pill in NameHeader's spine.
8. **Every page** — expect global FooterDisclosure strip at bottom (mono 10.5px fineprint).

### 7.3 Compliance self-audit (run before any commit that touches strings)

```bash
grep -rni --include="*.tsx" --include="*.ts" --include="*.md" \
  -E "\b(you should|recommend(s|ed|ation)?|outperform|model portfolio|guaranteed?|risk[- ]free|advisor|advisory|deploy(ment|ed|s)?\b)" \
  web/src docs/routines docs/compliance
```

Any hit must be either (a) on the allow list in `docs/compliance/language-discipline.md`, (b) inside a code comment, or (c) inside that discipline document itself.

## 8. Budget / quota tracking

**None this session.** No API calls against capped services (Anthropic Routines = scheduled fire only, Terry hasn't configured yet so 0/15 daily). No Vercel build-minute concerns. No Supabase usage spike (writes were code-only, not DB).

## 9. Known issues / backlog

### 9.1 Blockers on Terry's side (operational, not code)
1. **e80 migration** — `supabase/migrations/20260518000200_e80_routines_pr1.sql` needs to apply via Supabase Studio. Blocks finishing THS-71 + enables routine output tables.
2. **4 Anthropic Routines** — Terry must create on claude.ai/code per `docs/routines/setup-guide.md`. Blocks finishing THS-71.
3. **Linear cleanup** — duplicate THS-87 backtest ticket from S5's Linear 502 retry. Cosmetic delete.

### 9.2 Pending Linear queue (post-S6 ordering)
1. **THS-84 Marketing landing** — High, NOW UNBLOCKED by THS-86 compliance lock. Recommended next ticket. Will need positioning copy + pricing tier choices in-stream.
2. **THS-75 AIQ Editor cockpit** — High, no spec, scope ambiguous. Defer until Terry drops a one-liner.
3. **THS-76 Portfolio Guardrails** — High, no spec, scope ambiguous. Defer.
4. **THS-77 Decisions inbox** — High, no spec, scope ambiguous. Defer.
5. **THS-78-82 page polish** — Medium, THS-78 Dashboard shipped this session. Other pages still want /lambo review from Terry.
6. **THS-85 Auth + Stripe** — High, billing risk, gated by THS-86 done.
7. **THS-87 Backtest** — Medium (and there's a duplicate to delete).

### 9.3 Deferred enhancements within shipped tickets
1. **ScoreMath popover on Name-detail Final HeroNumber** — NameHeader already shows one-line derivation; full popover would duplicate. Deferred to a future "deeper derivation drawer" ticket.
2. **MonoMetaSpine on /aiq + /proposals** — those are operator-content surfaces; Live/Stubbed doesn't map cleanly. Acceptable as-is per D4 above.
3. **Today's Thesis avg-composite** — currently sampled from top movers, not the full 50-name set. Honest as directional read; could be exact if we thread full snap.rows.
4. **Portfolio compliance language extras** — `lib/memos-data.ts` fixture has `action: "trim"` action labels which are operational, not directives. Kept. Could revisit if legal review wants stricter.

### 9.4 Palette v1.2 (Terry-deferred — DO NOT ACT WITHOUT DIRECTIVE)
1. Purple (`#5236DC`) — "too violet" per Terry; needs adjustment.
2. Voltage yellow (`#CCFF33`) — "yellow usage" concern; usage pattern wrong.
3. Success green (`#34D399`) — "washed out"; needs more saturation/forest.
4. Chrome lift — sidebar + right rail both `#0B0C12` (lighter than canvas `#050608`); Terry wants them equal or darker than canvas (recede).

## 10. Quick-reference IDs

| Item | Value |
|---|---|
| Working directory | `/Users/terryturner/Projects/ai-thesis` |
| Web subdir | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch | `main` |
| HEAD SHA | `9543598984519b7ff934e97b08251e55c055d27c25` |
| Tracking | `origin/main` (synced) |
| GitHub repo | `git@github.com:terry-zero-in/ai-thesis.git` |
| Production URL | `https://ai-thesis-v2.vercel.app` |
| Supabase (AI Thesis) project ref | `nzcvjvuamddhjcaezvrh` |
| Supabase (Reticle, KEEP) project ref | `ydzvrosvkmqkdaqgsxtb` |
| Iris-300 (signal) | `#5236DC` |
| Iris-500 (base) | `#4D3FB8` |
| Voltage | `#CCFF33` |
| Jet (canvas) | `#050608` |
| Sidebar/Rail | `#0B0C12` |
| Algorithm spec | `docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Master design spec | `docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Compliance discipline | `docs/compliance/language-discipline.md` |
| Routines spec | `docs/routines/` (4 prompts + setup-guide.md) |
| S5 handoff | `docs/handoffs/2026-05-18-S5-monetization-epic-palette-routines-data-trust.md` |
| S6 handoff (this file) | `docs/handoffs/2026-05-18-S6-compliance-engine-visibility-todays-thesis.md` |
| e80 migration | `supabase/migrations/20260518000200_e80_routines_pr1.sql` |
| Linear team | THS (project: AI Thesis v2, id `79a38aec-...`) |
| ScoreMath popover anchor width | 360px |
| Portfolio responsive breakpoint | 1280px |

**Commits this session (oldest → newest):**

| SHA | Title |
|---|---|
| `ae8b06d` | THS-78 Dashboard polish — greeting market clock, KPI onboarding, rail differentiation |
| `66733b9` | Portfolio — responsive two-col layout to prevent form/table overlap |
| `c44c86c` | THS-86 Compliance language audit + global footer disclosure |
| `a972d24` | THS-73 Score Math derivation popover + Live/Stubbed engine-mode pill |
| `a8923bd` | THS-73 wave 2 — Score Math popover on Universe + Live/Stubbed pill |
| `6fba774` | THS-73 wave 3 — Live/Stubbed mode pill on name detail header |
| `e378e1d` | THS-74 Today's Thesis command-center card (signature pattern #1) |
| `e00a5ba` | THS-73 wave 4 — Live/Stubbed mode pill on Regime + Decisions |
| `9543598` | Chrome consistency — MonoMetaSpine on Portfolio + Memos |

## 11. Pitfalls / gotchas

1. **Memory `basis_palette_shortlist` is STALE.** It still says v1.0 (`#A87DFE`). Live palette is v1.1 (`#5236DC`). Per D6, Terry wants v1.2 work deferred — next-Claude should NOT touch palette until Terry explicitly raises it.
2. **THS-71 stays In Progress in Linear.** Don't mark Done. Migration + routines + first-fire verification are Terry's manual steps.
3. **DashboardMover shape grew this session.** Now carries q/g/v/aiq/composite/layer/macroGatesHit/macroMultiplier. If you destructure DashboardMover elsewhere, expect new fields. Type checker enforces this.
4. **ScoreMathPopover is a `<button>` inside what was previously a `<Link>`.** Browsers handle nested-interactive-element HTML but React strict-mode hydration may warn. MoverRow on Dashboard was restructured to `<div>` with explicit ticker `<Link>` + popover-button on composite cell to avoid the nesting entirely. If you wire ScoreMathPopover into a new row component, restructure similarly — do NOT nest button inside Link.
5. **Universe table cells DID nest button-in-`<a>`?** No — checked, the UniverseTable rows use `<tr>` not `<Link>` wrapper. The row's ticker is wrapped in `<Link>` separately; composite/final are wrapped in ScoreMathPopover separately. No nesting violation.
6. **"BUY" / "SELL" labels stay.** Don't scrub them — they're factual SEC Form 4 transaction-code labels. Carved out in compliance discipline doc.
7. **Portfolio MonoMetaSpine displaces "Prices as of"** — the old header right-edge "Prices as of {asOf}" was removed; that data now lives in the spine's `as_of` segment. If you re-add the old line, it duplicates.
8. **TodayThesisCard `computeAvgHighComposite()` samples movers, not full universe.** Honest as directional read; document this if anyone questions the exact number.
9. **FooterDisclosure text is LOCKED.** Any edit requires Terry approval per `docs/compliance/language-discipline.md`. Do not "improve" the copy.
10. **`/lambo` Page 1 of 8 is done; Pages 2-8 want Terry's per-page review.** Don't apply /lambo lens autonomously to Universe/Portfolio/Regime/AIQ/Memos/Decisions/Backtest pages — you'll burn cycles guessing what Terry would flag. Wait for him to drop the spec.
11. **3 handoff docs are untracked.** S3, S4, S5 markdown handoff files in `docs/handoffs/` are untracked. Commit them with S7's first commit (or roll into a docs-housekeeping commit).
12. **Greeting computes against `America/Chicago` for wall clock + `America/New_York` for market clock.** Don't change to UTC — the user-facing TZ is intentional.

## 12. Next-session pickup point

**First action:** Run §7.1 verification block. Confirm HEAD `9543598`, 0 ahead, TSC clean, prod HTTP/2 307. Then ask Terry: **"Want me to start THS-84 marketing landing autonomously, or do you have direction first?"** Default if no answer: start THS-84 — single-page landing using the position lock from THS-70 + the compliance language discipline from THS-86. Surface specific copy/pricing choices in-stream.

If Terry instead drops a /lambo Page 2 (Universe) spec or a THS-75/76/77 one-liner, that takes priority over THS-84.
