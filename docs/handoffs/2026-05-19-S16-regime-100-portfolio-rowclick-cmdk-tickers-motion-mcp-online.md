# S16 — Regime closed at 100% · Portfolio row-click + hover · ⌘K tickers · Motion MCP reinstalled

Session date: 2026-05-19 (afternoon CDT, S16)
Prior: S15 (fde7cbb) — Regime fetcher fix + KPI desparkle + 5/5 priority pages signed off
HEAD this handoff: `49a3775`

---

## 1. TL;DR

- 7 commits shipped, all deployed (parity ✓ +2s on last deploy).
- Regime page closed at 100% via 6 commits: trend chart fills full width with fixed 200px height (responsive via ResizeObserver), widened viewBox so strokes/text stay native pixel scale, /lambo /linear pass on MultiplierBanner balance + Ladder active-state lift + GateHistory breathing room, chart wrapped in surface card matching gauges above, right-edge value labels anchored to line endpoints via series-colored connectors.
- Multi-path Name Detail access shipped: CmdPalette now includes all 50 universe seed tickers as jump targets ("TICKER · Company · Layer" format), Portfolio rows are now full-row clickable with hover state, NameHeader carries a quiet "⌘K to switch" affordance.
- Dashboard polish: Score Movers row full-row click. Sample-data language sweep across 14 surfaces — every "Stubbed"/"fixture mode"/"synthesized fixture data" devspeak replaced with paid-product copy ("Sample"/"sample workspace"/"sample data").
- Motion MCP reinstalled: existing memory said installed, live `claude mcp list` showed missing — reinstalled via stored token. Premium 370+ examples now reachable for next-session motion-audit work.
- Two new memories: motion_audit_workflow.md (S–F tier rules + verification + install command) + feedback_motion_audit_in_page_reviews.md (motion-audit now part of every page polish pass).

## 2. Architectural pivot or major decision

**None this session as a true pivot.** Two minor framework decisions worth noting:

1. **Chart chrome consistency on Regime.** Previously the RegimeTrendChart sat on raw canvas while the gauge cards above it had `var(--surface)` chrome. That mixed-mode read inconsistent. Wrapped the chart in matching card chrome. Coherent rhythm: 3 gauge cards + 1 wide chart card. (Path A in the canvas-vs-card tradeoff per /lambo §earn-its-place. Path B — drop all card chrome and go full Mercury format-on-canvas — remains an option for a future deeper refactor.)

2. **In-page ticker switcher → defer to ⌘K instead.** Terry asked for "drop down/search to change the stock being displayed once you're on that page." Decided against building a NameHeader-local dropdown — the canonical pattern is the global ⌘K palette which Shell already mounts. Wired all 50 universe seed tickers into the palette + added a discoverable "⌘K to switch" affordance to NameHeader. Three paths now: ⌘K palette · existing NamePager prev/next · back-to-Universe + click row.

## 3. State of the world

### Git state
- Branch: `main`
- HEAD: `49a3775dd8c1a3a2e160d29d784d0a44cfa13cb7`
- Commits this session (since S15 baseline `fde7cbb`): **7**
- Commits ahead of `origin/main`: **0** (all pushed)
- Working tree: 13 untracked S3-S16 handoffs (12 carried from S15 + this S16 file = 13)

### Production deploy
- Prod alias: `https://ai-thesis-v2.vercel.app`
- Pointing to: `dpl_BQbaRva6WQkfHaqXMhAzNtbZDPKQ`
- Deploy created: 2026-05-19 15:21:06 CDT
- HEAD authored: 2026-05-19 15:21:04 CDT
- Δ deploy − HEAD: **+2 seconds** (deploy-parity gate ✓)
- TSC: `exit 0`

### Endpoints (production)
- `/` 200 · `/universe` 307 · `/portfolio` 307 · `/regime` 307 · `/memos` 307 · `/decisions` 307 (307 = auth-gate redirect to sign-in, expected for unauthed curl)

### Database state (Supabase project `mvxgnliwvoauwwarrlrr`)
- Unchanged from S15: `macro_gauges` 366 rows, latest 2026-05-18; cron `ingest-macro-daily` 21:45 UTC running.

