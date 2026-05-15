---
name: triage-basa
description: Use when handling a BASA-NN Linear ticket from Paperclip automation. Runs the deterministic triage decision tree — dedup check → run-log inspection → classify (duplicate / false-positive / valid) → close or escalate → meta-issue if 3x recurrence. Returns a one-line verdict + next action.
---

# Triage BASA tickets

Paperclip fires Linear tickets in the **BASA** project when its productivity-review agent flags something. This skill executes the deterministic triage Terry has done dozens of times, so it never gets done inconsistently or skipped.

## When to invoke

- A BASA-NN ticket appeared in your work queue (wake payload, mention, or scheduled review).
- You're about to comment on / close / escalate a BASA ticket.
- Terry says "triage BASA-NN."

## The decision tree

```
START
  │
  ▼
[1] Dedup check
  Is this issue a duplicate of any BASA-* opened in the last 30 days?
  ├── YES → close as duplicate (link to original) → END
  └── NO  → continue
      │
      ▼
  [2] Run-log inspection
  Pull the run log from Paperclip's inspection endpoint for the run_id
  referenced in the ticket body. Read the agent reasoning + tool calls.
      │
      ▼
  [3] Classify
  ├── (a) False positive — agent's reasoning was wrong; no actual issue
  │        → comment with the specific reason; close
  │        → if this is the 3rd+ false positive of the same pattern → [4]
  ├── (b) Valid — real issue Paperclip caught correctly
  │        → comment with the fix plan; either fix now or escalate to Terry
  │        → keep ticket open until verified fixed
  └── (c) Ambiguous — can't decide from log alone
        → comment with what you'd need to decide; ask Terry; keep open
      │
      ▼
  [4] Meta-issue check (only if [3] = false positive, 3rd+ occurrence of same pattern)
  Open a new ticket titled "Paperclip false-positive pattern: <pattern>"
  in the meta-issue Linear project. Link the 3 instances. Tag Terry.
      │
      ▼
END
```

## Step-by-step

### Step 1: Dedup check

```
# Search recent BASA tickets for the same root signature
mcp__claude_ai_Linear__list_issues({
  project: "BASA",
  filter: "createdAt > 30 days ago"
})

# Compare titles + run_id + flagged-pattern to the new ticket
```

If duplicate found → close with comment: `Duplicate of BASA-NN. Closing.` and link the original.

### Step 2: Run-log inspection

The ticket body contains a `run_id` (or `task_id`). Use Paperclip's inspection endpoint to pull the agent's reasoning trail.

```bash
# Example — adjust to your Paperclip host
curl -sS http://localhost:<paperclip-port>/runs/<run_id>/log | jq .
```

Read the log for:
- What pattern the agent flagged
- Which tool calls / file reads led to the flag
- Whether the agent's premises match observable reality (file state, run output, etc.)

### Step 3: Classify

**(a) False positive** — agent's reasoning broke down. Examples:
- Flagged an issue based on stale state
- Misread a tool output
- Triggered on a known-acceptable pattern

Action: comment with the *specific* reason (cite log line numbers if possible) → close → record this is the Nth occurrence of this pattern.

**(b) Valid** — Paperclip correctly identified an issue.

Action:
- If fix is small + clear → propose the fix in the ticket → if Terry has pre-approved auto-fix for this pattern, fix and link the PR → else wait for Terry
- If fix is bigger → escalate to Terry with summary + recommended scope
- Don't close until the fix is verified shipped

**(c) Ambiguous** — log doesn't give you enough.

Action: comment with the specific question(s) you need answered → tag Terry → keep open.

### Step 4: Meta-issue check (only if [3] = false-positive)

After classifying as false-positive, check: is this the 3rd+ time this same pattern has been a false positive?

Heuristic for "same pattern":
- Same agent rule / check ID
- Same triggering condition (e.g., "flagged commit lacking tests" when test was unnecessary)

If yes → open a new ticket:

```
Title: Paperclip false-positive pattern: <one-line description>
Body:
  This pattern has produced 3+ false-positive BASA tickets:
  - BASA-NN (date)
  - BASA-NN (date)
  - BASA-NN (date)

  Recommended action: refine the rule. Specifics:
  - Current condition: <...>
  - Proposed condition: <...>

  cc @terry
```

Tag Terry. This is the signal to refine the Paperclip rule itself, not just keep closing tickets.

## Output format

After triage, emit one line per ticket:

```
BASA-NN: <verdict> · <action>
```

Examples:

```
BASA-42: duplicate of BASA-38 · closed
BASA-43: false-positive (3rd of pattern X) · closed + opened meta BASA-META-7
BASA-44: valid (broken migration in db/0042.sql:14) · escalated to Terry; ticket open
BASA-45: ambiguous (run-log truncated) · commented on ticket; awaiting Terry
```

## Anti-patterns

- ❌ Closing a BASA ticket without inspecting the run log. Log first, decide second.
- ❌ Marking false-positive without citing log evidence. "Looks fine" is not evidence.
- ❌ Fixing a "valid" finding without checking if it's the right fix. Propose, get approval, then fix.
- ❌ Letting 3+ false positives of the same pattern slip without opening a meta-issue. The pattern is the bug, not the ticket.
- ❌ Treating BASA tickets as advisory you can ignore. Either dedup, classify, or escalate — never silent-drop.

## Pairs with

- `feedback_codex_finding_triage.md` (parent rule: real+cheap+contract-violating+lived → fix in-PR; else defer)
- `superpowers:verification-before-completion` (anti-skip discipline)

Founding case: optimize-claude I-D3 codified 2026-05-15 (S9). Pattern derived from 7+ automated_heartbeat_task sessions across BASA-16/17/18/etc. dedup + classification work.
