#!/usr/bin/env bash
# context-integrity :: SessionStart  (Lane C)
# Ensures the per-session verification log dir exists and records a session-start
# marker. We do NOT wipe the log: session_id is the partition key and is stable
# across resume/compact, so verifications made earlier in THIS logical session
# must keep counting. A brand-new session has a fresh (absent) log automatically.
set -euo pipefail
INPUT="$(cat)"
CWD="$(printf '%s' "$INPUT" | jq -r '.cwd // "."')"
SID="$(printf '%s' "$INPUT" | jq -r '.session_id // "unknown"')"
SRC="$(printf '%s' "$INPUT" | jq -r '.source // "startup"')"
DIR="${CI_STATE_DIR:-.context-integrity}"
mkdir -p "$CWD/$DIR"
printf '{"ts":"%s","session_id":"%s","tool":"SessionStart","source":"%s","targets":[]}\n' \
  "$(date +%Y-%m-%dT%H:%M:%S)" "$SID" "$SRC" >> "$CWD/$DIR/verified-$SID.jsonl"
# Best-effort: keep runtime state out of git.
GI="$CWD/.gitignore"
if [ -f "$GI" ] && ! grep -qxF "$DIR/" "$GI" 2>/dev/null; then
  printf '%s/\n' "$DIR" >> "$GI" || true
fi
exit 0