### Claude Code MCPs (verified `claude mcp list`)
- **motion**: ✓ Connected (reinstalled this session via `claude mcp add-json motion ...` with stored Motion+ TOKEN — see [[motion-mcp-setup]] memory).
- n8n: ✓ Connected
- claude.ai-hosted: Supabase ✓ · Linear ✓ · Invideo ✓ · others need auth or failed (Vercel/Netlify/Notion/Apollo/Gamma/GCal/GDrive/Gmail need auth · Figma + github plugin failed to connect)

### Scheduled jobs / external integrations
- Unchanged from S15. FMP /stable/ for ingest paths. Polygon for prices_raw. Vercel manual `cd web && vercel deploy --prod --yes` per commit (webhook still broken per S15 backlog).

## 4. Action / API reference

No new endpoints this session. None touched.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/app/page.tsx` | M | Score Movers row full-row click via outer `<Link>`; ticker inner Link dropped; ScoreMathPopover preventDefault+stopPropagation preserves math popover. |
| `web/src/app/universe/page.tsx` | M | Sample/Live chip + tooltip language sweep ("Stubbed" → "Sample"). |
| `web/src/app/regime/page.tsx` | M | Sample/Live chip + tooltip language sweep. |
| `web/src/app/memos/page.tsx` | M | Sample/Live chip + tooltip language sweep. |
| `web/src/app/decisions/page.tsx` | M | Sample/Live chip + tooltip language sweep. |
| `web/src/app/portfolio/page.tsx` | M | "Demo · fixture book" → "Sample book"; tooltip language sweep. |
| `web/src/app/settings/page.tsx` | M | "Not signed in (fixture mode)..." → "Sample workspace — sign in to use real data and enable writes." |
| `web/src/app/login/LoginForm.tsx` | M | "renders against fixtures" → "renders against sample data". |
| `web/src/components/name/NameHeader.tsx` | M | Sample/Live chip + tooltip language sweep · added "⌘K to switch" affordance beside ticker. |
| `web/src/components/dashboard/TodayThesisCard.tsx` | M | Sample/Live chip + tooltip language sweep. |
| `web/src/components/dashboard/EngineStateStrip.tsx` | M | SAMPLE/LIVE chip + tooltip language sweep. |
| `web/src/components/universe/UniverseTable.tsx` | M | "(fixture)" → "· sample data" suffix on footer. |
| `web/src/components/rails/RegimeLegendRail.tsx` | M | Same as above. |
| `web/src/components/rails/NameActivityRail.tsx` | M | Same as above. |
| `web/src/app/regime/RegimeTrendChart.tsx` | M | Six commits worth of evolution: remove 960px cap → widen viewBox 720→1200 to keep height short at full width → convert to client component with ResizeObserver for true fixed-pixel rendering (W=container, H=200) → wrap in surface card chrome matching gauges → tighten PAD_R 96→78 + add series-colored connectors from line-endpoint dots to right-edge value labels (L-bend when avoid-overlap shifted). |
| `web/src/app/regime/MultiplierBanner.tsx` | M | Cell flex 1.4:1 → 1:1. Hero cell stops floating in empty space. |
| `web/src/components/primitives/MultiplierLadder.tsx` | M | Active value fontSize 14→18, weight 600→700, 2px --accent rail under active cell. Inactive cells get matching transparent rail so baselines align. |
| `web/src/app/regime/GateHistory.tsx` | M | Arrow row gap 8→14, prior-multiplier text-3→text-2, arrow fontSize bump. Reads "0.95× → 1.00×" with room. |
| `web/src/app/portfolio/PositionsTable.tsx` | M | Full-row click via useRouter() + className="row-hov"; .closest() guard so Edit Link/Close button don't trigger navigation. |
| `web/src/components/shell/CmdPalette.tsx` | M | Wire 50 universe seed tickers as palette jump targets ("TICKER · Company · Layer" format). Closes the TODO at top of file. Placeholder bumped to "Jump to a screen or name…". |
| `~/.claude/projects/-Users-terryturner/memory/motion_audit_workflow.md` | C | Reference memory: S–F tier rules, /motion-audit + score.motion.dev pairing, MCP install command, verification steps. |
| `~/.claude/projects/-Users-terryturner/memory/feedback_motion_audit_in_page_reviews.md` | C | Feedback memory: motion-audit + add-purposeful-motion is part of every page polish pass. |
| `~/.claude/projects/-Users-terryturner/memory/MEMORY.md` | M | Added two new entries under Tools & Integrations. |
| `~/.claude.json` mcpServers | M (via CLI) | `claude mcp add-json motion ...` reinstalled the Motion MCP with stored TOKEN. |

## 6. Decisions locked

1. **Regime chart is fixed-height responsive client component.** Rule: width = container_width (via ResizeObserver), height = 200px. **Why:** earlier viewBox-scaling approach made height a function of width, so narrow viewports compressed the chart to ~110px and wide stretched it to ~347px — neither matched the gauge-card row above. **Tradeoff accepted:** chart can no longer be rendered as a pure server component; loses one-frame SSR fidelity (initial paint at W_FALLBACK=1136 before ResizeObserver fires).

2. **Regime trend chart gets surface card chrome.** Rule: chart wrapper matches gauge cards above (`--surface` bg + 1px `--border` + 6px radius + 14×16 padding). **Why:** mixed-mode chrome (cards + raw-canvas chart) read inconsistent. Match wins. **Tradeoff accepted:** less Mercury / format-on-canvas posture for the regime page; bias is toward institutional-card aesthetic.

3. **MultiplierBanner cells balance 1:1.** Rule: hero cell and curve cell get equal flex. **Why:** previous 1.4:1 left the hero floating in empty space while the curve felt cramped. Equal weight is honest — both halves carry information at the same density. **Tradeoff accepted:** the hero value (1.00×) is the protagonist; could argue it deserves more space. Counter: the curve cell shows the full state-space (4 cells), which is at least as much information.

4. **MultiplierLadder active state earns its lift.** Rule: active value renders at fontSize 18 / weight 700 + 2px --accent rail under the cell. Inactive cells get 2px transparent rail to keep baselines aligned. **Why:** previous "subtle border only" treatment was flagged in Perplexity review (S15) — active state didn't read at a glance. Per [[feedback_active_state_indicator_2px_floor]]. **Tradeoff accepted:** active cell visually weighs more than inactive — that's the point.

5. **Chart right-edge value labels are anchored, not floating.** Rule: 1px series-colored connector from line-endpoint dot to label leading edge. Straight tick when label y matches data y; L-bend callout when avoid-overlap shifted it. PAD_R tightened 96→78 to bring labels closer. **Why:** labels were "stranded in the right pad" with no visual tie to their lines. **Tradeoff accepted:** slight increase in SVG complexity; minor.

6. **In-page ticker switcher → use ⌘K palette instead.** Rule: don't build a NameHeader-local dropdown; route through the global ⌘K palette + add discoverable affordance. **Why:** ⌘K is the canonical pattern; a local dropdown would compete + duplicate. Terry's ask satisfied via three paths: ⌘K (now covers 50 tickers) · NamePager prev/next · Universe row click. **Tradeoff accepted:** ⌘K requires keyboard knowledge or click-on-affordance; arguably less discoverable than an inline button. Hint copy ("⌘K to switch") next to ticker mitigates.

7. **Score Movers + Portfolio rows = full-row click via `<Link>` / useRouter.** Rule: row is the navigation surface. ScoreMathPopover button stops propagation; Portfolio Edit + Close buttons stop via .closest() guard in the row-onClick handler. **Why:** Linear discipline — any row whose content is a record's detail page IS the navigation. **Tradeoff accepted:** button-inside-anchor on Score Movers (technically HTML-invalid but works in every browser; pragmatic).

8. **Developer jargon banned from user-visible copy.** Rule: "Stubbed" → "Sample"; "fixture mode" → "sample mode"; "fixture book" → "sample book"; "synthesized fixture data" → "pre-generated sample data for product preview". **Why:** paid-subscription launch this week — every visible string is first impression to a paying user. **Tradeoff accepted:** server-action error messages (only fire on misconfigured Supabase env) left in dev language because they never reach paid users in prod.

## 7. Next-session test plan

### 7.1 Read-only verification (run first, <60s)

```bash
# Live state
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                              # expect 49a3775dd8c1a3a2e160d29d784d0a44cfa13cb7
git log --oneline origin/main..HEAD | wc -l     # expect 0
git status --short | grep -v "docs/handoffs"    # expect empty

