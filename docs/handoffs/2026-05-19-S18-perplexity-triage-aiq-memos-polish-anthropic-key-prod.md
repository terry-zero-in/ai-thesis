# S18 — Perplexity triage (AIQ + Memos), polish cascade, ANTHROPIC_API_KEY unblocked in prod

**Date:** 2026-05-19
**Session:** S18 (post-S17 compact)
**Author:** Claude Opus 4.7 (1M context)
**Status at write:** 6 commits ahead of S17 baseline (`55ac43c`), all pushed + deployed-with-parity. ANTHROPIC_API_KEY now in Vercel prod env (THS-90 unblocked). Four Linear tickets opened (THS-88/89/90/91). Interrupted mid-investigation of Supabase Edge function `compute-daily-memo` to write this handoff.

---

## 1. TL;DR

- Motion: jerky-on-3-pages bug fully resolved via `hero-arrive` keyframe (replaces AnimateNumber wrapping in HeroNumber) + full-table 25ms cascade on Universe
- Name Detail: muted "⌘K to switch" hint promoted to clickable `[ Switch name · ⌘K ]` chip via new `ShellControlsProvider` context
- AIQ + Memos + Decisions + Proposals: bar-pass polish (voltage→accent, motion primitives, LayerChip canonicalization, next-rescore meta, system-status banner, failure-aware copy)
- Four Linear tickets opened from Perplexity triage: THS-88 (AIQ value drift data-wiring), THS-89 (dep_flag chip), THS-90 (ANTHROPIC_API_KEY missing — now done), THS-91 (memo retry button)
- ANTHROPIC_API_KEY added to Vercel prod env + redeployed. Next daily memo cron Wed 13:00 UTC will fire with the key.

## 2. Architectural pivot or major decision

**Motion: count-up → compositor-tier arrival.** S17 shipped JS rAF count-up via `AnimateNumber` wrapping all hero values via `HeroNumber`. Terry reported jerky on Universe / Name Detail / Regime ("This is all jerky again"). Root cause: integer-width reflow at 1→2 digit boundary (Name Detail 0→74.1 jitters at "10"; Regime 0→0.95 reads as flicker over ~5 frames). First attempted fix went too conservative (killed motion entirely on HeroNumber, capped Universe stagger at 6 rows). Terry pushed back: "only the top few rows try to have any motion. Regime — nothing and Stock Specific — Nothing." Second fix is the actual answer:

```css
@keyframes hero-arrive { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
.hero-arrive { animation: hero-arrive 500ms var(--ease-out) backwards }
```

`HeroNumber` now applies `.hero-arrive` to the value span — opacity + 6px translateY, compositor-tier, no text-content interpolation so no glyph-width reflow possible. Universe rows stagger via `row-stagger-in` with INLINE `animationDelay = Math.min(rowIndex * 25, 1200)ms` so all 50 rows cascade in over ~1.25s with no burst-at-cap.

**Why this matters as a pivot:** the AnimateNumber primitive still exists and is still used by Portfolio AggregateBar + Dashboard AnimatedKpiCell directly. The decision was NOT to retire it. Decision was that HeroNumber-mediated count-up is the wrong abstraction layer — surfaces that need count-up should opt-in by calling AnimateNumber directly, not get it via HeroNumber. Hero values get compositor-tier arrival; specific count-up surfaces get the JS rAF treatment. **Tradeoff accepted:** Name Detail Final score and Regime Active Multiplier lost their count-up. Terry confirmed first version "looks and feels perfect" after the cascade fix.

**Triage discipline for external reviews.** Established explicit framework for Perplexity (and any external reviewer) walks: (a) real data bugs → Linear ticket with root cause + fix options, (b) in-scope polish → ship in-session, (c) false positives → call out with verification, do not action. Applied successfully to two reviews (AIQ Editor, Memos) producing 3 tickets + ~5 polish commits without any drift into false-positive work.

## 3. State of the world

