# Supabase Edge Functions

Ingestion + compute jobs that run on Supabase's Deno runtime.

## Functions

| Function               | Ticket | Schedule          | Purpose                                     |
| ---------------------- | ------ | ----------------- | ------------------------------------------- |
| `ingest-fundamentals`  | THS-38 | 21:15 UTC Mon-Fri | Pull FMP fundamentals (Q + A) for universe  |
| `ingest-consensus`     | THS-39 | 21:30 UTC Mon-Fri | Pull consensus + compute revisions deltas   |

## Local development

```bash
# Start local stack (Postgres + Studio + Edge Function runtime)
supabase start

# Serve a function with hot reload
supabase functions serve ingest-fundamentals --no-verify-jwt --env-file .env.local

# Invoke locally
curl -X POST 'http://localhost:54321/functions/v1/ingest-fundamentals' \
  -H "Authorization: Bearer $CRON_INVOKE_SECRET" \
  -H 'Content-Type: application/json' \
  -d '{}'
```

## Required env vars

| Variable                     | Where to set                         |
| ---------------------------- | ------------------------------------ |
| `FMP_API_KEY`                | Supabase Edge Function secrets       |
| `CRON_INVOKE_SECRET`         | Edge Function secrets + Postgres vault |
| `SUPABASE_URL`               | provided automatically               |
| `SUPABASE_SERVICE_ROLE_KEY`  | provided automatically               |

Locally, copy `.env.example` to `.env.local` and fill in.

## Deploy

```bash
supabase functions deploy ingest-fundamentals
```

The cron migration (`20260515000300_e14_fundamentals_cron.sql`) wires pg_cron
to call this function on schedule once it's deployed. Function deploy ≠ cron
deploy — both are required.

## Tests

Pure helpers under `_shared/` have Node-runnable tests:

```bash
node --test --experimental-strip-types supabase/functions/_shared/*.test.ts
```

Network paths (`fetchIncome` / `fetchBalance` / `fetchCash`) aren't tested
locally — they require a live FMP API key. To smoke-test end-to-end, deploy
the function and invoke it with `supabase functions invoke`.
