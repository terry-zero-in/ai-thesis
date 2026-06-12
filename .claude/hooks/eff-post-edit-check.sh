#!/usr/bin/env bash
# PostToolUse(Edit|Write): fast per-file lint. Flag-gated. Yields to repo's own PostToolUse.
# NOTE: uses eslint per-file (reliable) for ts/js, stylelint for css. Per-file `tsc` is intentionally
# NOT used — single-file tsc ignores project config and emits false errors; project typecheck runs at Stop.
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/effsys.sh" 2>/dev/null || source "$HOME/.claude/hooks/lib/effsys.sh" 2>/dev/null || exit 0
EFF_REPO_HOOK=1
eff_read_input
eff_enabled || exit 0
eff_repo_has_hook "PostToolUse" && exit 0   # yield (e.g. basis-v2 format-on-write)
fp="$(eff_tool_input file_path)"; [ -z "$fp" ] && exit 0
[ -f "$fp" ] || exit 0
lines="$(wc -l < "$fp" 2>/dev/null || echo 0)"
if [ "${lines:-0}" -gt 2000 ] 2>/dev/null; then eff_hb "post-edit skip (>2k lines): $fp"; exit 0; fi
command -v npx >/dev/null 2>&1 || exit 0
out=""; rc=0
case "$fp" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs)
    out="$(cd "$(dirname "$fp")" 2>/dev/null && eff_timeout 15 npx --no-install eslint "$fp" 2>&1)"; rc=$?
    out="$(printf '%s' "$out" | head -25)" ;;
  *.css)
    npx --no-install stylelint --version >/dev/null 2>&1 || exit 0
    out="$(eff_timeout 15 npx --no-install stylelint "$fp" 2>&1)"; rc=$?
    out="$(printf '%s' "$out" | head -25)" ;;
  *) exit 0 ;;
esac
# 127 = tool not installed; treat as skip. Block only on real lint failures.
if [ "$rc" -ne 0 ] && [ "$rc" -ne 127 ] && [ -n "$out" ]; then
  eff_block "Post-edit check failed on $(basename "$fp"):"$'\n'"$out"
fi
exit 0
