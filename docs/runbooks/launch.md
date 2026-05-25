# Launch Runbook — Mom + Dad onboarding

**Owner:** Terry. Run from your Mac. All commands below are Mac-side — Claude Code on web cannot reach the Supabase CLI or Vercel CLI.

**Goal:** Bring `https://ai-thesis-v2.vercel.app` to "fully functioning" — auth works for 3 users, daily-batch produces real data, sell-flow shipped, app is live.

**Estimated time:** ~45 minutes if everything goes clean. Add 10 minutes for first-run troubleshooting.

**Dependencies:**
- Supabase CLI installed (`brew install supabase/tap/supabase`)
- Vercel CLI installed (`npm i -g vercel`)
- You're logged into both (`supabase login`, `vercel login`)
- Working directory: wherever your local clone of `ai-thesis` lives

**What's already done (S31 code session):**
- ✅ `/login` page rewritten to email+password (no magic-link dependency)
- ✅ Sell flow shipped (THS-103) — schema migration + UI + realized P&L math
- ✅ All 22 edge functions written + 17 pg_cron schedules in migrations
- ✅ public.users auto-sync trigger live (Mom + Dad already mirrored)

**What's pending — this runbook:**
- ⏳ Apply THS-103 migration to live DB
- ⏳ Set 4 edge-function secrets + verify functions deployed
- ⏳ Fire daily-batch manually + verify writes
- ⏳ Re-link Vercel to ai-thesis-v2 + redeploy
- ⏳ Set passwords for all 3 users
- ⏳ Smoke test as Mom + Dad

---

## Step 0 — Pre-flight

```bash
# Confirm you're on main and pulled
git checkout main
git pull origin main

# Confirm both CLIs auth'd
supabase projects list           # should show ai-thesis-v2
vercel whoami                    # should show your handle

# Confirm Supabase project linked (if not, link it)
supabase link --project-ref <your-project-ref>
```

If `supabase link` errors, your project-ref is on Supabase Dashboard → Settings → General → "Reference ID".

---

## Step 1 — Apply THS-103 migration

```bash
cd supabase
supabase db push
```

Expected: prints applied migration `20260525000000_ths_103_sell_flow`. If it says "already applied" that's fine.

Verify in Studio (SQL Editor):
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'portfolio_positions'
  AND column_name IN ('exit_price','realized_pl','realized_proceeds','original_shares')
ORDER BY column_name;
```
Should return 4 rows.

---

## Step 2 — Set the 4 edge function secrets

You need these API keys ready. **DO NOT PASTE THEM HERE.**

| Secret | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | https://console.anthropic.com/settings/keys |
| `FMP_API_KEY` | https://site.financialmodelingprep.com/developer/docs/dashboard |
| `POLYGON_API_KEY` | https://polygon.io/dashboard/api-keys |
| `CRON_INVOKE_SECRET` | Generate fresh: `openssl rand -hex 32` |

```bash
# Copy the openssl output for the next two steps — same value goes BOTH places
CRON_SECRET=$(openssl rand -hex 32)
echo "CRON_INVOKE_SECRET=$CRON_SECRET  ← save this"

# Set edge function secrets (replace placeholders)
supabase secrets set \
  ANTHROPIC_API_KEY="sk-ant-XXXX" \
  FMP_API_KEY="XXXX" \
  POLYGON_API_KEY="XXXX" \
  CRON_INVOKE_SECRET="$CRON_SECRET"

# Verify all 4 are set
supabase secrets list
```

Then put the same `CRON_INVOKE_SECRET` into the Postgres vault so pg_cron jobs can read it. In Studio SQL Editor:

```sql
-- One-time setup if not already done
SELECT vault.create_secret('PASTE_CRON_SECRET_HERE', 'cron_invoke_secret');
SELECT vault.create_secret('https://YOUR-PROJECT.supabase.co', 'project_url');
SELECT vault.create_secret('YOUR_SERVICE_ROLE_JWT', 'service_role_key');

