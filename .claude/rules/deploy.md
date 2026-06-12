---
paths:
  - "**/vercel.json"
  - "**/supabase/**"
  - "**/.env*"
---
# Deploy law (ai-thesis)
- Preflight before any supabase/vercel/psql command (hook-enforced; see `~/.claude/hooks/preflight-deploy.sh`).
- Supabase project ref for THIS repo: **TBD — not yet provided by Terry. ASK before any Supabase op.**
- Env: root `.env.example` (`FMP_API_KEY`, `CRON_INVOKE_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`); `web/.env.local.example` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Edge-function-only secrets (`ANTHROPIC_API_KEY`, `POLYGON_API_KEY`) live in Supabase Studio, not the repo.
- Vercel project: `ai-thesis-v2` (linked via `web/.vercel/project.json`; no root vercel.json — Next.js auto-detect).
- Known traps: anon role often lacks SELECT grants; RLS auto-enables on new tables; pasted SQL gets soft-wrap newlines (write SQL to a file and execute the file — never pipe pasted SQL via stdin); Vercel preview URLs may be SSO-gated.
- A deploy is done only after a live prod smoke test returns real data. Paste the output.
