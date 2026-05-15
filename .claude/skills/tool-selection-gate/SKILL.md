---
name: tool-selection-gate
description: Non-negotiable forcing function before ANY external-system call (DB write/read, HTTP API, MCP tool, cloud service, shared infra). Ranks candidate surfaces against the CLI > API > Skills > MCP hierarchy and forbids reaching for MCP when a CLI or API path exists. Output is one chosen surface + a one-line "why this and not lower-overhead alternatives." Skipping this step is a procedural failure — Terry should never be the one to ask "is MCP really the right path here."
---

# Tool Selection Gate

Non-negotiable forcing function. Before invoking ANY external-system tool, run this gate. Terry is the domain expert on real estate, not on tool plumbing. Tool-surface selection is your job. If Terry has to ask "is this the right path," the gate failed.

## Why this exists

Two memory rules already exist and were repeatedly violated:
- `feedback_surface_better_path_always.md` — surface the better path before executing
- `feedback_tool_hierarchy_cli_api_skills_mcp.md` — CLI > API > Skills > MCP; MCP is last resort

Advisory rules don't fire under tool-affordance pressure. When an MCP schema is already loaded and a write target is named, reflex is to reach for the convenient nearby tool. This skill converts the advice into a forced pre-execution step.

## When this fires

**Triggers (any one):**
- Writing to a database (any database, any table, any client).
- Calling an external HTTP API (third-party or first-party cloud service).
- Invoking any MCP tool.
- Reading from a cloud system when a local equivalent exists.
- Moving data across system boundaries (file → cloud, cloud → cloud, repo → external).
- Authoring scaffolding that will commit to a tool choice (env wiring, client setup, SDK install).

**Does NOT fire for:**
- Local file reads/edits/writes inside the working directory.
- Local shell commands that don't cross a network boundary.
- Pure compute (no I/O).
- Continuing inside the same surface already chosen earlier this task (run once per surface decision, not per call).

## The gate (silent, 10 seconds)

Before the tool call, answer these three questions in order. Do NOT skip any.

### Q1 · What's the minimal goal?
State the operation in one sentence with no tool name attached. Example: "Insert one row into `oc_routines` with these fields." NOT "Use Supabase MCP to insert." If your sentence contains a tool name, restate it.

### Q2 · What surfaces could perform this operation?
Enumerate every candidate at each tier. Be honest — don't skip a tier because it's slightly harder.

| Tier | Examples | Notes |
|---|---|---|
| **1 · CLI** | `psql`, `curl`, `gh`, `aws`, `gcloud`, `supabase` CLI, `pbcopy`, project scripts | Zero context cost. Lives in shell. |
| **2 · API** | direct HTTP via `curl`/`fetch`, SDK call from a script, REST/RPC | Small context cost. Often the same wire path as MCP. |
| **3 · Skills** | invoke a user skill that wraps the operation | Use when the skill exists for exactly this operation. |
| **4 · MCP** | `mcp__claude_ai_*`, `mcp__github__*`, etc. | Last resort. Eats context window. Often read-only or permission-scoped. |

### Q3 · Why not lower?
Pick the lowest tier that achieves the goal. If you skip a tier, write one sentence on why. Acceptable reasons to skip down:
- Lower tier is genuinely unavailable (no CLI binary installed, no API key, no skill).
- Lower tier requires multi-step plumbing that costs more than the call itself.

UNACCEPTABLE reasons (these are red flags — stop and reconsider):
- "MCP schema is already loaded so it's convenient."
- "I tried the MCP tool first and it worked partially."
- "Terry asked using a verb that names a tool" — verbs name operations, not surfaces.
- "It's faster to type" — token cost of MCP context is paid every turn for the rest of the session.

## Output format (state explicitly, even if brief)

Before the tool call, emit one line to Terry:

> **Surface:** `<tier · specific tool>` · **Why this over lower:** `<one phrase, or "none lower available">`

Example pass:
> Surface: CLI · `curl` to PostgREST with service-role key. Why this over lower: no `psql` connection string in .env.local, so API tier is the floor.

Example fail (would NOT pass the gate):
> Surface: MCP · `mcp__claude_ai_Supabase__execute_sql`. Why this over lower: schema is already loaded.
> → REJECTED. "Already loaded" is not a reason. Drop to CLI.

## Hard rules

1. **MCP requires explicit justification.** If the chosen surface is tier 4 (MCP), the "why not lower" must name a concrete blocker, not a convenience.
2. **One tier per operation, not per call.** Once you've picked CLI for the task, stay there until the task ends or the surface breaks. Don't bounce between MCP and CLI for ergonomics.
3. **CLI-first for writes to shared infra.** Database writes, cloud-resource mutations, repo pushes — these default to CLI. MCP for writes is almost always wrong because permission-scoping is opaque and reversal is harder.
4. **If unsure, ASK Terry the gate-output, not the goal.** "I'm about to write to oc_routines. Surface: CLI curl to PostgREST. Sound right?" — that's a 5-second confirmation, not a domain-expert ask.

## Failure mode the gate prevents

Terry asks for a DB write. MCP `execute_sql` schema is already in scope from an earlier loadup. Reflex reaches for MCP. Permission denied (read-only token). Pivot to file-paste-and-Terry-runs-it. Terry then has to ask "is MCP really the right path?" — which means the cost was paid twice: once on the failed MCP call, once on the manual paste path that's still suboptimal vs. curl. **The gate would have selected curl on the first pass.**

## Scope

Cross-project, every session, every task. Same tier as `compact-assessment` and `ship-gate` — procedural forcing functions, not advisory feedback.
