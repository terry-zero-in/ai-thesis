# S32 Handoff — HP-1 Phase 0: Engine Truth (lookahead fix + record restatement)

**Date:** 2026-06-16 (UTC)
**Branch:** `claude/kind-ride-d2uqi9`
**HEAD:** this handoff commit, sitting on top of `main` @ `63f0830` (the squash-merge of PR #17).
**Commits ahead of `origin/main`:** 1 (this handoff doc only).
**Continuation of:** first HP-1 session. Cold-start index for the whole workstream is `docs/hp1/2026-06-12-hp1-build-handoff.md`. This session executed only **Phase 0** of that plan.

---

## HEADLINE (read this first)

**HP-1 is a new, separate workstream from AI-Thesis v2.** It is a quantitative AI-equity trading engine + a "Fable" review orchestrator, specced entirely under `docs/hp1/`. This session did **Phase 0 only — engine truth** — and shipped it (PR #17, merged).

Three things that materially change the build state:

1. **The published HP-1 backtest record was inflated by a same-day-execution lookahead (~17–24 CAGR pts).** It is now corrected and regenerated. The old record (110.5% CAGR / 2.43 Sharpe) is **void**; the true 24M blend is **93.1% / 2.03**.
2. **A Python engine now lives in the repo at `engine/`** (it did not before). `engine/hp1_engine.py` + `engine/restate_record.py` + tests + the canonical CSVs. This is the single reference implementation Phase 1's GitHub Action will wrap.
3. **No UI was touched.** Phase 0 was engine + docs only. The Vercel app is byte-identical to pre-session. HP-1 surfaces don't exist until Phase 3.

---

## Operating posture (Terry's directives this session)

- *"Start with Phase 0 only… Do not touch any UI or fork anything until Phase 0's exit criteria are met: the grep guard is clean and the regenerated record lands within tolerance of `docs/hp1/hp1_audit_results.csv`."*
- *"If your regenerated 24M blend comes out near 110% CAGR / 2.43 Sharpe instead of ~93% / ~2.03, the lookahead fix isn't active — stop and debug."*
- *"Four decisions are mine, not yours (OPEN-1 through OPEN-4) plus sign-offs on deltas D8 and D10."* — Note: the handoff doc already had these LOCKED/ADOPTED 2026-06-16; I surfaced that conflict and Terry replied **"Confirmed"** (locked values stand). They were not re-litigated.
- *"Utilize workflows and put as many agents on this as possible."* — Applied: 4 parallel research agents up front; direct disciplined execution on the coupled engine-fix chain (it edits the same 2 files in strict order, so parallelizing it would only create conflicts and risk the lookahead gate); parallel-agent fan-out reserved for independent doc work and review.

---

## What shipped — HP-1 Phase 0 (no Linear ticket; plan-driven)

Source plan: `docs/hp1/2026-06-12-hp1-engine-fixes-plan.md` (Tasks 1–5). Executed TDD, red→green per task.

| Finding | Fix | Commit (pre-squash) |
|---|---|---|
| **F1** same-day execution lookahead | deferred `simulate()` execution to t+1 via a `pending`-weights queue; regression test asserts weights set at `t` earn zero asset return at `t` | `72fb791` |
| **F8** `dd_dev` floor at 1e-4 → synthetic RAM edge | falls back to total volatility below 20 negative obs | `d427aaa` |
| **F24** 15% single-name cap could leak after redistribution | feasibility guard + post-renorm assertion | `a6bf148` |
| **F2/F5** void record; no ex-IPO-cohort variant | `restate_record.py` regenerates 24M + 36M incl. ex-IPO-cohort variants | `8a678bd` |
| **F2/F15** docs cite void numbers | applied `HP1_SPEC_v1.2_deltas.md` D1–D10 verbatim; grep guard | `eea4fcc` |
| Codex review P1/P2 (post-open) | renamed void CSV → `results_24m_VOID.csv` + repointed refs; propagated D9 insider-buy exception into §5 hard-rules + §10 system prompt | `dca1442` |

Plus `5be981c` (verbatim import of `hp1_backtest.py` → `engine/hp1_engine.py`) and `1aea841` / `6359d09` (gitignore hygiene).

**Deliverables on disk (`engine/`):**
- `hp1_engine.py` — factors / weights / simulate / metrics. `simulate()` now t+1; `factors()` F8 fix; `weights()` F24 guard. Factor math otherwise untouched.
- `restate_record.py` — regenerates the canonical record from live yfinance.
- `tests/test_engine.py` — 4 tests (lookahead invariant, dd_dev fallback, cap invariant, + selftest path).
- `data/results_24m_v2.csv`, `data/results_36m_v2.csv` — **the only citable record.** `engine_version = v1.2-corrected`.

### Exit criteria — both MET (fresh verification this session)

- **Grep guard clean:** `grep -rn "110.5|2\.43|+31–42|31-42" docs/ engine/ --include="*.md"` → hits only in the 3 correction-documenting carve-outs (`HP1_redteam_findings.md`, `HP1_SPEC_v1.2_deltas.md`, `2026-06-12-hp1-engine-fixes-plan.md`). No spec/handoff/README presents the void numbers as the record.
- **Record within tolerance of `hp1_audit_results.csv`:** essentially exact (well inside the ~1 CAGR pt / 0.05 Sharpe drift budget).
- **Tests:** `pytest` → **4 passed**; `selftest()` → **SELFTEST PASS**.

| 24M metric | Regenerated (`results_24m_v2.csv`) | Audit target | Status |
|---|---|---|---|
| BLEND 50/50 | **93.1% / 2.03** | 93.1 / 2.03 | exact |
| V2 Tactical+gate | 89.7% / 2.07 | 89.7 / 2.07 | exact |
| V5 Core | 93.6% / 1.81 | 93.6 / 1.81 | exact |
| BLEND ex-IPO-cohort | 76.8% / 1.76 | 76.8 / 1.77 | within |
| EW-50 | 81.0% / 1.98 | 81.0 / 1.98 | exact |
| EW ex-IPO-cohort | 66.5% / 1.73 | 66.5 / 1.73 | exact |

36M: BLEND **99.1% / 2.43**; V2 **94.2% / 2.39** (matches the red-team's restated 36M figures).

**Anti-confound check:** under the *same* libraries/data, the **unfixed** engine reproduced the old **110.5% / 2.43** baseline exactly, then the fixed engine produced 93.1% / 2.03. The −17 CAGR pt delta is the lookahead fix, not a library or data artifact. (This mattered because the env has **pandas 3.0.3** — newer than the red-team's run — which changed `pct_change` defaults; the baseline anchor proves the libs are faithful.)

---

## Linear management

- **No HP-1 Linear project or tickets exist** (verified: `list_projects` query "HP" → empty). Phase 0 was driven entirely by `docs/hp1/`, so **zero Linear tickets were touched** — nothing to update, and I did not fabricate any.
- **Recommendation (Terry's call):** at Phase 1 kickoff, cut a new Linear project **"HP-1"** under the **Thesis** team with epics for Phases 0–4 (Phase 0 → Done retroactively). The build-handoff specifies this ("new project under THS: 'HP-1'") but the structure is Terry's to shape, so I did not create it unilaterally. I can scaffold it on his go.

---

## Prod database state at end of session

**No database changes.** Phase 0 is local Python + docs only. No Supabase migrations applied. The `hp1.*` schema (design doc §2.5: `engine_runs`, `engine_ranks`, `fable_runs`, `fable_reviews`, `trades`, `positions`, `tranches`, `anth_state`, `decisions_log`, `backtest_record`, `aiq_scores`, `fable_calibration`) does **not exist yet** — it is the first Phase 1 data task. v2 Supabase untouched.

---

## Commits pushed

`git log --oneline origin/main..HEAD` after this push = **1 commit** (this handoff).

Phase 0's work reached `main` via **PR #17 (squash-merge → `63f0830`)**. Pre-squash commits, for the record:
```
dca1442 docs(hp1): address Codex review — align D9 insider exception in prompt; retire void CSV (P1/P2)
eea4fcc docs(hp1): restate record to corrected v1.2 numbers; apply D1-D10 deltas (F2,F15)
1aea841 chore: ignore python build artifacts
8a678bd feat(engine): regenerate canonical record with corrected engine (F2, F5)
a6bf148 fix(engine): enforce feasible 15% single-name cap + guard (F24)
d427aaa fix(engine): dd_dev falls back to total vol below 20 negative obs (F8)
72fb791 fix(engine): defer rebalance execution to t+1, kill same-day lookahead (F1)
5be981c chore(engine): import hp1_backtest.py verbatim as engine/hp1_engine.py
6359d09 chore(hp1): ignore .worktrees for isolated Phase 0 dev
883b98f docs(hp1): lock OPEN-1..4 + adopt D8/D9/D10 (2026-06-16)
bebc100 docs(hp1): full HP-1 handoff package
```

---

## Pending Terry actions

| # | Item | Status / Need |
|---|---|---|
| 1 | OPEN-1…4 + D8/D10 decisions | **CONFIRMED** by Terry 2026-06-16 ("Confirmed"). Locked values stand. No action. |
| 2 | **OPEN-2 ANTH ceiling = 15×** ($705B max entry EV) | Standing personal re-confirm (pure risk appetite). Editable any time; flagged for periodic review. |
| 3 | Phase 1 go / hold | **Decision needed.** Terry merged #17; awaiting "start Phase 1" or "hold." |
| 4 | Cut HP-1 Linear project + epics | Recommended at Phase 1 start; I can scaffold on go. |
| 5 | Phase 1 external/credentials | Will need: private `hp1` repo fork, new Vercel project, Supabase `hp1` schema/access. Surface when Phase 1 begins. |

---

## Next ticket in build order

**Phase 1 — Fork + data** (from `docs/hp1/2026-06-12-hp1-build-handoff.md`):
1. Fork `ai-thesis` → `hp1` (private). Strip v2 scoring pages; **keep** components, AIQ editor, auth, shell, settings.
2. New Vercel project. `hp1.*` schema per design doc §2.5.
3. Extend v2 ingest to cover HP-1's 50 names — **compute the exact 70-vs-50 ticker delta first**; do NOT duplicate ingest functions; HP-1 writes only to `hp1`.
4. Engine GitHub Action (post-close daily, 5:30 PM CT) → `engine_runs` / `engine_ranks`.

**Prereqs:** PR #17 merged ✓, decisions confirmed ✓. I've read the Phase 1 description; not yet inspected the v2 ingest code for the delta computation (first Phase 1 task).

---

## Verified facts (don't re-prove these)

- **Repo:** `terry-zero-in/ai-thesis`. Working branch `claude/kind-ride-d2uqi9`. `main` @ `63f0830` (post PR #17).
- **Linear:** Thesis team id `21c004fc-6402-4d22-9316-fa9a05bb9b82`; "AI Thesis v2" project id `79a38aec-2b49-4c18-a92a-ce5585e2ff11`. **No HP-1 project yet.**
- **Engine env:** Python 3.11.15 at `/usr/local/bin/python3`. Deps (installed via `pip install --break-system-packages`): **pandas 3.0.3, numpy 2.4.6, yfinance 1.4.1, pytest 9.1.0**. Note `pip3`/`python3` target different interpreters here — always use `python3 -m pip`.
- **Network (this remote env):** PyPI ✓ and Yahoo finance chart endpoint ✓. yfinance downloads all 50 universe + benchmarks cleanly (`raw["Close"]`, multiindex `('Close', ticker)`).
- **pandas 3.0 caveat:** engine runs clean on 3.0.3; pin or test pandas in the Phase 1 GH Action for reproducibility.
- **Corrected record (v1.2):** 24M BLEND 93.1% / 2.03; 36M BLEND 99.1% / 2.43. Canonical: `engine/data/results_24m_v2.csv` + `results_36m_v2.csv`. Void record renamed `docs/hp1/results_24m_VOID.csv` (numbers preserved in `HP1_redteam_findings.md`).
- **Decisions (LOCKED 2026-06-16, Terry-confirmed):** OPEN-1 PAPER (v2 book is watch-only history; live positions only from `hp1.trades`); OPEN-2 ceiling 15× = $705B (status WAIT, Series H 20.5× is above); OPEN-3 one book, `account` label (`terry`|`mom`), mom read-only via RLS; OPEN-4 Terry 40% short-term, mom unset (loud warning), IRA recommendation for the Tactical sleeve; D8/D9/D10 adopted.

---

## Skills loaded this session

`honesty`, `executing-plans`, `using-git-worktrees`, `verification-before-completion`, `systematic-debugging`, `subagent-driven-development`, `dispatching-parallel-agents`.

**Deferred (intentionally):** the design skills mandated by CLAUDE.md (`lambo`, `linear`, `ferrari`, `frontend-design`, `ui-ux-pro-max`) were **not** loaded — Phase 0 is no-UI by Terry's instruction. Load them at Phase 1/3 when UI work begins (flagged at session start, not silently skipped).

---

## Recommendations for next session

1. **Phase 0 is verifiably complete and the engine is trustworthy.** Numbers match the independent audit essentially exactly; the lookahead is dead with a regression test guarding it.
2. **Don't start Phase 1 cold** — confirm Terry wants the fork to proceed (he merged + confirmed decisions, but "go for Phase 1" wasn't explicit). Then **cut the HP-1 Linear project first** so the fork work is tracked.
3. **First real Phase 1 engineering act:** compute the exact v2-70 vs HP-1-50 ticker delta before extending ingestion. HP-1's universe is in `engine/hp1_engine.py` (`UNIV`, 50 names); v2's 70 is in the v2 ingest/universe table.
4. **Pin pandas in the engine GH Action.** The engine is 3.0-clean, but pin for reproducibility of the daily record.
5. Minor: `hp1_engine.py`'s `__main__` still has legacy `/home/claude/...` hardcoded CSV paths (harmless — `restate_record.py` is the real entry point). Clean up only if you're in that file anyway.
