#!/usr/bin/env bash
# Stop: the verification gate. Flag-gated. Yields to repo's own Stop hook. Anti-loop hard cap.
# Blocks ONLY on failed project checks. Completion-claim-without-evidence → soft warning (never a hard
# trap, to avoid false-blocking conversational turns). Research/conversation turns are never blocked.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/effsys.sh" 2>/dev/null || source "$HOME/.claude/hooks/lib/effsys.sh" 2>/dev/null || exit 0
EFF_REPO_HOOK=1
eff_read_input
eff_enabled || exit 0
[ -n "${SKIP_VERIFY:-}" ] && exit 0
pd="$(eff_proj_dir)"; sd="$(eff_session_dir)"
[ -f "$sd/CONVERSATIONAL" ] && exit 0
eff_repo_has_hook "Stop" && exit 0   # yield (e.g. basis-v2 stop-verify)

# Anti-loop: after 2 consecutive blocks, never trap — warn and let through.
cf="$sd/stopgate-blocks"; n=0; [ -f "$cf" ] && n="$(cat "$cf" 2>/dev/null || echo 0)"
if [ "${n:-0}" -ge 2 ] 2>/dev/null; then
  : > "$cf"
  jq -cn '{hookSpecificOutput:{hookEventName:"Stop",additionalContext:"[eff stop-gate] still unconfirmed after 2 blocks — not trapping. Run /verify and append EVIDENCE."}}'
  exit 0
fi

# Only act if files changed (git dirty as proxy). Clean tree = conversation/research → never block.
if ! git -C "$pd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then : > "$cf"; exit 0; fi
[ -z "$(git -C "$pd" status -s 2>/dev/null)" ] && { : > "$cf"; exit 0; }

# Run fast checks from the repo check-set (committed .claude/checks.json preferred)
cj="$(eff_checks_file)"
[ -n "$cj" ] && [ -f "$cj" ] || { : > "$cf"; exit 0; }
appdir="$pd/$(jq -r '.app_dir // "."' "$cj" 2>/dev/null)"
pm="$(jq -r '.pkg_manager // "npm"' "$cj" 2>/dev/null)"
fail=""
while IFS= read -r s; do
  [ -z "$s" ] && continue
  name="$(jq -r --arg s "$s" '.scripts[$s] // empty' "$cj" 2>/dev/null)"
  [ -z "$name" ] && continue
  if [ "$s" = "lint" ]; then
    # Δ-aware: lint ONLY files changed this session — a red baseline must not induce
    # unsolicited "fixes" to pre-existing errors (scope creep by gate pressure).
    changed="$(cd "$pd" && { git diff --name-only HEAD 2>/dev/null; git ls-files --others --exclude-standard 2>/dev/null; } | grep -E '\.(ts|tsx|js|jsx|mjs|cjs)$' | grep -vE '^\.claude/' || true)"
    [ -z "$changed" ] && continue
    o="$(cd "$appdir" 2>/dev/null && printf '%s\n' "$changed" | sed "s|^|$pd/|" | eff_timeout 120 xargs npx --no-install eslint 2>&1)"; rc=$?
    o="$(printf '%s' "$o" | tail -15)"
    [ "$rc" -ne 0 ] && [ "$rc" -ne 127 ] && fail="${fail}[lint (changed files only)] FAILED:"$'\n'"$o"$'\n'
  else
    o="$(cd "$appdir" 2>/dev/null && eff_timeout 120 "$pm" run "$name" 2>&1)"; rc=$?
    o="$(printf '%s' "$o" | tail -15)"
    [ "$rc" -ne 0 ] && fail="${fail}[$s] FAILED:"$'\n'"$o"$'\n'
  fi
done < <(jq -r '.fast_check[]? // empty' "$cj" 2>/dev/null)

if [ -n "$fail" ]; then
  echo "$((n+1))" > "$cf"
  eff_block "Verification gate: checks failed — fix, then finish."$'\n'"$fail"
  exit 0
fi
: > "$cf"
exit 0
