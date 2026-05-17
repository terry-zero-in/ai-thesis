# Production Cutover Runbook

Step-by-step playbook to take AI Thesis v2 from a green `main` to a live, scheduled, single-tenant production system. Follow in order — later steps assume earlier ones succeeded.

**Time estimate:** 60–90 minutes hands-on (most of it waiting on backfills).

---

## 0. Prerequisites — gather before you start

You'll need accounts (free or paid) and API keys from:

| Service | Plan | Why | Where to sign up |
|---|---|---|---|
| Supabase | Pro ($25/mo) — needed for pg_cron + pg_net + edge functions on a paid project | Database + Auth + Edge Functions + cron | https://supabase.com |
| Vercel | Hobby (free) | Hosts the Next.js portal | https://vercel.com |
| FMP (Financial Modeling Prep) | Starter or higher | Fundamentals, prices, consensus, Form 4 | https://site.financialmodelingprep.com |
| Polygon.io | Starter ($79/mo) | Options surface signals | https://polygon.io |
| Anthropic | Pay-as-you-go | Daily memo (Sonnet 4.6) + weekly ranking (Opus 4.7) + AIQ drafts (Sonnet) | https://console.anthropic.com |

Keep a scratch file open. You'll paste these into Supabase + Vercel.

Also install locally if not already:

```bash
brew install supabase/tap/supabase   # mac
# or: npm install -g supabase
supabase --version                    # confirm ≥ 1.180
```

---

## 1. Provision Supabase

```bash
# From the AI Thesis repo root:
supabase login                              # opens browser
supabase projects create ai-thesis-v2 \
  --org-id YOUR-ORG-ID \
  --db-password 'STRONG-RANDOM'             # save this password
supabase link --project-ref YOUR-PROJECT-REF
```

`YOUR-PROJECT-REF` is the 20-char subdomain (visible in `supabase projects list`). Save it — you'll paste it into Vercel later.

In the Supabase dashboard → Project Settings → API, copy:
- **Project URL** (`https://YOUR-PROJECT-REF.supabase.co`)
- **anon public key**
- **service_role key** (treat like a password — server-side only, never commit)

Enable **pg_cron** and **pg_net** in Database → Extensions (toggle both on). Migrations will skip cron setup if these aren't enabled.

---

## 2. Apply migrations

```bash
supabase db push                            # applies all 49 forward migrations
```

If anything fails, the per-migration rollback lives at `supabase/migrations/rollback/`. Re-running `supabase db push` is safe — every migration is idempotent.

Verify in Dashboard → Table Editor: you should see ~25 tables (`universe`, `fundamentals_raw`, `scores_history`, `aiq_rubric`, etc.).

---

## 3. Set vault secrets (cron → function auth)

The Saturday scoring chain calls edge functions via `pg_net`, authenticated by a shared bearer token stored in Supabase Vault.

```bash
# Generate the cron secret (any strong random string):
openssl rand -hex 32                        # copy this output

# Then in Supabase Dashboard → SQL Editor:
SELECT vault.create_secret(
  'https://YOUR-PROJECT-REF.supabase.co',
  'project_url'
);
SELECT vault.create_secret(
  'PASTE-THE-OPENSSL-OUTPUT-HERE',
  'cron_invoke_secret'
);
```

These two vault entries are referenced by every cron job migration.

---

## 4. Set function secrets

```bash
supabase secrets set \
  FMP_API_KEY='your-fmp-key' \
  POLYGON_API_KEY='your-polygon-key' \
  ANTHROPIC_API_KEY='sk-ant-…' \
  CRON_INVOKE_SECRET='same-string-you-put-in-the-vault' \
  SEC_USER_AGENT='AI Thesis v2 your-email@example.com'
```

