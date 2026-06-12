#!/usr/bin/env bash
# SessionStart: inject a compact brief. Cannot block. Always-on (additive to any repo hook).
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/effsys.sh" 2>/dev/null || source "$HOME/.claude/hooks/lib/effsys.sh" 2>/dev/null || exit 0
EFF_REPO_HOOK=1
eff_read_input
eff_repo_has_hook "SessionStart" && [ -z "${EFF_REPO_HOOK:-}" ] && exit 0   # repo brief takes over (no double brief)
pd="$(eff_proj_dir)"; repo="$(basename "$pd" 2>/dev/null)"
en="DISARMED (blocking off)"; eff_enabled && en="ARMED"
brief="Manual: ~/.claude/OPERATING_MANUAL.md | Gates: blocking=[$en] scope/stop/preflight/guardrails/post-edit · always=heartbeat/notify/handoff"

git_block=$'\n'"repo: $repo"
if git -C "$pd" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  br="$(git -C "$pd" branch --show-current 2>/dev/null)"
  st="$(git -C "$pd" status -sb 2>/dev/null | head -6)"
  cm="$(git -C "$pd" log --oneline -3 2>/dev/null)"
  git_block=$'\n'"repo: $repo | branch: ${br:-?}"$'\n'"git status:"$'\n'"$st"$'\n'"last 3 commits:"$'\n'"$cm"
fi

sc="$pd/.claude/state/SCOPE.json"; sp="none"
if [ -f "$sc" ] && jq -e '.armed==true' "$sc" >/dev/null 2>&1; then
  sp="ARMED → $(jq -rc '((.files // []) + (.allow // []))' "$sc" 2>/dev/null)"
fi

envline=""
ex="$pd/.env.example"; [ -f "$pd/.env.local.example" ] && ex="$pd/.env.local.example"
if [ -f "$ex" ]; then
  have="$pd/.env"; [ -f "$pd/.env.local" ] && have="$pd/.env.local"
  if [ -f "$have" ]; then
    miss=""
    while IFS= read -r name; do
      [ -z "$name" ] && continue
      grep -q "^${name}=" "$have" 2>/dev/null || miss="$miss $name"
    done < <(grep -oE '^[A-Z][A-Z0-9_]+' "$ex" 2>/dev/null | sort -u)
    [ -n "$miss" ] && envline=$'\n'"env MISSING in $(basename "$have"):$miss" || envline=$'\n'"env: all $(basename "$ex") names present"
  else
    envline=$'\n'"env: no .env/.env.local present (template $(basename "$ex"))"
  fi
fi

portline=""
cj="$(eff_checks_file)"
if [ -n "$cj" ] && [ -f "$cj" ]; then
  port="$(jq -r '.dev_port // empty' "$cj" 2>/dev/null)"
  if [ -n "$port" ]; then
    if lsof -i ":$port" -sTCP:LISTEN >/dev/null 2>&1; then portline=$'\n'"dev port $port: IN USE"; else portline=$'\n'"dev port $port: free"; fi
  fi
fi

evline=""
ev="$HOME/.claude/state/EVIDENCE.md"
[ -f "$ev" ] && evline=$'\n'"last EVIDENCE: $(grep -E '^## ' "$ev" 2>/dev/null | tail -1)"

eff_inject "$brief$git_block"$'\n'"scope pin: $sp$envline$portline$evline"
exit 0