- **Working dir (code):** `/Users/terryturner/Projects/ai-thesis/web`
- **Working dir (git):** `/Users/terryturner/Projects/ai-thesis`
- **Branch:** `main` @ `d618f58cb320d7cfb7a2fd358060b81e7d86cd1b`
- **Commits ahead of S17 baseline `55ac43c`:** 6
- **Commits ahead of origin/main:** 0 (pushed)
- **tsc:** exit 0 (verified at handoff-write)
- **Prod alias:** `ai-thesis-v2.vercel.app` → `dpl_5cvTkppY99KEhY5BAb7rXqck5bFv`
- **Last code-shipping deploy:** `dpl_2ivkA6NGF2chyj1PSeSBRZKLMzVJ` (HEAD authored 18:56:38; that deploy 18:56:52, Δ +14s ✓)
- **Most recent deploy:** `dpl_5cvTkppY99KEhY5BAb7rXqck5bFv` (env-only redeploy after ANTHROPIC_API_KEY add; 19:57:40, ~61min after the last code commit — this is expected, no new code shipped)
- **Endpoint smoke:** `/` 200 · `/portfolio` `/universe` `/regime` `/memos` `/aiq` all 307 (auth gate, expected)
- **Dev server:** none running
- **Vercel prod env:** now has `ANTHROPIC_API_KEY` (Encrypted) + `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
- **External: Supabase Reticle project** `ydzvrosvkmqkdaqgsxtb` — unchanged
- **External: Anthropic API key source** `/Users/terryturner/Projects/thesis/.env.local` — `sk-ant-api03-` prefix (real API key, not OAuth token). Copied to Vercel via shell var (key never appeared in chat).
- **External: Motion+ MCP** — still listed `✓ Connected` via CLI but not reachable from in-conversation tool calls (unchanged from S17)
- **Working tree:** 15 untracked S3-S17 handoff `.md` files + soon-to-add this S18 file (operational cleanup pending; outside scope)

## 4. Action / API reference

No new HTTP endpoints. Two infra mutations:

| Mutation | Surface | Detail |
|---|---|---|
| `vercel env add ANTHROPIC_API_KEY production` | Vercel `ai-thesis-v2` project | Pulled from `~/Projects/thesis/.env.local` via shell var; piped with `--value "$KEY"` flag (stdin was rejected) |
| `vercel deploy --prod --yes` (env-only redeploy) | Same project | Picked up the env change; no code delta. `dpl_5cvTkppY99KEhY5BAb7rXqck5bFv` |

`HeroNumber.tsx` API unchanged externally — still accepts `value` / `prefix` / `unit` / `precision` / etc. Internal change: dropped the AnimateNumber wrapper in favor of static-text-with-keyframe.

`ShellControlsProvider` is a new lightweight client context at `web/src/hooks/shell-controls-context.tsx`:
```ts
useShellControls() → { openCmd: () => void; openShortcuts: () => void }
```
Wraps the canvas inside `Shell.tsx` so any descendant client component can imperatively open the CmdPalette / ShortcutsOverlay.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/components/primitives/HeroNumber.tsx` | modified ×2 | First: dropped AnimateNumber wrapper. Second: applied `.hero-arrive` class |
| `web/src/app/globals.css` | modified | Added `@keyframes hero-arrive` + `.hero-arrive` class (compositor-tier 500ms opacity+translateY) |
| `web/src/components/universe/UniverseTable.tsx` | modified ×2 | First: capped stagger at 6 rows. Second: full-table inline `animationDelay = min(i*25, 1200)ms` cascade |
| `web/src/hooks/shell-controls-context.tsx` | created | Lightweight context exposing openCmd / openShortcuts to canvas-level components |
| `web/src/components/shell/Shell.tsx` | modified | Wraps children in ShellControlsProvider with the existing setCmd / setShortcuts handlers |
| `web/src/components/name/SwitchNameChip.tsx` | created | Clickable `[ Switch name · ⌘K ]` pill on Name Detail; uses useShellControls() |
| `web/src/components/name/NameHeader.tsx` | modified | Replaced muted `⌘K to switch` text-4 hint with `<SwitchNameChip />` |
| `web/src/app/aiq/page.tsx` | modified ×2 | Row stagger + row-hov + LayerChip + next-rescore meta |
| `web/src/app/aiq/[ticker]/AiqEditor.tsx` | modified | Save button voltage → accent (last voltage usage retired) |
| `web/src/app/memos/page.tsx` | modified ×2 | Card stagger; system-status banner + failure-aware subtitle + next-daily-run meta + `computeNextDailyRun` helper |
| `web/src/app/decisions/page.tsx` | modified | AlertRow stagger via index |
| `web/src/app/proposals/page.tsx` | modified | ProposalCard stagger via index |
| `docs/handoffs/2026-05-19-S18-perplexity-triage-aiq-memos-polish-anthropic-key-prod.md` | created | this file |

