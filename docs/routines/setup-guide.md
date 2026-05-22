# Routine Setup Guide

Step-by-step for getting the 4 AI Thesis routines running on claude.ai/code with the Supabase MCP connector writing to live production.

> **Run the DB-setup checklist first.** This guide assumes the live Supabase
> project is already migrated, users exist, RLS is per-user, and env/secrets
> are wired. That work is covered click-by-click in
> `docs/setup/2026-05-21-supabase-setup-checklist.md`. Finish Steps 1-5 of
> that checklist before starting Step 1 below.

**Prerequisite checklist:**
- [ ] Migration `20260518000200_e80_routines_pr1.sql` has been applied to live Supabase (THS-71 task 1). Verified per `docs/setup/2026-05-21-supabase-setup-checklist.md` Step 1.
- [ ] You've signed in at least once at https://ai-thesis-v2.vercel.app/login (creates your auth.users row).
- [ ] You have your Supabase project's **service_role** key handy (Supabase Studio → Settings → API → `service_role`, NOT `anon`).
- [ ] You're on a Claude Max plan (Routines require Max, not pay-per-token API).

Reference: 15 fires/day cap is per **Anthropic account**, not per routine. The 4 v1 routines together use ~3 weekday fires + 1 Saturday + 1 monthly-Saturday ≈ 65 fires/month, well under the cap.

---

## Step 1 — Create the Supabase MCP connector

This is the connector each routine will use to read/write the AI Thesis DB.

1. Open https://claude.ai/code
2. Settings (gear icon, bottom-left) → **MCP Servers** → **Add Server**
3. Pick **Supabase** from the catalog
4. Configure:
   - **Name:** `ai-thesis-supabase`
   - **Project reference:** your Supabase project's ref (e.g., `xnxw9abc123...`)
   - **Access token:** paste the **service_role** key (starts with `sbp_v0_` or `eyJhbGc...`)
   - **Read-only:** OFF (routines need write access)
5. Save. Verify connection: in any Claude Code session, run "list tables in ai-thesis-supabase" — should show 30+ tables.

⚠️ **service_role bypasses RLS.** Routines will write to per-user tables (position_pulse) on Terry's behalf. The user_id is sourced from portfolio_positions.user_id, which routines read first. Don't share this MCP config with users who shouldn't have full DB write.

---

## Step 2 — Create each routine on claude.ai/code

For each of the 4 routine files (`01-daily-batch.md`, `02-weekly-rescore.md`, `03-monthly-curator.md`, `04-position-pulse.md`), do this:

1. Open https://claude.ai/code → **Routines** tab → **New Routine**
2. **Name:** mirror the file name (e.g., `daily-batch`, `weekly-rescore`, `monthly-curator`, `position-pulse`)
3. **System prompt:** paste the content from the routine file's "System prompt" code block.
4. **User message:** paste the content from the routine file's "User message" code block.
5. **MCP servers:** check `ai-thesis-supabase` (the one you created in Step 1)
6. **Other MCP servers if needed:**
   - `01-daily-batch`: add WebFetch (for SEC EDGAR access during AIQ scoring)
   - `03-monthly-curator`: add WebFetch (for sector/peer research)
   - `02-weekly-rescore`, `04-position-pulse`: Supabase only
7. **Schedule:**
   - `daily-batch`: cron `30 11 * * 1-5` (06:30 CT = 11:30 UTC, weekdays only). CT shifts to 12:30 UTC in CDT.
   - `weekly-rescore`: cron `0 11 * * 6` (06:00 CT Saturday).
   - `monthly-curator`: cron `0 14 1-7 * 6` (09:00 CT first Saturday — 7-day window with Saturday-of-week filter).
   - `position-pulse`: cron `0 12 * * 1-5` (07:00 CT weekdays).
8. **Save**.

⚠️ Schedule timing matters for cap math. Daily-batch + position-pulse weekday fires = 2/day. Weekly-rescore = 1/week. Monthly-curator = 1/month. Total: ~10 fires/week, ~3 fires/typical-weekday. Stays under 15/day cap with 12 fires/day headroom.

---

## Step 3 — Verify first fire (one-at-a-time)

Don't enable all 4 at once on day 1. Stagger:

### Day 1 — Fire `daily-batch` manually

1. On claude.ai/code → Routines → `daily-batch` → **Fire Now**
2. Watch the session: it should connect to Supabase MCP, run 3 tasks (insider digest → macro state → AIQ draft queue), report back with table writes. Drift detection → `memo_proposals` is NOT part of daily-batch — that work moved to weekly-rescore on 2026-05-21.
3. After completion, run verification in Supabase Studio → SQL Editor:
   ```sql
   SELECT 'insider_summary' AS table, COUNT(*) FROM insider_summary WHERE as_of = CURRENT_DATE
   UNION ALL SELECT 'macro_log', COUNT(*) FROM macro_log WHERE as_of = CURRENT_DATE
   UNION ALL SELECT 'aiq_drafts_today', COUNT(*) FROM aiq_drafts WHERE created_at::date = CURRENT_DATE;
   ```
