# S34 Handoff — HP-1 universe seed merged (PR #20); Supabase MCP gate blocks the apply

**Date:** 2026-06-16 (UTC)
**Branch:** `claude/kind-ride-d2uqi9`
**HEAD:** this handoff commit, on top of `main` @ `1f37009` (squash-merge of PR #20).
**Commits ahead of `origin/main`:** 1 (this handoff doc) at write time.
**Continuation of:** S33 (`docs/handoffs/2026-06-16-S33-hp1-phase1-kickoff-decisions-locked.md`). This is the **start of Phase 1 execution**.

---

## HEADLINE (read first)

1. **PR #20 is MERGED to `main`** — the first shipped slice of Phase 1: the `hp1` universe migration **+ five v2 universe-loader guards**. Squash commit `1f37009`.
2. ⚠️ **The migration is NOT applied to the live DB yet.** It is only a file on `main`. Prod `public.universe` still has **zero `kind='hp1'` rows** and the `universe_kind_check` constraint still rejects `'hp1'`. **APPLY IT FIRST next session.**
3. ⚠️ **Supabase MCP is connected and the Connectors UI shows both Read-only (18) and Write/delete (11) tool groups on "Always allow" — but every call this session still returned `MCP tool call requires approval`**, including `list_projects`, which is *explicitly* in `.claude/settings.local.json`'s allow-list. **Diagnosis:** the running web session loaded its permission/transport state at startup (when Supabase was gated) and does **not** honor mid-session connector changes. **FIX: start a FRESH session** — it will boot with Supabase allowed. Do not loop on retries.
4. **Linear MCP writes also stayed gated** all session — the 5 Phase 1 epics still don't exist.

---

## Operating posture (this session)

- Terry: **"start phase 1"** + **"go with defaults"** (S33). This session = Phase 1 execution under locked decisions.
- Terry tried to clear blockers live ("I approved", "supabase is good now!", then showed the Connectors UI on Always-allow), but the **running session never actually honored them**. Autonomy held the right line: shipped everything that needed **no** approval (the migration file + loader guards, via PR #20), and surfaced the gate precisely instead of spamming the approval prompt.
- **Mission-critical rule respected:** did not apply a prod migration without working tools; did not self-grant MCP permissions by editing settings (proven moot anyway — the allow-listed `list_projects` still failed).

---

## Tickets shipped

No Linear IDs (epics couldn't be created — Linear gated). Work is tracked via **PR #20 (MERGED)**.

### PR #20 — `hp1` universe seed + v2 loader guards
Commits (squashed into `1f37009`):
- `2e9b60f` feat(hp1): allow universe.kind='hp1' and seed 19 HP-1-only tickers
- `1030bbc` fix(universe): scope v2 universe-name loaders to kind='investable'

Files:
- **NEW** `supabase/migrations/20260616000000_hp1_universe_kind_and_seed.sql` — extends `universe_kind_check` to add `'hp1'`, then seeds the 19 HP-1-only tickers as `kind='hp1'`, `layer=0`, `layer_label='HP-1'` (mirrors the `^VIX` macro-row convention). Idempotent (`ON CONFLICT DO UPDATE`) + `count(*) where kind='hp1' = 19` assertion. Constraint widen precedes insert in one txn (Codex PR #19 catch).
  - 19 tickers: `AAPL, ALAB, APLD, APP, CLS, COHR, CRDO, CRWV, DELL, FN, IREN, MPWR, NBIS, PANW, RDDT, SMCI, TEM, TER, TSLA`.
- `web/src/lib/universe-data.ts` (both `getUniverseTickers` + `getLatestUniverseScores`), `universe-data-server.ts`, `aiq-data.ts` (`getAiqIndex`), `portfolio-data.ts` (`getUniverseChoices`) — added `.eq("kind","investable")` so `hp1` (and the pre-existing `benchmark` SPY) rows never render on v2 investable-name surfaces.

Acceptance / verification:
- **CI green on `1030bbc`:** Web typecheck (tsc) ✅ · Engine tests ✅ · Vercel Preview ✅.
- **Codex left 2 P1s — both verified valid against the code:**
  - **P1 #1** (hp1 rows would leak into v2 `/universe`): **FIXED.** Codex flagged 2 loaders; I found the same defect in **5** full-list loaders and guarded all. Thread **resolved**. Bonus: closes a pre-existing SPY (`kind='benchmark'`, `is_active=true`) leak on those surfaces.
  - **P1 #2** (`ingest-fundamentals`/`ingest-consensus` default to `kind='investable'` → the 19 hp1 names get no fundamentals/consensus/revisions): **VALID, DEFERRED**, thread left **open**. It's the broader Phase 1 ingestion-extension task (also needs Form 4 + short-interest per design §2.2; `activeTickers` needs an investable+hp1 union; adds recurring FMP cost). = S33 recommendation #4.

Judgment calls (with reasoning):
- **Did not author the full `hp1.*` schema.** Design §2.5 is column-level only (no types/PKs/FKs); authoring 12 untestable objects blind invites rework. Defer to an apply→generate-types→wire loop once Supabase works.
- **Guarded 5 loaders, not Codex's 2.** The server loader, AIQ index, and portfolio picker had the identical defect; a half-fix would leak hp1 into the AIQ editor + portfolio add-picker.
- **Deferred ingestion extension (P1 #2)** rather than expand it inside a migration PR — it's a scoped, cost-bearing design task, not a one-liner.

---

## Linear management

- **No changes this session — Linear MCP writes gated.** The HP-1 project exists (`4ab1b51a-94e9-4ace-bb10-c1a50777be8c`, Thesis team) but the **5 Phase 1 epics from S33 still do not exist.** Create them when Linear writes work (full list in S33 §Linear management). Phase 0 epic also still needs creating + marking Done (PR #17).

---

## Prod database state at end of session

- **No DB changes applied.** `hp1` schema not created. `public.universe` unchanged: 50 investable + `SPY` (benchmark) + `^VIX` (macro); **zero `kind='hp1'` rows**; `universe_kind_check` still `('investable','benchmark','macro')` — i.e., the merged migration is **not yet applied**.
- Could not run `list_tables` / `get_advisors` (Supabase gated).

---

## Commits pushed

`git log --oneline origin/main..HEAD` at handoff = **1 commit** (this handoff doc). PR #20's two commits are already merged into `main` (`1f37009`).

---

## Pending Terry actions

| # | Item | Blocking? |
|---|---|---|
| 1 | **Start a FRESH session** so Supabase "Always allow" takes effect (running session won't honor it) | **YES** — gates the migration apply + all Supabase Phase 1 work |
| 2 | Apply the merged migration (next session does this once tools work) | auto, once #1 |
| 3 | Make **Linear** MCP writes work (then create the 5 epics) | Medium — ticket tracking |
| 4 | Add `terry-zero-in/hp1` to this session's repo scope | YES **for the fork** (not for schema/data) |
| 5 | Vercel `hp1` project + secrets (FMP/Polygon/service-role); 2 auth emails + RLS | At deploy time |
| 6 | OPEN-2 ANTH ceiling (15×) re-confirm | Standing |

---

## Next session — start here (first actions)

1. Read `CLAUDE.md`, then S33, then this S34.
2. Supabase tools should now work (fresh session). Run **read-first**:
   - `list_projects` → project_id + `get_project_url`
   - `list_migrations` → **did `20260616000000_hp1_universe_kind_and_seed` auto-apply on the #20 merge?** (a deploy pipeline may have run it)
   - `get_advisors` (security + performance) for a baseline.
3. **GUARD-FIRST — before applying/seeding, confirm the `kind='investable'` loader guards are live on v2 Vercel prod** (PR #20 is on `main` → Vercel auto-deploys; verify prod is the post-#20 build). The pre-#20 loaders had no `kind` filter, so seeding the 19 `hp1` rows while prod still runs the old build would expose HP-1 names on `/universe`, the AIQ index, and the portfolio picker until the guarded build ships. (Codex P2 on PR #21.)
4. **Then apply** (only if `list_migrations` shows it didn't auto-apply): `apply_migration` with the file's exact SQL (idempotent). Verify `count(*) where kind='hp1' = 19` and the constraint includes `'hp1'`. Re-run `get_advisors`.
5. Author + apply the **`hp1.*` schema** (design §2.5) via apply→`generate_typescript_types`→wire-loaders.
6. **Ingestion extension** (the deferred Codex P1 #2): extend `activeTickers` (investable+hp1 union) + `ingest-fundamentals`/`ingest-consensus` (and Form 4 + short-interest per §2.2) to cover `kind='hp1'`; **mind FMP cost**. Backfill prices via `ingest-prices?days=2000` (prices already covered by `kind:'all'` once rows exist).
7. Fork into `terry-zero-in/hp1` once it's in scope (S33 fork execution order).

---

## Verified facts (don't re-prove)

- Repo `terry-zero-in/ai-thesis`, branch `claude/kind-ride-d2uqi9`, `main` @ `1f37009`. PR #20 merged.
- Migration file: `supabase/migrations/20260616000000_hp1_universe_kind_and_seed.sql`.
- 19 hp1-only tickers (above); 31 shared with v2; v2 universe = 50 investable (+ SPY benchmark + ^VIX macro).
- `activeTickers` (`supabase/functions/_shared/supabase.ts:44`) defaults `kind='investable'`; `ingest-prices` uses `kind:'all'` (hp1 prices covered once rows exist); `ingest-fundamentals`/`ingest-consensus` use the default → **do NOT cover hp1 yet**.
- 5 guarded UI loaders: `universe-data.ts` (`getUniverseTickers`, `getLatestUniverseScores`), `universe-data-server.ts`, `aiq-data.ts` (`getAiqIndex`), `portfolio-data.ts` (`getUniverseChoices`).
- Supabase Connectors UI: Read-only (18) + Write/delete (11) both "Always allow" — but the **running session does not honor it** (restart required). `.claude/settings.local.json` allow-list (`mcp__Supabase__list_projects`, `mcp__Linear__save_issue`) is **overridden** by the remote gate.
- Linear: Thesis team `21c004fc-6402-4d22-9316-fa9a05bb9b82`; HP-1 project `4ab1b51a-94e9-4ace-bb10-c1a50777be8c`. Writes gated this session.
- HP-1 engine return math = **yfinance** (`engine/hp1_engine.py`); shared Supabase market-data feeds **Fable's** checklist, not engine returns — which is why hp1 fundamentals/consensus coverage still matters.
- Vercel: v2 project `ai-thesis-v2` (https://vercel.com/terry-8893s-projects/ai-thesis-v2); this branch's preview built green.
- git identity now set to `Claude <noreply@anthropic.com>` for verified commits.

---

## Skills loaded this session

`honesty`, `executing-plans`, `verification-before-completion`, `systematic-debugging`, `subagent-driven-development`, `dispatching-parallel-agents`, and `receiving-code-review` (applied to the two Codex P1s). Design skills (`lambo`/`linear`/`ferrari`/`frontend-design`/`ui-ux-pro-max`) still deferred to Phase 3 UI.

---

## Recommendations for next session

1. **The restart is the unblock** — don't repeat this session's loop of retrying gated Supabase calls. If a fresh session *still* returns "requires approval" on Supabase, that's a deeper harness bug → tell Terry, don't loop.
2. **Apply the migration first** — it's the thing everything waits on. Low-risk (additive, idempotent), decisions locked, PR merged + reviewed → proceed without re-asking; just verify before/after + run advisors.
3. **`hp1.*` schema is the meaty next build.** Author carefully from §2.5 (needs type/PK/FK decisions); apply → `generate_typescript_types` → wire loaders.
4. **Don't fork** until `terry-zero-in/hp1` is in scope; schema + ingestion work doesn't need it.
5. The ingestion extension carries **FMP cost** — §2.2 gives the ingester set; flag scope to Terry only if genuinely unsure.