-- Verify all 3 vault entries exist
SELECT name FROM vault.decrypted_secrets
WHERE name IN ('cron_invoke_secret','project_url','service_role_key');
```

Service role JWT: Studio → Settings → API → `service_role` (eyJ…).

**If the vault entries already exist** (likely — this is your second time through), skip the create_secret lines; the matching name on existing entries blocks duplicates. To rotate `cron_invoke_secret` to match the fresh openssl-generated value, use `UPDATE vault.secrets SET secret = '<new-value>' WHERE name = 'cron_invoke_secret';` — but only if you actually rotated the edge function secret to match.

---

## Step 3 — Deploy all 22 edge functions

```bash
# From repo root
cd supabase

# List currently deployed
supabase functions list

# Deploy all functions in one shot (re-deploys are idempotent)
for fn in ingest-prices ingest-fundamentals ingest-consensus ingest-macro \
          ingest-short-interest ingest-form4 ingest-options \
          compute-q-scores compute-g-scores compute-v-scores compute-m-scores \
          compute-s-scores compute-aiq-scores compute-composite-scores \
          compute-concentration compute-daily-memo compute-weekly-ranking \
          compute-quarterly-review generate-aiq-draft run-backtest; do
  echo "=== Deploying $fn ==="
  supabase functions deploy $fn || echo "FAILED: $fn"
done

# Verify all show DEPLOYED
supabase functions list
```

Expected: 20 functions deployed. (`_shared` and `README.md` aren't deployable.)

---

## Step 4 — Fire daily-batch manually & verify writes

Pick a small, fast one first to confirm secrets are wired right:

```bash
# Invoke ingest-macro (~10s to run)
curl -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/ingest-macro" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: HTTP 200 + JSON body with row counts. If 401, the `CRON_INVOKE_SECRET` env var on the function doesn't match `$CRON_SECRET`. If 500, check function logs:
```bash
supabase functions logs ingest-macro --tail
```

If macro works, do the rest of the daily chain:

```bash
for fn in ingest-prices ingest-fundamentals ingest-consensus \
          compute-q-scores compute-g-scores compute-v-scores compute-m-scores \
          compute-s-scores compute-aiq-scores compute-composite-scores; do
  echo "=== $fn ==="
  curl -s -X POST "https://YOUR-PROJECT.supabase.co/functions/v1/$fn" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -d '{}' | head -1
  echo ""
done
```

Verify in Studio SQL Editor:
```sql
SELECT 'macro_state' AS t, COUNT(*) FROM macro_state WHERE as_of = CURRENT_DATE
UNION ALL SELECT 'prices_raw_today', COUNT(*) FROM prices_raw WHERE date = CURRENT_DATE
UNION ALL SELECT 'scores_history_today', COUNT(*) FROM scores_history WHERE as_of = CURRENT_DATE;
```

Expected: nonzero counts in all three.

---

## Step 5 — Re-link Vercel to the right project & deploy

