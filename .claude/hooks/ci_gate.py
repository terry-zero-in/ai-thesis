#!/usr/bin/env python3
"""
context-integrity :: PreToolUse gate  (autoresearch enforcing hook)

PURPOSE
  Make confident-stale-recall mechanically impossible to LAND. A Class-1
  (repo-state) assertion may not enter a commit message, a program.md, a
  decision/score ledger, or EVIDENCE.md unless EITHER:
    (a) a corresponding read/grep/command happened THIS session
        (proven by the session verification log written by ci_record.py), OR
    (b) the assertion is explicitly tagged  [UNVERIFIED ...]  in the same line, OR
    (c) the write carries a  Verified-this-session:  trailer naming a target
        that appears in this session's verification log.
  Otherwise the tool call is DENIED with an instruction to verify-or-tag.

CONTRACT (verified against code.claude.com/docs/en/hooks, 2026-06-19)
  stdin  : JSON with session_id, transcript_path, cwd, hook_event_name,
           tool_name, tool_input  (additionalProperties: true)
  block  : print {"hookSpecificOutput":{"hookEventName":"PreToolUse",
           "permissionDecision":"deny","permissionDecisionReason":"..."}} ; exit 0
  allow  : exit 0 with no stdout (normal permission flow continues)

STRICTNESS  (the autoresearch tunable — drive confident-but-wrong -> 0)
  env CI_STRICTNESS in {paranoid, strict, lenient}; default "strict".
    lenient  : enforce only explicit/strong patterns (paths-as-fact, named symbols).
    strict   : + prose repo-state verbs (currently/already + is/lives/exists at).
    paranoid : + any backticked path or known artifact mentioned as present.

FAIL-OPEN
  A buggy integrity gate must never brick the repo. On any internal error the
  gate emits a visible systemMessage and ALLOWS. Strictness is what's tuned;
  correctness of the harness is not traded for it.
"""
import json
import os
import re
import shlex
import sys

STRICTNESS = os.environ.get("CI_STRICTNESS", "strict").strip().lower()
CI_DIR = os.environ.get("CI_STATE_DIR", ".context-integrity")

# ----- which writes are "landing actions" we gate -----------------------------
LEDGER_PATH_RE = re.compile(
    r"(program.*\.md$"               # program.md AND lane program files
    r"|EVIDENCE\.md$"
    r"|(decision|score).*ledger"
    r"|ledger.*\.(md|json|jsonl)$"
    r"|score\.json$"
    r"|/decisions?/"
    r"|DECISIONS?\.md$)",
    re.IGNORECASE,
)

# ----- Class-1 (repo-state) assertion patterns, tiered by strictness ----------
# Each pattern, when it matches a line, flags that line as a repo-state claim.
# AI-Thesis artifacts: named so a paranoid-mode mention of one as "present"
# still needs a this-session read backing it.
KNOWN_ARTIFACTS = [
    "computeComposite", "runBacktest", "parseAiqDraft", "LAYER_WEIGHTS",
    "compositeTaxed", "scores_history", "backtest_runs", "aiq_rubric",
    "aiq_drafts", "memo-context", "compute-daily-memo", "compute-composite-scores",
    "slate.json", "score.json",
]

STRONG = [
    # "<thing> is/lives/exists/located/defined in/at <path-or-symbol>"
    r"\b(schema|scorer|harness|parser|fixture|target|type|hook|ticket|table|"
    r"column|field|function|endpoint|module|file|path|extractor|adapter|"
    r"engine|backtest|validator|loader|migration)\b[^.\n]{0,40}?"
    r"\b(is|lives|exists|located|defined|found|sits|resides)\b[^.\n]{0,12}?\b(in|at|under)\b",
    # "main is protected" / "branch is protected" / "is hook-protected"
    r"\bmain\b[^.\n]{0,20}?\bprotected\b",
    r"\bis\s+(hook-)?protected\b",
    # a backticked path asserted to hold/contain a symbol
    r"`[^`]+\.(ts|tsx|py|json|jsonl|md)`[^.\n]{0,30}?\b(holds|contains|has|defines|carries)\b",
]
PROSE = [
    r"\b(currently|already)\b[^.\n]{0,30}?\b(does|extracts|handles|maps|routes|"
    r"returns|supports|implements|wired|parses|emits|validates|scores|computes)\b",
    r"\b(the\s+)?(scorer|harness|extractor|loop|generator|engine|backtest|validator)\b[^.\n]{0,20}?\bexists?\b",
]
BACKTICK_PATH = re.compile(r"`([^`]+?\.(?:ts|tsx|py|json|jsonl|md))`")
SYMBOLISH = re.compile(r"\b([A-Z][a-zA-Z0-9]*[A-Z][a-zA-Z0-9]+)\b")  # CamelCase symbols

UNVERIFIED_RE = re.compile(r"\[UNVERIFIED", re.IGNORECASE)
TRAILER_RE = re.compile(r"^\s*Verified-this-session:\s*(.+)$", re.IGNORECASE | re.MULTILINE)


def active_patterns():
    pats = [re.compile(p, re.IGNORECASE) for p in STRONG]
    if STRICTNESS in ("strict", "paranoid"):
        pats += [re.compile(p, re.IGNORECASE) for p in PROSE]
    return pats


def load_verified_targets(cwd, session_id):
    """Set of tokens (paths/basenames/symbols/patterns) verified THIS session."""
    path = os.path.join(cwd, CI_DIR, f"verified-{session_id}.jsonl")
    targets = set()
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                rec = json.loads(line)
                for t in rec.get("targets", []):
                    t = str(t).strip()
                    if not t:
                        continue
                    targets.add(t.lower())
                    targets.add(os.path.basename(t).lower())
    except FileNotFoundError:
        pass
    except Exception:
        pass
    return targets