# tsc clean
cd /Users/terryturner/Projects/ai-thesis/web && npx tsc --noEmit; echo "exit=$?"
# expect exit=0

# Deploy parity gate (MANDATORY)
vercel inspect ai-thesis-v2.vercel.app 2>&1 | grep -E "^\s+(id|created)" | head -3
git log -1 --format="HEAD authored: %ad" --date=iso HEAD
# Expect deploy created AFTER HEAD authored. S16: dpl_BQbaRva6WQkfHaqXMhAzNtbZDPKQ created 15:21:06 CDT vs HEAD 15:21:04 = Δ+2s ✓

# Endpoint smoke
for p in / /universe /portfolio /regime /memos /decisions; do printf "%-12s " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "https://ai-thesis-v2.vercel.app$p"; done
# Expect / 200; /universe /portfolio /regime /memos /decisions all 307 (auth-gated)

# Motion MCP precondition
claude mcp list 2>&1 | grep -i motion
# Expect: motion: npx -y https://api.motion.dev/registry.tgz?package=motion-studio-mcp&version=latest - ✓ Connected
```

### 7.2 Fresh end-to-end

None this session — no new endpoints, no infrastructure changes.

### 7.3 Visual/UI verification

Open each page and confirm:

1. `/` — Dashboard renders w/ greeting + 5 KPI tiles + portfolio chart + Score Movers (rows clickable, hover background appears). All "Stubbed" / "fixture" strings replaced with "Sample".
2. `/regime` — MultiplierBanner balanced 50/50 left/right. MultiplierLadder active cell (0 GATES = 1.00) shows enlarged 18px value + 2px accent rail under. Trend chart fills full canvas width × 200px tall, sits in surface card matching gauge cards above. Right-edge value labels connected to line-endpoints via subtle colored connectors. GateHistory rows show "0.95× → 1.00×" with breathing room around arrow.
3. `/portfolio` — Position rows hover background visible on hover; clicking anywhere on a row (except edit/close buttons) navigates to `/universe/{ticker}`.
4. `/universe/NVDA` (or any seed) — NameHeader shows "⌘K to switch" quiet hint beside ticker.
5. Hit ⌘K — palette opens. Type "AAPL" → row "AAPL · Apple · Incumbent" appears. Type "compute" → all L1 Compute names appear (NVDA / AVGO / AMD / TSM / ASML / AMAT / LRCX / KLAC / MRVL / ARM / SNPS / CDNS / MU / ANET). Enter → navigates.
6. Smoke-test Motion MCP: in Claude Code chat, ask *"List the Motion+ premium examples available via the motion MCP."* Expect real example names returned (App Store, Carousel, AnimateNumber, Ticker, Typewriter, Cursor, etc.). If you get generic suggestions instead, MCP isn't actually serving the premium catalog — reinstall per [[motion-mcp-setup]].

## 8. Budget / quota tracking

Not burning against cap this session. No Vercel ops cost concern; no Supabase row/storage near limits.

## 9. Known issues / backlog

By area, numbered for cross-session reference:

### Regime
1. **None — closed at 100% S16.** Future "even more polish" candidates: drop gauge card chrome and go full format-on-canvas (Path B from §2 decision tradeoff); revisit the "snapshot ... macro engine" attribution position under hero (requires HeroNumber primitive edit).

### Page-by-page pixel review (Terry's S16 ask — primary work for next session)
2. **Portfolio pixel audit** (task #108 pending) — spacing/margins/padding consistency · tooltips · anything-else. Single commit after the audit.
3. **Universe pixel audit** — same dimensions as #2.
4. **Name Detail pixel audit** — same dimensions as #2.
5. **Dashboard pixel audit** — same dimensions as #2.

### Motion-audit arc
6. **Pre-flight every session**: `claude mcp list | grep motion` must show ✓ Connected. Smoke test by asking Claude to list Motion+ premium examples — should return real names, not generic. If it fails, reinstall via the command in `~/.claude/projects/-Users-terryturner/memory/motion-mcp-setup.md`.
7. **Motion-audit + add-motion pass on each of the 5 priority pages** (task #110 pending). Run `/motion-audit @<path>`. Fix C/D/F findings. Identify under-motioned surfaces. Add purposeful motion via Motion+ premium examples (AnimateNumber, Carousel, Ticker, Typewriter, magnetic Cursor, scroll-linked entrances). Re-audit, confirm A/S tier. Deploy → `npx motionscore https://ai-thesis-v2.vercel.app`.