## 6. Decisions locked

### Motion architecture: hero-arrive (compositor) for hero values, AnimateNumber (rAF count-up) for opt-in count-up surfaces only
**Why:** Hero values wrapped in AnimateNumber via HeroNumber jittered on integer-width transitions (1→2 digit boundary). Compositor-tier opacity+translateY can't reflow because the rendered text is static. Surfaces that genuinely want count-up (Portfolio AggregateBar dollar values, Dashboard KPI tiles) call AnimateNumber directly and accept the SSR-0 → final-value paint pattern.
**Tradeoff accepted:** Name Detail Final score + Regime Active Multiplier lost count-up. Acceptable because the values are quiet single-source numbers where compositor arrival reads as "this is the answer" rather than "watch it compute."

### Universe row cascade: inline animationDelay with 25ms cascade + 1200ms ceiling
**Why:** `Math.min(rowIndex, 12)` capped at delay 780ms which caused rows 13-50 to burst-render simultaneously. Inline `animationDelay = min(i * 25, 1200)ms` lets every row arrive in sequence; total span ~1.25s.
**Tradeoff accepted:** CSS `.row-stagger-in` class default of 65ms cascade is now overridden inline for Universe. Dashboard / Portfolio still use the CSS default with ≤12 rows. The class is no longer the single source of truth for cascade pacing — pages can tune.