def claim_tokens(line):
    """Concrete tokens a repo-state line is asserting about."""
    toks = set()
    for m in BACKTICK_PATH.finditer(line):
        p = m.group(1)
        toks.add(p.lower())
        toks.add(os.path.basename(p).lower())
    for m in SYMBOLISH.finditer(line):
        toks.add(m.group(1).lower())
    for art in KNOWN_ARTIFACTS:
        if art.lower() in line.lower():
            toks.add(art.lower())
            toks.add(os.path.basename(art).lower())
    return toks


def get_write_content(tool_name, tool_input):
    """Text payload a Write/Edit/MultiEdit/commit is trying to land."""
    if tool_name in ("Write", "CreateFile", "create_file"):
        return tool_input.get("content") or tool_input.get("file_text") or ""
    if tool_name in ("Edit", "str_replace", "StrReplace"):
        return tool_input.get("new_string") or tool_input.get("new_str") or ""
    if tool_name in ("MultiEdit",):
        return "\n".join(
            e.get("new_string", "") for e in tool_input.get("edits", []) if isinstance(e, dict)
        )
    return ""


def gated_file_path(tool_name, tool_input):
    if tool_name in ("Write", "Edit", "MultiEdit", "CreateFile", "create_file",
                     "str_replace", "StrReplace"):
        fp = tool_input.get("file_path") or tool_input.get("path") or ""
        if fp and LEDGER_PATH_RE.search(fp):
            return fp
    return None


def commit_message(tool_input):
    """Extract inline commit message from a `git commit -m/--message` Bash call.
    Editor-driven commits (no -m) cannot be inspected pre-tool; that gap is
    documented in autoresearch/README.md and covered by the ledger-write gate."""
    cmd = tool_input.get("command", "")
    if "git commit" not in cmd:
        return None
    try:
        parts = shlex.split(cmd)
    except ValueError:
        return cmd  # unparseable -> scan raw, fail toward inspection
    msg = []
    i = 0
    while i < len(parts):
        p = parts[i]
        if p in ("-m", "--message") and i + 1 < len(parts):
            msg.append(parts[i + 1]); i += 2; continue
        if p.startswith("--message="):
            msg.append(p.split("=", 1)[1]); i += 1; continue
        if p.startswith("-m") and len(p) > 2:
            msg.append(p[2:]); i += 1; continue
        i += 1
    return "\n".join(msg) if msg else None


def evaluate(content, verified):
    """Return (ok, reason). ok=False -> deny."""
    pats = active_patterns()
    trailer_targets = set()
    for tm in TRAILER_RE.finditer(content):
        for t in re.split(r"[,\s]+", tm.group(1).strip()):
            if t:
                trailer_targets.add(t.lower())
                trailer_targets.add(os.path.basename(t).lower())

    offenders = []
    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if UNVERIFIED_RE.search(line):
            continue  # explicitly tagged unverified -> allowed
        if not any(p.search(line) for p in pats):
            if STRICTNESS == "paranoid" and BACKTICK_PATH.search(line):
                pass  # paranoid: a bare path-as-fact still needs proof
            else:
                continue
        toks = claim_tokens(line)
        backing = (toks & verified) or (toks & trailer_targets)
        # vague claim (no concrete token) but a trailer is present -> trust trailer
        if not toks and (trailer_targets & verified or trailer_targets):
            backing = True
        if not backing:
            offenders.append(line[:160])

    if offenders:
        first = offenders[0]
        reason = (
            "context-integrity: BLOCKED — repo-state (Class-1) assertion with no "
            "verification in THIS session.\n"
            f"  Offending claim: \"{first}\"\n"
            "  Resolve one of:\n"
            "   1) Verify now: run a read/grep/command this session that backs the "
            "claim (ci_record.py logs it), then retry.\n"
            "   2) Tag it: append \"[UNVERIFIED — recalled, not checked this session]\" "
            "to the claim's line.\n"
            "   3) Add a trailer: \"Verified-this-session: <path-or-symbol> ...\" naming "
            "what you read this session.\n"
            f"  ({len(offenders)} unverified claim(s) total. Strictness={STRICTNESS}; "
            "tune via CI_STRICTNESS.)"
        )
        return False, reason
    return True, ""


def deny(reason):
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": reason,
        }
    }))
    sys.exit(0)


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # cannot parse -> do not block

    tool_name = data.get("tool_name", "")
    tool_input = data.get("tool_input", {}) or {}
    cwd = data.get("cwd", os.getcwd())
    session_id = data.get("session_id", "unknown")

    try:
        verified = load_verified_targets(cwd, session_id)

        # Path 1: writing to a ledger / program.md / EVIDENCE
        fp = gated_file_path(tool_name, tool_input)
        if fp:
            content = get_write_content(tool_name, tool_input)
            ok, reason = evaluate(content, verified)
            if not ok:
                deny(reason)
            sys.exit(0)

        # Path 2: a git commit with an inline message
        if tool_name == "Bash":
            msg = commit_message(tool_input)
            if msg is not None:
                ok, reason = evaluate(msg, verified)
                if not ok:
                    deny(reason + "\n  (Commit blocked. Fix the message or verify, then retry.)")
            sys.exit(0)

        sys.exit(0)
    except Exception as e:
        # fail-open, but loud
        print(json.dumps({
            "systemMessage": f"context-integrity gate errored and ALLOWED (fail-open): {e}"
        }))
        sys.exit(0)


if __name__ == "__main__":
    main()
