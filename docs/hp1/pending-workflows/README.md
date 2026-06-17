# Pending workflow files (S36)

These two GitHub Actions workflows were authored in S36 (2026-06-17) but **could
not be pushed** under `.github/workflows/`: the session's git OAuth token lacks
`workflow` scope and the GitHub MCP App is read-only on this repo. They live here
as pushable reference copies.

**To activate:** copy them into `.github/workflows/` (by hand, or via a push from
a token with `workflow` scope), then add the two repo secrets:

- `HP1_DATABASE_URL` — the standalone HP-1 Supabase project (`uetclnhbubmkwbherwkw`)
  Postgres connection string (server-only).
- `FMP_API_KEY` — FMP `/stable/` key (same key v2 uses).

| File here | Goes to |
|---|---|
| `hp1-engine.yml` | `.github/workflows/hp1-engine.yml` (new) |
| `ci.yml` | `.github/workflows/ci.yml` (replaces existing — adds the `hp1-engine-tests` pytest job) |

Until then the engine runs only on manual invocation (`python run_engine.py`), not
on a schedule. Context: `docs/handoffs/2026-06-17-S36-hp1-engine-db-adaptation.md`.