This is **THS-107**. Your Mac is currently linked to project `ai-thesis` (the 404'ing one); needs to be `ai-thesis-v2`.

```bash
cd /path/to/ai-thesis    # repo root
cd web                   # Next app dir

# Clear current link
rm -rf .vercel

# Re-link, picking ai-thesis-v2 this time
vercel link
# When prompted:
#   - Set up “web”? → Y
#   - Which scope? → your personal account (or the team that owns ai-thesis-v2)
#   - Link to existing project? → Y
#   - Project name? → ai-thesis-v2

# Deploy to production
vercel --prod

# Output should show: https://ai-thesis-v2-XXXX.vercel.app and "Aliased to ai-thesis-v2.vercel.app"
```

Verify in browser:
- `https://ai-thesis-v2.vercel.app/login` → password form (NOT magic link)
- `https://ai-thesis-v2.vercel.app/` → sidebar has "Learn" item

If `ai-thesis-v2.vercel.app` still 404s, the project's domain alias isn't auto-promoted. Run:
```bash
vercel alias set <deployment-url> ai-thesis-v2.vercel.app
```

Optional cleanup: once verified, delete the unused `ai-thesis` project in the Vercel dashboard so nobody re-deploys to it.

---

## Step 6 — Set passwords for all 3 users

Since we dropped magic links (S31 — sbcglobal delivery was unreliable), every account needs a password set. Easiest path: Supabase Studio Auth → Users → click each user → "Send password recovery" — but this still needs email delivery. **More reliable for Mom: set the password directly via admin API.**

```bash
SUPABASE_URL="https://YOUR-PROJECT.supabase.co"
SERVICE_KEY="<your service_role JWT>"

# Get each user's UID
curl -s "$SUPABASE_URL/auth/v1/admin/users?per_page=20" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" | jq '.users[] | {email, id}'

# Set password for Mom (replace UID + chosen password)
curl -X PUT "$SUPABASE_URL/auth/v1/admin/users/<MOM-UID>" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"<mom-temp-password>","email_confirm":true}'

# Repeat for Dad
curl -X PUT "$SUPABASE_URL/auth/v1/admin/users/<DAD-UID>" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"password":"<dad-temp-password>","email_confirm":true}'
```

`email_confirm: true` marks the email as verified so they can sign in immediately without clicking a verification link (which would need email delivery again).

Pick passwords they can actually remember and type. Suggestion: `<firstname><last4-of-phone>` or similar. Mention they can change it later (when forgot-password is wired — currently no UI for this, so they'd ask you).

Email each parent (manually) with:
> Sign in at https://ai-thesis-v2.vercel.app
> Email: `<their email>`
> Password: `<the password you set>`

---

## Step 7 — RLS smoke test (THS-105)

Open three browser tabs (or one browser + two incognito):

1. **Terry tab:** sign in as `terry@zero-in.io`. Add a position: NVDA 5 shares @ $400. Verify it appears at `/portfolio`.
2. **Mom tab:** sign in as `at-turner@sbcglobal.net`. Go to `/portfolio` — should show **empty book** (NOT Terry's NVDA). Add NVDA 2 shares @ $410.
3. **Dad tab:** sign in as `terryturner@gmail.com`. Go to `/portfolio` — should show **empty book** (NOT Terry's, NOT Mom's). Add NVDA 1 share @ $395.

In Studio SQL Editor (bypass RLS to see all 3):
```sql
SELECT u.email, p.ticker, p.shares, p.cost_basis
FROM portfolio_positions p
JOIN auth.users u ON u.id = p.user_id
WHERE p.ticker = 'NVDA'
ORDER BY u.email;
```

Expected: 3 rows, 3 emails, 3 share counts — each user only sees their own row in-app.

**Sell-flow smoke (do this once as Terry):**
1. Click `sell` on the NVDA row → drawer opens with 5 shares + current mark prefilled
2. Reduce to 2 shares, set exit price $450 → preview shows "+$250 realized"
3. Submit → success banner → table shows 3 remaining + "realized +$250" subline under ticker
4. Click `sell` again → sell remaining 3 @ $380 → preview shows "−$60 realized"
5. Submit → NVDA row disappears from open table; closed-positions section shows NVDA with realized +$190
6. AggregateBar Col 2 shows "+$190" green

---

## Step 8 — Enable cron schedules (final)

The pg_cron schedules are defined in migrations but might be paused. Verify they're active:

```sql
SELECT jobname, schedule, active
FROM cron.job
WHERE jobname LIKE '%-cron' OR jobname LIKE 'ingest-%' OR jobname LIKE 'compute-%'
ORDER BY schedule;
```

All 17 should show `active = true`. If any are false:
```sql
UPDATE cron.job SET active = true WHERE jobname = '<name>';
```

Set a calendar reminder for tomorrow morning (after the 22:15 ET fire) to check `scores_history WHERE as_of = CURRENT_DATE` — that's the proof the daily cron landed without manual intervention.

---

## What's NOT in this runbook (out of scope)

- **Forgot-password UI** — Terry resets via admin API for now. Wire up if Mom/Dad lock themselves out > 2x.
- **Email-based password recovery** — would need SMTP (Resend, SendGrid). Skipped per S31 directive.
- **2FA** — closed system, low risk, deferred.
- **User self-signup** — closed system, accounts only created by Terry via admin API.

---

## Done state

- `https://ai-thesis-v2.vercel.app/login` loads, password form works for all 3 users
- `/portfolio` shows isolated books per user; sell flow + realized P&L visible
- Tomorrow's `scores_history WHERE as_of = CURRENT_DATE` returns rows (real cron fired)
- THS-103, 104, 105, 107 all close → personal-tool v1 epic (THS-92) closes
