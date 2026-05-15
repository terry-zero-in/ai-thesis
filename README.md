# AI Thesis v2

Multi-factor AI-investing scoring engine + portfolio dashboard.
Ranks ~70 public-equity names across 5 layers using Q / G / V / AIQ factors with M and S overlays. Drives a $100K deployment slate, tracks position performance, refreshes weekly.

**Owner:** Terry Turner
**Project tracker:** [AI Thesis v2 — Scoring Engine & Portfolio](https://linear.app/basisuw/project/ai-thesis-v2-scoring-engine-and-portfolio-79a38aec2b49) in Linear (Thesis team)

---

## For Claude Code (and any AI agent working on this repo)

**Read [`CLAUDE.md`](./CLAUDE.md) first.** It defines the operating posture (autonomous by default), when to ask, when not to, commit conventions, and the start-of-session checklist. Terry expects you to crank through tickets independently — don't ask permission to start the next one in build order.

---

## What's in this repo

```
ai-thesis/
├── CLAUDE.md                          ← read this FIRST on any session
├── README.md                          ← you are here
├── DESIGN_REFERENCES.md               ← read this BEFORE touching the UI
├── docs/
│   ├── AI-Thesis-v2-Algorithm-and-Deployment.md   ← algorithm spec (functional source of truth)
│   └── AI-Thesis-v2-Master-Design-Spec.md          ← design tokens, components, wireframes
├── prototype/                         ← static React-via-Babel prototype (working portal as of May 15 2026)
│   ├── index.html
│   ├── app.jsx
│   ├── components.jsx
│   ├── page-*.jsx                     ← one per route (dashboard, universe, detail, portfolio, regime, aiq, memos)
│   ├── data.js
│   └── styles.css
└── design-references/
    ├── 01-base-reticle-screenshots/   ← BASE: sidebar, right panel, motion, states
    ├── 02-canvas-primary-basis-proforma/   ← PRIMARY canvas styling reference
    ├── 03-canvas-secondary-investment-portal/   ← supplementary aesthetic
    └── 04-additional-basis-q-series/  ← additional component/idea mining
```

---

## Build sequence (Linear epic order)

Build sequentially. Do **not** parallelize — each phase depends on the previous one.

1. **Epic 1 — Foundation** (THS-29) — Supabase schema, FMP ingestion, universe seed
2. **Epic 2 — Tier-A Scoring Engine** (THS-30) — Q, G, V, AIQ compute live
3. **Epic 3 — Overlays** (THS-31) — AIQ rubric, depreciation flags, macro gate
4. **Epic 4 — Portal UI** (THS-32) — promote `prototype/` to a proper Next.js app, wire to real data
5. **Epic 5 — Tier-B Scoring** (THS-33) — momentum + sentiment overlays
6. **Epic 6 — Maintenance** (THS-34) — concentration tax, backtest, walk-forward

Tickets THS-35 through THS-67 are sub-issues under those epics.

---

## Quick start

Open `prototype/index.html` in a browser to see the current state of the UI. Everything renders client-side; no build step required.

For real work:
- Functional spec lives in `docs/AI-Thesis-v2-Algorithm-and-Deployment.md`
- Design system lives in `docs/AI-Thesis-v2-Master-Design-Spec.md`
- Design-source hierarchy lives in `DESIGN_REFERENCES.md` — **read this before changing any UI**

---

## Stack (target)

- Frontend: Next.js 15 + React 19 + Tailwind v4, deployed to Vercel
- Backend: Supabase (Postgres + Edge Functions + Auth)
- Data: FMP for fundamentals/consensus/prices, Polygon for options, FINRA short-interest, SEC Form 4
- LLMs: Claude Sonnet 4.6 (daily memo), Claude Opus 4.7 (weekly ranking)
- Cron: Supabase scheduled functions

The `prototype/` directory uses static React-via-Babel as a visual fidelity reference only. The real Next.js implementation lives in `app/` once Epic 4 starts.
