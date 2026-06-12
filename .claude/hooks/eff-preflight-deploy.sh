#!/usr/bin/env bash
# PreToolUse(Bash) for supabase/vercel/psql: deny on failed preflight. Flag-gated. Fail-safe.
# Cheap checks here (ref match, paused, TBD); deep live DB/RLS probe lives in the /preflight skill (MCP).
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/effsys.sh" 2>/dev/null || source "$HOME/.claude/hooks/lib/effsys.sh" 2>/dev/null || exit 0
EFF_REPO_HOOK=1
eff_read_input
eff_enabled || exit 0
cmd="$(eff_tool_input command)"; [ -z "$cmd" ] && exit 0
echo "$cmd" | grep -qiE '\b(supabase|vercel|psql)\b' || exit 0
pd="$(eff_proj_dir)"; sd="$(eff_session_dir)"; facts="$HOME/.claude/state/terry-facts.json"
repokey="$(basename "$pd")"

# 30-min pass cache per repo
hash="$(printf '%s' "$pd" | md5 -q 2>/dev/null || printf '%s' "$pd" | md5sum 2>/dev/null | cut -d' ' -f1)"
ck="$sd/preflight-pass-$hash"
if [ -f "$ck" ]; then
  now="$(date +%s)"; mt="$(stat -f %m "$ck" 2>/dev/null || stat -c %Y "$ck" 2>/dev/null || echo 0)"
  [ $(( now - mt )) -lt 1800 ] && exit 0
fi

deny=""
if echo "$cmd" | grep -qiE 'supabase'; then
  ref="$(jq -r --arg k "$repokey" '.repos[$k].supabase.project_ref // empty' "$facts" 2>/dev/null)"
  status="$(jq -r --arg k "$repokey" '.repos[$k].supabase.status // empty' "$facts" 2>/dev/null)"
  # Portable fallback (cloud has no terry-facts.json): canonical ref from the committed deploy rule.
  if [ -z "$ref" ] || echo "$ref" | grep -qiE 'TBD'; then
    dref="$(grep -oE '\*\*`[a-z]{20}`\*\*' "$pd/.claude/rules/deploy.md" 2>/dev/null | head -1 | tr -d '`*')"
    [ -n "$dref" ] && ref="$dref"
  fi
  if [ -z "$ref" ] || echo "$ref" | grep -qiE 'TBD'; then
    deny="Supabase project ref for '$repokey' is unknown/TBD in terry-facts.json — confirm it before running (wrong-project guard)."
  else
    cref="$(echo "$cmd" | grep -oE '[a-z]{20}' | head -1)"
    [ -n "$cref" ] && [ "$cref" != "$ref" ] && deny="Supabase ref mismatch: command uses '$cref' but '$repokey' = '$ref' (terry-facts.json)."
    echo "$status" | grep -qiE 'paused|inactive' && deny="${deny:+$deny | }Supabase project '$ref' is PAUSED — resume before any DB/deploy op."
  fi
fi

if [ -n "$deny" ]; then eff_deny "Preflight: $deny"; exit 0; fi
: > "$ck" 2>/dev/null
eff_hb "preflight PASS | $repokey"
exit 0