### Name Detail (carries from S15)
8. **FactorPanels severity-color question** — Q/G/V/AIQ currently use `var(--accent)`/`--success`/`--warning` which misuses severity semantics. Awaits Terry's color direction.
9. **Bottom-grid placeholder consolidation** — 2/3 placeholders today. Awaits Terry direction.

### Second-half page reviews (after the 5 priority pages are pixel-perfect + motion-audited)
10. **AIQ Editor page review**
11. **Memos page review**
12. **Decisions page review**
13. **Proposals page review**

### Docs + infrastructure backlog
14. **Master Design Spec §2.1/§4.1/§4.6 tier-color update** — still says "High = indigo," superseded by traffic-light. Docs-only commit.
15. **DRY-extract `web/src/lib/tier-colors.ts`** — cosmetic refactor; 5 separate copies exist today.
16. **Operational cleanup commit for 13 untracked S3-S16 handoffs** — single-purpose commit.
17. **THS-87 Sidebar Backtest dim** — cross-page.
18. **TSM Q=4 engine investigation** — multi-session.
19. **THS-85 Auth + Stripe** — high-priority, multi-session.
20. **GitHub→Vercel webhook fix** — manual deploy still required per commit.

## 10. Quick-reference IDs

| Key | Value |
|---|---|
| Repo root | `/Users/terryturner/Projects/ai-thesis` |
| Web app root | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch | `main` |
| HEAD SHA (S16) | `49a3775dd8c1a3a2e160d29d784d0a44cfa13cb7` |
| HEAD (S15) | `fde7cbb5bc8fe4bd751744a8723c95094a822b97` |
| HEAD (S14) | `282d690` |
| Prod alias | `https://ai-thesis-v2.vercel.app` |
| Prod deploy (S16) | `dpl_BQbaRva6WQkfHaqXMhAzNtbZDPKQ` |
| Vercel project name | `ai-thesis-v2` (NOT `ai-thesis` — repo root .vercel/project.json is wrong, never touch) |
| Supabase project | `mvxgnliwvoauwwarrlrr` |
| Motion+ TOKEN | stored in `~/.claude/projects/-Users-terryturner/memory/motion-mcp-setup.md` (DO NOT paste in chat) |
| Deploy command | `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes` (MUST be ONE chained command — repo root .vercel points to wrong project) |
| MCP install (Motion) | `claude mcp add-json motion '{"command":"npx","args":["-y","https://api.motion.dev/registry.tgz?package=motion-studio-mcp&version=latest"],"env":{"TOKEN":"<TOKEN_FROM_MEMORY>"}}'` |
| MCP list check | `claude mcp list \| grep -i motion` |
| Macro chain | Tue 22:00 UTC weekly composite · macro ingest 21:45 UTC daily |
| Sidebar | 220px width · 280px right rail when open |
| Canvas maxWidth | 1200 on most pages (regime, dashboard) |
| Trend chart dims | `H = 200px` fixed pixel · `W = container_width` via ResizeObserver · `PAD_R = 78` |