4. Expected: insider_summary=1, macro_log=1, aiq_drafts_today ≤ 5.
5. Open https://ai-thesis-v2.vercel.app/ and verify the Morning Brief dashboard module lights up with the new insider + macro data.

If anything fails:
- Check the routine's session transcript for the error
- Verify service_role key has not expired
- Run the failing query manually in Studio to see the exact PG error
- Common: missing table → migration didn't fully apply

### Day 2 — Fire `position-pulse` manually

1. Verify daily-batch fired automatically that morning (check macro_log for today's date).
2. Fire position-pulse manually.
3. Verify:
   ```sql
   SELECT verdict, COUNT(*) FROM position_pulse WHERE as_of = CURRENT_DATE GROUP BY verdict;
   ```
4. Expected: rows per held position. If any are `broken`, they should surface in /decisions.

### Day 7 — Fire `weekly-rescore` manually

On the first Saturday after setup. Weekly-rescore runs 4 tasks: rescore all 50 tickers → top movers → drift detection → weekly narrative. It is the **only** routine that writes `memo_proposals` (writer moved here from daily-batch on 2026-05-21 — `scores_history` only updates Saturdays so daily drift polling wrote no useful rows).

Verify:

```sql
SELECT 'scores_history' AS table_name, COUNT(*) FROM scores_history WHERE as_of = CURRENT_DATE
UNION ALL SELECT 'weekly_summary', COUNT(*) FROM weekly_summary WHERE week_of = CURRENT_DATE
UNION ALL SELECT 'memo_proposals_today', COUNT(*) FROM memo_proposals WHERE created_at::date = CURRENT_DATE;
```

Expected: `scores_history ≈ 50` (1 per active ticker), `weekly_summary = 1`, `memo_proposals_today` variable (drift-triggered — 0 is valid on a quiet week). After the fire, memo_proposals with `status='pending'` should surface in the app's `/memos` page.

### Day 30 — Fire `monthly-curator` manually

On the first Saturday of the next month. Verify universe_proposals gets 1 new row with pending status.

---

## Step 4 — Enable schedules

Once all 4 routines fire successfully manually:

1. For each routine, toggle **Enable Schedule** → ON.
2. Confirm next-run timestamp shows in the routine card.
3. Set up a calendar reminder for week+1 to check that automated fires landed (Supabase Studio → check today's row counts).

---

## Step 5 — Monitor cap usage

claude.ai/code → Account → Usage shows daily fire count. Expected weekday cadence:
- Mon-Fri: 2 fires/day (daily-batch + position-pulse) = 10 fires/week
- Saturday: 1-2 fires (weekly-rescore + occasional monthly-curator)
- Sunday: 0 fires

Average: ~12 fires/week, ~1.7 fires/day. **Plenty of headroom** for the eventual 5th routine (earnings-batch, v1.1) and any manual fires for debugging.

---

## Troubleshooting

### "MCP server unreachable"

- Verify service_role key is current (Supabase rotates keys when project is paused/restored)
- Try the connector test in claude.ai/code → MCP Servers → ai-thesis-supabase → Test

### "Permission denied for table X"

- The new tables created by E80 migration have RLS enabled with explicit policies
- service_role should bypass RLS by default
- If it doesn't: the table needs `GRANT SELECT, INSERT, UPDATE, DELETE ON public.<table> TO service_role` (already in migration, but verify)

### "Routine timed out"

- Default routine timeout is 30 min
- weekly-rescore can take 8-12 min for 50 tickers + narrative
- monthly-curator with WebFetch can take 10-15 min
- If timeouts persist: split the routine (rare — current spec stays well under 30 min)

### "Daily-batch fired but no UI surface lit up"

- Check that the e80 migration actually created the tables: `\d insider_summary` in Studio
- Check the app's lib helpers (`web/src/lib/routine-outputs.ts`) point at the right tables (already wired in S4)
- Hard-refresh the dashboard (cache may be stale)

---

## Future: v1.1 earnings-batch

Once earnings_calendar ingestion lands (FMP `/earning_calendar` daily cron, separate ticket), add:
- `05-earnings-batch.md` routine
- Fires on earnings days only
- Reads earnings_calendar for "today's reports", pulls actual vs consensus, writes earnings_outcomes table, drafts earnings-driven memo_proposals for tier movers

Defer until earnings_calendar table exists.

---

## Reference

- Routine output schemas: `supabase/migrations/20260518000200_e80_routines_pr1.sql`
- Engine spec: `docs/AI-Thesis-v2-Algorithm-and-Deployment.md`
- Compliance language: `docs/compliance/language-discipline.md` (when shipped — THS-86)
- S4 handoff: `docs/handoffs/2026-05-18-S4-iris-voltage-and-routines-pr1-partial.md`
