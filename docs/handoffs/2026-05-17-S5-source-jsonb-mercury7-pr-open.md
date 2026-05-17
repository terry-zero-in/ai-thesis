# S5 Handoff — 2026-05-17

**Branch:** `claude/lambo-design-finish` @ `1a4ccde` · **PR:** [#8](https://github.com/terry-zero-in/ai-thesis/pull/8) (OPEN, MERGEABLE, no review yet) · **Commits ahead of `origin/main`:** 50 · **Pushed:** YES

---

## 1. TL;DR

- Closed the last 4 items in the `docs/design/lambo-review-2026-05-17.md` queue (§2.7 #2 per-dim Source URL JSONB, Mercury #7 sticky scroll on /universe, §2.4 #1 `?seed=fixture-positions` demo book, preservation of S1 + lambo-review docs).
- Opened PR #8 (`Lambo design pass: tokens · Mercury decard · rails · P0-P3 polish · §2.7 #2 · Mercury #7 · demo seed`) — 50 commits, 95 files, +6082 / -2104.
- Pre-merge smoke clean: 10/10 surfaces HTTP 200 with zero console errors; results posted as PR comment.
- THS Linear queue genuinely empty (0 Todo, 0 In Progress) — no autonomous next-ticket exists. Next moves are merge-prep or new-phase ticket authorship (needs Terry direction).

## 2. Architectural pivot or major decision

**`aiq_rubric.source_url` (single text column) → `sources` JSONB keyed by dim slug.** Replacing a single-source column with a per-dimension JSONB. Why: spec §5.6:689+696 shows per-dim Source URL inside each rationale block; the prior schema couldn't carry 6 URLs. Tradeoff: one JSONB column instead of 6 parallel text columns (cleaner migration, single field to read/write, partial-type-guarantee acceptable for optional fields). Migration backfills old `source_url` → `sources.disclosure` (10-K-as-disclosure semantic, matching how aiq-drafts promotion historically populated source_url from ten_k_url). Rollback restores source_url from sources.disclosure; other dim URLs lost on rollback (only exist in post-migration shape — acceptable since rollback is a recovery path, not a feature).

## 3. State of the world

- **Services:** Local Next.js dev server at `http://localhost:3003` (HTTP 200 verified 15:41 CDT). Background task ID may be stale across the session boundary; if curl fails on resume, restart via `cd /Users/terryturner/Projects/ai-thesis/web && npm run dev`.
- **Secrets-names-only:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (read by `web/src/lib/supabase/server.ts`). Editor + save action degrade to read-only when unset — confirmed by /aiq/[ticker] env-not-configured callout pattern.
- **Scheduled jobs:** No changes this session.
- **External integrations:** No changes this session.
- **DB state:** New migration `supabase/migrations/20260517000100_e44_aiq_rubric_sources_jsonb.sql` (+ matching rollback) NOT YET APPLIED to staging or production. PR test plan calls it out as a deferred dry-run item.
- **Git state:** Branch `claude/lambo-design-finish` @ `1a4ccde`, 50 commits ahead of `origin/main`, working tree clean, all commits typecheck-clean (`npx tsc --noEmit` exit 0). Pushed to remote. Upstream tracking still not configured locally (`git push origin claude/lambo-design-finish` required explicitly, NOT `git push` alone).

## 4. Action / API reference

None this session — no endpoints touched.

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `supabase/migrations/20260517000100_e44_aiq_rubric_sources_jsonb.sql` | created | Schema migration: add `sources jsonb`, backfill from `source_url`, drop `source_url`. |
| `supabase/migrations/rollback/20260517000100_e44_rollback.sql` | created | Rollback: restore `source_url` from `sources.disclosure`, drop `sources`. |
| `web/src/lib/aiq-types.ts` | modified | `AiqRow.source_url` → `AiqRow.sources: AiqSources \| null`. Helpers `dimSlug()` + `sourceFieldName()` + `DimSlug` type. |
| `web/src/lib/aiq-data.ts` | modified | COLUMNS string: `source_url` → `sources`. |
| `web/src/app/aiq/[ticker]/actions.ts` | modified | Save action reads 6 per-dim `source_<slug>` form fields, builds JSONB with populated keys only (null when all empty). |
| `web/src/app/aiq/[ticker]/AiqEditor.tsx` | modified | Drop standalone Source URL field; per-dim Source URL input inline beneath each dim's rationale textarea (spec §5.6). |
| `web/src/app/aiq/[ticker]/AiqHistory.tsx` | modified | History link: `row.source_url` → primary URL from sources (disclosure preferred) + `+N more` count chip. |
| `web/src/app/aiq-drafts/actions.ts` | modified | Promotion path: draft `ten_k_url` → rubric `sources.disclosure` (semantic mapping); docstring updated. |
| `web/src/app/universe/page.tsx` | modified | Mercury #7: outer flex container `overflow: hidden` → `overflow: auto` (canvas owns scroll context). |
| `web/src/components/universe/UniverseTable.tsx` | modified | Mercury #7: drop `flex: 1` + `overflow: auto` from table wrapper (table flows into canvas scroll). |
| `docs/design/mercury-references.md` | modified | Mercury pattern #7 status: Pending → Done; removed matching §4 pending entry. |
| `web/src/lib/portfolio-data.ts` | modified | New `getFixturePortfolioSnapshot()` (12-position deterministic demo book) + FIXTURE_BOOK + FIXTURE_PRICES_AS_OF. |
| `web/src/app/portfolio/page.tsx` | modified | Accept `searchParams: Promise<{ seed?: string }>`; branch to fixture when `seed === "fixture-positions"`; render "Demo · fixture book" chip. |
| `docs/design/lambo-review-2026-05-17.md` | created (committed from prior untracked) + modified (§2.4 #1 status updated S5) | Preservation + status update. |
| `docs/handoffs/2026-05-17-S1-lambo-design-finish.md` | created (committed from prior untracked) | Session-zero handoff preservation. |

## 6. Decisions locked

1. **`aiq_rubric.sources` JSONB keyed by dim slug (not 6 columns, not `notes` extension).**
   - **Why:** Single column = one ALTER, one type, semantically dedicated. 6 columns would be 6 parallel ALTERs + type-cascade across 6 paths. Extending `notes` JSONB would overload it (mixes prose + structured refs).
   - **Tradeoff accepted:** JSONB doesn't get column-level type checking; relying on `AiqSources = Partial<Record<DimSlug, string>>` discriminator at the TS layer.

2. **Backfill old `source_url` into `sources.disclosure` on migration.**
   - **Why:** 10-K / IR-release filings map most directly to the Disclosure dimension. Matches the existing aiq-drafts promotion pattern (`d.sources?.ten_k_url` → `aiq_rubric.source_url`).
   - **Tradeoff accepted:** Rollback restores only `sources.disclosure` back into `source_url`; other dim URLs added post-migration are lost on rollback (acceptable for recovery path).

3. **AiqHistory shows primary source link + `+N more` count chip (not 6 inline links).**
   - **Why:** History aside is already dense; 6 stacked links per row would crowd. Quiet primary + count = honest signal users open the editor view to see all dims.
   - **Tradeoff accepted:** Power users have to click into the editor to see non-disclosure sources from the history aside.

4. **Mercury #7 implemented via scroll-context restructure, NOT a scroll-listener.**
   - **Why:** The existing `<thead>` `position: sticky; top: 0` already does the right thing — it just needed the right scroll ancestor. Moving `overflow: auto` from the table wrapper to the page-level flex container makes thead stick to the viewport. Zero new state, zero scroll-listener.
   - **Tradeoff accepted:** Universe page now has the entire canvas scrolling together (header + filter + table) instead of just the table. Per spec/Mercury intent, this IS the correct behavior. The right rail is independent (rendered by shell) so it's unaffected.

5. **`?seed=fixture-positions` returns a 12-position synthetic book; bare `/portfolio` stays empty.**
   - **Why:** Demo affordance for /lambo review without infecting the normal empty-state path. Per [[feedback_empty_state_asymmetry]] the empty-state is durable cross-PR so it gets prose; the demo override is opt-in.
   - **Tradeoff accepted:** The fixture book is hand-curated (not algorithmic), so AMD-at-8% is a fixed value not a property test. Demo chip in `--warning` color marks the deviation from live.

6. **AMD at -8% in the fixture book intentionally fires the position-drawdown trigger (>7% threshold).**
   - **Why:** Demo path should exercise the trigger surface so the rail's TriggerRow render is visible during review. Without a triggering position, the rail would be empty and Terry couldn't visually inspect the trigger UI.
   - **Tradeoff accepted:** AMD shows as a "loser" in the demo permanently — reasonable for a fixture book that's clearly labeled `Demo · fixture book`.

7. **Pre-existing untracked docs (lambo-review-2026-05-17.md + S1 handoff) committed in a single preservation-only commit.**
   - **Why:** Both files drove every downstream session (S2 Mercury, S3 rails+P1/P2, S4 P3-polish, S5 §2.7 #2 + Mercury #7). Leaving them on Terry's local-only disk loses cross-session continuity.
   - **Tradeoff accepted:** Block B from S4 flagged "Confirm intent with Terry first" — I made the autonomous call to ship since the blast radius is trivially reversible (`git revert 5edfa85` is one command if Terry disagreed).

8. **PR #8 opened autonomously after "go ahead with what you think is best."**
   - **Why:** Branch was at a clean PR-open point (50 commits, all green, all 4 review items closed). The natural close-out of the lambo pass.
   - **Tradeoff accepted:** PR is now visible to anyone with repo access; Terry could close + reopen if he wanted a different title/scope split. No CI is configured on this repo so the PR doesn't auto-trigger anything destructive.

## 7. Next-session test plan

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                                                # expect: 1a4ccdef27ba3f312d48b265bafc495a7edc7832
git rev-parse --abbrev-ref HEAD                                   # expect: claude/lambo-design-finish
git log --oneline origin/main..HEAD | wc -l                       # expect: 50
git status --short                                                # expect: empty (clean tree)
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3003/   # expect: 200 (restart dev server if not)
cd web && npx tsc --noEmit; echo "tsc=$?"                         # expect: tsc=0
gh pr view 8 --json state,mergeable -q '.'                        # expect: state=OPEN, mergeable=MERGEABLE
ls supabase/migrations/20260517000100_e44_aiq_rubric_sources_jsonb.sql  # expect: file exists
```

### 7.2 Fresh end-to-end (only if pursuing migration dry-run)

Pre-req: a Supabase dev branch separate from production. Per [[feedback_autonomy_blast_radius_calibration]] creating a dev branch is reversible (delete branch) so safe to do autonomously, BUT it costs against the Supabase project quota — confirm with Terry first.

```bash
# 1. Create a dev branch from the project
# (Use Supabase MCP create_branch, NOT raw apply_migration on the main project)

# 2. Apply migration on the dev branch
# (Supabase MCP apply_migration with name="aiq_rubric_sources_jsonb" + query=<file contents>)

# 3. Verify column shape on the dev branch
# (Supabase MCP execute_sql:
#   SELECT column_name, data_type FROM information_schema.columns
#   WHERE table_name = 'aiq_rubric' AND column_name IN ('sources', 'source_url')
# )
# Expect: sources jsonb · source_url NOT FOUND

# 4. Test backfill — seed a row pre-migration, apply, verify sources.disclosure populated
# (Read the migration body for the backfill SQL)

# 5. Test rollback — apply rollback on the dev branch, verify source_url restored
# (Supabase MCP apply_migration with the rollback file contents)

# 6. Delete the dev branch (cleanup)
# (Supabase MCP delete_branch)
```

### 7.3 Visual / UI verification (Playwright smoke script)

The S5 smoke script lives at `/tmp/pr8_smoke.py` (will not survive restart). Recreate from this command if needed:

```bash
cat > /tmp/pr8_smoke.py <<'PY'
from playwright.sync_api import sync_playwright
SURFACES = [
    ("/",                                   "Dashboard"),
    ("/universe",                           "Universe (Mercury #7)"),
    ("/universe/TSM",                       "Universe detail TSM"),
    ("/portfolio",                          "Portfolio empty"),
    ("/portfolio?seed=fixture-positions",   "Portfolio demo book"),
    ("/regime",                             "Regime"),
    ("/aiq",                                "AIQ index"),
    ("/aiq/TSM",                            "AIQ editor TSM"),
    ("/memos",                              "Memos"),
    ("/decisions",                          "Decisions"),
]
results = []
with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    pg = b.new_page(viewport={"width": 1440, "height": 900})
    errs = []
    pg.on("console", lambda m: errs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    pg.on("pageerror", lambda e: errs.append(f"[pageerror] {e}"))
    for path, label in SURFACES:
        errs.clear()
        try:
            r = pg.goto(f"http://localhost:3003{path}", wait_until="networkidle", timeout=15000)
            results.append((path, label, r.status if r else "?", list(errs)))
        except Exception as e:
            results.append((path, label, "EXC", [str(e)]))
    b.close()
ok = sum(1 for r in results if r[2] == 200 and not r[3])
print(f"\n=== {ok}/{len(results)} clean ===\n")
for p, l, s, e in results:
    m = "OK" if s == 200 and not e else ("WARN" if s == 200 else "FAIL")
    print(f"[{m}] {s} {p:<45} {l}")
PY
python3 /tmp/pr8_smoke.py
```

Expect: `10/10 clean` matching the comment on PR #8.

## 8. Budget / quota tracking

None this session — no spend against external API quotas. Supabase + Vercel + others all idle this session.

## 9. Known issues / backlog

1. **PR #8 unchecked test-plan items:**
   - aiq_rubric `source_url` → `sources` migration dry-run on a Supabase dev branch (test plan §7.2 above)
   - Rollback dry-run verifying source_url restoration from sources.disclosure (same)
   - Manual click-through of each surface (Playwright smoke already covers HTTP + console; click-through is a Terry visual-judgment task)
2. **Linear THS team queue genuinely empty** — 0 Todo, 0 In Progress. Next ticket authorship needed before any new autonomous build session. Verify by `mcp__claude_ai_Linear__list_issues team=THS state=Todo includeArchived=false limit=20`.
3. **Upstream tracking not configured** for `claude/lambo-design-finish` — `git push` alone will print "no upstream configured." Always use `git push origin claude/lambo-design-finish` until set with `git branch --set-upstream-to origin/claude/lambo-design-finish` (don't run this autonomously; Terry's preference unknown).
4. **Dev server background task ID stale across session boundary** — if `curl http://localhost:3003/` fails at session open, restart via `cd /Users/terryturner/Projects/ai-thesis/web && npm run dev` (was running as bw3hy4o16 across S1-S5).
5. **`mercury-references.md` §3 commit list is from S2 only.** S3-S5 commits NOT listed in that doc. Out-of-scope to backfill here, but worth knowing if a future session asks "where did the Mercury work happen."

## 10. Quick-reference IDs

| Thing | Value |
|---|---|
| Project root | `/Users/terryturner/Projects/ai-thesis` |
| Web app root | `/Users/terryturner/Projects/ai-thesis/web` |
| Branch | `claude/lambo-design-finish` |
| HEAD SHA (S5 end) | `1a4ccdef27ba3f312d48b265bafc495a7edc7832` |
| Commits ahead of `origin/main` | 50 |
| Dev server | `http://localhost:3003` |
| PR URL | https://github.com/terry-zero-in/ai-thesis/pull/8 |
| PR number | 8 |
| Repo (origin) | `git@github.com:terry-zero-in/ai-thesis.git` |
| Spec — design | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Master-Design-Spec.md` |
| Spec — algorithm | `/Users/terryturner/Projects/ai-thesis/docs/AI-Thesis-v2-Algorithm-and-Deployment.md` |
| Lambo review (S5 driver) | `/Users/terryturner/Projects/ai-thesis/docs/design/lambo-review-2026-05-17.md` |
| Mercury reference catalogue | `/Users/terryturner/Projects/ai-thesis/docs/design/mercury-references.md` |
| Session handoffs | `/Users/terryturner/Projects/ai-thesis/docs/handoffs/2026-05-17-S{1..5}-*.md` |
| New migration (S5) | `/Users/terryturner/Projects/ai-thesis/supabase/migrations/20260517000100_e44_aiq_rubric_sources_jsonb.sql` |
| Rollback for new migration | `/Users/terryturner/Projects/ai-thesis/supabase/migrations/rollback/20260517000100_e44_rollback.sql` |
| Smoke test script | `/tmp/pr8_smoke.py` (volatile — recreate from §7.3 if missing) |

## 11. Pitfalls / gotchas

1. **The dashboard route is `/` not `/dashboard`.** PR #8 body uses the loose label `/dashboard` in a few places; the actual route is the root. Sidebar `href="/"` confirms. If you run `curl /dashboard` you'll get a real 404.
2. **`aiq_rubric.source_url` no longer exists in the AiqRow type or COLUMNS string.** Anything reading `row.source_url` post-this-PR will TS-error. Already swept the codebase (only consumer was `AiqHistory.tsx`); a stale docstring in `aiq-drafts/actions.ts` was also updated. If you find another consumer, that's a missed surface — surface it.
3. **`AiqSources` is `Partial<Record<DimSlug, string>>` — every key is optional.** Code reading `sources.disclosure` must handle `undefined`. The SourcesLine component in AiqHistory.tsx handles this correctly (filter + fallback to first available); the editor passes `latest?.sources?.[slug] ?? ""` so empty defaults are correct.
4. **The Supabase migration has NOT been applied anywhere yet.** If you're testing against production Supabase, `/aiq/[ticker]` save path will 400 (column doesn't exist). Apply the migration on a dev branch before testing the save path end-to-end. Or test against env-unset fixture mode (read-only callout).
5. **Mercury #7 changed Universe page scroll behavior.** Whole canvas now scrolls together — UniverseHeader (title + search + name-count) scrolls away as you scroll the table. If a future task adds another sticky element above the table, it'll need explicit `position: sticky; top: 0` AND a z-index higher than thead's (z: 1).
6. **`?seed=fixture-positions` only works on `/portfolio`.** Other surfaces don't read the seed query param — adding similar demo affordances to other surfaces requires explicit wiring.
7. **`FIXTURE_BOOK` in `web/src/lib/portfolio-data.ts:155` is hand-curated.** If the FIXTURE_INDEX (in `universe-fixture.ts`) loses any of the 12 tickers (NVDA TSM AMD MSFT GOOGL META CRWD PLTR VST CEG AAPL ADBE), the fixture book falls through to `fallbackUniverseRow(ticker)` which shows the ticker as its own name and layer 0. Not a crash, just a degraded demo display.
8. **`getFixturePortfolioSnapshot()` runs synchronously but is awaited because the page calls it via ternary.** The branch `demo ? getFixturePortfolioSnapshot() : await getPortfolioSnapshot()` is fine because TS coerces — but if you refactor to a Promise.all, wrap the fixture call in `Promise.resolve()`.
9. **PR body title is 144 chars** — most GitHub displays truncate. Title's intentional all-cap-bullets format makes the truncation graceful (readers see "Lambo design pass: tokens · Mercury decard · rails…"). Don't edit the title to something longer.
10. **`gh pr comment` posts as bot user, not Terry.** Confirmed by the comment URL (`...#issuecomment-4472449414`). If Terry wants the smoke results posted under his name, he'd need to copy/paste them himself.
11. **Right-rail `CtxPanel` was NOT touched this session.** Override #1 (verbatim S2: *"I do like the right rail though that I have as part of MY DESIGN. Leave that."*) was honored. The `CtxPanel` `rail === "none"` early-return added in S4 is the only structural change to the rail across the lambo pass.
12. **The /sch skill is loaded but its output appears as a tool result in chat, not as a real skill invocation.** Reading the skill spec then writing the artifacts is the actual contract. The 12-section handoff doc + Block B = /sch deliverables.

## 12. Next-session pickup point

Choose one of these (none is "obviously next" — Terry's call):

1. **Hold for PR #8 review/merge.** If `gh pr view 8 -q '.state'` returns `MERGED`, run §7.2 migration dry-run on a Supabase dev branch (with Terry's quota-spend confirmation) and post results as PR comment.
2. **Author next-phase Linear tickets.** THS queue is empty (verify with `mcp__claude_ai_Linear__list_issues team=THS state=Todo includeArchived=false`). Surface the natural next-work items based on what's NOT in the v2 spec yet — Phase 2 backtest review? Production deploy push? Authoring tickets needs Terry's roadmap input first.
3. **Manual click-through smoke on each surface.** Playwright covered HTTP + console; remaining unchecked is the human-eye review of each canvas. ~15 minutes if just visual / 30+ if includes interactions.