## 11. Pitfalls / gotchas

1. **Motion MCP must be reinstalled if `claude mcp list` shows it missing.** Existing memory at `~/.claude/projects/-Users-terryturner/memory/motion-mcp-setup.md` says "already installed" but the live `~/.claude.json` mcpServers can lose it (Claude Code reinstall, config rebuild). At session open run `claude mcp list | grep motion` — if not Connected, run the `claude mcp add-json motion ...` command stored in that memory. Token is inside the memory.

2. **Smoke-test MCP after install.** Connected in `claude mcp list` is necessary but not sufficient. Real test: ask Claude *"List the Motion+ premium examples available via the motion MCP."* If it returns generic suggestions instead of real example names (App Store / Carousel / AnimateNumber / Ticker / Typewriter / Cursor), the MCP isn't actually serving the premium catalog and motion-audit work is degraded.

3. **`/motion-audit` skill ≠ Motion MCP.** Two separate pieces. Skill at `~/.claude/skills/motion-audit/` does static code grading. MCP at `~/.claude.json` mcpServers serves the 370+ premium component source. You can have one without the other. For the page-by-page motion-audit arc you need BOTH.

4. **Deploy parity gate is mandatory.** Don't write "deployed" in any handoff or status without `vercel inspect ai-thesis-v2.vercel.app` confirming the prod alias deploy `created` timestamp is AFTER HEAD's authored timestamp. S14 phantom-deploy incident is the canonical failure this prevents.

5. **`cd web && vercel deploy` MUST be ONE chained bash command.** Repo root `.vercel/project.json` points to wrong project (`ai-thesis`). Splitting `cd` from `vercel deploy` loses cwd → deploys to wrong project → prod alias doesn't move. Caught twice in S15.

