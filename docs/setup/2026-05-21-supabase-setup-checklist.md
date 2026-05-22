# Supabase Setup Checklist — 2026-05-21

Paste-ready package for finishing the AI Thesis v2 Supabase setup from Studio's SQL Editor + the Supabase Studio web UI. This is the doc you (Terry) run **tonight** to unblock all the MCP-gated tasks: routine fires, per-user portfolios for you / Mom / Dad, and the Vercel env wiring.

This is a **complement** to `docs/routines/setup-guide.md`, not a replacement. That guide covers the click-by-click for creating the 4 claude.ai/code routines after the DB is ready. This one gets the DB ready.

---

## Goal

Bring the live Supabase project from "migrations applied" to "production-ready for 3 users (Terry + Mom + Dad), 4 routines, and the Vercel deploy." Every step is paste-ready: SQL goes into Supabase Studio → SQL Editor; UI steps cite the exact menu path. By the end of this checklist, all MCP-gated work (routine fires, per-user RLS, Vercel deploy, claude.ai/code Supabase connector) is unblocked.

The personal-tool pivot (3 users — Terry, Mom, Dad — each with private portfolios, shared research / scoring / memos) is encoded by migration `20260518000200_e80_routines_pr1.sql`. That migration converts `portfolio_positions` and `portfolio_settings` from single-tenant to multi-tenant with `auth.uid() = user_id` RLS, and creates the routine output tables. **As of 2026-05-22, this migration has NOT yet been applied to prod** (`mvxgnliwvoauwwarrlrr`) — Step 1 below will detect and push it. The work below is migration apply → verify → create the 2 additional users → wire env → wire routines.

---

## Prerequisites

