# AI Thesis — Portal (web)

Next.js 16 + React 19 + Tailwind v4 + Supabase SSR. Chrome (sidebar, top
bar, right rail, command palette, shortcuts overlay, theme tokens) is
ported from the Reticle codebase
(`github.com/terry-zero-in/reticle-optimizeclaude`) per the design
hierarchy in `../DESIGN_REFERENCES.md`. Canvas content per page is built
fresh from Tier 2/3/4 references.

## Getting started

```bash
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm install
npm run dev                        # http://localhost:3000
```

## Layout

```
src/
  app/                 — App Router routes
    layout.tsx           shell mount, fonts, metadata
    globals.css          design tokens (verbatim from Reticle Stage 3)
    page.tsx             /          → Dashboard
    universe/page.tsx    /universe  → Universe table (THS-52)
    portfolio/page.tsx   /portfolio → Portfolio book (THS-55)
    regime/page.tsx      /regime    → Macro gauges (THS-56)
    aiq/page.tsx         /aiq       → AIQ rubric editor (THS-54)
    memos/page.tsx       /memos     → Investment memos
    decisions/page.tsx   /decisions → Decision log (THS-57)
    settings/page.tsx    /settings  → Account + theme
  components/
    shell/               Sidebar, TopBar, CtxPanel, CmdPalette, …
    primitives/          Btn, Chip, Pill, KeyChips, icons, PageStub
    overlays/            Modal, Toast
    tweaks/              Dev-mode tweaks panel (theme, density, etc.)
  hooks/                 useShellKeyboard, ctx-panel-context, useTweaks…
  lib/                   cn, theme, screens, shortcuts
```

## What's stubbed in THS-51

- All routes mount and render a `PageStub` (chrome boots, design tokens load)
- CtxPanel renders an empty placeholder (per-page rails ship with each page ticket)
- Auth gate not wired yet — single-tenant v1, Supabase RLS does the protection.
  Magic-link login lands as a follow-on (likely THS-51b or rolled into THS-52).

## What's wired

- ⌘K command palette (jump-to-screen)
- ⌘\\ context panel toggle
- ⌘B sidebar collapse
- ? keyboard shortcuts overlay
- G-prefix navigation (G,U → /universe, G,P → /portfolio, etc.)
- Theme switcher (5 palettes, applies CSS vars on :root)
