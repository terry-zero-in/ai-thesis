---
description: Session handoff — commit/push everything, update Linear, write a dated handoff doc, append pointer to SESSION_NOTES, summarize.
---

# /sch — Session handoff

Run the full session-handoff playbook so the next remote session (or fresh container) can pick up cold. This is Terry's standing shorthand; he'll type `/sch` when he wants to wrap.

## Steps (execute in order — no shortcuts)

### 1. Verify clean state

```
git status -s          # must end up clean
git log --oneline -10  # know what you shipped this session
```

If there are uncommitted changes, commit them before continuing. Don't ask — the handoff is incomplete with dirty state.

### 2. Linear hygiene — per ticket touched this session

For every Linear ticket you wrote code or comments against in this session:

- Post a comment summarizing what shipped: commit SHAs, files touched, acceptance items ticked, judgment calls (with reasoning), verification (TSC + lint + dev-server status), and what's left for Terry.
- Move to `In Review` if the ticket needs Terry's visual / external check. Move to `Done` if every acceptance criterion is verifiably met by evidence in this session.
- File follow-up tickets for any judgment-deferred items, schema gaps, or scope-stretch findings — under epic THS-92 by default. Use `priority: 3 (Medium)` for engineering follow-ups, `priority: 4 (Low)` for nice-to-haves.

### 3. Write the handoff doc

Path: `docs/handoffs/YYYY-MM-DD-S{N}-{short-topic}.md` where:
- Date = today UTC (or Terry's day if UTC has rolled but Terry's day hasn't).
- N = next session number after the most recent file in `docs/handoffs/`.
- Topic = 4–6 words capturing the session's theme.

Required sections (don't skip — these are what makes the next session functional):

- **Header:** date, branch, HEAD SHA, commit-count ahead of `origin/main`, continuation-of pointer if relevant.
- **Operating posture:** quote any directive Terry gave that changed posture this session (autonomy rule, scope pivot, etc.).
- **Tickets shipped:** per-ticket section with commits, files, acceptance status, judgment calls.
- **Linear management:** new tickets, re-parents, state changes (cancellations, closures).
- **Prod database state at end of session:** migrations applied, row counts of key tables, advisor state.
- **Commits pushed:** full `git log --oneline origin/main..HEAD` block.
- **Pending Terry actions:** table format. Visual reviews, env secrets, Studio actions, deploys, decision-needed items.
- **Next ticket in build order:** which ticket, what blocks it, whether you've inspected its description.
- **Verified facts:** project IDs, team IDs, emails, branch name — anything the next session shouldn't have to re-prove.
- **Skills loaded this session:** so the next session can match the posture.
- **Recommendations for next session:** honest assessment of whether to keep cranking, pause for review, pivot to data work, etc. Include why.

### 4. Append a pointer to SESSION_NOTES.md

`docs/SESSION_NOTES.md` is the cold-start index. Append a short dated section pointing to the new handoff doc + 3–5 bullets of headline state changes. Do NOT rewrite the file — append only.

Format:
```
## SESSION S{N} (YYYY-MM-DD, {theme})

**Note:** Sessions S10–S{N} are logged in `docs/handoffs/` per-session. This entry is a pointer.

{2–3 sentence summary of the session.}

- Bullet 1 — biggest state change
- Bullet 2
- Bullet 3

**Full record:** `docs/handoffs/YYYY-MM-DD-S{N}-{topic}.md`

**Next session — start here:**
1. Read `CLAUDE.md`
2. Read the handoff above
3. {Specific first action}
```

### 5. Commit + push the handoff

Single commit. Conventional message:
```
docs(handoffs): S{N} — {one-line summary}

{2–4 sentence body}

Refs: {THS-IDs touched}
```

Push with `git push -u origin <branch>`. Confirm push succeeded.

### 6. Verify clean tree one more time

```
git status -s
```

Must be empty. If not, you missed something — go back to step 1.

### 7. Summary to Terry

Output a tight summary (no headers spam, no emojis):
- Branch + HEAD SHA, commits ahead of main.
- Per-ticket status table (Done / In Review / In Progress).
- Pending-Terry list (3–6 items max).
- Pointer to the handoff doc + SESSION_NOTES entry.
- End of session.

## Don'ts

- Don't write the handoff doc if there's uncommitted work — commit it first.
- Don't claim "all pushed" without running `git status -s` and confirming clean.
- Don't gloss over judgment calls in Linear comments — every non-obvious decision needs the reasoning recorded so the next session can revisit it.
- Don't recreate stale SESSION_NOTES content — just append the new dated entry.
- Don't mark a ticket Done without evidence every acceptance box is ticked. Use `In Review` when Terry's visual or external check is the remaining gate.
- Don't bury the headline. If something shipped that materially changes the build (new schema, canceled epic, rule change), put it at the top of the handoff doc, not buried in section 5.
