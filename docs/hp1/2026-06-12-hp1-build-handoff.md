# HP-1 Build Handoff — for Claude Code cold start
2026-06-12 · Maintained by Terry via Perplexity · Read with repo `CLAUDE.md` posture (autonomous by default, batch questions with defaults, never silently change algorithm spec)

## Read order (all in `docs/hp1/`)

1. `handoff_2026-06-11_hp1.md` — strategy-session context (note: its backtest numbers are superseded, see #3)
2. `HP1_SPEC_v1.1.md` + `FABLE_REVIEW_RUBRIC_v1.md` — the system (apply #4's deltas before treating as current)
3. `HP1_redteam_findings.md` — independent adversarial review (2026-06-12): 2 BLOCKERs, why the record is restated
4. `HP1_SPEC_v1.2_deltas.md` — exact redlines; apply in Phase 0. D8/D10 need Terry's sign-off — flag, don't block on them
5. `2026-06-12-hp1-dashboard-design.md` — the approved product design (architecture, schema, all 8 surfaces)
6. `2026-06-12-hp1-engine-fixes-plan.md` — TDD plan for Phase 0 engine work (use `executing-plans`)
7. `anthropic_diligence.md` — seeds the ANTH surface (verified $47B run-rate 2026-05-28; recommended ceiling 14–16x)
8. Reference receipts: `hp1_backtest.py` (original, contains F1 bug — superseded by engine plan), `hp1_audit.py` + `hp1_audit_results.csv` (independent verification targets), `results_24m.csv` (VOID record, history only), `current_ranks.csv` (stale, 2026-06-10)

## Phase plan (cut Linear tickets from this; new project under THS: "HP-1")

**Phase 0 — Engine truth (blocks everything).** Execute `2026-06-12-hp1-engine-fixes-plan.md` Tasks 1–5. Then apply `HP1_SPEC_v1.2_deltas.md`. Exit: grep guard clean, regenerated record within tolerance of `hp1_audit_results.csv`.

**Phase 1 — Fork + data.** Fork `ai-thesis` → `hp1` (private). Strip v2 scoring pages (keep components, AIQ editor, auth, shell, settings). New Vercel project. `hp1.*` schema per design doc §2.5. Extend v2 ingest universe lists to cover HP-1's 50 (compute the exact ticker delta first; do NOT duplicate ingest functions; HP-1 never writes outside `hp1`). Engine GH Action (post-close daily 5:30 PM CT) → `engine_runs`/`engine_ranks`.

**Phase 2 — Fable orchestrator.** Scheduled run every 2 trading days + event triggers (incl. D4's SPY/VIX). Rubric §10 verbatim system prompt; rubric §7/§8 JSON contract; D5 entry-block enforcement; D6 server-side citation validation; D8 reasons_against + pending-check mechanics; failure handling per rubric §11 (engine output never blocked). Persist everything (D7 calibration starts day 1).

**Phase 3 — Surfaces** in design-doc §8 order: Today → Portfolio+Trade Log → Ranks → Name View → ANTH → Regime → Runs → System. Design tokens inherit Reticle verbatim; the only new semantic is the verdict-chip mapping (design doc §3). Provenance ribbon on every page. Compact-first; Today must answer "what do I do" in one screen, no fold on 13".

**Phase 4 — Seeds + go-live.** Port 20 AIQ scores from v2; queue 30 Fable-assisted drafts for Terry's ratification (Aug 2026 refresh). Seed `anth_state` from `anthropic_diligence.md` (`run_rate_verified: true`, source + date; ceiling null until Terry sets it). Backtest record tables from Phase 0 CSVs only. Acceptance gate: one full week of engine+Fable runs, zero unhandled citation-validation failures, real fills in the trade log, Today renders the decision stack end-to-end.

## Open decisions (Terry's column — surface at Phase 1 start, don't guess)

| # | Decision | Default if Terry says "defaults" |
|---|---|---|
| OPEN-1 | v2 book ($79,475, 13 positions) paper or real; migration path | Treat as paper; import as watch-only history; HP-1 positions come only from `hp1.trades` |
| OPEN-2 | ANTH ceiling multiple | None — diligence recommends 14–16x verified run-rate; ceiling stays null (WAIT) until Terry sets it |
| OPEN-3 | One book or two (Terry/mom) | One book, `account` label per trade, mom read-only via RLS |
| OPEN-4 | Marginal tax rate + IRA availability | 35% placeholder in settings; flag prominently until Terry edits |
| D8/D10 | Spec-delta sign-offs | Implement both; render D10's sign-off line unsigned until Terry signs |

## Do NOT

Quote the void v1 record anywhere · let Fable recompute engine math · let adjusted_pct reorder selection (D5) · widen Fable bounds past [−10,+5] before calibration (D6) · backtest the fundamental overlay on current fundamentals · write outside the `hp1` schema · expand surfaces beyond the eight in the design doc without Terry · treat the May14→Jun10 19-day window as proof (asymmetry note, verdict doc).
