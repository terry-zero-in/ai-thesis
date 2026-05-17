# AI Thesis v2

Multi-factor AI-investing scoring engine + portfolio portal.
Ranks ~70 public-equity names across 5 layers using Q / G / V / AIQ factors with M and S overlays. Drives a $100K deployment slate, tracks position performance, refreshes weekly via a Supabase-scheduled chain.

**Owner:** Terry Turner
**Project tracker:** [AI Thesis v2 — Scoring Engine & Portfolio](https://linear.app/basisuw/project/ai-thesis-v2-scoring-engine-and-portfolio-79a38aec2b49) in Linear (Thesis team)

---

## For Claude Code (and any AI agent working on this repo)

**Read [`CLAUDE.md`](./CLAUDE.md) first**, then [`docs/SESSION_NOTES.md`](./docs/SESSION_NOTES.md) for cold-start state. `CLAUDE.md` defines the operating posture (autonomous by default); `SESSION_NOTES.md` is the build's running log — what shipped, what's parked, what's next. The autonomous-by-default contract means picking up the next Linear ticket without asking permission.

---

## Repo layout

```
ai-thesis/
├── CLAUDE.md                          ← read FIRST on any session
├── README.md                          ← you are here
├── DESIGN_REFERENCES.md               ← read BEFORE touching UI
├── docs/
│   ├── SESSION_NOTES.md               ← running build log (read on cold start)
│   ├── HANDOFF.md                     ← Terry's cross-session state (Perplexity-maintained)
│   ├── PARKED.md                      ← parked items + revisit conditions (code-grounded detail)
│   ├── AI-Thesis-v2-Algorithm-and-Deployment.md
│   ├── AI-Thesis-v2-Master-Design-Spec.md
│   └── aiq-drafts-pipeline.md         ← AIQ draft batch operator runbook
├── web/                               ← Next.js 16 portal (Epic 4 — live)
│   ├── src/app/                       ← 15 real routes + /settings stub
│   └── src/lib/                       ← server-side data loaders + types
├── supabase/
│   ├── migrations/                    ← 50 sequenced migrations
│   └── functions/                     ← 19 edge functions (ingest + compute + LLM)
├── prototype/                         ← static React-via-Babel reference (frozen May 15 2026)
└── design-references/
    ├── 01-base-reticle-screenshots/        ← BASE: sidebar, right panel, motion
    ├── 02-canvas-primary-basis-proforma/   ← PRIMARY canvas styling
    ├── 03-canvas-secondary-investment-portal/
    └── 04-additional-basis-q-series/
```

---

## Build state (as of session 8 — 2026-05-17)

| Epic | Scope | Status |
|---|---|---|
| **1 — Foundation** | Supabase schema, FMP/Polygon/SEC ingestion, universe seed | ✅ shipped |
| **2 — Tier-A scoring** | Q, G, V, AIQ compute + composite | ✅ shipped |
| **3 — Overlays** | AIQ rubric, depreciation flags, macro gate, concentration tax | ✅ shipped |
| **4 — Portal UI** | Reticle-based Next.js portal, all surfaces wired to real data | ✅ shipped (15 routes live) |
| **5 — Tier-B scoring** | Momentum + sentiment overlays (M, S) | ✅ engine shipped, S is no-op until options ingest live in prod |
| **6 — Maintenance** | Concentration tax, backtest, walk-forward | ✅ engine shipped; backtest UI live |

**Overall: ~85% complete.** Remaining work is production cutover (API keys, Vercel deploy, Epic-6 auth hardening), visual-fidelity polish vs Reticle/Basis Proforma references, and runtime validation once cron jobs are live.

See `docs/SESSION_NOTES.md` for the per-session running log.

---

## Stack

- **Frontend:** Next.js 16 + React 19 + Tailwind v4, deployed to Vercel
- **Backend:** Supabase (Postgres + Edge Functions + Auth + pg_cron)
- **Data:** FMP (fundamentals/consensus/prices), Polygon (options), SEC EDGAR (Form 4 + 10-K), FINRA (short interest)
- **LLMs:** Claude Sonnet 4.6 (daily memo, AIQ drafts), Claude Opus 4.7 (weekly ranking)
- **Scheduling:** pg_cron + pg_net (Saturday Q→G→V→composite chain; daily macro/memo; weekday options/insider)

---

## Quick start

### Run the portal locally

```bash
cd web
cp .env.local.example .env.local      # fill in Supabase URL + anon key
npm install
npm run dev
```

The portal renders in **fixture mode** when env vars are unset — all pages show synthetic data so you can navigate without a live DB. Real data lights up once `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (server) are set.

### Run the engine tests

```bash
node --test --experimental-strip-types supabase/functions/_shared/*.test.ts
# 335 pass / 0 fail / 0 skip
```

### Typecheck the web app

```bash
cd web && npx tsc --noEmit
```

### Migrations

Migrations are idempotent and sequenced by timestamp. Each has a rollback in `supabase/migrations/rollback/`. Apply against a fresh database in order; on a live DB use `supabase db push` or apply individually.

---

## Surfaces (Next.js routes)

| Route | Purpose |
|---|---|
| `/` | Dashboard — tier distribution, macro gate, top movers, tier crossings |
| `/universe` | Sortable scorecard across all 50 names |
| `/universe/[ticker]` | Per-name detail (factor breakdown, history, AIQ rubric) |
| `/portfolio` | $100K deployment slate, position P&L, reserve |
| `/regime` | Macro gauges + market-regime classification |
| `/aiq` | AIQ rubric editor index (universe-wide coverage table) |
| `/aiq/[ticker]` | Per-name rubric editor with history |
| `/aiq-drafts` | LLM-generated AIQ draft review + promotion queue |
| `/memos` | Daily + weekly memo archive |
| `/decisions` | Decision log / position changes |
| `/backtest` | Backtest run history + cumulative-return sparklines |
| `/login`, `/logout`, `/auth/*` | Supabase auth flow |
| `/settings` | (stub for v1) account, theme, cron status |

---

## Honesty before agreement

If a discovered fact invalidates the spec, surface it — don't quietly route around it. See `CLAUDE.md` for the full operating contract. The build only stays trustworthy if discrepancies are flagged (e.g. session 8 dep-flag SEC verification batch).