`SEC_USER_AGENT` must contain a real email per SEC EDGAR ToS (any unique string with an email works; they don't validate, but they will rate-limit + block bad actors).

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-provided by Supabase to edge functions — don't set them manually.

---

## 5. Deploy edge functions

All 19 in one shot:

```bash
supabase functions deploy \
  ingest-fundamentals ingest-consensus ingest-prices ingest-macro \
  ingest-options ingest-form4 ingest-short-interest \
  compute-q-scores compute-g-scores compute-v-scores \
  compute-m-scores compute-s-scores compute-composite-scores \
  compute-concentration compute-quarterly-review \
  compute-daily-memo compute-weekly-ranking \
  run-backtest generate-aiq-draft
```

Verify each appears in Dashboard → Edge Functions with a green "deployed" status.

---

## 6. Trigger initial backfills

Order matters — prices and fundamentals need to be in before scoring can run.

```bash
# Set these in your shell once so the curl calls below stay short:
export SUPABASE_URL='https://YOUR-PROJECT-REF.supabase.co'
export CRON='Bearer YOUR-CRON-INVOKE-SECRET'

# 1. Prices — 400 days of history (~12,750 rows for 51-name universe)
curl -X POST "$SUPABASE_URL/functions/v1/ingest-prices?days=400" \
  -H "Authorization: $CRON" -H "Content-Type: application/json" -d '{}'

# 2. Fundamentals — quarterly + annual for each ticker
curl -X POST "$SUPABASE_URL/functions/v1/ingest-fundamentals" \
  -H "Authorization: $CRON" -H "Content-Type: application/json" -d '{}'

# 3. Consensus — daily snapshot
curl -X POST "$SUPABASE_URL/functions/v1/ingest-consensus" \
  -H "Authorization: $CRON" -H "Content-Type: application/json" -d '{}'

# 4. Macro — 365-day backfill of NAAIM + F&G + AAII forward-fill
curl -X POST "$SUPABASE_URL/functions/v1/ingest-macro?backfill_days=365" \
  -H "Authorization: $CRON" -H "Content-Type: application/json" -d '{}'

# 5. Options + insider + short interest — daily snapshots (no backfill flag)
curl -X POST "$SUPABASE_URL/functions/v1/ingest-options" -H "Authorization: $CRON" -d '{}'
curl -X POST "$SUPABASE_URL/functions/v1/ingest-form4" -H "Authorization: $CRON" -d '{}'
curl -X POST "$SUPABASE_URL/functions/v1/ingest-short-interest" -H "Authorization: $CRON" -d '{}'
```

Each call returns `{ "ok": true, "rows_upserted": N }` on success. If any fail, check Dashboard → Edge Functions → Logs.

**Expected sanity counts** after the backfill batch:
- `prices_raw` ≥ 12,000 rows
- `fundamentals_raw` ≥ 500 rows (51 tickers × ~10 periods each)
- `consensus` ≥ 51 rows
- `macro_gauges` ≥ 50 rows
- `options_raw` ≥ 50 rows
- `insider_form4_raw` ≥ 100 rows (varies)

---

## 7. Run the first scoring chain manually

The Saturday cron does this automatically; running it once by hand confirms the chain works.

```bash
# Tier A — sequential, each reads the prior's output
curl -X POST "$SUPABASE_URL/functions/v1/compute-q-scores" -H "Authorization: $CRON" -d '{}'
curl -X POST "$SUPABASE_URL/functions/v1/compute-g-scores" -H "Authorization: $CRON" -d '{}'
curl -X POST "$SUPABASE_URL/functions/v1/compute-v-scores" -H "Authorization: $CRON" -d '{}'

# Tier B
curl -X POST "$SUPABASE_URL/functions/v1/compute-m-scores" -H "Authorization: $CRON" -d '{}'
curl -X POST "$SUPABASE_URL/functions/v1/compute-s-scores" -H "Authorization: $CRON" -d '{}'

# Composite + concentration tax
curl -X POST "$SUPABASE_URL/functions/v1/compute-composite-scores" -H "Authorization: $CRON" -d '{}'
curl -X POST "$SUPABASE_URL/functions/v1/compute-concentration" -H "Authorization: $CRON" -d '{}'
```

Verify in Dashboard → Table Editor → `scores_history`: you should see one row per investable ticker with `final_score`, `tier`, and `factor_breakdown` populated.

---

## 8. Generate AIQ drafts for the universe

Optional but recommended — pre-loads `/aiq-drafts` so you have something to review on day 1.

```bash
# One call drafts ~30 names not yet in aiq_rubric. Run multiple times if you
# want to retry parse-error rows.
curl -X POST "$SUPABASE_URL/functions/v1/generate-aiq-draft" \
  -H "Authorization: $CRON" -H "Content-Type: application/json" -d '{}'
```

This uses Claude Sonnet + FMP earnings transcripts + SEC EDGAR 10-Ks. Expect 30-60s per ticker. Drafts land in `aiq_drafts` for review at `/aiq-drafts`.

---

## 9. Deploy the web app to Vercel

```bash
# From repo root:
cd web
npx vercel link                             # connect to a Vercel project
```

In the Vercel dashboard for the new project → Settings → Environment Variables, add (all three for Production + Preview + Development):

| Name | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://YOUR-PROJECT-REF.supabase.co` | Safe to expose; RLS forced on every table |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from §1 | Safe to expose |
| `SUPABASE_SERVICE_ROLE_KEY` | from §1 | **Server-side only — never NEXT_PUBLIC_** |

Then:

```bash
npx vercel --prod                           # first prod deploy
```

Vercel will hand you a URL like `ai-thesis-yourname.vercel.app`. Open it.

Configure Supabase magic-link redirect: Dashboard → Authentication → URL Configuration → add your Vercel URL (and the preview `*.vercel.app` wildcard if you want preview deploys to work).

---

## 10. Auth + smoke test

1. Hit your Vercel URL → you should be redirected to `/login`.
2. Enter your email → check inbox → click the magic link → land on `/`.
3. Walk every route, confirming data renders (not fixture mode):
   - `/` — Dashboard shows tier distribution + macro multiplier
   - `/universe` — scorecard with real composite numbers
   - `/universe/AAPL` (or any ticker) — factor breakdown + history sparkline
   - `/portfolio` — empty book until you add positions; reserve = $20K
   - `/regime` — NAAIM / AAII / F&G live gauges
   - `/aiq` — 20-name seed rubric visible
   - `/aiq-drafts` — drafts from §8
   - `/memos` — empty until daily memo cron fires tomorrow at 13:00 UTC
   - `/decisions` — alert log
   - `/backtest` — empty until you trigger a run via `run-backtest`
   - `/settings` — all freshness probes green
4. None of these should show "fixture mode" or `—` everywhere — if they do, env vars are wrong.

---

## 11. Cron verification

In Supabase Dashboard → SQL Editor, run:

```sql
SELECT jobname, schedule, command FROM cron.job ORDER BY jobname;
```

You should see 17 scheduled jobs. Cross-check against `/settings` → Cron registry.

The first Saturday after deploy at 22:00 UTC, the chain runs end-to-end. **Babysit the first run**:
- Watch Edge Functions → Logs starting 21:55 UTC
- Confirm each function returns 200 + `ok: true`
- After 23:00 UTC, check `/` (Dashboard) shows updated scores
- After Sunday 23:00 UTC, check `/memos` for the weekly Opus memo

---

## 12. Post-deploy parking and follow-ups

- **First Saturday chain:** save logs from each function for ~24h in case anything needs forensics
- **First Sunday weekly memo:** verify it parsed cleanly (no `parse_error` row)
- **After ~30 days of cron data:** revisit `docs/PARKED.md` items (10b5-1 parser, forward-capex consensus) — decide based on actual signal quality whether to invest in fixes
- **Visual fidelity:** browse the live deploy on a real monitor and capture any UI delta vs `design-references/02-canvas-primary-basis-proforma/` for a follow-up polish pass

---

## Recovery — if a step fails

| Symptom | Most likely cause | Fix |
|---|---|---|
| `supabase db push` fails on a migration | pg_cron / pg_net not enabled | Enable in Dashboard → Extensions, retry |
| Backfill curl returns 401 | `CRON_INVOKE_SECRET` mismatch between vault and function env | Re-set both to the same value |
| Backfill returns 500 with FMP error | API quota exceeded or wrong key | Check FMP dashboard usage |
| Composite scoring writes no rows | A factor returned all-null | Check Logs for the failing factor function |
| Vercel deploy succeeds but every page shows fixture mode | env vars not set, or `NEXT_PUBLIC_` prefix missing | Re-add in Vercel settings, redeploy |
| `/login` magic link doesn't redirect to portal | Redirect URL not added in Supabase auth config | Add Vercel URL to allowed redirects |
| Saturday chain fires but composite scores are all null | Tier-A function failed earlier in chain | Logs for whichever function ran most recently, re-run from there |

Anything not covered here: ping Claude with the error + the Edge Functions log excerpt.