6. **Regime trend chart is now a client component.** It uses ResizeObserver + `useState` + `useEffect`. Anything that imports it from a server component context still works (Next.js handles the boundary). But editing the chart no longer means "edit a pure server SVG render" — be mindful of the client/server boundary.

7. **Score Movers `<button>` inside `<Link>` is HTML-invalid but works.** ScoreMathPopover trigger is a `<button>` inside a Next `<Link>` (which renders as `<a>`). Anchor children cannot contain interactive descendants per HTML spec. Works in every browser; React 19 doesn't complain. If a lint rule starts flagging this, the fix is to convert the button to `<span role="button">` with onClick — affects ScoreMathPopover API. Don't refactor on a whim.

8. **Portfolio row click skips on `a, button, input, label, form` via `.closest()`.** Adding new interactive elements inside a position row that should NOT navigate (e.g. a future inline edit toggle, a checkbox, a popover trigger) — make sure they fall within those tag names OR add their tag to the guard.

9. **CmdPalette uses `FIXTURE_UNIVERSE` static seed.** 50 hand-curated names. When the universe grows beyond seed (real users with custom universes), the palette will undercover. Punt to a future ticket — for v1 launch the 50 seed names cover everything.

10. **Sample/Live chip lives per-page.** DemoBadge in TopBar is the global truth-marker for unauthenticated visitors (fires on `!userEmail`). Per-page Sample/Live chips fire on `snap.synthetic` and stay visible for authed users on synthetic data. Both serve different roles; don't merge.

11. **Server-action error messages still say "fixture mode."** `decisions/actions.ts`, `portfolio/actions.ts`, `aiq-drafts/actions.ts`, `aiq/[ticker]/actions.ts`, `login/actions.ts` — error returns reference "dev fixture mode" in copy. These only fire on misconfigured Supabase env (never in prod). Left as-is; if any paying user reports seeing this string, it indicates an env misconfig.

12. **MultiplierLadder active rail bumps fontSize 14→18.** Cell height grows by ~6px. If a future caller embeds MultiplierLadder in a tight vertical slot (sidebar rail, drawer), it may overflow. Today's only consumer is /regime MultiplierBanner — plenty of room.

13. **Regime trend chart's W_FALLBACK = 1136.** SSR / pre-measure render uses this. If a future viewport renders much wider OR narrower before the ResizeObserver fires, there's a one-frame visual flash. Acceptable for v1; if it becomes visible jitter, switch to a layout-effect read + initial sync setW.

14. **GateHistory arrow row gap bumped to 14.** If a future content variant adds an "arrow" element with `gap: 8` styling elsewhere on Regime, the visual rhythm will mismatch. No other consumers today.

15. **Memo / Decisions language sweep still uses "Sample data" tooltip on chip.** If you decide the Tooltip copy should distinguish "this page renders from sample because the daily-batch routine hasn't written yet" vs "this page renders sample globally", you'll want per-page tooltips. Today everything reads as one consistent message.

## 12. Next-session pickup point

Literal first action (do this before any new work):

```bash
# 1. State + parity verification (60s)
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD   # must equal 49a3775
vercel inspect ai-thesis-v2.vercel.app 2>&1 | grep -E "^\s+(id|created)" | head -3

# 2. Motion MCP precondition
claude mcp list | grep -i motion   # must show ✓ Connected

# 3. Smoke-test Motion MCP serves premium catalog
#    Ask Claude in chat: "List the Motion+ premium examples available via the motion MCP."
#    Expect real example names. If generic, reinstall via stored token.
```

If all three pass, the next move is **Portfolio pixel audit** (task #108). Open `/Users/terryturner/Projects/ai-thesis/web/src/app/portfolio/` and walk every visible row / chip / label / hover state with /lambo + /linear lenses. Single commit covers the audit fixes. Pair this with **`/motion-audit @web/src/app/portfolio`** to catch animation tier issues. Add purposeful motion via Motion+ premium examples where the page is under-utilized. Confirm A/S tier. Then move on to Universe / Name Detail / Dashboard with the same pattern.

Open Terry questions to surface before exhaustive page audits:
- Name Detail FactorPanels severity-color call (backlog #8) — Q/G/V/AIQ severity-color semantics.
- Name Detail bottom-grid 2/3-placeholder consolidation (backlog #9).
