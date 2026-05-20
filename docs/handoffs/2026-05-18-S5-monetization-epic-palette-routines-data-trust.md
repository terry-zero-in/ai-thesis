# S5 — Monetization Epic + Palette v1.1 + Routines Bucket A + Data Trust

**Date:** 2026-05-18
**Session:** S5
**Branch:** main
**HEAD:** `a4915d2c4c6ddd3ff18a94d131a30f658b2a0cbd`
**Pushed:** YES (origin/main is current; 13 commits pushed this session including S3/S4 backlog + S5 work)
**Production:** https://ai-thesis-v2.vercel.app → HTTP 307 (auth-gated, working)

---

## 1 · TL;DR

Terry decided to commit to monetization. Filed full **Linear epic THS-70 (Monetization-Ready v1)** + 16 children covering routines plumbing, engine visibility, signature patterns, page polish, marketing landing, auth/billing, and SEC compliance. Then shipped 3 tickets autonomously: **THS-72 Palette v1.1** (deeper iris #5236DC + warm-near-black surface lift), **THS-71 (partial) routine prompts** (4 paste-ready specs + setup guide), and **THS-83 Data trust** (DemoBadge consolidation + date-display honesty). SSH agent loaded — pushed all 13 commits including the S3/S4 backlog. CLAUDE.md operating posture is autonomous: pick next ticket, build, ship, push, mark Done.

## 2 · Architectural pivot — Monetization-Ready v1

Major decision this session: **activate Bucket C (monetization).** Previously deferred at S4 ("ship A + B, hold C"). Terry's directive S5: "I do want to configure this for potential customers." Triggered the full epic creation.

**Why:** GPT-5 review + engine doc made the case that AI Thesis can be sold as "explainable research terminal for the AI infrastructure trade" — not a stock-picking app, not personalized advice. Research software at $49-79/mo. 50-100 user paid beta target.

**Positioning LOCK (THS-70):**
> AI Thesis = explainable investment research terminal for the AI infrastructure cycle.
> NOT a stock-picking app. NOT personalized advice. Research software with transparent factor scoring, macro risk controls, and portfolio guardrails.

**Tradeoff accepted:** Earlier "wait 60-90 days of personal use before monetizing" deferred. Terry's read: GPT review + engine doc give enough conviction to start building the monetization scaffolding now. Compliance ticket THS-86 is the legal floor that gates marketing.

## 3 · State of the world

**Services:**
- App: Next.js 16 + React 19 + Tailwind v4 + Supabase. Live at https://ai-thesis-v2.vercel.app.
- Supabase: ai-thesis project (separate from Reticle `ydzvrosvkmqkdaqgsxtb` which hosts Routines/Paperclip oc_* catalog).
- Vercel: production deploy `ai-thesis-v2-cvygwzxjk-terry-8893s-projects.vercel.app` (THS-72 palette) + later deploy for THS-83.
- GitHub: terry-zero-in/ai-thesis @ `a4915d2`.

**Scheduled jobs:** 17 cron jobs already exist (see /settings page). 4 new Anthropic Routines pending creation by Terry on claude.ai/code — paste-ready prompts in `docs/routines/`.

**External integrations:** FMP (prices/fundamentals), Polygon (intraday), Perplexity (AIQ research draft), Resend (transactional email — not wired yet). New: Anthropic Claude Code Routines via Supabase MCP connector (Terry creates 4 routines this/next session).

**DB state:** e80 migration `20260518000200_e80_routines_pr1.sql` (551 lines) **NOT YET APPLIED to live Supabase.** Terry's manual step. Migration is atomic + idempotent — paste into Studio SQL Editor → Run. Adds: `users` table, user_id columns on portfolio_*, alert_acks, + 7 routine-output tables (aiq_draft_queue, weekly_summary, insider_summary, macro_log, memo_proposals, universe_proposals, position_pulse).

**Git state:** HEAD `a4915d2` on main. 0 commits ahead of origin/main (all pushed). Working tree has S3 + S4 + S5 handoff docs untracked.

## 4 · Action / API reference

None this session. No new endpoints touched. Routine prompts call MCP-resident Supabase tools, not app endpoints.

## 5 · Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/app/globals.css` | MODIFIED | Iris × Voltage **v1.1**: iris-300 #A87DFE → **#5236DC** (electric indigo); iris-500 → #4D3FB8 (Persian); surface lift +1-5 (jet #000 → #050608); 4 rgba alpha tokens swept. Header comment updated. THS-72. |
| `docs/routines/README.md` | NEW | Routines overview + cadence table + compliance language floor. THS-71. |
| `docs/routines/01-daily-batch.md` | NEW | Paste-ready daily-batch routine (insider digest + macro + AIQ queue + drift detection). |
| `docs/routines/02-weekly-rescore.md` | NEW | Saturday composite rescore for all 50 tickers + weekly_summary narrative. |
| `docs/routines/03-monthly-curator.md` | NEW | Monthly ADD/TRIM proposals to universe_proposals. |
| `docs/routines/04-position-pulse.md` | NEW | Per-user thesis-intact verdict (intact/weakening/broken). v1 = score+insider only, no news. |
| `docs/routines/setup-guide.md` | NEW | Step-by-step routine creation + Supabase MCP connector + verification. |
| `web/src/components/shell/DemoBadge.tsx` | NEW | Single-source header badge for demo workspace state. Replaces 4 inline " · fixture mode" subtitle suffixes. THS-83. |
| `web/src/components/shell/TopBar.tsx` | MODIFIED | Imports + renders DemoBadge when `!userEmail`. |
| `web/src/app/settings/page.tsx` | MODIFIED | Stripped inline " · fixture mode" suffix. |
| `web/src/app/memos/page.tsx` | MODIFIED | Stripped inline " · fixture mode" suffix. |
| `web/src/app/backtest/page.tsx` | MODIFIED | Stripped inline " · fixture mode" suffix. |
| `web/src/app/aiq-drafts/page.tsx` | MODIFIED | Stripped inline " · fixture mode" suffix. |
| `web/src/app/regime/GateHistory.tsx` | MODIFIED | `fmtDate` now includes year ("May 14" → "May 14, 2026"). |
| `web/src/app/aiq/page.tsx` | MODIFIED | MonoMetaSpine label "latest" → "as_of" (less ambiguous). |
| `docs/handoffs/2026-05-18-S5-...md` | NEW (this file) | S5 handoff doc. |

## 6 · Decisions locked

**D1: Iris × Voltage v1.1 supersedes v1.0.** Iris-300 = `#5236DC` (electric indigo) per Terry referencing Robinhood Strategies half-circle gradient. Iris-500 = `#4D3FB8` (Persian) as two-tone hover companion.
- **Why:** v1.0 `#A87DFE` read too light/lavender — not authoritative enough for institutional financial UI.
- **Tradeoff accepted:** Some hover states may need re-eyeballing; LayerChip categorical L2 violet (#A78BFA) is now MUCH lighter than iris-300 — actually better separation than v1.0, no collision.

**D2: Surface lift "very little more gray."** Jet #000000 → #050608 (+5 on pure-black baseline). Onyx/carbon/steel +1-2 each.
- **Why:** Terry directive — pure-cold-black felt sterile; warm-near-black adds "comforting/safe" texture.
- **Tradeoff accepted:** Larger lift (+3-5 across the board) was rejected as "too gray" — would slide into SaaS-gray territory and lose terminal posture.

**D3: 4 v1 routines, not 5.** Earnings-batch deferred to v1.1.
- **Why:** Terry: "i dont have anything setup right now fyi" — no earnings_calendar ingestion exists.
- **Tradeoff accepted:** Position-pulse v1 has no news signal — uses score change + insider only.

**D4: DemoBadge replaces inline " · fixture mode" suffixes.** Single header pill, single tooltip.
- **Why:** GPT review G2 — five scattered inline labels created inconsistent tone ("· fixture mode" vs "(fixture)" vs "Demo · fixture book"). One badge, one place to look.
- **Tradeoff accepted:** Portfolio's "Demo · fixture book" chip (page-specific seed indicator) kept — different concept from workspace-level demo state.

**D5: "Single source-of-truth per date type" claim in THS-83 was overstated.** Audit found dates are already honest per data type.
- **Why:** Composite (2026-05-09), prices (2026-05-17), macro (2026-05-14) refresh at different cadences. Forcing same date would be dishonest.
- **Tradeoff accepted:** Surface-specific freshness handling stays; only fixed the actual 2 gaps (GateHistory year, AIQ label).

**D6: Autonomous mode is default per CLAUDE.md.** Don't ask, build, ship, mark Done.
- **Why:** Terry's directive + repo CLAUDE.md operating posture.
- **Tradeoff accepted:** Some color/UX decisions get locked unilaterally (palette v1.1, DemoBadge wording) with low-cost-revert option instead of render-and-eyeball gate. Surface decisions on commit + Linear ticket, easy to revert if wrong.

## 7 · Next-session test plan

### 7.1 Read-only verification (run first, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                                          # expect a4915d2...
git status --short                                          # expect handoff docs untracked
git rev-list --count origin/main..HEAD                      # expect 0 (all pushed)
cd web && ./node_modules/.bin/tsc --noEmit && echo OK       # expect TSC OK
curl -sI https://ai-thesis-v2.vercel.app | head -1          # expect HTTP/2 307
```

### 7.2 Visual / UI verification

Once Terry signs in to https://ai-thesis-v2.vercel.app, verify:
- Iris signal reads as **deep electric indigo**, NOT light lavender. Score arcs, active nav, links should all be #5236DC.
- Surfaces feel **warm-near-black** — not stark pure black, not gray-SaaS.
- DemoBadge appears in top bar **only when signed out** (or no Supabase env).
- Settings / Memos / Backtest / AIQ-drafts pages no longer show " · fixture mode" in subtitle (when env is configured + signed in).
- Regime > Gate History dates show full year (e.g., "May 14, 2026").
- AIQ Editor page shows "as_of" label in MonoMetaSpine (not "latest").

### 7.3 Migration apply (Terry's manual step — blocks THS-71 finish)

In Supabase Studio:
1. Open SQL Editor → New query
2. Paste `supabase/migrations/20260518000200_e80_routines_pr1.sql`
3. Run
4. Verification queries embedded at end of migration should pass

After apply, the 7 routine-output tables exist + portfolio_* / alert_acks have user_id columns.

### 7.4 Routine setup (Terry's manual step — unlocks data pipeline)

After migration applied, follow `docs/routines/setup-guide.md`:
1. Create Supabase MCP connector at claude.ai/code with service_role key
2. Create 4 routines (paste system prompt + user message from each `docs/routines/0N-*.md`)
3. Stagger first-fires per setup guide
4. Verify writes land in Supabase tables

## 8 · Budget / quota tracking

Anthropic Routines cap: 15/day per account. Planned weekday cadence after routines live:
- Daily-batch + position-pulse = 2 fires/weekday
- Weekly-rescore = 1 fire/Saturday
- Monthly-curator = 1 fire/first Saturday
- **Total:** ~12 fires/week, ~1.7/day average. Plenty of headroom.

No other quota concerns this session.

## 9 · Known issues / backlog

### Linear queue (under epic THS-70)

| Status | Ticket | Title |
|---|---|---|
| **Done** | THS-72 | Palette v1.1 — deeper iris + surface lift |
| **Done** | THS-83 | Data trust — DemoBadge + date honesty fixes |
| **In Progress** | THS-71 | Routines plumbing — finish Bucket A (markdown done; migration apply + 2 UI surfaces + verify-fires remain) |
| Backlog (Urgent) | THS-73 | Engine visibility — Score Math drawer + scoring-mode status |
| Backlog (Urgent) | THS-74 | Dashboard "Today's Thesis" command-center |
| Backlog (Urgent) | THS-86 | Compliance language audit + disclosures (legal floor for marketing) |
| Backlog (High) | THS-75 | AIQ Editor — 6-dimension cockpit |
| Backlog (High) | THS-76 | Portfolio — Book Guardrails + allocation strip |
| Backlog (High) | THS-77 | Decisions — rule-generated inbox (8 alert kinds) |
| Backlog (High) | THS-84 | Marketing landing — paid-beta wedge |
| Backlog (High) | THS-85 | Auth + Stripe billing + tier provisioning |
| Backlog (Medium) | THS-78 | Universe — FINAL/TIER dominance |
| Backlog (Medium) | THS-79 | Detail — 12-week chart visual moment |
| Backlog (Medium) | THS-80 | Regime — multiplier curve + de-rate note |
| Backlog (Medium) | THS-81 | Backtest fixture honesty (DUPLICATE — see below) |
| Backlog (Medium) | THS-82 | Typography Q-LOCK |
| Backlog (Medium) | THS-87 | Backtest fixture honesty (DUPLICATE) |

### Duplicate ticket

**THS-81 and THS-87 are identical** (Backtest fixture honesty). First attempt got Linear 502 but the write actually succeeded — retry created the duplicate. **Action:** Delete one (recommend THS-87, the later one). Cosmetic gap.

### Carry-overs from S3

- AAII data quality: 5/366 days filled (needs better source)
- 3 API tokens to rotate (Supabase access, Perplexity, FMP)

## 10 · Quick-reference IDs

| Item | Value |
|---|---|
| Repo path | `/Users/terryturner/Projects/ai-thesis` |
| GitHub | https://github.com/terry-zero-in/ai-thesis |
| HEAD | `a4915d2c4c6ddd3ff18a94d131a30f658b2a0cbd` |
| Production URL | https://ai-thesis-v2.vercel.app |
| Latest prod deploy ID | `dpl_FFrARaM63AaUBnxxc163GuK37vjE` (palette) + later for THS-83 |
| Linear team | THS (id `21c004fc-6402-4d22-9316-fa9a05bb9b82`) |
| Linear project | AI Thesis v2 — Scoring Engine & Portfolio (id `79a38aec-2b49-4c18-a92a-ce5585e2ff11`) |
| Linear epic | THS-70 (Monetization-Ready v1) |
| Linear URL | https://linear.app/basisuw/project/ai-thesis-v2-scoring-engine-and-portfolio-058e8881dd4a |
| Migration file | `supabase/migrations/20260518000200_e80_routines_pr1.sql` |
| Engine doc | `docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| S4 handoff | `docs/handoffs/2026-05-18-S4-iris-voltage-and-routines-pr1-partial.md` |
| Reticle Supabase (KEEP) | `ydzvrosvkmqkdaqgsxtb` (Routines/Paperclip oc_* catalog) |
| Palette v1.1 iris-300 | `#5236DC` (electric indigo, A) |
| Palette v1.1 iris-500 | `#4D3FB8` (Persian indigo, B) |
| Palette v1.1 jet | `#050608` (warm-near-black) |
| Voltage CTA | `#CCFF33` (unchanged) |

## 11 · Pitfalls / gotchas

1. **Migration not applied.** All THS-71 finish work + any UI that reads new tables is blocked. Terry's manual step. Helpers in `web/src/lib/routine-outputs.ts` and `web/src/lib/aiq-queue.ts` return null/[] gracefully when tables don't exist, so UI shipped in S4 is graceful.
2. **Anthropic 15/day cap is per account, not per routine.** Bundle work into batched routines. v1's 4 routines averages ~1.7 fires/day, well under.
3. **App never calls Routines fire endpoint.** Routines fire on schedule. Terry directive: "i dont plan on manually running or updating anything."
4. **Palette v1.1 — visual diff might surprise.** Iris is now deep electric indigo, not light lavender. If anything looks "off" on dashboard/universe/regime, it's probably the eye adjusting to the deeper signal color.
5. **DemoBadge only renders when `!userEmail`.** Signed-in users with configured Supabase will not see it. Verify in production by signing in (badge should disappear) and signing out (badge should appear).
6. **THS-71 stays In Progress until Terry's manual steps complete.** Don't mark Done from this side.
7. **Compliance language audit (THS-86) is the legal floor.** Marketing landing (THS-84) cannot ship without it. Auth/Stripe (THS-85) signup-disclaimer language depends on it.
8. **CLAUDE.md operating mode is autonomous.** Don't ask "should I start ticket X?" — yes, you should. Build, ship, push, mark Done.
9. **SSH agent loaded this session.** Continues working as long as ssh-agent is alive. If push fails next session, `ssh-add -L` to verify keys, fallback to Terry pushing from his terminal.
10. **TopBar `userEmail` resolves at layout (server-side).** Changes per session — Demo badge state should not be cached client-side.
11. **iris-300 alpha tokens were swept** (`--accent-soft`, `--accent-border`, `--accent-glow`, `--info-soft`). If any component hardcodes `rgba(168,125,254, …)` it's stale — grep verified zero hits in tsx/ts, but check stylesheet-adjacent files (CSS Modules, vendored libs).
12. **No tests written this session.** TDD skill loaded but the work was: CSS palette swap (no logic), markdown docs (no code), single-line UI edits + new DemoBadge component (trivial UI primitive). Per TDD skill exceptions: configuration files OK without tests. If THS-73 + later add real logic (Score Math derivation, Today's Thesis composition), TDD reactivates.

## 12 · Next-session pickup point

1. Run §7.1 verification (4 commands, <60s).
2. Confirm Terry applied e80 migration (ask: "have you applied the e80 migration in Supabase Studio yet?").
3. If yes → finish THS-71 (2 UI surfaces) AND/OR move to THS-86 (Compliance language audit, Urgent + legal floor). Recommended start: **THS-86** (smallest unblocked Urgent — code grep + word-list doc + footer disclosure component; gates marketing landing).
4. If no → start **THS-86** anyway (independent of migration) OR **THS-73 Engine visibility** (signature pattern #2 — sitewide Engine-Status metadata strip + Score Math drawer + Live/Stubbed honesty on Universe). Larger build but highest leverage for "monetization-ready credibility."
5. Delete duplicate THS-87 in Linear (cosmetic cleanup).
