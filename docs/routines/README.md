# AI Thesis — Claude Code Routines

These are paste-ready prompts for Anthropic's Claude Code Routines, scheduled to run on the Anthropic platform and write outputs into the AI Thesis Supabase database via the Supabase MCP connector.

## How they fit

```
┌─────────────────────┐    schedule    ┌──────────────────────────┐
│  Anthropic platform │ ─────────────▶ │  Claude Code session     │
│  (Routines tab)     │                │  with Supabase MCP       │
└─────────────────────┘                └──────────────────────────┘
                                                   │
                                                   ▼ writes
                                       ┌──────────────────────────┐
                                       │  AI Thesis Supabase DB   │
                                       │  (routine-output tables) │
                                       └──────────────────────────┘
                                                   │
                                                   ▼ reads
                                       ┌──────────────────────────┐
                                       │  AI Thesis Next.js app   │
                                       └──────────────────────────┘
```

## v1 routines (4 total — 15/day Anthropic account cap)

| File | Cadence | Writes to |
|---|---|---|
| `01-daily-batch.md` | Weekday 06:30 CT | `aiq_drafts` (up to 5/day), `insider_summary`, `macro_log`, `memo_proposals` (when drift triggered) |
| `02-weekly-rescore.md` | Saturday 06:00 CT | `scores_history` (all 50 tickers), `weekly_summary` |
| `03-monthly-curator.md` | First Saturday of month, 09:00 CT (after weekly) | `universe_proposals` |
| `04-position-pulse.md` | Weekday 07:00 CT (after daily-batch) | `position_pulse` |

**Total weekday fires: 3 per day** (daily-batch + position-pulse on weekdays; monthly-curator on first Saturday only). Comfortable under the 15/day cap.

## Compliance language floor

Every routine output must use research framing, not advice framing:

✅ "score change", "tier transition", "drift observed", "research note", "suggested review"
❌ "buy", "sell", "deploy", "you should", "recommend", "model portfolio"

Per `docs/compliance/language-discipline.md` (when shipped — THS-86).

## Setup

See `setup-guide.md` for step-by-step routine creation on claude.ai/code, Supabase MCP connector configuration, and first-fire verification.

## Schema reference

Routine output tables are defined in `supabase/migrations/20260518000200_e80_routines_pr1.sql` (E80, S4 2026-05-18). Read the migration before writing new routine prompts that touch new tables.
