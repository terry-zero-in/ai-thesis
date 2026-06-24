#!/usr/bin/env python3
"""
context-integrity :: PostToolUse recorder  (Lane C)

Appends a record of every VERIFICATION action (file reads, greps, inspections)
to a session-scoped log:  <cwd>/.context-integrity/verified-<session_id>.jsonl
The gate (ci_gate.py) reads this log to decide whether a repo-state claim is
backed by an actual look at the tree THIS session.

Records on PostToolUse for:
  - Read / Grep / Glob / view            -> file_path or pattern/path
  - Bash, when the command is read-class  -> referenced paths/patterns
    (grep, rg, cat, head, tail, less, sed -n, awk, jq <file>, ls, find,
     git show, git grep, git log, git diff, git cat-file, tsx/vitest harness runs)

Fail-open: never blocks; on error, exits 0 silently.
"""
import json
import os
import re
import shlex
import sys
import time

CI_DIR = os.environ.get("CI_STATE_DIR", ".context-integrity")

READ_VERBS = (
    "grep", "rg", "cat", "head", "tail", "less", "view", "bat", "ls", "find",
    "sed", "awk", "jq", "rev",
)
GIT_READ = ("show", "grep", "log", "diff", "cat-file", "blame", "ls-files", "rev-parse")
# Running the harness/scorer is also "looking at the tree" for tie-out claims.
HARNESS_HINTS = ("vitest", "tsx", "harness/cli", "runFixture", "compare.ts", "pnpm test", "npm test")

PATH_RE = re.compile(r"[\w./\-]+\.(?:ts|tsx|py|json|jsonl|md|csv|xlsx|xls|pdf)\b")


def extract_bash_targets(command):
    targets = []
    low = command.lower()
    # harness / scorer runs
    if any(h in low for h in HARNESS_HINTS):
        targets.append("harness:run")
    try:
        toks = shlex.split(command)
    except ValueError:
        toks = command.split()
    if not toks:
        return targets
    head = os.path.basename(toks[0])

    is_read = head in READ_VERBS
    if head == "git" and len(toks) > 1 and toks[1] in GIT_READ:
        is_read = True
    # also catch piped/compound reads (e.g. `... | grep X`, `cd dir && rg Y`)
    if not is_read and any(re.search(rf"(^|[|&;]\s*){v}\b", low) for v in READ_VERBS + ("git grep", "git show")):
        is_read = True

    if is_read:
        # grep/rg pattern is the search target
        if head in ("grep", "rg") or "git grep" in low:
            # first non-flag token after the verb is the pattern
            after = toks[1:]
            for t in after:
                if not t.startswith("-"):
                    targets.append(f"pattern:{t}")
                    break
        for m in PATH_RE.finditer(command):
            targets.append(m.group(0))
        # bare-word symbol greps like:  grep -r CleanRentRoll
        for t in toks[1:]:
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]+", t) and not t.startswith("-"):
                targets.append(t)
    return targets


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)
    try:
        tool = data.get("tool_name", "")
        ti = data.get("tool_input", {}) or {}
        cwd = data.get("cwd", os.getcwd())
        sid = data.get("session_id", "unknown")

        targets = []
        if tool in ("Read", "view", "View"):
            fp = ti.get("file_path") or ti.get("path")
            if fp:
                targets.append(fp)
        elif tool in ("Grep",):
            if ti.get("pattern"):
                targets.append(f"pattern:{ti['pattern']}")
            if ti.get("path"):
                targets.append(ti["path"])
        elif tool in ("Glob",):
            if ti.get("pattern"):
                targets.append(ti["pattern"])
        elif tool == "Bash":
            targets.extend(extract_bash_targets(ti.get("command", "")))

        if not targets:
            sys.exit(0)

        d = os.path.join(cwd, CI_DIR)
        os.makedirs(d, exist_ok=True)
        rec = {
            "ts": time.strftime("%Y-%m-%dT%H:%M:%S"),
            "session_id": sid,
            "tool": tool,
            "targets": sorted(set(targets)),
        }
        with open(os.path.join(d, f"verified-{sid}.jsonl"), "a", encoding="utf-8") as fh:
            fh.write(json.dumps(rec) + "\n")
    except Exception:
        pass
    sys.exit(0)


if __name__ == "__main__":
    main()
