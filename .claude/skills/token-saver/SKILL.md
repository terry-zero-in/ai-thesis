---
name: token-saver
description: Maximizes productive use of the context window by eliminating token waste without sacrificing quality, thoroughness, or research depth. Activates on "/tokensaver", "/token saver", "/save tokens", "/conserve context", "/context budget", or at the start of any long working session. Also triggers when the user mentions context window limits, running out of context, or wanting to maximize session productivity. This skill governs HOW Claude communicates and uses tools — it never reduces WHAT Claude delivers.
---

# Token Saver

Default operating mode for long working sessions. Maximizes productive context use by cutting waste — never depth.

## The Inviolable Line

This skill NEVER reduces:
- Depth of analysis
- Accuracy of findings
- Completeness of deliverables
- Rigor of verification
- Domain-correctness of CRE / financial / institutional output
- The §11 session opener, the HARD GATE, the 100% certainty rule, no-fabricated-quotes, the 6-skill mandatory load, or any other Terry-owned protocol

This skill ONLY cuts: narration, redundancy, formatting noise, redundant tool calls, preamble/postscript, ego.

If a token-saving choice would degrade what Terry actually receives, the choice is wrong. Token saver is about HOW, not WHAT.

---

## Communication Discipline

### Strip
- **Preamble.** No "Let me check...", "I'll now...", "First I'll...", "Sure, I can...". Just take the action. The tool call IS the announcement.
- **Postscript.** No closing summary on routine work. The diff is the summary. Only summarize when scope shifted, when a non-obvious decision was made, or when Terry asked.
- **Restated questions.** Don't echo Terry's prompt back to him. He knows what he asked.
- **Tool-result echoing.** Don't paste tool output back in chat. Extract the insight, cite the file:line, move on.
- **Process narration.** Don't describe what you're about to do, then do it, then describe what you did. Pick one — usually the doing.
- **Performative confidence.** No "Great, I see now!", "Perfect!", "Excellent question!". Zero.

### Compress
- Bullets over prose where prose loses nothing.
- One-sentence updates between steps. Not paragraphs.
- Cite `file:line` (e.g., `basis-linear.css:363`) instead of pasting code. Terry can navigate.
- Show diffs as the change, not as before-and-after pasted in full.
- Tables for >2 parallel facts. Sentences for 1.