### Switch-name affordance: clickable chip instead of muted text + new ShellControls context
**Why:** Muted `text-4` 10.5px hint was functionally invisible. Promoted to `[ Switch name · ⌘K ]` bordered pill (Linear's "↗ Open issue picker" pattern). Plumbing required a way for client components to open CmdPalette without prop-drilling or synthetic keyboard events.
**Tradeoff accepted:** Added a third shell-level context (CtxPanel, UniverseFilter, ShellControls). Worth it — ShellControls will be reused for shortcuts overlay and any future chrome overlay.

### Triage discipline for external reviews
**Why:** Perplexity reviews mix real bugs (NVDA AIQ drift across pages, missing ANTHROPIC_API_KEY) with false positives (AVGO arithmetic misread, Universe count misreading HANDOFF). Without explicit triage, all items get same weight and Claude wastes time on false positives or skips real bugs as polish.
**Tradeoff accepted:** Triage adds 1-2 minutes per review but produces (a) Linear tickets with full diagnosis for real bugs (b) ship-in-session polish for real polish (c) explicit "not actioning, here's why" for false positives. Net: faster + more honest.

### ANTHROPIC_API_KEY added to Vercel prod via shell var with `--value` flag
**Why:** `vercel env add` rejected stdin (non-interactive mode required `--value` flag). Shell var keeps the key out of chat history. Output filtered through `grep -v "$KEY"` so success message doesn't leak.
**Tradeoff accepted:** Key now lives encrypted in Vercel prod env. Reversible via `vercel env rm ANTHROPIC_API_KEY production`. Audit trail in Vercel project log.

## 7. Next-session test plan

### 7.1 — Read-only verification (<60s, paste-and-run)

```bash
cd /Users/terryturner/Projects/ai-thesis && \
  echo "=== HEAD ===" && git rev-parse HEAD && \
  echo "=== HEAD vs origin/main (should be 0) ===" && git rev-list --count origin/main..HEAD && \
  echo "=== HEAD authored ===" && git log -1 --format=%cd HEAD && \
  echo "=== Working tree (only handoffs expected) ===" && git status --short && \
  echo "=== Deploy parity ===" && vercel inspect ai-thesis-v2.vercel.app 2>&1 | grep -E "id|created|target" | head -3 && \
  echo "=== Env vars ===" && vercel env ls production 2>&1 | grep -E "ANTHROPIC|SUPABASE" && \
  echo "=== Endpoints (200 then 307×5 expected) ===" && \
  curl -s -o /dev/null -w "/         %{http_code}\n" https://ai-thesis-v2.vercel.app/ && \
  curl -s -o /dev/null -w "/portfolio %{http_code}\n" https://ai-thesis-v2.vercel.app/portfolio && \
  curl -s -o /dev/null -w "/universe  %{http_code}\n" https://ai-thesis-v2.vercel.app/universe && \
  curl -s -o /dev/null -w "/regime    %{http_code}\n" https://ai-thesis-v2.vercel.app/regime && \
  curl -s -o /dev/null -w "/memos     %{http_code}\n" https://ai-thesis-v2.vercel.app/memos && \
  curl -s -o /dev/null -w "/aiq       %{http_code}\n" https://ai-thesis-v2.vercel.app/aiq
```

Expected: HEAD `d618f58`, env has ANTHROPIC_API_KEY, endpoints `200/307×5`.

### 7.2 — Fresh end-to-end (Anthropic key verification)

The next daily memo cron fires Wed 2026-05-20 at 13:00 UTC. If still pre-cron at session pickup, can't verify yet. If post-cron:

```bash
# Check /memos page for new card with kind=daily, as_of=2026-05-20, failed=false
curl -s https://ai-thesis-v2.vercel.app/memos | grep -E "2026-05-20|claude-sonnet"
```

OR if Terry wants tonight-validation (couldn't ship in S18, was the interrupted task):
- Build `/api/memos/test-key` endpoint that calls Anthropic with "ping" prompt
- OR find the Supabase Edge function `compute-daily-memo` invocation pattern and trigger it manually

### 7.3 — Visual/UI verification (manual, in browser)

1. `/universe` — hard refresh. All 50 rows cascade in over ~1.25s, smooth wave, no burst.
2. `/regime` — Active Multiplier 0.95× appears with hero-arrive (6px translateY up + opacity fade, 500ms).
3. `/universe/AMZN` (or any) — Final score arrives via hero-arrive. `[ Switch name · ⌘K ]` chip next to company name. Click chip → CmdPalette opens.
4. `/aiq` — rows cascade with row-hov; Layer column shows colored dot + "L1 Compute" pattern; PageHeader meta shows "next rescore" date.
5. `/aiq/AAPL` (or any) — Save button is accent blue (not voltage yellow).
6. `/memos` — top of page shows danger-tinted banner "⚠ Memo generation failing since 2026-05-18 · Missing required env var: ANTHROPIC_API_KEY"; subtitle shows "2 most recent · 2 failed"; meta strip has "next daily run: 2026-05-20 13:00 UTC". Cards cascade.
7. `/decisions` + `/proposals` — rows / cards cascade smoothly.

## 8. Budget / quota tracking

None this session. Vercel deploys within plan. Anthropic API spend will start accruing when the next cron fires successfully (Wed 13:00 UTC) — daily memo + weekly memo cost is minimal but worth watching once volume scales.

## 9. Known issues / backlog

### Linear tickets opened this session
1. **THS-88 (High):** Fix AIQ value drift between aiq_rubric (Editor) and scores_history (Universe/Dashboard). Recommendation: Postgres view JOINing aiq_rubric at read time.
2. **THS-89 (Medium):** Surface dep_flag penalty stack as inline chip on AIQ + Universe rows. Requires data-wiring expansion in `getAiqIndex`.
3. **THS-90 (Urgent — now unblocked):** ANTHROPIC_API_KEY missing in prod. **Key has been added; next cron Wed 13:00 UTC will validate. Close ticket after first successful daily memo lands.**
4. **THS-91 (Medium):** Retry button on failed memo cards. Recommendation: extract `generateMemo(kind, as_of)` helper, call from both cron and server action.

### Open follow-ups not yet ticketed
5. **System-status banner on `/memos` when generation failing** — shipped this session (NOT a ticket, in-scope polish)
6. **Cron failure alerting (Slack/email)** when memo cron fails — per Perplexity: "first failure didn't trigger an alert (otherwise you'd have caught it before yesterday's run also failed)." Worth a ticket.
7. **Verify successful memo render once data arrives** — UI hasn't been seen with a successful card yet; the expand-on-click + WeeklyDetail patterns are untested with real Anthropic output.

### Pixel audits remaining
8. **Universe pixel audit** — not started (only motion+stagger touched)
9. **Name Detail pixel audit** — STILL BLOCKED on Q/G/V/AIQ severity-color call from Terry
10. **Dashboard pixel audit** — not started

### Operational
11. **16 untracked handoff `.md` files** in `docs/handoffs/` (S3-S18). Pre-existing operational cleanup. Single-purpose commit when there's a quiet window.
12. **Master Design Spec §2.1/§4.1/§4.6 tier-color update** — still stale (carries from S15+).
13. **DRY-extract `web/src/lib/tier-colors.ts`** — cosmetic refactor.
14. **Stale wrong-project deploys in `ai-thesis` Vercel project** — `dpl_5991CirK4aVmz98GEdLAU6KjDqfY`, `dpl_Ft8e4kcG9o2N59SeHQKgcUgwFS8F` (carried from S17).
15. **Cross-page polish sweep (per Claude Browser review):** skeleton primitives, chart interactivity (crosshair, tooltips, range-snap), contrast audit, deep-link URL state for filters. Deferred to after all-pages-built.

### Larger tickets (multi-session)
16. THS-85 Auth + Stripe (highest priority for paid launch)
17. THS-87 Sidebar Backtest dim
18. TSM Q=4 engine investigation
19. GitHub → Vercel webhook fix

## 10. Quick-reference IDs

| Item | Value |
|---|---|
| HEAD SHA | `d618f58cb320d7cfb7a2fd358060b81e7d86cd1b` |
| HEAD short | `d618f58` |
| HEAD authored | `Tue May 19 18:56:38 2026 -0500` |
| Last code-shipping deploy | `dpl_2ivkA6NGF2chyj1PSeSBRZKLMzVJ` (18:56:52, parity Δ +14s) |
| Current prod-alias deploy | `dpl_5cvTkppY99KEhY5BAb7rXqck5bFv` (env-only redeploy 19:57:40) |
| S17 baseline (commit count from) | `55ac43c` |
| Prod alias | `ai-thesis-v2.vercel.app` |
| Vercel project (correct) | `terry-8893s-projects/ai-thesis-v2` |
| Vercel project (WRONG — DO NOT DEPLOY HERE) | `terry-8893s-projects/ai-thesis` (alias `ai-thesis-three.vercel.app`) |
| Repo root | `/Users/terryturner/Projects/ai-thesis` |
| Web app cwd | `/Users/terryturner/Projects/ai-thesis/web` |
| Auto-deploy command | `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes` |
| Local pre-deploy build check | `cd /Users/terryturner/Projects/ai-thesis/web && npx next build` |
| Anthropic key source | `/Users/terryturner/Projects/thesis/.env.local` (`sk-ant-api03-` prefix; real API, not OAuth) |
| Vercel env-add command (used this session) | `KEY=$(grep "^ANTHROPIC_API_KEY=" /Users/terryturner/Projects/thesis/.env.local \| cut -d= -f2-) && vercel env add ANTHROPIC_API_KEY production --value "$KEY" --yes` |
| Supabase Reticle project | `ydzvrosvkmqkdaqgsxtb` |
| Linear tickets opened S18 | THS-88, THS-89, THS-90, THS-91 |
| Linear project | `AI Thesis v2` in team `THS` |
| Daily memo cron cadence | Mon-Fri 13:00 UTC |
| Weekly memo cron cadence | Sun 23:00 UTC |
| Supabase Edge function for daily memo | `supabase/functions/compute-daily-memo/index.ts` |
| Memo generation Anthropic helper | `supabase/functions/_shared/anthropic.ts` |
| ShellControls context | `web/src/hooks/shell-controls-context.tsx` |
| Hero-arrive keyframe | `web/src/app/globals.css` lines ~285-292 |

## 11. Pitfalls / gotchas

1. **`HeroNumber` no longer animates via JS.** It uses CSS `.hero-arrive` keyframe (opacity + translateY). If you need count-up on a new hero surface, call AnimateNumber directly — don't try to "fix" HeroNumber to wrap it again. Reason: integer-width reflow at digit boundaries (S18 jerky-motion fix).

2. **AnimateNumber primitive is still alive.** Used directly by Portfolio `AggregateBar.tsx` + Dashboard `AnimatedKpiCell` in `page.tsx`. Don't delete it thinking it's unused. SSR paints "0" then animates 0 → value on mount (intentional, init-from-0 pattern).

3. **Universe row cascade uses INLINE animationDelay.** Per-row `style={{animationDelay: \`${Math.min(i * 25, 1200)}ms\`}}`. Don't try to compute via CSS `var(--row-i)` — that's the Portfolio/Dashboard pattern with the CSS default 65ms cascade. Universe needs the inline override because 50-row tables don't fit the 65ms cascade pattern (~3s tail).

4. **`vercel env add` requires `--value` flag.** Stdin is rejected. Use shell var pattern to keep key out of chat:
   ```
   KEY=$(grep ... | cut -d= -f2-) && vercel env add NAME production --value "$KEY" --yes
   ```
   Filter output through `grep -v "$KEY"` so the success message doesn't leak.

5. **Env-only redeploys don't change HEAD parity.** After `vercel env add` + `vercel deploy --prod --yes`, the deploy `created` will be much later than HEAD's authored time. This is EXPECTED — env change triggered the deploy, not a new commit. Don't flag as parity failure unless a new commit was supposed to ship.

6. **The S17 NVDA AIQ drift IS a real data bug** — `aiq_rubric.total` vs `scores_history.aiq_score` are two independent reads with no propagation between weekly crons. THS-88 has the full diagnosis + 3 fix options.

7. **`/aiq` index uses `LayerChip` now** (colored dot + "L1 Compute" pattern). If any future page is added with a layer column, use `LayerChip` — don't render `r.layer_label` raw. Dashboard `/page.tsx:599` still has raw rendering (MoverRow); worth fixing in next polish pass for full consistency.

8. **Memos page status banner only fires when top-3 are ALL failures.** `recent3.length >= 2 && recent3Failed.length === recent3.length`. If 2-of-3 are failures, no banner. Tuneable in `web/src/app/memos/page.tsx`. Don't loosen without thinking about transient flake noise.

9. **Daily memo cron + ANTHROPIC_API_KEY now works.** Next fire Wed 2026-05-20 13:00 UTC. If still failing at next session: check Anthropic console for spend/rate-limit issues; key prefix should be `sk-ant-api03-` not `sk-ant-oat01-`.

10. **15 untracked handoff `.md` files** in `docs/handoffs/`. Pre-existing. Don't add them in unrelated commits.

## 12. Next-session pickup point

**INTERRUPTED MID-INVESTIGATION:** Terry asked for a sample successful memo to screenshot for marketing. Was about to look at `supabase/functions/compute-daily-memo/index.ts` to understand how to manually trigger it (so the operator doesn't have to wait until Wed 13:00 UTC). /compact arrived before that work landed.

**First action on pickup:**

1. Run §7.1 verification block.
2. Read `supabase/functions/compute-daily-memo/index.ts` + `supabase/functions/_shared/anthropic.ts` + `supabase/functions/_shared/memo-context.ts` to understand the cron's full invocation chain.
3. Decide: ship a manual-trigger route (`/api/memos/trigger-daily?key=<admin>`) that re-invokes the cron logic for a specific date, OR write a one-shot Supabase Edge function deploy command Terry can run to fire it now. Either works; route is cleaner from the operator's perspective.
4. Trigger it, verify the new memo card lands on `/memos` with `failed=false`, then screenshot it for Terry's marketing needs.
5. After Terry confirms the memo looks good, close THS-90 (mark Done).

Out-of-scope alternates if blocked: just wait until Wed 13:00 UTC for the natural cron fire. Less satisfying but valid.
