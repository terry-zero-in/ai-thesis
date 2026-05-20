# S19 — Mint accent · Universe RSC · Regime polish · Memo trigger unblock

**Session:** 2026-05-19 S19 (post-S18 /compact)
**Branch:** main @ `11d5984` (`11d5984c…`)
**Commits ahead of origin:** 0 (pushed)
**Prod alias:** ai-thesis-v2.vercel.app → `dpl_6EQLEhLnv6v7GyjNBzwzbxB4yvcK` (created 23:19:13 CDT vs HEAD authored 23:19:04 CDT · Δ +9s ✓)

---

## 1. TL;DR

- Closed THS-90: ANTHROPIC_API_KEY was set in **Vercel** in S18 but the Supabase Edge Function runtime needed its own. Fixed via Supabase Edge Functions secrets surface. First successful daily memo fired manually (claude-sonnet-4-6, 13.4s, 0 movers / 0 insiders / 2 data_gaps, neutral macro). Wed 13:00 UTC cron now unblocked.
- CRON_INVOKE_SECRET rotated (current value was lost across S1/S2 rotations); new 64-char hex secret set in BOTH Edge Functions secrets AND Postgres `vault.secrets` entry.
- Three pixel-level polish commits live on prod: regime GaugeCard source attribution, Universe RSC migration (killed loading-spinner flash), Universe full-row click.
- Accent palette v1.3: electric blue `#2A5FE6` → Granite mint-teal `#4FC9B5`. Surfaces untouched per Terry's "leave our surfaces" directive.
- Semantic `--success` bumped to Granite `--pos #4bde80` to open perceptual distance from mint accent (was `#5BB880`, too close on hue). Mint = action; success = state-positive.
- Built but DELETED GateLadder primitive after honest-calibration showed no surface where it added value beyond existing rail+GaugeCards on /regime.

## 2. Architectural pivot or major decision

**Pivot 1 — Accent v1.3.** From v1.2 electric blue `#2A5FE6` to Granite mint-teal `#4FC9B5`. **Why:** Terry's "subscriber vibes" argument + Granite spec proposed mint as a confident departure from fintech-blue default. **Tradeoff accepted:** mint and `--success` `#5BB880` both greenish — distinguishable on B-axis (teal-leaning vs pure green) but worth watching in live use. If they collide, follow-up adjusts success.

**Pivot 2 — GateLadder primitive killed before shipping.** Built ~250 LOC primitive matching Claude Chat's proposed "Inline Derivation Ladder." Audit showed /regime already has MultiplierBanner + GaugeCards + right rail covering the same ground; /dashboard at neutral 0/3 state would render three rows of "no hit" wallpaper. **Why no:** /lambo discipline — "every element justifies itself." Dead-code-as-future-investment was rejected per Terry's "what truly adds value" filter.

## 3. State of the world

**Services / runtime:**
- Vercel project: `ai-thesis-v2` (orgId `team_lz1y0drEGAlm56SDV39OP1zk` · projectId `prj_YkjioJcd1aEBmr1becSngnv9g8wP`)
- Prod alias: `ai-thesis-v2.vercel.app`
- Last code-shipping deploy: `dpl_EXr2XPSSVAB9DmQjQHZGZqEtk1Eg` (preview alias `ai-thesis-v2-ow8hk01ht-terry-8893s-projects.vercel.app`)
- Supabase project: `mvxgnliwvoauwwarrlrr` (project_id `ai-thesis` in supabase/config.toml)
- Supabase URL: `https://mvxgnliwvoauwwarrlrr.supabase.co`