- [ ] Supabase project exists with the `optimize-claude/ai-thesis` (or equivalent) ref
- [ ] You have admin access to Supabase Studio for that project
- [ ] You have signed in **at least once** at `https://ai-thesis-v2.vercel.app/login` using `terry@zero-in.io` — this creates your `auth.users` row, which migration `20260518000200_e80_routines_pr1.sql` requires to backfill ownership of `portfolio_settings` / `portfolio_positions` / `alert_acks`
- [ ] You have the `service_role` key from Studio → Settings → API on hand (you'll need it for the Supabase MCP connector and for Edge Function secrets)
- [ ] You're on a Claude Max plan (routines require Max, not pay-per-token)

---

## Step 1 — Verify migrations are applied

> **2026-05-22 state confirmed via MCP:** prod has 50 migrations applied, latest = `20260517000100_e44_aiq_rubric_sources_jsonb`. **Two migrations on disk are NOT yet applied:** `20260518000100_e25_aiq_scores_cron` and `20260518000200_e80_routines_pr1`. You will need the `supabase db push` step below.

Open Supabase Studio → SQL Editor → New query. Paste and run:

```sql
SELECT name FROM supabase_migrations.schema_migrations ORDER BY name;
```

You should see all of these (54 rows total, the most recent dated 2026-05-18):

```
20260515000000_e11_init_core_tables
20260515000100_e12_overlay_tables
20260515000200_e13_seed_universe
20260515000300_e14_fundamentals_cron
20260515000400_e15_consensus_cron
20260515000500_e16_universe_kind_and_spy
20260515000600_e16_momentum_view
20260515000700_e16_refresh_rpc
20260515000800_e16_prices_cron
20260515000900_e13_reclassify_anet_l1
20260515001000_e21_extend_fundamentals_for_qmj
20260515001100_e21_q_scores_cron
20260515001200_e22_ai_segment_overrides
20260515001300_e22_seed_ai_segment_overrides
20260515001400_e22_extend_fundamentals_rd
20260515001500_e22_upsert_factor_score_rpc
20260515001600_e22_g_scores_cron
20260515001700_e23_extend_fundamentals_dna
20260515001800_e23_forward_pe_history_view
20260515001900_e23_refresh_forward_pe_rpc
20260515002000_e23_seed_depreciation_flags
20260515002100_e23_v_scores_cron
20260515002200_e25_macro_gauges
20260515002300_e25_upsert_composite_rpc
20260515002400_e25_composite_cron
20260515002500_e34_macro_ingest_cron
20260516000000_e31_aiq_rubric_seed
20260516000100_e44_aiq_rubric_extend
20260516000200_e45_portfolio_positions
20260516000300_e47_alert_acks
20260516000400_e51_m_scores_cron
20260516000500_e53_short_interest
20260516000600_e53_short_interest_cron
20260516000700_e54_insider_form4
20260516000800_e54_form4_cron
20260516000900_e55_s_scores_cron
20260516001000_e61_concentration
20260516001100_e61_concentration_cron
20260516001200_e65_quarterly_reviews
20260516001300_e65_quarterly_review_cron
20260516001400_e62_backtest_runs
20260516001500_e35_vix_macro_kind
20260516001600_e52_options_raw
20260516001700_e52_options_cron
20260516001800_e63_memos
20260516001900_e63_daily_memo_cron
20260516002000_e64_weekly_ranking_cron
20260516002100_e32_aiq_drafts
20260517000000_e24_extend_depreciation_flags
20260517000100_e44_aiq_rubric_sources_jsonb
20260518000100_e25_aiq_scores_cron
20260518000200_e80_routines_pr1
```

The critical one is `20260518000200_e80_routines_pr1` — that's the multi-user pivot + routine output tables (`users`, `aiq_draft_queue`, `weekly_summary`, `insider_summary`, `macro_log`, `memo_proposals`, `universe_proposals`). If it's missing, push from local:

```bash
# From your Mac in /Users/terryturner/Hub/ai-thesis (or wherever the repo lives)
cd /Users/terryturner/Hub/ai-thesis
supabase link --project-ref YOUR-PROJECT-REF   # one-time, if not linked
supabase db push
```

Then re-run the SELECT above. Migration count should now match.

---

## Step 2 — Create the 3 user accounts

Each user gets their own login + private portfolio. Research/scoring/memos are shared (everyone reads the same `universe`, `scores_history`, `aiq_drafts`, `memos`, `macro_log`, `regime` rows).

### 2a — Confirm Terry's account already exists

Migration `20260518000200_e80_routines_pr1.sql` requires Terry's `auth.users` row to exist. Confirm:

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email = 'terry@zero-in.io';
```

Expected: exactly 1 row. If 0 rows, you skipped the prerequisite — sign in at `https://ai-thesis-v2.vercel.app/login` first, then re-run the migration (`supabase db push`).

### 2b — Create Mom + Dad in Supabase Studio

Studio path: **Authentication → Users → Add user → Create new user**.

- **Auto-confirm user:** ON (skips email verification — fine for a 3-person personal tool)
- Suggested credentials (replace with the actual emails you want them to use):

| Role | Email | Password |
|---|---|---|
| Mom | `at-turner@sbcglobal.net` (already in auth.users as of 2026-05-22 — confirmed but never signed in; she can magic-link from /login) | n/a, magic-link only |
| Dad | `terryturner@gmail.com` (NOT yet in auth.users — add via Studio) | strong random, share via 1Password / Signal |

Click **Create user** for each. They appear in `auth.users` immediately.

### 2c — Get the resulting auth.users.id UUIDs

Paste into SQL Editor:

```sql
SELECT id, email, created_at
FROM auth.users
WHERE email IN (
  'terry@zero-in.io',
  'at-turner@sbcglobal.net',
  'terryturner@gmail.com'
)
ORDER BY created_at;
```

Save the 3 UUIDs somewhere — you'll need them for Step 3 verification and any backfill SQL.

### 2d — Backfill public.users for Mom and Dad

Migration e80 only auto-backfilled Terry. Mom + Dad need their own `public.users` rows (tier defaults to `'free'`, which is correct):

```sql
INSERT INTO public.users (id, email, subscription_tier)
SELECT id, email, 'free'
FROM auth.users
WHERE email IN (
  'at-turner@sbcglobal.net',
  'terryturner@gmail.com'
)
ON CONFLICT (id) DO NOTHING;
```

Verify:

```sql
SELECT id, email, subscription_tier, created_at
FROM public.users
ORDER BY created_at;
```

Expected: 3 rows. Terry = `'owner'`. Mom + Dad = `'free'`.

### 2e — Seed default portfolio_settings for Mom and Dad

Each user gets one `portfolio_settings` row (the previously-singleton table is now per-user, PK = `user_id`). Terry's row was migrated by e80. Add Mom and Dad:

```sql
INSERT INTO public.portfolio_settings (user_id, total_capital, target_reserve)
SELECT id, 100000, 20000
FROM auth.users
WHERE email IN (
  'at-turner@sbcglobal.net',
  'terryturner@gmail.com'
)
ON CONFLICT (user_id) DO NOTHING;
```

Adjust `total_capital` / `target_reserve` per user later via the app (or directly here) — the defaults match Terry's original singleton seed of $100K total / $20K reserve.

Verify:

```sql
SELECT u.email, ps.total_capital, ps.target_reserve, ps.updated_at
FROM public.portfolio_settings ps
JOIN auth.users u ON u.id = ps.user_id
ORDER BY u.created_at;
```

Expected: 3 rows.

---

## Step 3 — Verify per-user RLS on portfolio_positions

The e80 migration changed `portfolio_positions` from `WHERE auth.uid() IS NOT NULL` (any logged-in user sees everything) to `WHERE auth.uid() = user_id` (each user only sees their own positions). Verify:

```sql
SELECT polname, polcmd, polqual, polwithcheck
FROM pg_policy
WHERE polrelid = 'public.portfolio_positions'::regclass;
```

Expected: one row, `polname = 'portfolio_positions_self_all'`, `polcmd = '*'` (ALL), `polqual` containing `(auth.uid() = user_id)`.

If that row is missing or still says `auth.uid() IS NOT NULL`, the e80 migration didn't fully apply. Fix with the paste-ready policy refresh below (matches e80 exactly):

```sql
-- Idempotent reset of the portfolio_positions policy to per-user scoping.
DROP POLICY IF EXISTS portfolio_positions_authenticated_all ON public.portfolio_positions;
DROP POLICY IF EXISTS portfolio_positions_self_all          ON public.portfolio_positions;

CREATE POLICY portfolio_positions_self_all ON public.portfolio_positions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

Also confirm `portfolio_settings` is scoped the same way:

```sql
SELECT polname, polqual
FROM pg_policy
WHERE polrelid = 'public.portfolio_settings'::regclass;
```

Expected: `polname = 'portfolio_settings_self_all'`, `polqual` contains `(auth.uid() = user_id)`. If missing:

```sql
DROP POLICY IF EXISTS portfolio_settings_authenticated_all ON public.portfolio_settings;
DROP POLICY IF EXISTS portfolio_settings_self_all          ON public.portfolio_settings;

CREATE POLICY portfolio_settings_self_all ON public.portfolio_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### 3a — Confirm shared tables stay open to anon SELECT

Universe / scores / memos / regime should be readable by anyone signed in (or by anon if that's how the existing policies are set). Spot-check:

```sql
SELECT c.relname AS table_name,
       p.polname,
       p.polcmd,
       p.polqual
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
WHERE c.relname IN (
  'universe',
  'scores_history',
  'aiq_drafts',
  'memos',
  'macro_log',
  'regime'
)
ORDER BY c.relname, p.polname;
```

For each, you should see at least one `SELECT` (or `ALL`) policy that does NOT scope to `auth.uid()` — these are research outputs and need to be readable by all 3 users (and anon for the public marketing surface, if applicable). If any of them is locked to `auth.uid() = user_id` by mistake, raise it before flipping routines on.

### 3b — Live smoke test: simulate Mom's session

```sql
-- Simulate Mom's JWT for one statement
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<MOM-UUID-FROM-STEP-2C>","role":"authenticated"}';

SELECT user_id, ticker, shares
FROM public.portfolio_positions;
-- Expected: 0 rows (Mom hasn't added any positions yet)

RESET ROLE;
RESET request.jwt.claims;
```

If Terry's positions leak into Mom's session, the RLS is wrong — re-run the `CREATE POLICY` block in Step 3 and re-test.

---

## Step 4 — Populate env vars in Vercel + Edge Function secrets

There are 8 secrets total. The 2 `NEXT_PUBLIC_*` vars go in Vercel; the other 6 go in Supabase Edge Function secrets (the Next.js app never reads them).

### 4a — Vercel (Project Settings → Environment Variables)

Set both to **Production, Preview, Development** (3 env scopes each):

| Variable | Source | Where |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Studio → Settings → API → "Project URL" | Vercel → Project → Settings → Environment Variables |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Studio → Settings → API → `anon` / `public` key | Vercel → Project → Settings → Environment Variables |

After adding, hit **Save**, then trigger a redeploy (Deployments tab → latest → ⋯ → Redeploy) so the new env vars take effect.

### 4b — Supabase Edge Function secrets (Studio → Project Settings → Edge Functions → Secrets)

These are server-side / cron-job secrets. The Next.js app never imports them; only Edge Functions and scheduled jobs do. Add each via **Add new secret**:

| Variable | Source | Notes |
|---|---|---|
| `SUPABASE_URL` | Same value as `NEXT_PUBLIC_SUPABASE_URL` | Edge runtime needs its own copy (env namespace is separate) |
| `SUPABASE_SERVICE_ROLE_KEY` | Studio → Settings → API → `service_role` key | **Never** ship to browser. Bypasses RLS. |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com → API Keys | Used by AIQ + memo edge functions. Distinct from your Claude Max account (which powers routines). |
| `FMP_API_KEY` | https://site.financialmodelingprep.com → Dashboard | Fundamentals + prices ingestion crons |
| `POLYGON_API_KEY` | https://polygon.io → Dashboard | Backup price/options source |
| `CRON_INVOKE_SECRET` | Generate locally: `openssl rand -hex 32` | Arbitrary bearer token to authenticate scheduled job invocations |

Verification: in Studio → Edge Functions → Secrets, you should see 6 secrets listed. (Studio masks the values after save — that's expected.)

---

## Step 5 — Wire the Anthropic Supabase MCP connector to AI Thesis

The 4 routines on claude.ai/code talk to the AI Thesis DB via the Supabase MCP connector. Set it up on **the org that owns AI Thesis** — if your Anthropic account has multiple orgs (e.g., a personal default + a Basis org), make sure you're authorizing against the right one.

1. Go to **https://claude.ai → Settings → Connectors → Supabase**
2. If it shows "Connected to <other-org>", click **Disconnect**, then **Connect**
3. In the OAuth flow, select the **Anthropic organization that should own the routines** (the same org you'll create routines under)
4. Approve all requested scopes (read + write across all your Supabase projects)
5. Save

### 5a — How to verify the connector landed correctly

In any Claude Code session (web or CLI) with no special setup, paste:

```
List my Supabase projects via the Supabase MCP connector.
```

Expected: the AI Thesis project (project ref matching your Supabase Studio URL) appears in the list. If it doesn't, the connector is bound to the wrong org — repeat Step 5.

Also confirm write access works:

```
Using the Supabase MCP connector on the AI Thesis project, run:
SELECT count(*) FROM public.universe;
```

Expected: returns a numeric count (~50 for the v1 universe). If it errors with "no project selected", the routine will need an explicit project ref in its system prompt — bake it in there per `docs/routines/setup-guide.md` Step 1.

---

## Step 6 — Smoke-test one routine manually before scheduling

Don't enable schedules until you've fired one routine by hand and watched it write rows. Pick `daily-batch` because it touches 3 tables and shows the full write loop.

### 6a — Fire daily-batch manually (one-time)

Open **claude.ai/code → Routines tab → New Routine** and paste from `docs/routines/01-daily-batch.md`:

- **Name:** `daily-batch`
- **System prompt:** the block under "System prompt" in `01-daily-batch.md` (lines ~21-37)
- **User message:** the block under "User message" in `01-daily-batch.md` (lines ~41-77)
- **MCP servers:** check `ai-thesis-supabase` (the one you wired in Step 5), plus WebFetch
- **Schedule:** leave blank for now (don't enable)
- **Save** → then click **Fire Now**

Watch the session transcript:
- It should connect to the Supabase MCP
- Run 3 tasks (insider digest → macro state → AIQ draft queue, up to 5 tickers)
- Report back with row counts for each table

### 6b — Verify writes landed (run in Studio SQL Editor)

```sql
SELECT 'insider_summary' AS table_name, COUNT(*) AS rows_today
  FROM insider_summary WHERE as_of = CURRENT_DATE
UNION ALL
SELECT 'macro_log', COUNT(*)
  FROM macro_log WHERE as_of = CURRENT_DATE
UNION ALL
SELECT 'aiq_drafts_today', COUNT(*)
  FROM aiq_drafts WHERE created_at::date = CURRENT_DATE;
```

Expected after first fire:
- `insider_summary = 1`
- `macro_log = 1`
- `aiq_drafts_today ≤ 5` (depends on how many tickers were queued in `aiq_draft_queue` with status `'queued'`)

Also spot-check the narrative output uses research framing only:

```sql
SELECT as_of, regime_state, gates_hit, multiplier, narrative, delta_summary
FROM macro_log
WHERE as_of = CURRENT_DATE;
```

Read the narrative. It should describe a "score change", "tier transition", or "drift observed" — never say "buy", "sell", "recommend", or "you should". If the routine output violates the language floor, edit the system prompt before scheduling.

---

## Step 7 — Schedule the 4 routines on claude.ai/code

Once daily-batch fires cleanly and writes the expected rows, follow the click-by-click in `docs/routines/setup-guide.md` (Steps 2 → 5) to:

- Create the remaining 3 routines (`weekly-rescore`, `monthly-curator`, `position-pulse`) with their system prompts + user messages from `docs/routines/02-*.md`, `03-*.md`, `04-*.md`
- Set the cron schedules per the table in `setup-guide.md` Step 2 step 7
- Manually fire each one once before enabling its schedule (Step 3 in `setup-guide.md`)
- Toggle each routine's schedule ON only after a clean manual fire (Step 4 in `setup-guide.md`)

No need to duplicate the click-by-click here — `setup-guide.md` is current as of 2026-05-21 and covers it.

Cap math sanity check: weekday cadence will be `daily-batch + position-pulse = 2 fires/day`, `weekly-rescore = 1/week`, `monthly-curator = 1/month`. ~12 fires/week total. Cap is 15/day — plenty of headroom.

---

## Troubleshooting

### "MCP can't find the AI Thesis project" / "List projects shows nothing"

Connector is bound to the wrong Anthropic org, or the OAuth approval didn't grant the Supabase project scope.

Fix:
1. `https://claude.ai → Settings → Connectors → Supabase → Disconnect`
2. Reconnect, picking the org that owns AI Thesis at the org-picker step
3. In the OAuth scopes dialog, ensure **all projects** (or specifically the AI Thesis project) are selected — Supabase OAuth defaults to a single project, so easy to mis-scope
4. Re-test with "List my Supabase projects" (Step 5a)

### "Routine fired but no rows were written"

Almost always one of:

1. **service_role key missing or stale.** The routine wrote via the anon role, which RLS blocks on the write side of routine-output tables. Verify the MCP connector is using a key with write permission (Studio → Settings → API → `service_role`). Rotate if needed.
2. **RLS denying.** Routine-output tables (`insider_summary`, `macro_log`, `memo_proposals`, etc.) have policies; `service_role` bypasses RLS by default. If you're using a custom key or the anon key, the writes will silently fail. Re-paste the `service_role` key into the MCP connector config.
3. **Table missing.** The e80 migration didn't fully apply. Run Step 1's SELECT and confirm `20260518000200_e80_routines_pr1` is present.

Diagnostic query to see which tables the routine could write to:

```sql
SELECT n.nspname AS schema,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       has_table_privilege('service_role', c.oid, 'INSERT') AS service_can_insert
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('insider_summary','macro_log','aiq_drafts','memo_proposals','universe_proposals','weekly_summary','position_pulse')
ORDER BY c.relname;
```

Every row should have `service_can_insert = true`. If any are false, add the grant:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table_name> TO service_role;
```

### "/portfolio shows blank for Mom (or Dad) after they sign in"

The most common cause is that `portfolio_positions.user_id` constraint isn't being honored — either:

1. **Mom has no `public.users` row.** Step 2d's INSERT was skipped. Re-run it.
2. **Mom has no `portfolio_settings` row.** The /portfolio page reads settings to render the reserve / total-capital chrome. Step 2e's INSERT was skipped. Re-run it.
3. **Mom is signed in but `auth.uid()` is returning NULL** — usually a stale JWT. Have her sign out + back in.
4. **RLS is correct but `user_id` was NULL on insert.** If you (Terry) inserted a position via service_role without setting `user_id`, it lives on Terry's UUID by default (from e80 backfill). Mom won't see it — but she shouldn't see it. That's the system working.

Diagnostic:

```sql
SELECT u.email,
       (SELECT COUNT(*) FROM public.users WHERE id = u.id) AS public_users_row,
       (SELECT COUNT(*) FROM public.portfolio_settings WHERE user_id = u.id) AS settings_row,
       (SELECT COUNT(*) FROM public.portfolio_positions WHERE user_id = u.id) AS positions_count
FROM auth.users u
WHERE u.email IN (
  'terry@zero-in.io',
  'at-turner@sbcglobal.net',
  'terryturner@gmail.com'
)
ORDER BY u.created_at;
```

Expected for each user: `public_users_row = 1`, `settings_row = 1`, `positions_count` = however many positions they've added (0 for fresh accounts is correct).

### "Routine wrote rows but the language floor is violated (says 'buy' / 'sell' / 'recommend')"

Edit the routine's system prompt on claude.ai/code → Routines → `<routine-name>` → System prompt. Reinforce the compliance language floor from `docs/routines/README.md`:

> Use language like: "score change", "tier transition", "drift observed", "research note", "suggested review". Never: "buy", "sell", "deploy", "recommend", "you should", "model portfolio".

Then fire manually again and re-check the narrative columns. Don't enable the schedule until output is clean.

---

## Reference

- Multi-user pivot migration: `supabase/migrations/20260518000200_e80_routines_pr1.sql`
- Per-user portfolio schema: `supabase/migrations/20260516000200_e45_portfolio_positions.sql` (pre-pivot; e80 layers on top)
- Routine prompts: `docs/routines/01-daily-batch.md` through `04-position-pulse.md`
- Routine click-by-click: `docs/routines/setup-guide.md`
- Env var template: `web/.env.local.example`
- Compliance language floor: `docs/routines/README.md`
