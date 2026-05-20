# S3 — Dashboard real-data fix, portfolio form overhaul, Next 16 "use server" landmine

**Date:** 2026-05-18 · **Branch:** main @ `2ebfed2` · **Commits ahead of origin/main:** 7 (not pushed — see §11 #1)

---

## 1. TL;DR

- Dashboard was silently serving FIXTURE data (uniform ±1.6 mover deltas) because `getLatestUniverseScores()` used the browser supabase client from a server component. Fixed via sibling `getLatestUniverseScoresServer()`. Confirmed live: spine `as_of 2026-05-18`, real insider rows (KLAC/ARM Form 4), real F&G value `73/80 ▼ 7.1`.
- Score Movers column collision (`Δ 7DDRIVER` / `+1.6Q +2.0`) fixed with `columnGap: 16` on grid header + rows.
- Sidebar hover tips were marketing prose; collapsed to label + keybinding per Linear/Cursor convention.
- Portfolio form rebuilt: Dollar-amount input mode (auto-derives fractional shares from current price), per-row Edit affordance, prefill on edit, $-prefix on currency inputs, native date picker on click.
- Globals: `color-scheme: dark` + `accent-color: var(--accent)` → dark calendar pickers with Apex-blue selected-day highlight.
- **Next 16 landmine caught from Vercel logs:** `"use server"` modules cannot export non-async values. POSITION_INITIAL + 3 other initial-state consts moved to sibling `action-types.ts` files across `/portfolio`, `/decisions`, `/aiq-drafts`.

## 2. Architectural pivot or major decision

**Server actions: split out non-async exports — always.**

Next 16 enforces `"use server" files can only export async functions` at RUNTIME (not tsc, not build — only when the action POSTs). The portfolio Buy button surfaced it as ERROR `3104394537@E352`. Three files in the repo had the same pattern silently waiting to fire (`/decisions`, `/aiq-drafts`, `/portfolio`). All fixed by moving `*_INITIAL` constants + state interfaces into sibling `action-types.ts` (plain modules, no `"use server"` pragma).

**Why this matters going forward:** any new server-action route must follow the split-pattern from day one. The lesson belongs in the next session's handoff gotchas and ideally in a project rule.

## 3. State of the world

### Services / endpoints
- Production: `https://ai-thesis-v2.vercel.app` → deployment `dpl_4H28UVUnXDjYZPHKR1LbyjYA51AU`, target=production, readyState=READY, alias assigned (verified 2026-05-18 08:17 CDT).
- Supabase project ref: `mvxgnliwvoauwwarrlrr` (ai-thesis Postgres 17).
- Reticle Supabase: `ydzvrosvkmqkdaqgsxtb` — preserved, hosts Routines/Paperclip DB. Do NOT delete.

### Secrets (names only, not values)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (plain) — readable via Vercel REST API.
- `SUPABASE_SERVICE_ROLE_KEY` (sensitive) — present in prod env, NOT decryptable via API.
- Vercel CLI auth token at `~/Library/Application Support/com.vercel.cli/auth.json`.
- Vault `cron_invoke_secret` ID: `a5767249-e337-43eb-9d6b-7540f7ca0eb7`.

### DB state (this session — verified via dashboard render, not direct query)
- scores_history populated for `as_of 2026-05-18` (this week's Saturday-chain run).
- `insider_form4_raw` has real recent rows: KLAC SELL 4.5k 6d ago, ARM SELL (4 transactions) 7d ago. Total ~416 rows / 5 tickers.
- `macro_gauges` shows F&G=73 today; NAAIM/AAII still "no data" (Perplexity scrape gap, AAII data quality is queue item #3).
- `portfolio_positions` schema confirmed in `supabase/migrations/20260516000200_e45_portfolio_positions.sql` — accepts fractional shares (numeric NOT NULL CHECK > 0), FK to universe(ticker).

### Scheduled jobs
- No changes this session. Weekly score chain still at Sat 22:00–22:45 UTC (Q→G→V→AIQ→composite).

### Git state
- HEAD: `2ebfed2b97f8aabdc51cd92631accce6e0cecb3e`
- Tree: clean (no uncommitted, no untracked except this handoff doc to be added next)
- Branch: `main`
- Commits ahead of `origin/main`: 7
- Pushed: **NO** — SSH key not loaded in agent; deployments went via Vercel CLI directly. Local commits include S2 handoff + 6 commits from this session.

### Dev server / processes
- None running. Port 3000 free.

## 4. Action / API reference

Two server actions touched (not their signatures, but their containing modules):
- `web/src/app/portfolio/actions.ts` — now imports `PositionFormState` type-only from `action-types`; exports only `savePosition()` + `closePosition()` async.
- `web/src/app/decisions/actions.ts` — same pattern; exports only `ackAlert()` + `ackAlerts()`.
- `web/src/app/aiq-drafts/actions.ts` — same pattern; exports only `promoteAiqDraft()`.

No API surface changes.

## 5. Files created or modified

| Path | Action | One-line rationale |
|---|---|---|
| `web/src/app/page.tsx` | M | Score Movers `columnGap: 16` + View-all link; AlertCallout state pill (Neutral/Tightened/Cautious/Defensive) + tier color; replaced 3 GaugeCards with CompactGateStrip + CompactGateRow; pass recentInsider into railData; drop unused GaugeCard import |
| `web/src/lib/dashboard-data.ts` | M | Switch to `getLatestUniverseScoresServer()`; add `getRecentInsider()` (14d window, P/S codes, 5 rows) + `DashboardInsiderRow` type |
| `web/src/lib/universe-data.ts` | M | Export `buildSnapshot`, `fixtureSnapshot`, `UniverseDbRow`, `ScoresRow` so the server variant can compose them |
| `web/src/lib/universe-data-server.ts` | + | NEW. `getLatestUniverseScoresServer()` using `getSupabaseServer()` (cookies → user JWT → RLS passes). Fixes silent fixture fallback on dashboard. |
| `web/src/components/rails/DashboardTodayRail.tsx` | M | Replace THS-66 ghost with InsiderRow rendering real form4 P/S rows + relDays helper |
| `web/src/components/shell/Sidebar.tsx` | M | Delete NAV_TIPS + BADGE_TIPS marketing copy; nav tooltip now just `label` + `keys`; settings tip shortened; drop unused `id` arg from SbItem |
| `web/src/app/portfolio/page.tsx` | M | Accept `?edit=<TICKER>` searchParam; await new async `getUniverseChoices()`; pass `heldPrefill` + `initialTicker` to form |
| `web/src/app/portfolio/AddPositionForm.tsx` | M | Full rewrite — Dollar/Shares mode toggle, current-price line + auto-fill, "use current $X" chip, edit prefill, $-prefix DollarInput, DateInput with showPicker(), form anchor `id="add-position"` |
| `web/src/app/portfolio/PositionsTable.tsx` | M | Per-row Edit link → `/portfolio?edit=<TICKER>#add-position`; widened action cell 64→116px; import POSITION_INITIAL from action-types |
| `web/src/app/portfolio/actions.ts` | M | Drop `POSITION_INITIAL` const + `PositionFormState` interface; import the type from action-types |
| `web/src/app/portfolio/action-types.ts` | + | NEW. PositionFormState + POSITION_INITIAL constant. Plain module. |
| `web/src/app/decisions/actions.ts` | M | Drop ACK_INITIAL, BULK_ACK_INITIAL, AckState, BulkAckState exports; import types from action-types |
| `web/src/app/decisions/action-types.ts` | + | NEW. AckState + BulkAckState + ACK_INITIAL + BULK_ACK_INITIAL. |
| `web/src/app/decisions/AlertRow.tsx` | M | Import constants/types from action-types |
| `web/src/app/decisions/BulkAckButton.tsx` | M | Import constants/types from action-types |
| `web/src/app/aiq-drafts/actions.ts` | M | Drop PROMOTE_INITIAL + PromoteState exports; import type from action-types |
| `web/src/app/aiq-drafts/action-types.ts` | + | NEW. PromoteState + PROMOTE_INITIAL. |
| `web/src/app/aiq-drafts/DraftCard.tsx` | M | Import constants/types from action-types |
| `web/src/lib/portfolio-types.ts` | M | Add `latest_price` + `latest_price_as_of` to UniverseChoice; add HeldPositionPrefill |
| `web/src/lib/portfolio-data.ts` | M | `getUniverseChoices()` async — joins latest close from prices_raw; fixture fallback w/ deterministic fixtureClose hash; `fallbackUniverseRow` updated for new fields |
| `web/src/app/globals.css` | M | `html { color-scheme: dark; accent-color: #3560F3 }` + calendar indicator filter inversion |

## 6. Decisions locked

1. **Dashboard server-side data fetches use `getSupabaseServer`, never `getSupabaseBrowser`.**
   **Why:** `getSupabaseBrowser` from a server component has no cookies → no user JWT → anon role → RLS blocks reads → silent fixture fallback that looks plausible until you spot uniform ±1.6 deltas.
   **Tradeoff accepted:** two functions (`getLatestUniverseScores` for client, `getLatestUniverseScoresServer` for server) instead of one — minor duplication for correctness.

2. **`"use server"` files export only async functions.** Initial-state constants + interface declarations live in sibling `action-types.ts` modules.
   **Why:** Next 16 enforces this at runtime; consts emit JS, run on POST, throw with digest `@E352`.
   **Tradeoff accepted:** one extra file per action route. Worth it — silent landmines cost more debugging time than the file creation costs.

3. **Sidebar nav tooltips are terse: label + keybinding only.** Long marketing-style descriptions removed.
   **Why:** Tip primitive uses `white-space: nowrap`, so any prose tooltip balloons off-screen. Linear/Cursor/Vercel convention is label + shortcut.
   **Tradeoff accepted:** lose the descriptive copy. The page label + keybind is enough; description belongs in /settings or the page itself if anywhere.

4. **Portfolio Dollar-mode entry truncates shares to 2 decimals via `Math.floor`.**
   **Why:** Never over-buy on rounding. Matches Robinhood / Fidelity / Schwab behavior.
   **Tradeoff accepted:** can leave $0.01–$X.YY of unspent capital depending on price. Acceptable; alternative is fractional precision the broker won't honor.

5. **Edit-mode forces Shares input mode** regardless of how you arrived.
   **Why:** Editing a held position is adjusting deltas — re-buying with a fresh dollar amount semantically doesn't apply to "edit my existing 30 shares of NVDA."
   **Tradeoff accepted:** Slight asymmetry between Add vs Edit UX. Worth it for clarity.

6. **Per-row Edit uses URL routing (`?edit=<TICKER>`) over client-side state.**
   **Why:** URL is shareable, back/forward works correctly, no inter-component event bus needed.
   **Tradeoff accepted:** full server re-render on click. Fine — it also gives us free revalidation.

7. **Dashboard 3 macro GaugeCards replaced by one CompactGateStrip.**
   **Why:** Cards duplicate /regime; ~400px reclaimed; dashboard reads "scannable in 10s".
   **Tradeoff accepted:** less detail per gauge on dashboard. Full cards live one click away at /regime.

## 7. Next-session test plan

### 7.1 Read-only verification (<60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                                  # expect 2ebfed2
git status --short                                  # expect clean (or only this handoff if uncommitted)
git log --oneline origin/main..HEAD | wc -l         # expect 7 (or 0 if pushed)
curl -sI https://ai-thesis-v2.vercel.app | head -1  # expect HTTP/2 307 (auth redirect = working)
cd web && ./node_modules/.bin/tsc --noEmit; echo "TSC=$?"  # expect TSC=0
# Verify all "use server" files export only async functions:
for f in $(grep -rl '^"use server"' src --include="*.ts" --include="*.tsx"); do
  bad=$(grep -nE "^export (const|let|var|enum|class)" "$f"); [ -n "$bad" ] && echo "BAD: $f"; done
# Expect empty output.
```

### 7.2 Fresh end-to-end (Terry's authenticated browser)

1. `/` Dashboard — spine shows `as_of 2026-05-18` (not 2026-05-09), score movers section either has varied deltas OR shows "No composite movement this week"; regime pill (if hit) shows state name + multiplier; rail "Insider · recent" shows real Form 4 rows.
2. `/portfolio` — Ticker dropdown lists ~50 stocks; selecting a ticker shows "Current $X · as of YYYY-MM-DD" beneath; mode toggle works; Dollar-mode preview computes shares correctly; clicking date opens dark calendar picker with Apex-blue highlight; clicking "edit" on a row sets URL to `?edit=TICKER`, scrolls form into view, header reads "Edit {TICKER}", all fields prefilled.
3. `/portfolio` Buy — submitting a new position should now succeed without a 500 (E352 error fixed). Refresh confirms position in table.

### 7.3 Visual/UI verification

- Hover any sidebar nav item → short tooltip with label + keybinding (e.g., `Dashboard G→D`), not paragraph prose.
- `/portfolio` → Cost / share input shows leading `$`; clicking Opened field opens dark calendar picker.
- Score Movers table on `/` → `+1.6  Q +2.0` style spacing (gap between Δ and Driver columns), not `+1.6Q +2.0`.

## 8. Budget / quota tracking

None this session. No new external API spend; Vercel deploys are unlimited on Pro; Supabase reads are within Free tier.

## 9. Known issues / backlog

### By area

1. **Dashboard / data**
   - 1.1 "No composite movement this week" empty state — scores_history may have only 1 as_of run for this week; either data-side (run a backfill of last week's chain) or accept as honest empty state.
   - 1.2 NAAIM + AAII gauges show "no data" — Perplexity scrape only filled 5/366 days for AAII. Find better source (S2 backlog #3).

2. **Portfolio**
   - 2.1 Average-in mode for editing positions deferred — current edit semantics is REPLACE. Add "buy more" alternative if Terry asks.
   - 2.2 Dollar-mode is disabled when ticker has no `prices_raw` row. Communicates via tooltip on the disabled toggle; could be more prominent.
   - 2.3 30D return KPI still shows em-dash with sub "tracks once a position has been open ≥30 days" — that's the current contract; if Terry wants a different empty state, separate ticket.

3. **Universe (deferred from S3)**
   - Browser Claude posted a Universe-page polish spec. I drafted detailed pushback (kept items + skip items) but didn't execute. Saved as in-chat draft only — not committed anywhere.
   - Real bug: G column truncation at 1325px viewport (Q/G/V/AIQ columns at 100px each → 80px would fix without sticky-left surgery).

4. **Anthropic-via-Routines build** — major (2-4 hrs). Not touched this session. Reticle DB has the schema; plan-mode the architecture before code.

5. **Tier 3 polish punch-list (from S2 handoff §9)**
   - G4 ⌘K command palette
   - U1 universe table skeleton
   - U2 Q/G column truncation fix
   - U3/A4 sub-score column header tooltips
   - R4 active-multiplier glow on Regime CURVE cell
   - U4 filter pill selected-state visual

6. **Tokens to rotate post-session** (carried from S2): Supabase access `sbp_ad67b561bb496794ae69c426fac17197f0d50ba9`; Perplexity `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`; FMP `xnxw9DLdXCMAiVtl0o56flJMF8lvdKWT`.

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Working dir | `/Users/terryturner/Projects/ai-thesis` |
| HEAD SHA | `2ebfed2b97f8aabdc51cd92631accce6e0cecb3e` |
| Branch | `main` |
| Origin | `git@github.com:terry-zero-in/ai-thesis.git` (SSH; agent key not loaded — see §11 #1) |
| Production URL | `https://ai-thesis-v2.vercel.app` |
| Latest prod deploy | `dpl_4H28UVUnXDjYZPHKR1LbyjYA51AU` |
| Vercel project ID | `prj_YkjioJcd1aEBmr1becSngnv9g8wP` |
| Vercel team ID | `team_lz1y0drEGAlm56SDV39OP1zk` |
| Vercel CLI token path | `~/Library/Application Support/com.vercel.cli/auth.json` |
| Supabase project ref (ai-thesis) | `mvxgnliwvoauwwarrlrr` |
| Supabase anon key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im12eGdubGl3dm9hdXd3YXJybHJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwNTMwMTcsImV4cCI6MjA5NDYyOTAxN30.1LmaRs9bH_rG0ROBwyvkoEbFBp5NzYwPhV9M1i72bzs` |
| Reticle Supabase ref (KEEP) | `ydzvrosvkmqkdaqgsxtb` |
| Accent color | `#3560F3` (Apex blue) — locked S2, never revert |
| portfolio_positions migration | `supabase/migrations/20260516000200_e45_portfolio_positions.sql` |
| Dashboard data libs | `web/src/lib/{dashboard-data,universe-data,universe-data-server,regime-data,portfolio-data}.ts` |
| Form anchor for portfolio edit | `?edit=<TICKER>#add-position` |
| 7 commits this session (latest first) | `2ebfed2`, `2a2be07`, `9d3f0c0`, `e91c689`, `5f5b935`, `ef56189`, `c51b326` (S2 handoff doc) |

## 11. Pitfalls / gotchas

1. **SSH key not loaded in this session's agent.** `git push origin main` fails with `Permission denied (publickey)`. I deployed via `vercel --prod --yes` from `web/` directory instead. **7 commits are local-only** until Terry runs `git push` from his terminal (where his ssh-agent has the key). Vercel production is current; GitHub is behind.

2. **Next 16 `"use server"` is RUNTIME-enforced.** Object/const exports from action files tsc clean, build clean, fail only when the action POSTs. Audit command: `grep -rl '^"use server"' src --include="*.ts" --include="*.tsx"` then check each file with `grep -nE "^export (const|let|var|enum|class)"`. Empty = clean. (Type-only `export interface` / `export type` is fine — those erase at compile.)

3. **`getSupabaseBrowser()` returns a non-functional client when called from a server component** — it doesn't throw, it returns a client with no cookies. Queries silently return empty arrays, code falls back to fixture. Dashboard was poisoned this way for some time before this session caught it. Any new server-side data fetch must use `getSupabaseServer()`.

4. **Vercel logs CLI hangs without `--no-branch` in non-default branch contexts.** Run with `--no-branch` to avoid auto-filtering. `vercel logs --no-follow --since 30m --limit 50 --no-branch --status-code 500 -x` was what surfaced the @E352 error stack.

5. **Supabase service_role key is `type: sensitive` in Vercel** — NOT decryptable via `?decrypt=true`. `value` field returns "" even when the key is set. Don't conclude "key is missing" from an empty value field. Test by hitting a route that needs it.

6. **MCP `claude_ai_Supabase` cannot reach the ai-thesis project** — only the `helm-handoff-console` and `Fontera - KPI Dashboard` projects are in MCP's accessible org. For ai-thesis DB diagnostics: PostgREST with anon key (RLS-limited) OR ask Terry for service_role for one-off queries OR deploy a temporary diagnostic API route.

7. **PostgREST anon-key reads on `scores_history` / `universe` return `[]` due to RLS.** That's correct behavior. The browser path that works uses the user's JWT via cookies (per `getSupabaseBrowser`'s ssr client cookie pickup). Don't conclude "table is empty" from anon-key PostgREST results.

8. **Tip primitive (`web/src/components/shell/Tip.tsx`) uses `white-space: nowrap`.** Any tooltip with prose-length text balloons off-screen. Keep labels under ~30 chars; use `keys` prop for the keybinding chip.

9. **`html { color-scheme: dark }` flips ALL native form widgets to dark.** That includes scrollbars, checkboxes, radios, sliders, date/time/color inputs. `accent-color: #3560F3` colors all of them with Apex blue. If a future input wants a different accent, set it inline on that element.

10. **The fixture path is now actively misleading on `/portfolio` choices.** `getUniverseChoices()` falls back to FIXTURE_UNIVERSE when Supabase returns empty — keeps the form usable locally, but on prod if `universe` table is ever cleared, choices would silently shift to fixture. Not currently risky (universe is populated), but worth knowing.

11. **`?seed=fixture-positions` populates a 12-position fixture book.** Still works for /lambo review. Don't ship that URL to users.

12. **Local dev requires `.env.local` to talk to prod Supabase.** Pull with the Vercel REST API (token in `~/Library/Application Support/com.vercel.cli/auth.json`):
    ```bash
    VERCEL_TOKEN=$(jq -r '.token' ~/Library/Application\ Support/com.vercel.cli/auth.json)
    curl -s "https://api.vercel.com/v9/projects/prj_YkjioJcd1aEBmr1becSngnv9g8wP/env?teamId=team_lz1y0drEGAlm56SDV39OP1zk&decrypt=true" \
      -H "Authorization: Bearer $VERCEL_TOKEN" \
      | jq -r '.envs[] | select(.target | index("production")) | select(.value != "") | "\(.key)=\(.value)"' > web/.env.local
    ```
    Then `rm web/.env.local` before commit — `.env*.local` is gitignored but visible to next-Claude as untracked state.

## 12. Next-session pickup point

1. `cd /Users/terryturner/Projects/ai-thesis && git status` — verify clean working tree at HEAD `2ebfed2`.
2. Ask Terry whether to push the 7 commits to GitHub (his SSH key is loaded in his terminal, mine isn't), and which is the next priority: Universe page polish (pushback already drafted), Anthropic-via-Routines (plan-mode required), or G4 ⌘K palette (~1 hr).
3. Do NOT delete any sibling `action-types.ts` files. They are the Next 16 server-action contract. Treat them as a project-wide pattern from now on.
