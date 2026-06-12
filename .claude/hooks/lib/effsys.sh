#!/usr/bin/env bash
# Shared library for the efficiency-system hooks. SOURCE this; do not execute.
# IRON RULE: hooks FAIL SAFE. On any internal error or ambiguity, the caller exits 0 (no block).
# Blocking behaviour is gated behind ~/.claude/state/SYSTEM_ENABLED so the system is inert until armed.

EFF_STATE="$HOME/.claude/state"
EFF_INPUT=""

eff_read_input() { EFF_INPUT="$(cat 2>/dev/null || true)"; }

# Top-level field from the hook JSON on stdin. Usage: eff_field session_id
eff_field() { printf '%s' "$EFF_INPUT" | jq -r --arg k "$1" '.[$k] // empty' 2>/dev/null; }
# Nested tool_input.<key>. Usage: eff_tool_input command
eff_tool_input() { printf '%s' "$EFF_INPUT" | jq -r --arg k "$1" '.tool_input[$k] // empty' 2>/dev/null; }

# Master switch for BLOCKING hooks: global flag (this machine) OR repo-committed ARMED marker
# (.claude/hooks/ARMED — the portable arming mechanism; cloud sandboxes have no ~/.claude).
eff_enabled() {
  [ -f "$EFF_STATE/SYSTEM_ENABLED" ] && return 0
  [ -f "$(eff_proj_dir)/.claude/hooks/ARMED" ]
}

# Check-set config: committed .claude/checks.json wins (travels to cloud); legacy .claude/state/checks.json fallback.
eff_checks_file() {
  local pd; pd="$(eff_proj_dir)"
  if [ -f "$pd/.claude/checks.json" ]; then printf '%s' "$pd/.claude/checks.json"
  elif [ -f "$pd/.claude/state/checks.json" ]; then printf '%s' "$pd/.claude/state/checks.json"
  fi
}

# Project dir: prefer CLAUDE_PROJECT_DIR, then input.cwd, then PWD.
eff_proj_dir() {
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then printf '%s' "$CLAUDE_PROJECT_DIR"
  else local c; c="$(eff_field cwd)"; printf '%s' "${c:-$PWD}"; fi
}

# Does the current repo define its OWN hook for EVENT? (yield-to-repo — never double-fire)
# When the caller IS the repo hook (EFF_REPO_HOOK=1), never yield — else repo copies self-yield and die.
eff_repo_has_hook() {
  [ -n "${EFF_REPO_HOOK:-}" ] && return 1
  local ev="$1" pd; pd="$(eff_proj_dir)"
  [ "$pd" = "$HOME" ] && return 1   # never treat ~/.claude (global config) as a repo's own hooks
  local f="$pd/.claude/settings.json"
  [ -f "$f" ] || return 1
  jq -e --arg ev "$ev" '(.hooks[$ev] // []) | length > 0' "$f" >/dev/null 2>&1
}

# Repo root that OWNS a file (walk up via git; empty if none). Pins anchor to the file's repo, not session cwd.
eff_file_repo() {
  local d; d="$(dirname "$1" 2>/dev/null)"
  git -C "$d" rev-parse --show-toplevel 2>/dev/null
}

eff_session_dir() {
  local sid; sid="$(eff_field session_id)"; sid="${sid:-unknown}"
  local d="$EFF_STATE/$sid"; mkdir -p "$d" 2>/dev/null; printf '%s' "$d"
}

eff_is_remote() { [ -n "${CLAUDE_CODE_REMOTE:-}" ]; }

eff_hb() {
  local d; d="$(eff_session_dir)"
  printf '%s | %s\n' "$(date '+%H:%M:%S')" "$1" >> "$d/heartbeat.log" 2>/dev/null || true
}

# Portable timeout: macOS lacks GNU timeout. Fall back to gtimeout, else run unbounded.
eff_timeout() {
  local secs="$1"; shift
  if command -v timeout >/dev/null 2>&1; then timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then gtimeout "$secs" "$@"
  else "$@"; fi
}

# --- output emitters (print JSON to stdout, then caller exits 0) ---
eff_deny()  { jq -cn --arg r "$1" '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'; }
eff_block() { jq -cn --arg r "$1" '{decision:"block",reason:$r}'; }
eff_inject(){ jq -cn --arg c "$1" '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$c}}'; }
