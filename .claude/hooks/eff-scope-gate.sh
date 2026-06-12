#!/usr/bin/env bash
# PreToolUse(Edit|Write): deny edits outside an armed SCOPE pin. Flag-gated. Yields to repo's own PreToolUse.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/effsys.sh" 2>/dev/null || source "$HOME/.claude/hooks/lib/effsys.sh" 2>/dev/null || exit 0
EFF_REPO_HOOK=1
eff_read_input
eff_enabled || exit 0
fp_pre="$(eff_tool_input file_path)"
# Pin anchors to the EDITED FILE's repo (cross-repo edits from any cwd stay gated).
pd="$(eff_file_repo "$fp_pre")"; [ -z "$pd" ] && pd="$(eff_proj_dir)"
# Yield only if THAT repo runs its own PreToolUse hooks AND the session is anchored there (its hooks actually loaded).
if [ -f "$pd/.claude/settings.json" ] && [ -z "${EFF_REPO_HOOK:-}" ] && [ "$pd" = "$(eff_proj_dir)" ]; then
  jq -e '(.hooks.PreToolUse // []) | length > 0' "$pd/.claude/settings.json" >/dev/null 2>&1 && exit 0
fi
sc="$pd/.claude/state/SCOPE.json"
[ -f "$sc" ] || exit 0
jq -e '.armed==true' "$sc" >/dev/null 2>&1 || exit 0
fp="$(eff_tool_input file_path)"; [ -z "$fp" ] && exit 0
# allow if file matches any pinned path (suffix or substring)
if jq -e --arg f "$fp" '((.files // []) + (.allow // [])) | any(. as $p | ($f|endswith($p)) or ($f|contains($p)))' "$sc" >/dev/null 2>&1; then
  exit 0
fi
pins="$(jq -r '((.files // []) + (.allow // [])) | join(", ")' "$sc" 2>/dev/null)"
eff_deny "Out of pinned scope: $fp. Pinned: ${pins:-<none>}. Ask Terry or run /unpin."
exit 0
