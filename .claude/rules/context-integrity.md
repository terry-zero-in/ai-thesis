# Context Integrity — always-on contract

> Auto-loaded every session via `.claude/rules/`. The doctrine lives here; the
> **hooks** (`.claude/hooks/ci_gate.py` + `ci_record.py`) ENFORCE it. A rule you
> are merely trusted to remember is the same stale-recall failure one level up —
> so this file states the rule and the hook makes skipping it impossible.

## The failure this prevents
Answering a "where/what/how does our system currently do X" question from a
**prior-session cached belief**, confidently, when it is stale. Confident-stale-
recall is worse than "I don't know": "I don't know" triggers a check; stale
confidence propagates silently until it is load-bearing and wrong. (This repo's
own memory already records one such trap — the "accent is gray" note that the
live token file contradicts. Verify the tree, not the memory.)

## Classify EVERY project assertion before it ships
Before any claim enters a reply, a commit message, a `program.md`, a ledger, a
`score.json`, or `EVIDENCE.md`:

**Class 1 — REPO-STATE** ("the scorer is in `composite.ts`", "`runBacktest`
exists", "main is protected", "the citation validator is already wired", "this
function currently rescales the weights").
→ MUST be verified by reading the file / running the command **THIS session**.
If not, it ships tagged `[UNVERIFIED — recalled, not checked this session]`.
Never assert repo state confidently from memory.

**Class 2 — WORLD-FACT** (SEC 206(4)-1 marketing-rule scope, a GAAP definition,
an FMP/Polygon field's semantics, "the standard annualization is √12").
→ Web-research-gated. Pull the research tool; document the source. Re-verify
even "known" facts — conventions change and training is stale.

**Class 3 — METHODOLOGY / JUDGMENT** (a factor-weighting choice the spec doesn't
pin; how to treat a name whose hand-score doesn't reconcile to the engine, e.g.
PLTR in the deployment slate).
→ Decide with documented rationale, log to the decision/score ledger, **never
stop the loop to ask.** Terry reviews the ledger later; disagreements become new
fixtures. Terry is the gate at REVIEW time, never at RUN time.

Routing a claim to the wrong class is itself an error. "Research mode" does NOT
fix a repo-state failure — only reading the repo does.

## How to satisfy the Class-1 gate (what the hook checks)
A Class-1 claim landing in a commit / program.md / score.json / ledger passes
only if ONE holds:
1. **Verified this session** — a `Read`/`Grep`/`Glob` or a read-class `Bash`
   (`grep`, `rg`, `cat`, `git show`, `git grep`, a `node --test` harness run, …)
   touched the path/symbol earlier this session. `ci_record.py` logs it.
2. **Tagged** — the claim's line contains `[UNVERIFIED — recalled, not checked this session]`.
3. **Trailer** — the write/commit carries `Verified-this-session: <path-or-symbol> …`
   naming what you actually read this session.

If none hold, the write is **denied** with instructions. Verify, tag, or add the
trailer — then retry.

## Self-sufficiency (pairs with the gate)
Terry is never the run-time bottleneck. Research → decide → document Class-3
judgments → continue. Forbidden mid-loop: "What next?", "Should I try X or Y?"
Replace with "Decided X because Y — logged, continuing."

## Strictness
The gate's strictness is the autoresearch tunable (`CI_STRICTNESS` ∈
`paranoid|strict|lenient`, default `strict`). The context-integrity lane drives
"confident-but-wrong rate" → 0 on a repo-state eval set by tuning it to the knee
of the precision/recall curve. The gate is **fail-open**: a bug in it ALLOWS and
emits a visible systemMessage — it never bricks the repo.
