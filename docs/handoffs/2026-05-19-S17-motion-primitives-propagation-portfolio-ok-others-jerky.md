# S17 — Motion primitives propagation across Dashboard / Universe / Name Detail / Regime

**Date:** 2026-05-19
**Session:** S17 (mid-conversation continuation of S16)
**Author:** Claude Opus 4.7 (1M context)
**Status at write:** 5 commits ahead of S16 baseline (`49a3775`), all pushed + deployed-with-parity. Motion working on Portfolio + Dashboard. Other 3 pages jerky per Terry — handoff to fresh session for the same surgical fix that worked for Portfolio.

---

## 1. TL;DR

- 5 commits this session: Portfolio pixel audit · Portfolio motion-add · 2 regression fixes · 4-page motion propagation
- Portfolio (signed off) + Dashboard (Terry: "looks good") — count-up + row stagger working
- Universe / Name Detail / Regime — same primitives ship, but Terry: "This is all jerky again"
- AnimateNumber API refactored from function-prop to serializable kind-string (RSC-safe)
- HEAD `55ac43c` live in prod (`ai-thesis-v2.vercel.app`), parity Δ +10s

## 2. Architectural pivot or major decision

**AnimateNumber API: function-prop → kind-string.** First motion-add (`9909f9c`) passed `format: (n) => string` callback prop. AggregateBar consumed it as a Server Component → Next.js threw at runtime (functions don't serialize across the RSC boundary). Patched with `"use client"` on AggregateBar (`543fdf7`), but the underlying API was the problem — it would have blocked propagation to Dashboard (server) and HeroNumber (server). This session (`55ac43c`) refactored to:

```ts
type AnimateNumberKind = "usd" | "usd-signed" | "pct-signed" | "multiplier" | "int" | "decimal";
<AnimateNumber value={n} kind="usd" decimals={2} />
```

All props serializable. Server pages render the primitive directly. **Why:** the function-prop API forced every consuming surface to be marked client, which would have cascaded `"use client"` across Dashboard, Regime, and every page that uses HeroNumber. The kind-enum keeps the RSC boundary clean and propagation cheap. **Tradeoff accepted:** lost format-callback flexibility (caller can't pass an arbitrary formatter); all current call-sites fit one of the six kinds, so no concrete loss.

## 3. State of the world

- **Working dir (code):** `/Users/terryturner/Projects/ai-thesis/web`
- **Working dir (git):** `/Users/terryturner/Projects/ai-thesis`
- **Branch:** `main` @ `55ac43c663a91d11ead8cc925038be2e0df83655`
- **Commits ahead of S16 baseline `49a3775`:** 5
- **Commits ahead of origin/main:** 0 (pushed)
- **tsc:** exit 0 (verified at handoff-write time)
- **Prod alias:** `ai-thesis-v2.vercel.app` → `dpl_CJAXQfhAYEf2KPgBJRy4cpAuFaB1`
- **Deploy parity:** deploy created Tue May 19 16:32:52 CDT; HEAD authored Tue May 19 16:32:42 CDT; Δ +10s ✓
- **Endpoint smoke (handoff-write time):** `/` 200 · `/portfolio` 307 · `/universe` 307 · `/regime` 307 (307 = auth gate, expected)
- **Dev server:** none running
- **External: Supabase Reticle project** `ydzvrosvkmqkdaqgsxtb` — unchanged
- **External: Motion MCP** — listed `✓ Connected` via `claude mcp list` BUT not actually loaded in this conversation's MCP runtime (only n8n / claude.ai Supabase / Vercel / Linear / Netlify / Notion / Apollo / Gamma / Figma / Calendar / Drive / Gmail / Invideo). Hand-rolled implementation used.
- **Working tree:** 14 untracked S3-S16 handoff `.md` files (operational cleanup pending; outside scope)

## 4. Action / API reference

No server endpoints touched. AnimateNumber's component API changed:

| Before | After |
|---|---|
| `format: (n: number) => string` | `kind: AnimateNumberKind` + `decimals?: number` |
| Function not serializable across RSC | All props serializable |
| Forced `"use client"` on consumers | Server components consume directly |

`AnimateNumberKind` values: `"usd"` · `"usd-signed"` · `"pct-signed"` · `"multiplier"` · `"int"` · `"decimal"`.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/components/primitives/AnimateNumber.tsx` | created → modified ×3 | rAF count-up primitive; init-to-0 fix; API refactor to kind-enum |
| `web/src/components/primitives/HeroNumber.tsx` | modified | wrap value-rendering with AnimateNumber; cascades to NameHeader + MultiplierBanner automatically |
| `web/src/app/globals.css` | modified | added `.row-stagger-in` keyframe + `.chip-fade-in` keyframe; fresh session re-tuned durations (480ms / 65ms cascade / 380ms chip) |
| `web/src/app/portfolio/AggregateBar.tsx` | modified ×3 | `"use client"`; swap to AnimateNumber; new kind-enum API |
| `web/src/app/portfolio/PositionsTable.tsx` | modified | tooltips on Th; tabIndex+onKeyDown row-nav; `.lin-hov` on Edit/Close; row-stagger-in; chip-fade-in on drawdown trigger |
| `web/src/app/portfolio/AddPositionForm.tsx` | modified | notes placeholder copy refresh |
| `web/src/app/page.tsx` | modified | KpiCell → AnimatedKpiCell sibling for 4 of 5 tiles; MoverRow tagged row-stagger-in with `--row-i` |
| `web/src/components/dashboard/TopPositionsList.tsx` | modified | PositionRowRender tagged row-stagger-in with `--row-i` |
| `web/src/components/universe/UniverseTable.tsx` | modified | `<tr>` row-stagger-in with `--row-i` cap at 12; queued Q pill chip-fade-in |
| `docs/handoffs/2026-05-19-S17-motion-primitives-propagation-portfolio-ok-others-jerky.md` | created | this file |

## 6. Decisions locked

### AnimateNumber API is kind-enum, NOT function-prop
**Why:** function props don't serialize across the RSC boundary. Forces every consumer into client mode; cascades unwanted `"use client"` across the tree.
**Tradeoff accepted:** caller cannot pass arbitrary formatters. All six kinds (`usd`, `usd-signed`, `pct-signed`, `multiplier`, `int`, `decimal`) cover every existing call-site. Add a new kind to the enum when a seventh formatter is needed.

### AnimateNumber initializes from 0, not from `value`
**Why:** prior init pattern (`useState(value)` + `useRef(value)`) caused first-mount `from === to` short-circuit — animation never fired. Inert in production until the user said "didn't do anything."
**Tradeoff accepted:** brief SSR paint of formatted "0" before hydration takes over. Reads as deliberate count-up arrival, not as broken data.

### Row stagger duration: 480ms / 65ms cascade
**Why:** first-pass values (320ms / 30ms) finished so fast Terry described it as "if you blinked you missed it." Front-loaded ease-out cubic compresses perceived motion; bumping duration + cascade lets the wave register.
**Tradeoff accepted:** last row arrives ~780ms in (12 × 65 + 480 = 1260ms total span, but eased so most rows arrive earlier). Acceptable per user feedback after the bump.

### Local `next build` mandatory before any deploy with motion changes
**Why:** `tsc --noEmit` does NOT validate RSC serialization boundaries. The function-prop bug compiled clean and only failed at runtime. `next build` runs the full pipeline including the server/client boundary checks.
**Tradeoff accepted:** ~30s pre-deploy build cost. Cheap vs. the cost of a broken prod deploy + diagnosis + rollback.

### Deploy from `web/`, never from repo root
**Why:** repo root `.vercel/project.json` points to the wrong project (`ai-thesis`, aliased `ai-thesis-three.vercel.app`). Two wrong-project deploys happened this session before the rule was followed strictly. The correct cwd is `/Users/terryturner/Projects/ai-thesis/web` which is linked to `ai-thesis-v2` (aliased `ai-thesis-v2.vercel.app`).
**Tradeoff accepted:** can't chain `git commit && git push && vercel deploy` from repo root. Must split: chain commit+push from root, then separate bash invocation `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`.

## 7. Next-session test plan

### 7.1 — Read-only verification (<60s, paste-and-run)

```bash
cd /Users/terryturner/Projects/ai-thesis && \
  echo "=== HEAD ===" && git rev-parse HEAD && \
  echo "=== HEAD vs origin/main (should be 0) ===" && git rev-list --count origin/main..HEAD && \
  echo "=== Working tree (only handoffs expected) ===" && git status --short && \
  echo "=== Deploy parity ===" && vercel inspect ai-thesis-v2.vercel.app 2>&1 | grep -E "id|created|target" | head -3 && \
  echo "=== HEAD authored ===" && git log -1 --format=%cd HEAD && \
  echo "=== Endpoints (200 then 307×3 expected) ===" && \
  curl -s -o /dev/null -w "/         %{http_code}\n" https://ai-thesis-v2.vercel.app/ && \
  curl -s -o /dev/null -w "/portfolio %{http_code}\n" https://ai-thesis-v2.vercel.app/portfolio && \
  curl -s -o /dev/null -w "/universe  %{http_code}\n" https://ai-thesis-v2.vercel.app/universe && \
  curl -s -o /dev/null -w "/regime    %{http_code}\n" https://ai-thesis-v2.vercel.app/regime
```

Expected HEAD = `55ac43c`. Expected deploy id = `dpl_CJAXQfhAYEf2KPgBJRy4cpAuFaB1` unless a fresh deploy has gone out. If parity Δ is NEGATIVE (HEAD newer than deploy), redeploy before any other work: `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`.

### 7.2 — Fresh end-to-end

None applicable — no schema changes, no new external integrations this session.

### 7.3 — Visual/UI verification (manual, in browser)

1. Open private window, sign in.
2. Hard-refresh `/` (Dashboard). Expected: 4 KPI tile values count up over ~800ms; Score Movers rows and Top Positions rows cascade in over ~780ms.
3. Hard-refresh `/portfolio`. Expected: 4 hero numbers count up; 12 rows cascade.
4. Hard-refresh `/universe`. Expected: all visible rows cascade (capped at 12 for stagger length); queued Q pills fade in.
5. Hard-refresh `/regime`. Expected: Active Multiplier hero counts up; MultiplierBanner ladder NOT animated (intentionally static — instrument cell).
6. Click any ticker → `/universe/{ticker}`. Expected: Final score hero counts up via NameHeader.

**If motion is jerky on any of Universe / Name Detail / Regime (Terry feedback this session), see §11 gotcha #6.**

## 8. Budget / quota tracking

None this session. Vercel deploys are within the included plan; no API spend accrued; Motion+ MCP not consumed (not loaded in runtime).

## 9. Known issues / backlog

### Motion
1. **Universe / Name Detail / Regime motion reads jerky to Terry.** Same primitives shipped as Portfolio + Dashboard (which look good). Root cause hypotheses: row count too high on Universe (50 rows × 65ms cascade caps at 12 but visible jitter possible during the staggered window); HeroNumber's animated value sits inside an existing flex baseline that's also adjusting → flicker; tabular-nums width on NameHeader hero glyphs may be jittering during the count-up if the SSR paint width differs from the post-hydration width.
2. **Motion+ MCP not actually reachable in this Claude Code runtime.** `claude mcp list` shows `motion ✓ Connected` at CLI but `ListMcpResourcesTool server=motion` returns "Server not found." Premium examples never queried. Hand-rolled count-up is paint-tier (bounded) instead of Motion+'s S-tier per-digit transform-tape.
3. **motionscore false S-tier from earlier.** Pre-fix run (when AggregateBar was throwing at runtime) returned 98/100 because it crawled the error fallback, not Portfolio. Not re-run since the fix landed. Re-run: `cd /Users/terryturner/Projects/ai-thesis/web && npx motionscore@latest https://ai-thesis-v2.vercel.app/portfolio`.

### Pixel audits remaining
4. **Universe pixel audit** — not started. Same dimensions as Portfolio pass: spacing/padding/hover/tooltip/keyboard nav. Sortable header click affordance + queued pill placement.
5. **Name Detail pixel audit** — STILL BLOCKED on Q/G/V/AIQ severity-color call. Awaits Terry's direction.
6. **Dashboard pixel audit** — not started.

### Operational
7. **14 untracked handoff `.md` files** in `docs/handoffs/` — pre-existing operational cleanup. Single-purpose commit when there's a quiet window.
8. **Master Design Spec §2.1/§4.1/§4.6 tier-color update** — still stale (carries from S15+). Says "High = indigo"; superseded by traffic-light mapping.
9. **DRY-extract `web/src/lib/tier-colors.ts`** — cosmetic refactor; the mapping lives in 4 places (Portfolio PositionsTable, Universe TierBadge, Dashboard TopPositionsList, Dashboard `/` page).
10. **Stale wrong-project deploys in the `ai-thesis` Vercel project** — `dpl_5991CirK4aVmz98GEdLAU6KjDqfY`, `dpl_Ft8e4kcG9o2N59SeHQKgcUgwFS8F`. Don't affect prod (different alias). Cleanup later.

### Larger tickets (multi-session)
11. THS-87 Sidebar Backtest dim
12. TSM Q=4 engine investigation
13. THS-85 Auth + Stripe (highest priority for paid launch)
14. GitHub → Vercel webhook fix

## 10. Quick-reference IDs

| Item | Value |
|---|---|
| HEAD SHA | `55ac43c663a91d11ead8cc925038be2e0df83655` |
| HEAD short | `55ac43c` |
| HEAD authored | `Tue May 19 16:32:42 2026 -0500` |
| Last deploy id | `dpl_CJAXQfhAYEf2KPgBJRy4cpAuFaB1` |
| Last deploy created | `Tue May 19 16:32:52 2026 -0500` |
| Prod alias | `ai-thesis-v2.vercel.app` |
| Vercel project (correct) | `terry-8893s-projects/ai-thesis-v2` |
| Vercel project (WRONG — DO NOT DEPLOY HERE) | `terry-8893s-projects/ai-thesis` (alias `ai-thesis-three.vercel.app`) |
| Repo root | `/Users/terryturner/Projects/ai-thesis` |
| Web app cwd | `/Users/terryturner/Projects/ai-thesis/web` |
| Auto-deploy command | `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes` |
| Local pre-deploy build check | `cd /Users/terryturner/Projects/ai-thesis/web && npx next build` |
| Motion primitive | `web/src/components/primitives/AnimateNumber.tsx` |
| Motion CSS keyframes | `web/src/app/globals.css` lines ~275-282 |
| Supabase Reticle project | `ydzvrosvkmqkdaqgsxtb` |
| Motion+ TOKEN reference | `~/.claude/projects/-Users-terryturner/memory/motion-mcp-setup.md` |

## 11. Pitfalls / gotchas

1. **AnimateNumber's API changed mid-session.** If you see legacy `format={(n) => ...}` usage anywhere, that's pre-`55ac43c` code that needs updating to `kind="..."`. Current source has no legacy call-sites — `grep -rn "format={.*=>" web/src/` should return zero.
2. **AggregateBar must stay `"use client"`.** It's downstream of an unfixable historical RSC-boundary need. Even though AnimateNumber's API is now serializable, the file still has `"use client"` at line 1. Leave it.
3. **Deploy from `web/` only.** Repo root `.vercel/project.json` deploys to the WRONG project. Two regressions this session. Never deploy as part of a `cd /Users/terryturner/Projects/ai-thesis && ... && vercel deploy` chain — always separate `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`.
4. **`tsc` does not validate RSC boundary.** Function-prop bug compiled green and broke at runtime. **Always** run `npx next build` locally before deploying any motion / Server-Component changes.
5. **Motion MCP runtime ≠ CLI runtime.** Listed `✓ Connected` via `claude mcp list` but not available to in-conversation tool calls. Premium examples not reachable. Don't claim "Motion+ examples used" — they weren't.
6. **The "jerky on 3 pages" issue is unresolved at handoff time.** Same primitives shipped as Portfolio+Dashboard which look smooth. Terry's spotting motion-tier flicker on Universe / Name Detail / Regime. Hypotheses to test:
   - **Universe:** 50 rows × `--row-i: Math.min(rowIndex, 12)` means rows 13-50 all share the same delay. They burst-render together at the cap; could read as a hitch. Try uncapped cascade or two-stage (first 12 staggered, remaining fade together).
   - **Name Detail:** NameHeader hero swap-in via HeroNumber's animated value may be reflowing the baseline if tabular-nums width differs from SSR. Add fixed-width container or use `min-width` on the value span.
   - **Regime:** MultiplierBanner's Active Multiplier hero passes through HeroNumber → AnimateNumber. The 0→0.95 count-up only takes ~5 frames at 60Hz because the range is tiny. Reads as a flicker, not motion. Consider: skip animation when `Math.abs(to - from) < 0.5` (don't animate trivial numeric distances).
   - **All three:** could be the universal `prefers-reduced-motion` collapsed-keyframe CSS at `globals.css:248` interacting badly with the new animations. Try removing `transition-duration: 60ms !important;` from the @media block — current value forces ALL transitions to 60ms when reduce-motion is on, which is fine, but the keyframe animations get `0.01ms` while the JS rAF count-up runs at full duration → mixed-speed motion reads as jerky.
7. **First-mount SSR paints "0" briefly before hydration animates.** Reads as deliberate count-up arrival on Portfolio/Dashboard. If it reads broken on other pages, that's a sign hydration is delayed (maybe rail register effects firing first). Not currently observed.
8. **`row-stagger-in` cap at 12 is global.** All four pages share the same `Math.min(rowIndex, 12)` pattern. If Universe needs a different cap, set it locally — don't change the CSS keyframe (other pages depend on it).
9. **Don't re-litigate Portfolio.** Signed off this session by Terry: "looks good." If next session "fixes" Portfolio motion as part of the Universe/Name/Regime work, that's regression. Keep edits localized.

## 12. Next-session pickup point

1. Run §7.1 verification block. Expected: HEAD `55ac43c`, deploy parity ✓, endpoints `200/307×3`.
2. Fresh-session task: **diagnose + fix the jerky motion on Universe / Name Detail / Regime.** See §11 gotcha #6 for the four hypotheses ranked. Start with hypothesis #2 (Name Detail HeroNumber width reflow) since that's the simplest to verify — open `/universe/AMZN`, watch the hero number on hard refresh, check if the container baseline shifts during count-up.
3. **Don't change the API.** AnimateNumber is locked at kind-enum; the bug is in the propagation, not the primitive.
4. Deploy with `cd /Users/terryturner/Projects/ai-thesis/web && vercel deploy --prod --yes`. Verify parity. Report back so Terry can spot-check.
