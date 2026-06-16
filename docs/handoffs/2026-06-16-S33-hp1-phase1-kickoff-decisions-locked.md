# S33 Handoff — HP-1 Phase 1 kickoff: decisions locked, fork plan ready (no code yet)

**Date:** 2026-06-16 (UTC)
**Branch:** `claude/kind-ride-d2uqi9`
**HEAD:** this handoff commit, on top of `main` @ `a089ee0` (squash-merge of PR #18 = the S32 handoff).
**Commits ahead of `origin/main`:** 1 (this handoff doc only).
**Continuation of:** S32 (`docs/handoffs/2026-06-16-S32-hp1-phase0-engine-truth-lookahead-fix.md`). Same session, checkpointed before Terry compacts.

---

## HEADLINE

Phase 0 is merged and done. This was **Phase 1 kickoff prep** — no code shipped. Two things got fully worked out and are banked below so the next session can execute the fork cold:
1. **The ticker delta** (what data coverage HP-1 needs that v2 lacks).
2. **The fork inventory** (exactly what to keep/strip/adapt + execution order).

Plus **all four Phase 1 decisions are locked** (Terry: "go with defaults", 2026-06-16). The build is **blocked on two Terry-side actions only**: (a) create the private `hp1` repo + grant this session access, and (b) approve MCP writes (Linear/Supabase are approval-gated this session). Nothing else blocks Phase 1.

---

## Operating posture (this segment)

- Terry: **"go with defaults"** on all four decisions. Then: *"if this is a good time to start clean then we can do a handoff and /sch and then ill compact."* → checkpoint now, compact after.
- Autonomy reminder (CLAUDE.md): the repo/Vercel/Supabase/secrets items are the mission-critical / external class — correct to surface, not guess. They're now decided; execution waits on Terry's actions + approvals.

---

## Decisions — LOCKED 2026-06-16 (Terry "go with defaults")

| # | Decision | Resolution |
|---|---|---|
| 1 | Supabase topology | **Same v2 Supabase project + a new `hp1` schema.** HP-1 reads v2's `public.*` market-data tables read-only and writes only to `hp1.*`. (Separate project was rejected — it would force duplicating all ingestion.) |
| 2 | The 19 uncovered tickers | **Add to `public.universe` as a data-only `kind='hp1'`.** Covers their prices/fundamentals for HP-1 **without** perturbing v2's locked 50-name *scored* composite. (NOT `kind='investable'`.) |
| 3 | `hp1` GitHub repo | **Terry creates private `terry-zero-in/hp1` and grants this session access.** ⚠️ PENDING TERRY — the `list_repos`/`add_repo` (claude-code-remote) tooling is NOT available in this session, so this cannot be done from inside Claude Code. The fork cannot start until the repo exists and is in MCP scope. |
| 4 | Vercel + secrets | Deferred to when the app is ready to deploy: new Vercel project + pipeline secrets (FMP, Polygon, Supabase service-role). |

---

## Ticker delta (computed this session — agent-verified)

**v2's universe is 50 names, NOT 70.** The "70" in old docs/tickets was a typo (Terry-confirmed in the seed migration `supabase/migrations/20260515000200_e13_seed_universe.sql`, which hard-asserts exactly 50 rows). Canonical source = the `public.universe` table, read at runtime by one helper, `supabase/functions/_shared/supabase.ts` → `activeTickers({kind})`.

- **Shared (31):** AMAT, AMD, AMZN, ANET, ARM, ASML, AVGO, CDNS, CEG, CRWD, DDOG, GEV, GOOGL, KLAC, LRCX, META, MRVL, MSFT, MU, NET, NOW, NRG, NVDA, ORCL, PLTR, SNOW, SNPS, TLN, TSM, VRT, VST
- **In HP-1, NOT in v2 → must be ingested (19):** `AAPL, ALAB, APLD, APP, CLS, COHR, CRDO, CRWV, DELL, FN, IREN, MPWR, NBIS, PANW, RDDT, SMCI, TEM, TER, TSLA`
- **In v2, NOT in HP-1 (dropped, no action):** ADBE, AES, AI, BE, CRM, DLR, EQIX, ESTC, ETN, ETR, IBM, INTU, MDB, NEE, PWR, S, SAP, WDAY, ZS

**Mechanism (zero function duplication):** ⚠️ PREREQUISITE (Codex catch on PR #19 — verified): the `universe_kind_check` constraint currently allows only `('investable','benchmark','macro')` (`supabase/migrations/20260516001500_e35_vix_macro_kind.sql:20`), so a `kind='hp1'` insert **fails** until you ship a migration extending the constraint to include `'hp1'`. Also widen the `activeTickers` kind union (`"investable" | "benchmark" | "all"`, `supabase/functions/_shared/supabase.ts:46`) **only if** a loader queries `kind:'hp1'` explicitly — not needed for `ingest-prices` (it uses `"all"`, so `hp1` rows are already covered). Do the constraint migration FIRST, then insert the 19 into `public.universe` with `kind='hp1'`; every ingest fn (`ingest-prices` uses `kind:"all"`, others filter `investable`) and every scorer derive their ticker list from this table. ⚠️ For HP-1's data to flow, **`ingest-prices` must include `kind='hp1'`** (it already pulls `"all"`, so `hp1`-kind rows are covered) and fundamentals/consensus must be extended to include `hp1`-kind if HP-1's Core overlay needs them — confirm which ingest fns should treat `hp1` like `investable` for *data only*. Backfill history once via `ingest-prices?days=2000`. Recent-IPO names (CRWV, NBIS, IREN, APLD, ALAB, CRDO, TEM, RDDT) have <130 trading days → the engine drops them until history accrues (data-availability limit, not a wiring bug).

**Pre-existing v2 bug (not fixed here):** `web/src/lib/universe-fixture.ts` has drifted 10 names from the DB seed. Dev-only fixture, doesn't feed ingestion. Flag for a separate v2 fix.

---

## Fork inventory (computed this session — agent-verified)

The app is Next.js 16 / React 19 / Tailwind v4 under `web/`. **The frame carries over almost untouched; the work is rewiring data + building 4 new surfaces.**

**Single biggest coupling fact:** all 17 `web/src/lib/*-data.ts` loaders call `.from("table")` with **no `.schema()`** → they hit `public`. Every retained/adapted loader must be re-pointed to `hp1.*`. The Supabase client/server factories are schema-agnostic (no change).

**⚠️ CRITICAL FIRST FIX:** `web/src/app/layout.tsx` calls `getUnseenAlertCount()` (from `alerts-data.ts`) on **every** render against v2 tables. Stub/swap this first or the whole forked app errors on load.

### KEEP verbatim (the Reticle frame)
- `web/src/app/layout.tsx` (minus the alert call), `components/shell/*` (Shell, ConditionalShell, Sidebar, TopBar, CtxPanel, CmdPalette, ShortcutsOverlay, GoToPill, FooterDisclosure, NoRail, Tip), `proxy.ts`, hooks (`ctx-panel-context`, `shell-controls-context`, `useReducedMotion`, `useShellKeyboard`).
- Auth: `lib/supabase/{client,server}.ts`, `app/login/*`, `app/logout/route.ts`, `app/auth/callback/route.ts`. (Only DB-side change: provision the two allowed emails + RLS — Terry write, mom read-only.)
- AIQ editor: `app/aiq/**` (`AiqEditor`, `AiqHistory`, `actions.ts`), driven by `lib/aiq-types.ts` (constants).
- Settings scaffold: `app/settings/page.tsx` (rewire `lib/settings-data.ts`).
- `globals.css` (523 lines — the entire "Basis Indigo" Reticle token system; Tailwind v4 css-first, NO `tailwind.config.*`). Only sanctioned addition: the verdict-chip mapping (CONFIRM/FLAG/DOWNGRADE/UPGRADE/VETO).
- Primitive library: `components/primitives/*` (Btn, Chip, Pill, Label, PageHeader, MovingPillTabs [the Reticle Delegations/Reviews pill-tabs], icons, LineChart, HeroNumber, AnimateNumber, etc.), `components/overlays/*`. `lib/cn.ts`, `lib/screens.ts`, `lib/shortcuts.ts`, `lib/portfolio-types.ts`, `lib/universe-fixture.ts`.

### STRIP
`app/page.tsx` (v2 dashboard body), `app/memos`, `app/decisions`, `app/proposals`, `app/backtest`, `components/dashboard/*`, `components/marketing/*`, and the v2-scoring lib loaders (`scoring-weights.ts`, `score-math*.ts`, `routine-outputs.ts`, `dashboard-data.ts`, `memos-data.ts`, `backtest-data.ts`, `alerts-*`, `proposals`, etc.).

### ADAPT (keep structure, rewire to `hp1.*`)
- `/universe` → **Ranks** (`/ranks`); `/universe/[ticker]` → **Name View**; `/portfolio` → **Book** (`/book`); `/regime` (swap macro-multiplier for breadth gate; gauge cards carry over); `/aiq-drafts` (→ Fable-assisted drafts); `/learn` (keep component shell, **rewrite all prose** — it's v2-algorithm-specific).
- ScoreMath/DerivationLadder primitives: reuse the *ladder/drawer UI pattern* for HP-1's zM/zRAM/zDD decomposition + verdict chips, but **replace the v2 math**.
- `EngineStatusStrip`/provenance-ribbon primitives: rewire to HP-1 freshness (design §3 keeps a provenance ribbon on every page).

### NEW surfaces (no v2 equivalent)
`/anth` (Anthropic conviction), `/trades` (trade log), `/runs` (Fable runs), `/system` (trust/backtest-record/calibration). Final nav (design §4): Today `/` · Ranks `/ranks` · Book `/book` · ANTH `/anth` · Regime `/regime` · Fable Runs `/runs` · AIQ `/aiq` · Trade Log `/trades` · System `/system` · Learn `/learn`.

### Fork execution order (next session follows this)
1. Clone/fork + prune the STRIP list; keep the frame.
2. Rebrand chrome: `Sidebar.tsx` `ITEMS`, `screens.ts` breadcrumbs, `CmdPalette` commands, `layout.tsx` title/metadata, favicon → HP-1's 9 surfaces.
3. Stand up `hp1.*` schema (design §2.5) and **stub the `layout.tsx` alert call FIRST**.
4. Rewire retained/adapted loaders `public` → `hp1.*` (reuse client/server unchanged).
5. First vertical slice (lowest risk): wire **AIQ editor + Settings** to `hp1` — proves the pipeline.
6. Build the 8 canvases in design §8 order: Today → Book + Trade Log → Ranks → Name View → ANTH → Regime → Runs → System. Add verdict-chip token; provenance ribbon every page.
7. Rewrite `/learn` content for the HP-1 engine.
8. Engine GitHub Action (post-close daily 5:30 PM CT) → `hp1.engine_runs` / `hp1.engine_ranks`.

---

## Linear management

- **HP-1 project CREATED:** https://linear.app/basisuw/project/hp-1-9bc9cc1ed6ba (id `4ab1b51a-94e9-4ace-bb10-c1a50777be8c`, Thesis team, priority Urgent, status Backlog).
- **Epics NOT created** — Linear MCP **writes are approval-gated this session** (the `save_issue` for the Phase 0 epic returned "requires approval"). The next session (with write-approval) should create 5 epics under the HP-1 project:
  1. **Phase 0 — Engine truth** → state **Done** (PR #17; engine at `engine/`; record 93.1/2.03).
  2. **Phase 1 — Fork + data** → Urgent. Use the delta + fork-execution-order above. Sub-issues: fork+prune · rebrand chrome · `hp1.*` schema + stub alert call · rewire loaders · AIQ+Settings slice · extend `universe_kind_check` to allow `'hp1'` (+ widen `activeTickers` type) · add 19 tickers `kind='hp1'` + backfill · engine GH Action.
  3. **Phase 2 — Fable orchestrator** (rubric §7/§8 JSON, D5/D6/D8, calibration day 1).
  4. **Phase 3 — Surfaces (8)** (design §8 order).
  5. **Phase 4 — Seeds + go-live** (20 AIQ ports, 30 drafts, seed `anth_state` ceiling 15×, acceptance gate).

---

## Prod database state at end of session

**No DB changes.** `hp1` schema not yet created (Phase 1, gated on Supabase write-approval). v2 `public` schema untouched. The 19 `kind='hp1'` universe rows are not yet inserted.

---

## Commits pushed

`git log --oneline origin/main..HEAD` = **1 commit** (this handoff). No code/engine changes this session — only Phase 1 planning + this doc.

---

## Pending Terry actions

| # | Item | Blocking? |
|---|---|---|
| 1 | **Create private `terry-zero-in/hp1` + grant this session MCP access** | YES — fork cannot start without it. The add-repo tool is unavailable in-session. |
| 2 | **Approve MCP writes** (Linear epics; Supabase migrations) | YES — needed to scaffold epics + create `hp1` schema. |
| 3 | New Vercel project + secrets (FMP, Polygon, Supabase service-role) | At deploy time (not day 1). |
| 4 | Provision 2 auth emails + RLS (Terry write, mom read-only) | During Phase 1 auth wiring. |
| 5 | OPEN-2 ANTH ceiling (15×) | Standing personal re-confirm (risk appetite). |

---

## Next session — start here

1. Read `CLAUDE.md`, then `docs/hp1/2026-06-12-hp1-build-handoff.md` (HP-1 index), then this S33 doc.
2. **Confirm Terry created `terry-zero-in/hp1` and it's in MCP scope.** If not, that's the blocker — surface it; do not try to fork without it.
3. Get MCP-write approval (Linear + Supabase).
4. Create the 5 Linear epics (above) under the HP-1 project.
5. Execute the **fork execution order** (8 steps above). Decisions are locked — don't re-ask.

---

## Verified facts (don't re-prove)

- **v2 universe = 50** (not 70); canonical = `public.universe` table → `activeTickers()` helper (`supabase/functions/_shared/supabase.ts`). 19-name HP-1 delta listed above.
- **HP-1 engine** = `engine/hp1_engine.py` (Python, yfinance, separate stack). Corrected record: 24M blend 93.1/2.03, 36M 99.1/2.43. Canonical CSVs in `engine/data/`.
- **Env:** Python 3.11.15 (`/usr/local/bin/python3`); pandas 3.0.3 / numpy 2.4.6 / yfinance 1.4.1 / pytest 9.1.0 (install via `python3 -m pip --break-system-packages`). yfinance + PyPI reachable. Pin pandas in the engine GH Action.
- **Linear:** Thesis team id `21c004fc-6402-4d22-9316-fa9a05bb9b82`; HP-1 project id `4ab1b51a-94e9-4ace-bb10-c1a50777be8c`. MCP writes need approval this session.
- **Repo:** `terry-zero-in/ai-thesis`, branch `claude/kind-ride-d2uqi9`, `main` @ `a089ee0`. `hp1` repo does not exist yet / not in scope.
- **Decisions:** all locked (table above) + OPEN-1..4 / D8-D10 from S32.
- **Frontend:** Next.js 16 / React 19 / Tailwind v4 (css-first, no config file). Tokens in `web/src/app/globals.css`. Fork keep/strip map above.

---

## Skills loaded this session

`honesty`, `executing-plans`, `using-git-worktrees`, `verification-before-completion`, `systematic-debugging`, `subagent-driven-development`, `dispatching-parallel-agents`. Design skills (`lambo`/`linear`/`ferrari`/`frontend-design`/`ui-ux-pro-max`) still deferred — **load them when Phase 3 UI work starts** (the fork's surface-building is where they earn their keep).

---

## Recommendations for next session

1. **The fork is fully planned — it's now mechanical** once the repo exists. Don't re-analyze; execute the 8-step order.
2. **Biggest risk is the `layout.tsx` alert call** — stub it before anything else renders.
3. **Do the AIQ+Settings vertical slice first** (step 5) — it's the lowest-risk proof that the `public`→`hp1` rewiring pattern works before you touch the 8 canvases.
4. **Confirm the ingest-coverage detail** for `kind='hp1'`: prices are covered (ingest-prices pulls "all"), but verify whether fundamentals/consensus need to treat `hp1` like `investable` for HP-1's Core overlay (data-only, still no v2 scoring).
5. Phase 3 is where the design doctrine matters — load the design skills then, build against Reticle chrome + the 8-surface design doc.