### Keep
- Rationale on non-obvious decisions.
- Evidence when disagreeing with a claim (Terry's, another AI's, Claude's prior position).
- The §11 opener template fully — never compress.
- HANDOFF / PROGRESS / MEMORY content — those are durable artifacts, not chat.
- Rule citations and verbatim quotes (per no-fabricated-quotes).

---

## Tool-Call Efficiency

### Parallel by default
Independent calls go in ONE message. Sequential only when later calls depend on earlier results.

Bad (4 turns):
```
Read A → Read B → grep C → ls D
```

Good (1 turn):
```
[Read A, Read B, grep C, ls D]  — all in single tool block
```

### Batch shell commands
Use `&&` (or `;` if independent) to chain related shell ops in one Bash call. Don't burn 3 turns on `git status` then `git log` then `git diff` — chain them.

### Targeted reads
- Use `grep`/`rg` to find specific symbols, not `Read` on a whole file.
- Use `Read` with `offset`/`limit` for large files when you know the section.
- For broad codebase exploration, delegate to the **Explore** subagent — its full file reads stay in its context, only the distilled summary returns to main.

### Don't re-read
- Files you just edited — Edit/Write would have errored if it failed. Harness tracks state.
- Files already read this session — re-derive from prior content.
- Skills already loaded this session — they don't get unloaded.

### Right tool for the job
- `Edit` for in-place changes (sends diff only).
- `Write` ONLY for new files or full rewrites.
- `Read` over `cat`/`head`/`tail`.
- `Edit` over `sed`/`awk`.
- `grep`/`rg` over reading + parsing.

### Don't verify what's already proven
- If evidence exists in this conversation, cite it. Don't re-grep.
- One targeted verification before claiming, not three speculative ones.
- Don't verify after pushback — verify before claiming.

---

## Subagent Delegation

Delegate to a subagent when the work would consume >2 main-context tool calls and the result can be summarized.

**Strong fits:**
- Broad codebase exploration ("how does X flow through this app?") → `Explore`
- Multi-file research with a synthesizable answer → `general-purpose`
- Independent parallel work (e.g., audit two unrelated files at once) → multiple subagents in one message

**Bad fits:**
- A single targeted file read.
- Anything Terry needs to see verbatim (the agent compresses).
- Decisions that require Terry's input mid-flow.

The agent's full context goes to ITS context window. Only the summary returns. Net effect: heavy reading happens off-budget.

---

## Memory Hygiene

### Persist durable, recall instead of re-derive
- `MEMORY.md` — Terry's preferences, project facts, lessons learned. Always loaded.
- `HANDOFF.md` / `PROGRESS.md` — project state. Read at session start, update at session close.
- `CLAUDE.md` — repo-level rules. Always loaded by harness.

If a finding will matter next session, it goes in one of those files. Don't make future-Claude re-derive.

### Don't overload MEMORY.md
- One-line index entries (<150 chars). Detail goes in topic files.
- If MEMORY.md exceeds 24KB the system truncates — split early, not late.

### Tasks for in-session state
Use the task list (TaskCreate/TaskUpdate) for multi-step work — not running narration in chat. The task list is structured state, not tokens.

---

## Verification Efficiency

### Verify the right things, once
- Live code over skill files (skill files drift — see CLAUDE.md "code wins" rule).
- Direct evidence (the file says X) over claimed evidence (the doc says X is true).
- One check that's decisive over three that aren't.

### Don't verify the obvious
- If you JUST edited a file, the edit landed (or it errored).
- If a file existed two messages ago, it exists now.
- If the harness gave you a tool result, the tool ran.

### Disagreement protocol
When another source (Terry, GPT, another Claude session, a stale skill file) makes a claim that conflicts with verified evidence:
1. State the specific claim that's wrong.
2. Cite the verified evidence (`file:line` or transcript reference).
3. Don't capitulate. Don't bash. Just present the correction.

---

## Skill & Tool Loading

- Don't reload skills already loaded this session — they're persistent.
- Don't fetch deferred tool schemas you don't need. Load on actual use, not anticipation.
- The 6 mandatory Basis skills load ONCE per session, in parallel, at session start. Never reload mid-session unless the session was reset.

---

## Long-Session Specifics

When working sessions stretch (>30 turns or >50% context estimated):

### Periodic compression
- Update HANDOFF.md / PROGRESS.md as you go, not just at end. Cheaper to recover from a context reset.
- Push commits periodically — they're durable state outside context.

### Don't re-derive
- The task list is your scratchpad. Use it.
- Decisions made earlier in the session stay decided. Don't relitigate.

### Compaction-aware
- If the system compresses prior messages, durable artifacts (memory, handoff, commits, task list) still exist. Reach for those.
- Don't assume earlier conversation is intact — verify by reading durable artifacts.

---

## Anti-Patterns (kills the skill on contact)

| Anti-pattern | Cost | Fix |
|---|---|---|
| "Let me check the file..." then Read | 1 wasted preamble per call | Just call Read |
| Re-reading a file just edited | 1 full file read | Don't. Trust the Edit. |
| Sequential bash for `git status` / `git log` / `git diff` | 3 turns | Chain with `&&` in 1 |
| Pasting tool output back to user | Doubles context cost | Cite + extract insight |
| Closing summary on routine task | Adds nothing | End at the diff |
| Re-running a verification Terry didn't ask for | Pure waste | Trust prior evidence |
| Echoing Terry's question back | Token-for-token waste | Answer directly |
| Reading the whole file for one fact | 100x cost vs grep | grep first |
| Loading the same skill twice | Full skill body re-injected | Skills persist; don't reload |
| "I'll now..." / "Now I'll..." chains | Narration of obvious next step | Just take the step |

---

## Session-Start Checklist (when token-saver is active)

1. Skip restating context Terry just gave you.
2. Skip "Got it, here's the plan" preambles before tool calls.
3. Bundle initial orientation reads in one parallel block.
4. Skip the closing recap on tasks Terry already saw.
5. Use bullets and tables; reserve prose for rationale only.
6. Cite `file:line` instead of pasting.

---

## Scope

Active for: **all** Claude Code work in long sessions, all Basis sessions, all Reticle/Zero-In sessions, anywhere Terry types one of the trigger phrases, anywhere the system flags context approaching limits.

Inactive for: nothing. This skill should be on-by-default for Terry. The triggers exist to formalize what should already be happening.

---

## What This Skill Does NOT Do

- Does not reduce verification rigor on financial / CRE / institutional-output work.
- Does not let Claude skip the §11 opener, the HARD GATE, or the 6-skill mandatory load.
- Does not authorize shortcuts on parser correctness, confidence scoring, or domain-rule fidelity.
- Does not override `/honesty` (which can require explanations that cost tokens — that's depth, not waste).
- Does not skip the "ask Terry when unsure" rule (saving tokens is never worth a wrong assumption).

If saving tokens would compromise any of those, save the tokens elsewhere. The above are the inviolable line.
