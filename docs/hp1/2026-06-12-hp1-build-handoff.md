# HP-1 Build Handoff — for Claude Code cold start
2026-06-12 · Maintained by Terry via Perplexity · Read with repo `CLAUDE.md` posture (autonomous by default, batch questions with defaults, never silently change algorithm spec)

## Read order (all in `docs/hp1/`)

1. `handoff_2026-06-11_hp1.md` — strategy-session context (note: its backtest numbers are superseded, see #3)
2. `HP1_SPEC_v1.1.md` + `FABLE_REVIEW_RUBRIC_v1.md` — the system (apply #4's deltas before treating as current)
3. `HP1_redteam_findings.md` — independent adversarial review (2026-06-12): 2 BLOCKERs, why the record is restated
4. `HP1_SPEC_v1.2_deltas.md` — exact redlines; apply in Phase 0. D8/D9/D10 ADOPTED 2026-06-16 (see Decisions section) — implement as written, no further sign-off needed
5. `2026-06-12-hp1-dashboard-design.md` — the approved product design (architecture, schema, all 8 surfaces)
6. `2026-06-12-hp1-engine-fixes-plan.md` — TDD plan for Phase 0 engine work (use `executing-plans`)
7. `anthropic_diligence.md` — seeds the ANTH surface (verified $47B run-rate 2026-05-28; recommended ceiling 14–16x)
8. Reference receipts: `hp1_backtest.py` (original, contains F1 bug — superseded by engine plan), `hp1_audit.py` + `hp1_audit_results.csv` (independent verification targets), `results_24m.csv` (VOID record, history only), `current_ranks.csv` (stale, 2026-06-10)

## Phase plan (cut Linear tickets from this; new project under THS: "HP-1")

**Phase 0 — Engine truth (blocks everything).** Execute `2026-06-12-hp1-engine-fixes-plan.md` Tasks 1–5. Then apply `HP1_SPEC_v1.2_deltas.md`. Exit: grep guard clean, regenerated record within tolerance of `hp1_audit_results.csv`.

**Phase 1 — Fork + data.** Fork `ai-thesis` → `hp1` (private). Strip v2 scoring pages (keep components, AIQ editor, auth, shell, settings). New Vercel project. `hp1.*` schema per design doc §2.5. Extend v2 ingest universe lists to cover HP-1's 50 (compute the exact ticker delta first; do NOT duplicate ingest functions; HP-1 never writes outside `hp1`). Engine GH Action (post-close daily 5:30 PM CT) → `engine_runs`/`engine_ranks`.

**Phase 2 — Fable orchestrator.** Scheduled run every 2 trading days + event triggers (incl. D4's SPY/VIX). Rubric §10 verbatim system prompt; rubric §7/§8 JSON contract; D5 entry-block enforcement; D6 server-side citation validation; D8 reasons_against + pending-check mechanics; failure handling per rubric §11 (engine output never blocked). Persist everything (D7 calibration starts day 1).

**Phase 3 — Surfaces** in design-doc §8 order: Today → Portfolio+Trade Log → Ranks → Name View → ANTH → Regime → Runs → System. Design tokens inherit Reticle verbatim; the only new semantic is the verdict-chip mapping (design doc §3). Provenance ribbon on every page. Compact-first; Today must answer "what do I do" in one screen, no fold on 13".

**Phase 4 — Seeds + go-live.** Port 20 AIQ scores from v2; queue 30 Fable-assisted drafts for Terry's ratification (Aug 2026 refresh). Seed `anth_state` from `anthropic_diligence.md` (`run_rate_verified: true`, source + date) AND `ceiling_multiple = 15` per locked OPEN-2 (status WAIT, since Series H 20.5x > 15x ceiling). Backtest record tables from Phase 0 CSVs only. Acceptance gate: one full week of engine+Fable runs, zero unhandled citation-validation failures, real fills in the trade log, Today renders the decision stack end-to-end.

## Decisions — LOCKED 2026-06-16 (Terry delegated; implement as stated, do not re-ask)

| # | Decision | RESOLUTION |
|---|---|---|
| OPEN-1 | v2 book paper or real | **PAPER.** Nothing was bought before 2026-06-16. The v2 portal book ($79,475 / 13 positions) imports as watch-only history; live HP-1 positions come ONLY from `hp1.trades`. No migration of v2 positions as holdings. Reconcile nothing against the verdict doc's −4.2% slate — it was paper too. |
| OPEN-2 | ANTH ceiling multiple | **15x verified run-rate** = $705B max entry EV at the verified $47B run-rate (Anthropic Series H, 2026-05-28). Seed `anth_state.ceiling_multiple = 15`, `ceiling_set_at = 2026-06-16`. Series H mark ($965B = 20.5x) is ABOVE ceiling → status WAIT until either (a) run-rate verifies higher from a primary source, or (b) a primary/IPO price prints at/below $705B. Terry-confirm flag set: this is the one number Terry should personally re-confirm (pure risk appetite) — editable any time, history kept. |
| OPEN-3 | One book or two (Terry/mom) | **One book, `account` label per trade** (`terry` \| `mom`). P&L, tax lots, and tax rate are computed per account label. Mom = read-only via RLS. Avoids two-book complexity while keeping per-person tax attribution correct. |
| OPEN-4 | Marginal tax rate + IRA | **Terry default 40%** short-term (≈37% federal ordinary + ~5.2% Georgia), editable in settings. **Mom: unset — render a loud `tax rate not set` warning** on her account's tax panel until entered (her bracket is unknown and likely lower). IRA: unknown, do not assume. **Surface a standing recommendation on the System/tax panel: at ~12.8x turnover nearly all gains are short-term — running at least the Tactical sleeve in a tax-advantaged (IRA) account is the single highest-leverage tax decision available.** This is advisory, not a blocker. |
| D8 | ANTH conflict controls | **ADOPTED.** Implement `reasons_against[]` (3 cited every run), GO-pending-independent-check mechanics, ceiling-immutable-by-Fable. |
| D9 | Insider buy asymmetry | **ADOPTED.** A qualifying opportunistic cluster buy may count as one of the two hard UPGRADE citations (still never sufficient alone). |
| D10 | Re-ratify momentum weights | **ADOPTED / SIGNED Terry 2026-06-16.** Momentum weights stand as a judgment call — structure (gates + exits + sizing) is the deliverable, not factor alpha. Render the verdict-doc sign-off line as signed. |

## Do NOT

Quote the void v1 record anywhere · let Fable recompute engine math · let adjusted_pct reorder selection (D5) · widen Fable bounds past [−10,+5] before calibration (D6) · backtest the fundamental overlay on current fundamentals · write outside the `hp1` schema · expand surfaces beyond the eight in the design doc without Terry · treat the May14→Jun10 19-day window as proof (asymmetry note, verdict doc).
