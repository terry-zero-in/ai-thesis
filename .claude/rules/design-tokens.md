---
paths:
  - "**/*.css"
  - "**/*.tsx"
  - "**/styles/**"
---
# Design token law (ai-thesis)
1. FIRST ACTION on any visual change: read this repo's token source of truth — `web/src/app/globals.css` (the `:root` block; tokens flow via `@import "tailwindcss"`, there is no tailwind.config). CODE WINS over any remembered palette.
2. Never invent or hardcode hex/oklch values from memory. Quote the token name + current value from `web/src/app/globals.css` before changing it.
3. ⚠️ VERIFIED 2026-06-11 — accent is CORRECT, not a trap: `--accent: oklch(59.06% 0.2232 272)` IS the brand **Basis Indigo** (≈ #5468FF). There is **no `--chart-1`** token in this repo. Older notes claiming "`--accent` resolves to hover-gray; brand indigo is `--chart-1`" are STALE — they predate the Basis-Indigo reskin, which swapped token VALUES while preserving names. Always read the file; code wins.
4. Numbers are mono, tabular-nums, right-aligned. Accent is precious. No glassmorphism, gradient mesh, rounded-xl defaults, rainbow charts.
5. Scope: change only the named element. A header change is a header change.