**Secrets (names only, never values):**
- Vercel prod env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (added S18)
- Supabase Edge Functions secrets: `CRON_INVOKE_SECRET` (rotated this session), `ANTHROPIC_API_KEY` (added this session — separate from Vercel's), plus pre-existing FMP_API_KEY / PERPLEXITY_API_KEY / SEC_USER_AGENT
- Postgres `vault.secrets` row name `cron_invoke_secret` — updated this session to match Edge Functions value

**Scheduled jobs (Supabase pg_cron):**
- Daily memo: Mon-Fri 13:00 UTC — `compute-daily-memo` edge function
- Weekly memo: Sun 23:00 UTC — `compute-weekly-ranking`
- Macro chain: Tue 22:00 UTC weekly
- Composite chain: Saturday weekly (referenced but cron name not re-verified this session)

**DB state:** Memo row inserted at as_of 2026-05-19 with successful headline; persists in `memos` table.

**Git state:** main @ `2a4770901e53410125dd931f0c88e696bca5473b` · 0 ahead of origin · 4 commits past S18 baseline `d618f58`.

## 4. Action / API reference

`POST /functions/v1/compute-daily-memo` (Supabase edge function)
- Auth: `Authorization: Bearer ${CRON_INVOKE_SECRET}`
- Body: `{"as_of":"YYYY-MM-DD"}` (optional; defaults to today UTC)
- Returns: `{ok: true, as_of, model, headline, movers, insiders, data_gaps, usage, elapsed_ms}` on success; persists `memos` row with `failed=true,error=...` on 500.
- Verified working with this session's new CRON_INVOKE_SECRET + ANTHROPIC_API_KEY pair.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/lib/regime-types.ts` | modified | Added `source` field to GAUGES — "naaim · weekly" / "aaii · weekly" / "cnn f&g · daily" |
| `web/src/app/regime/GaugeCard.tsx` | modified | Render `meta.source` in footer between crossings + last-hit. /lambo "every computed number has a source attribution nearby" |
| `web/src/app/universe/page.tsx` | modified | Convert to server component; await getLatestUniverseScoresServer; render `<UniverseClient />`. Kills loading-spinner flash. |
| `web/src/app/universe/UniverseClient.tsx` | created | Client wrapper holding UniverseHeader + UniverseTable + filter-context bindings + rail register. |
| `web/src/lib/universe-data-server.ts` | modified | Parallelized 3 queries (universe + scores + aiq_draft_queue) to match browser variant; queue fetch unlocks Q chip in RSC paint. |
| `web/src/components/universe/UniverseTable.tsx` | modified | Full-row click → `router.push('/universe/${ticker}')`; cursor: pointer; ScoreMathPopover stopPropagation already in place. |
| `web/src/app/globals.css` | modified | Accent v1.3 swap: electric blue → Granite mint-teal #4FC9B5 across --accent + 5 derived tokens. |

## 6. Decisions locked

**D1 — Mint-teal accent #4FC9B5 (Granite v1.3).**
- **Why:** Terry's "subscriber vibes" instinct + Granite proposal. Fintech-blue feels generic; mint signals departure.
- **Tradeoff accepted:** Mint vs --success green collision possible in live use; B-axis differential should keep them distinguishable; willing to adjust success if not.

**D2 — Surfaces stay unchanged.**
- **Why:** Terry: "i said opposite, leave our surfaces." Granite warm graphite proposal was rejected.
- **Tradeoff accepted:** Current dark stack (jet #050608 / onyx #0B0C12 / carbon #161920 / steel #2C313F) reads slightly cooler against mint than against blue, but coherence intact.

**D3 — Universe page becomes RSC.**
- **Why:** Last main-nav surface still flashing a center-screen loading spinner. Doctrinally aligned to /aiq, /memos, /decisions, /proposals which all RSC-fetch. Memory [[feedback_server_fetch_no_loading_state]].
- **Tradeoff accepted:** Dual-fetcher pattern (universe-data.ts for browser, universe-data-server.ts for RSC) — slight duplication but cleaner than poison-import via next/headers.

**D4 — Universe rows full-clickable.**
- **Why:** Consistency with Dashboard Score Movers (#100) + Portfolio Positions (#106). Discoverability — operator can hit anywhere on row.
- **Tradeoff accepted:** Middle-click "open in new tab" only works on Ticker/Name cells (the Links); other cells route via router.push which doesn't honor aux-click. Acceptable per same pattern on Dashboard/Portfolio.

**D5 — GateLadder primitive killed before shipping.**
- **Why:** Built it, audited where it'd land, found no surface where it added value beyond existing rail + GaugeCards on /regime. /lambo "every element justifies itself."
- **Tradeoff accepted:** ~250 LOC of well-documented work discarded vs leaving dead code in primitives/. Discard was the lambo-correct call. If a derivation-heavy verdict surface appears in the future (AIQ 6-dimension rubric, factor-pass gates), build it fresh.

**D6 — Memo trigger path: rotate-and-curl, not new Next.js route.**
- **Why:** Terry wanted a sample memo for marketing screenshot ASAP. Smallest possible path = curl with bearer. Path #0 (Supabase dashboard reveal) failed because Supabase only shows partial values. Path #1 (rotate CRON_INVOKE_SECRET) was forced anyway.
- **Tradeoff accepted:** No durable "retry memo" button in app. That belongs to THS-91 if Terry wants it later.

## 7. Next-session test plan

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis

# State checks
git rev-parse HEAD
git log -1 --format="HEAD authored: %cd"
git status -s | head -5
git rev-list --count origin/main..HEAD

# Deploy parity (MANDATORY — S14 protocol)
vercel inspect ai-thesis-v2.vercel.app 2>&1 | grep -E "id|created|status"

# Endpoint smoke
curl -s -o /dev/null -w "/ %{http_code}\n" https://ai-thesis-v2.vercel.app/

# Verify mint live in CSS
grep -A1 "^  --accent:" web/src/app/globals.css | head -2
```

**Expected:**
- HEAD short: `11d5984`
- Authored: `Tue May 19 23:19:04 2026 -0500`
- Deploy id: `dpl_6EQLEhLnv6v7GyjNBzwzbxB4yvcK` created 23:19:13 CDT (Δ +9s ✓)
- `/` 200
- `--accent: #4FC9B5;` and `--success:#4bde80;`

### 7.2 Fresh end-to-end (if cron fires Wed)

The Wed 2026-05-20 13:00 UTC daily-memo cron should now succeed without intervention. After it fires, verify:

```bash
# Refresh /memos and confirm card for 2026-05-20 lands with a real headline,
# not "Missing required env var: ANTHROPIC_API_KEY"
open https://ai-thesis-v2.vercel.app/memos
```

If it fails: re-fire manually via the same path used this session (curl with `/tmp/cron.txt` value if still on disk, OR rotate again per docs/CUTOVER.md §97).

### 7.3 Visual / UI verification

1. Open `/` — confirm sidebar active state, "Open regime →" link, "Switch name" chip, all chart annotations, AIQ "Drafts queue ›" CTA render in mint-teal `#4FC9B5`, NOT electric blue `#2A5FE6`.
2. Open `/regime` — confirm each GaugeCard footer shows `naaim · weekly` / `aaii · weekly` / `cnn f&g · daily` between the crossings + last-hit cells.
3. Open `/universe` — confirm NO center-screen loading spinner on first paint; rows render in <500ms. Click anywhere on a row (not just Ticker text) → navigates to `/universe/[ticker]`.
4. Hover-test mint vs success: scan Dashboard for any "+%" delta pill (green success) sitting next to an "active accent" element. If they read interchangeable, flag for follow-up.

## 8. Budget / quota tracking

Not burning against cap. One Anthropic API call this session (sample memo fire: 703 input / 457 output tokens via claude-sonnet-4-6).

## 9. Known issues / backlog

**Linear queue (verified status not re-checked this session — trust S18 numbers):**
- THS-88 (High): AIQ value drift Editor vs Universe — Postgres view recommended
- THS-89 (Medium): dep_flag chip on AIQ + Universe rows — needs data wiring
- THS-90 (Urgent): **CLOSED Done this session** with handoff-drift correction comment posted
- THS-91 (Medium): Retry button on failed memo cards — needs cron arch decision

**Operational backlog:**
- 17 untracked S3-S19 handoff .md files in `docs/handoffs/` (S19 included after this writes)
- Stale wrong-project deploys not investigated
- Name Detail pixel audit STILL BLOCKED on Q/G/V/AIQ severity-color call from Terry

**Polish backlog (deferred from this session):**
- Universe RSC migration shipped, but Universe C (Δw header tooltip) + D/E/F quibbles intentionally skipped per "what truly adds value" filter
- Graph chart upgrades discussed (cost-basis dashed line, HIGH/LOW anchor pills, KPI consolidation to 2-card grid) — Granite mockup showed all of these. Terry chose accent-only scope this session. Chart polish bundle remains queued.

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Repo (local) | `/Users/terryturner/Projects/ai-thesis` |
| Code root | `/Users/terryturner/Projects/ai-thesis/web` |
| Repo (GitHub) | `terry-zero-in/ai-thesis` |
| Branch | `main` |
| HEAD short | `11d5984` |
| HEAD authored | `Tue May 19 23:19:04 2026 -0500` |
| Vercel project | `ai-thesis-v2` (projectId `prj_YkjioJcd1aEBmr1becSngnv9g8wP`) |
| Vercel org | `terry-8893s-projects` (teamId `team_lz1y0drEGAlm56SDV39OP1zk`) |
| Prod alias | `https://ai-thesis-v2.vercel.app` |
| Latest deploy id | `dpl_6EQLEhLnv6v7GyjNBzwzbxB4yvcK` |
| Latest deploy alias | `ai-thesis-v2-qd5314vw9-terry-8893s-projects.vercel.app` |
| Supabase project ref | `mvxgnliwvoauwwarrlrr` |
| Supabase URL | `https://mvxgnliwvoauwwarrlrr.supabase.co` |
| Supabase Studio | `https://supabase.com/dashboard/project/mvxgnliwvoauwwarrlrr` |
| Memo function | `POST https://mvxgnliwvoauwwarrlrr.supabase.co/functions/v1/compute-daily-memo` |
| Linear team | `Thesis` (teamId `21c004fc-6402-4d22-9316-fa9a05bb9b82`) |
| Linear THS-90 url | `https://linear.app/basisuw/issue/THS-90/anthropic-api-key-missing-in-prod-env-daily-memo-cron-failing-since` |
| New cron secret on disk | `/tmp/cron.txt` (mode 600, contents = the rotated CRON_INVOKE_SECRET — DELETE at session close if not needed) |
| Anthropic key source | `/Users/terryturner/Projects/thesis/.env.local` (key prefix `sk-ant-api03-`, 108 chars) |
| `--accent` (new) | `#4FC9B5` (mint-teal) |
| `--accent` (prior) | `#2A5FE6` (electric blue) |
| `--success` (new) | `#4bde80` (Granite --pos) |
| `--success` (prior) | `#5BB880` |

## 11. Pitfalls / gotchas

1. **Two ANTHROPIC_API_KEY surfaces.** Vercel env (for the Next.js app — currently unused at runtime) AND Supabase Edge Functions env (for the cron). S18 set Vercel only and claimed THS-90 unblock; the cron was still broken. Both surfaces now have the key. If you rotate the Anthropic key in the future, update BOTH.

2. **CRON_INVOKE_SECRET lives in TWO places.** Edge Functions secrets (what the function reads) AND Postgres `vault.secrets` row name `cron_invoke_secret` (what `pg_cron` reads to fire the function). If you rotate, update both via the same value or the cron 401s.

3. **Supabase dashboard does NOT reveal full secret values.** Shows partial only. Path #0 (read existing) is dead; only Path #1 (rotate) works.

4. **`vercel deploy --prod --yes` from web/ — never repo root.** Repo root `.vercel/project.json` points to wrong project. Run from `/Users/terryturner/Projects/ai-thesis/web` only.

5. **`tsc --noEmit` passes but `next build` catches RSC boundary violations.** This session: imported `getSupabaseServer` into `universe-data.ts` (used by client components transitively), passed tsc, failed `next build` with "Client Component Browser → server" import trace. Fix was splitting into `universe-data-server.ts`. **Run `npx next build` before deploy. Always.**

6. **Background `vercel deploy --prod --yes` doesn't always actually promote.** First attempt this session (task `bd8uyybpz`) produced no actionable URL in output and the alias did NOT update to the new commit's deploy. Caught via S14 deploy-parity protocol. Re-deployed synchronously and parity verified Δ +42s. **For prod deploys, prefer synchronous Bash + 180s timeout.**

7. **GreetingStrip server-rendered initial value vs client tick.** Already shipped earlier sessions; just noting: the greeting's "Up late, Terry" verbiage handles `<5am` and `≥22h` per S18 work. Don't re-litigate.

8. **The dead-code temptation.** Built GateLadder, deleted it. Don't re-build it speculatively. Wait for a real surface that needs it (AIQ 6-dimension rubric is a likely candidate when that gets Q-locked).

9. ~~**Mint ↔ success collision (open watch).**~~ **CLOSED in commit `11d5984` this session.** `--success` bumped to `#4bde80` (Granite --pos); brighter + pure-greener opens B-axis distance from mint-teal accent. Mental model now clean: accent = action; success = state-positive.

## 12. Next-session pickup point

Open `/` and `/regime` and `/universe` in browser. Confirm mint accent reads right against the existing dark surface stack. If yes: **chart polish bundle** queued for next session — cost-basis dashed line on Portfolio NAV chart + HIGH/LOW anchor pills on the line + chart footer stats row. All three patterns appeared in Terry's Granite mockup screenshot and are real lambo wins (vs the GateLadder which was redundant). Files in scope: `web/src/components/dashboard/PortfolioValueChart.tsx` + `web/src/components/primitives/LineChart.tsx` (audit first to see what annotation hooks already exist).

If mint reads wrong: roll `--accent` back to `#2A5FE6` (one-line revert in `web/src/app/globals.css`). Simple.

Also pending: clean up `/tmp/cron.txt` at session close if no further memo fires needed. The Wed 13:00 UTC cron will auto-fire and prove the secret works without further manual triggering.
