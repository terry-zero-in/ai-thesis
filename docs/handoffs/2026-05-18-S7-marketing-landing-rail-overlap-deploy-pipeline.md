# S7 handoff — 2026-05-18 — Marketing landing + rail overlap + deploy-pipeline gotchas

Written at 2026-05-18 18:08 CDT (23:08 UTC). Next-Claude: verify every claim below against live state before acting (per `feedback_handoff_as_context_not_commands`).

---

## 1. TL;DR

- THS-84 Marketing landing **shipped + verified live** at https://ai-thesis-v2.vercel.app/ (HTTP 200, 72KB body, hero + 4 features + score math + 3-tier pricing + disclaimers + footer).
- Two cross-page layout bugs caught + fixed: right CtxPanel rail and Portfolio add-position form were both stealing canvas width on common laptop viewports. New global breakpoint floor: 1600px (below = overlay/stack, above = flex sibling).
- **Two deploy-pipeline gotchas discovered, both still LIVE and dangerous**: (a) GitHub→Vercel auto-deploy webhook is silently broken — every commit this session needed manual `vercel deploy --prod --yes`; (b) repo-root `.vercel/project.json` points to the WRONG Vercel project (`ai-thesis` instead of `ai-thesis-v2`), so `vercel deploy` from repo root deploys to the wrong project and the production alias does not update.
- Terry has ONE open comment on the Portfolio crowding fix (commit `9a5c952`) — did not state it yet; deferred to next turn.
- 4 commits pushed (`c904a9b`, `536774b`, `cf99984`, `9a5c952`). Working tree clean except 4 untracked handoff docs.
- /lambo self-audit graded landing **6/10**: hero too product-light, feature tiles claim-soup, sections cavernous, no engine version stamp, pricing recommended-tile underdifferentiated. Concrete restructure proposed (fold score-math into hero) but not shipped — Terry didn't direct it.

## 2. Architectural pivot or major decision

**Decision 1 — Root `/` gates by auth, becomes the marketing landing for unauthed visitors.** Per AskUserQuestion answered "Root / — gate by auth (Recommended)" at session open. Rejected alternatives: `/welcome` bare route, dashboard-at-`/dashboard` refactor. Implementation: top-of-function auth check in `web/src/app/page.tsx`, plus `ConditionalShell` carve-out so the operator Shell (sidebar/topbar) doesn't render for unauthed visitors at `/`, plus Next 16 proxy carve-out so the proxy doesn't redirect unauthed `/` traffic to `/login` before page.tsx runs.

**Decision 2 — Waitlist email capture as the CTA target.** Per AskUserQuestion answered "Waitlist email-capture form (Recommended)". Rejected: disabled CTA + caption, mailto link, link to /login. Server action `joinWaitlist` best-effort writes to `public.marketing_waitlist` if the table exists (it doesn't yet — see §9), otherwise logs to console and returns success.

**Decision 3 — Single 1600px breakpoint for "canvas needs full width on this surface."** Applied to two CSS surfaces:
- `.ctx-panel-aside` (right rail) — below 1600px becomes position:fixed overlay; above stays flex sibling.
- `.portfolio-grid` (Portfolio table + form) — below 1600px stacks form under table; above sits side-by-side with 48px gap.

Rationale: prior 1280px breakpoint on portfolio-grid was too low — at 1280-1599px viewports the form crowded the right edge of the 10-column positions table. Consistent floor across surfaces means future wide canvases (Backtest etc.) get the right behavior for free.

## 3. State of the world

**Services / endpoints:**
- Next.js 16 + React 19 + Tailwind v4 (per `web/AGENTS.md` — breaking changes from prior versions; consult `node_modules/next/dist/docs/` before any novel patterns).
- Supabase SSR via `@supabase/ssr` createServerClient (`web/src/lib/supabase/server.ts`).
- Vercel hosts production at `ai-thesis-v2.vercel.app` (alias to deploys under project `ai-thesis-v2`, id `prj_YkjioJcd1aEBmr1becSngnv9g8wP`).
- Anthropic Routines (planned, NOT YET set up — see THS-71 in §9).

**Vercel deploy pipeline (BROKEN — read carefully):**
- GitHub repo `terry-zero-in/ai-thesis` is supposedly connected to Vercel for auto-deploy on main. **It is not firing.** Last auto-deploy that landed on the production alias was 21+ hours before session start. All 4 commits this session required `vercel deploy --prod --yes` run manually from `web/`.
- `/Users/terryturner/Projects/ai-thesis/.vercel/project.json` at repo root points to **project `ai-thesis` (id `prj_D9olPvBb2W0h7l5oYGgkAnzuHRKs`)** — wrong project. Deploying from repo root sends the build to that wrong project and prod alias never updates.
- `/Users/terryturner/Projects/ai-thesis/web/.vercel/project.json` points to the **correct project `ai-thesis-v2` (id `prj_YkjioJcd1aEBmr1becSngnv9g8wP`)**.
- **Rule for every Vercel command next session: `cd /Users/terryturner/Projects/ai-thesis/web` first, then `vercel deploy --prod --yes`. Verify the prod alias updated by `curl -sI https://ai-thesis-v2.vercel.app/`.**

**Scheduled jobs:** none firing yet. Routines plumbing (THS-71) still in_progress; Terry has not applied the e80 migration or created the 4 routines.

**External integrations:** Supabase + FMP (price chain) + Vercel. No Anthropic API direct use.

**DB state:** unchanged this session. No migrations applied. No schema edits.

**Git state (verified `git rev-parse HEAD` + `git rev-list --count` at 2026-05-18 23:08 UTC):**
- Branch: `main`
- HEAD: `9a5c952d5d0846564c6bd2f17bbc159461bbb529` (short `9a5c952`)
- Commits ahead of `origin/main`: **0** (all pushed)
- Working tree: clean. 4 untracked handoff docs (S3, S4, S5, S6) — see §9 #2.
- TSC (`web/`): **0 errors** (exit 0).
- Production (`https://ai-thesis-v2.vercel.app/`): **HTTP/2 200**, body 72,325 bytes, marketing markers present (`research terminal`, `AI infrastructure trade`, `Notify me`, `Starter`, `HIGH ≥`).
- Production alias verified pointing at the correct latest deploy `ai-thesis-v2-ps0a7becp-...` (13min old at handoff write, includes Portfolio breakpoint fix).

## 4. Action / API reference

No new API endpoints or route handlers added this session. One new server action:

- `joinWaitlist(prev, formData)` — `web/src/components/marketing/waitlist-action.ts`. Email-only capture from the marketing landing hero. Best-effort insert into `public.marketing_waitlist` table; if 42P01 (relation does not exist), log to server console and return success. Returns `{ok:true, email}` or `{ok:false, error}`. Public; no auth required (lives behind the unauthed `/` landing).

## 5. Files created or modified

| Path | Action | Rationale |
|---|---|---|
| `web/src/components/marketing/MarketingLanding.tsx` | created | THS-84 single-file landing (847 lines, server component, inline sub-components per /linear template discipline). |
| `web/src/components/marketing/WaitlistForm.tsx` | created | Client component for email-capture form using React 19 `useActionState` + `useFormStatus`. |
| `web/src/components/marketing/waitlist-action.ts` | created | "use server" action — best-effort insert into `public.marketing_waitlist`. |
| `web/src/app/page.tsx` | modified | Top-of-function auth gate (`getSupabaseServer` → `auth.getUser()` → `null` → render `<MarketingLanding />`; otherwise render existing dashboard). |
| `web/src/app/globals.css` | modified | Three additions: `.score-math-grid` responsive (landing); `.ctx-panel-aside` overlay-when-narrow (right rail); `.portfolio-grid` breakpoint 1280→1600 + gap 32→48. |
| `web/src/components/shell/ConditionalShell.tsx` | modified | Carve-out so `pathname === "/" && !userEmail` renders bare (no operator Shell). |
| `web/src/components/shell/CtxPanel.tsx` | modified | Added `className="ctx-panel-aside"` to the aside; logic explained in §6 decision-3. |
| `web/src/hooks/ctx-panel-context.tsx` | modified | Default rail-open is true at ≥1600px, false at <1600px (SSR-safe `useEffect` checks matchMedia on mount). |
| `web/src/proxy.ts` | modified | Carve-out: unauthed `/` not redirected to `/login` so page.tsx can render the marketing landing. |

## 6. Decisions locked

**Decision A — Landing lives at root `/`, gated by auth, ConditionalShell suppresses operator chrome.**
- **Why:** /lambo "perception is product." Modern SaaS pattern (vercel.com, linear.app). User chose this over `/welcome` bare route via AskUserQuestion.
- **Tradeoff accepted:** Three layers had to coordinate (page.tsx render gate, ConditionalShell chrome gate, proxy.ts redirect gate). One miss = either a broken-looking dashboard for unauthed users OR a forced /login redirect that hides the landing. All three are now coordinated.

**Decision B — CTA is a waitlist email form, not a /signup link or mailto.**
- **Why:** /signup blocked by THS-MZ-14 (auth + billing infra not built). Waitlist captures intent without a fake CTA destination. User chose via AskUserQuestion.
- **Tradeoff accepted:** No real waitlist table yet — server action falls back to console.log. Visitor gets green thank-you regardless; honest contract is "interest captured" but the data isn't actually persisted until Terry adds the table.

**Decision C — 1600px single breakpoint for "canvas needs full width."**
- **Why:** Universe table minWidth ≈1500px + 220px sidebar + 320px rail = 2040px floor before nothing has to compress. Most laptop screens are 1440-1600px. Single floor across CtxPanel + Portfolio form keeps the rule legible.
- **Tradeoff accepted:** On 1600px monitors the right rail is right at the boundary — might feel slightly tight. Will iterate up to 1700 if Terry observes crowding at 1600 viewports.

**Decision D — Score Math example on landing uses true L2 Tier-A weights, not the ticket's illustrative 74.1.**
- **Why:** /lambo "math reconciles end-to-end." Ticket's "AVGO 74.1" didn't math cleanly with real L2 weights. Picked Q90/G80/V70/AIQ80 inputs that produce weighted values (35.1, 21.6, 11.9, 13.6) summing to exactly 82.2, × 0.95 = 78.1, tier HIGH ≥ 75. Every visible number reconciles.
- **Tradeoff accepted:** Diverged from the ticket's illustrative number. Final tier shown is HIGH not the ticket's Medium — still defensible (illustrative example, picks a strong-profile name to anchor "research terminal" claim).

**Decision E — /lambo audit of shipped landing graded 6/10, restructure proposed but NOT shipped.**
- **Why:** Honest self-grade per /honesty + /lambo. Score-math is the page's strongest moment but sits 1300px down the page. Hero is product-light. Feature tiles are claim-soup with no institutional texture (no mono micro-facts). Section padding cavernous. Pricing tiles don't visually differentiate Recommended.
- **Tradeoff accepted:** Identified ONE-move tightening (fold score-math into hero as a two-column layout) and surfaced to Terry. He pivoted to fix-the-overlap work before answering. Restructure is queued for S8 if he directs it.

## 7. Next-session test plan

### 7.1 Read-only verification (paste-and-run, <60s)

```bash
cd /Users/terryturner/Projects/ai-thesis
git rev-parse HEAD                              # expect 9a5c952d5d0846564c6bd2f17bbc159461bbb529
git status --short                              # expect 4 untracked handoff docs (S3/S4/S5/S6) only
git rev-list --count origin/main..HEAD          # expect 0
git log --oneline -5                            # expect 9a5c952 → cf99984 → 536774b → c904a9b → 9543598
cd web && npx tsc --noEmit ; echo "tsc=$?"      # expect 0
curl -sI https://ai-thesis-v2.vercel.app/ | head -1   # expect HTTP/2 200 (NOT 307)
curl -s https://ai-thesis-v2.vercel.app/ | grep -oE "research terminal|AI infrastructure trade|Notify me|Starter|HIGH" | sort -u
# expect 5 lines (or 6 with case variants): AI infrastructure trade, HIGH, Notify me, Starter, research terminal
```

If `tsc=0` and prod returns HTTP/2 200 with marketing markers, the live surface from S7 is intact.

### 7.2 Visual verification (browser — Terry on his side, or Claude with auth via Playwright)

1. Open `https://ai-thesis-v2.vercel.app/` in browser **without logging in**. Expect marketing landing (hero, 4 features, score-math derivation example showing Q90/G80/V70/AIQ80 → composite 82.2 → ×0.95 → final 78.1 → HIGH, pricing tiles, disclaimers, footer).
2. Hit "Notify me" with a fake email. Expect green thank-you state inline.
3. Log in. Expect dashboard (not landing) at `/`. Operator chrome (sidebar, topbar, ctx-panel) renders.
4. Go to `/universe`. At your viewport width:
   - If ≥1600px: rail sits as flex sibling on right, table fits in remaining width.
   - If <1600px: rail is closed by default. Open via ⌘\ — it floats as overlay with drop shadow over the right edge of the canvas. Table claims full canvas width.
5. Go to `/portfolio`. At your viewport width:
   - If ≥1600px: add-position form sits in 320px right column with 48px gap between table edit column and form fields.
   - If <1600px: form stacks BELOW the full-width positions table.
6. **Terry's open comment on the Portfolio fix (commit 9a5c952) is unresolved** — wait for it before claiming Portfolio crowding fully done.

### 7.3 Deploy-pipeline test (CRITICAL — see §11 gotchas)

If you push a commit:
```bash
cd /Users/terryturner/Projects/ai-thesis/web   # MUST cd into web/ first
vercel deploy --prod --yes                     # auto-deploy webhook is broken; manual is required
# After ~40s, verify alias updated:
curl -sI https://ai-thesis-v2.vercel.app/ | head -1   # expect 200 (not 404, not 307)
```

If you accidentally run from repo root, the build goes to the WRONG Vercel project (`ai-thesis`, not `ai-thesis-v2`) and the production alias does not update. Symptoms: deploy succeeds, prod alias still returns old content. Recovery: `cd web && vercel deploy --prod --yes` (re-deploys to correct project).

## 8. Budget / quota tracking

**None this session.** No paid API calls. No Vercel build-minute concerns (4 deploys, ~22s build time each).

## 9. Known issues / backlog

1. **GitHub→Vercel auto-deploy webhook silently broken** (deploy pipeline). Every commit since at least 21h before session start has required manual `vercel deploy --prod --yes`. Terry needs to either reconnect the integration in Vercel project settings OR every future session needs to keep manually deploying. Affects every future commit.
2. **4 untracked handoff docs** (`docs/handoffs/2026-05-18-S3*.md`, `...S4*.md`, `...S5*.md`, `...S6*.md`) plus this S7 doc when written. Roll into the next commit (or a single `docs: track session handoff docs` commit). Don't let it grow further.
3. **Repo-root `.vercel/project.json` is wrong.** Points to project `ai-thesis` (id `prj_D9olPvBb2W0h7l5oYGgkAnzuHRKs`). Should either be deleted or fixed to match `web/.vercel/project.json` (id `prj_YkjioJcd1aEBmr1becSngnv9g8wP`). Currently it just causes confusion + accidental wrong-project deploys.
4. **THS-71 Routines plumbing still in_progress** (carried from S6). Terry hasn't applied the e80 migration in Supabase Studio or created the 4 routines on claude.ai/code. Blocks `/aiq-drafts` Pending tab + `/decisions` thesis_broken alert finish.
5. **`public.marketing_waitlist` table doesn't exist.** Waitlist server action falls back to console.log silently. If you want waitlist persistence: add a 2-column migration (`id uuid pk default gen_random_uuid(), email text unique not null, source text, created_at timestamptz default now()`). Until then, every captured email is lost to `vercel logs` ephemera.
6. **/lambo audit of landing: 6/10, restructure proposed but unshipped.** Concrete proposal: convert hero to two-column layout (headline + waitlist left, score-math ladder right, stacks below 960px). Plus: drop section padding clamp 60-110→48-80; replace feature-tile prose captions with mono micro-facts; give Starter pricing tile accent-soft tint + 2px iris top-border. Queued for S8 if Terry directs.
7. **Terry has one open comment on the Portfolio crowding fix** (commit `9a5c952`). He said "I have one comment but lets compact first /sch" — comment not yet stated. Resolve first thing in S8.
8. **Marketing landing has no product screenshot/embed.** /lambo principle: "show the product." Linear/Vercel landings always do. Currently the landing only proves explainability via the static Score Math example; no actual UI screenshot anywhere. If shipping S8 polish, consider embedding a static dashboard screenshot or a small interactive demo.
9. **No engine version stamp on the marketing page anywhere visible.** Should add `engine v1.0 · regenerated weekly` mono caption under the score-math ladder header per /lambo institutional texture.
10. **Tickets blocked on Terry input** (carried from S6 + S7):
    - THS-75 AIQ Editor cockpit — no spec.
    - THS-76 Portfolio Guardrails — no spec.
    - THS-77 Decisions inbox — no spec.
    - THS-79-82 /lambo Pages 2-8 polish — awaiting per-page specs.
    - THS-85 Auth + Stripe — billing risk, gated by Terry direction.
    - THS-87 backtest — Medium; duplicate THS-87 in Linear needs deletion.
    - Palette v1.2 refinement — deferred until Terry explicitly directs.

## 10. Quick-reference IDs

- **Production URL:** https://ai-thesis-v2.vercel.app/
- **Vercel project (CORRECT):** `ai-thesis-v2`, id `prj_YkjioJcd1aEBmr1becSngnv9g8wP`, org `team_lz1y0drEGAlm56SDV39OP1zk`
- **Vercel project (WRONG, do not deploy here):** `ai-thesis`, id `prj_D9olPvBb2W0h7l5oYGgkAnzuHRKs`
- **Latest production deploy:** `ai-thesis-v2-ps0a7becp-terry-8893s-projects.vercel.app` (commit `9a5c952`)
- **HEAD SHA:** `9a5c952d5d0846564c6bd2f17bbc159461bbb529`
- **Linear epic:** THS-70 — Monetization-Ready v1
- **Linear ticket shipped this session:** THS-84 — Marketing landing — paid-beta wedge
- **Working dir for code:** `/Users/terryturner/Projects/ai-thesis/web`
- **Working dir for git + handoffs:** `/Users/terryturner/Projects/ai-thesis`
- **Supabase project (Reticle, hosts oc_routines + ai_thesis schemas):** `ydzvrosvkmqkdaqgsxtb`
- **Marketing files:** `web/src/components/marketing/{MarketingLanding,WaitlistForm,waitlist-action}.{tsx,ts}`
- **Cross-page CSS rules:** `web/src/app/globals.css` — `.ctx-panel-aside`, `.portfolio-grid`, `.score-math-grid`

## 11. Pitfalls / gotchas

1. **`cd web/` before any Vercel command.** Repo root deploys to wrong project. Symptoms: deploy succeeds, prod alias doesn't update, possibly 404s on routes.
2. **GitHub auto-deploy is broken.** Every commit needs manual `vercel deploy --prod --yes` from `web/`. Until Terry fixes the webhook in Vercel project settings.
3. **Next 16 calls middleware "proxy.ts" not "middleware.ts".** The file at `web/src/proxy.ts` is the middleware-equivalent. Pattern lives there.
4. **Default rail-open state is viewport-dependent now** (`ctx-panel-context.tsx`). On narrow viewports the rail starts closed. On wide viewports the rail starts open. Don't assume it's always open — test both.
5. **Marketing landing CSS uses raw inline styles, not className everywhere.** Single-file `MarketingLanding.tsx` follows the existing project pattern. If you need a responsive rule, add it to globals.css as a named class (like `.score-math-grid`) and add the className to the inline element.
6. **Waitlist insert silently succeeds when table doesn't exist** (PostgresError 42P01). Don't take "no errors in logs" as proof the waitlist is being captured to DB.
7. **ConditionalShell's `landingUnauthed` carve-out specifically checks `pathname === "/"`** — exact match, not startsWith. Any future "marketing" routes would also need to be added here OR moved under a `/marketing/*` prefix that gets its own bare-route handling.
8. **Proxy carve-out for `/` is unauthed-only.** Authed users at `/` still flow through to the dashboard. Don't refactor the proxy to treat `/` as universally public — it weakens operator-surface protection.
9. **Score Math example numbers are TRUE-math-derived from real L2 weights.** Don't update Q/G/V/AIQ inputs without re-running the weighted sums; the visible composite (82.2) and final (78.1) MUST stay consistent end-to-end per /lambo math-reconciles rule.
10. **Voltage CTA discipline (one per page) is non-negotiable on marketing surfaces.** Don't add a second Voltage button to the pricing tiles or the footer.
11. **FooterDisclosure text is LOCKED** per `docs/compliance/language-discipline.md`. Same constraint on the new marketing landing's disclaimer block — text is hand-crafted to match the compliance allow-list. Edits require Terry approval.
12. **The `web/AGENTS.md` warning is real.** Next.js 16 has breaking changes not in your training data. If you reach for an unfamiliar API pattern, read `node_modules/next/dist/docs/` first.

## 12. Next-session pickup point

1. Run §7.1 verification (5 commands + tsc + curl, expect HEAD `9a5c952`, 0 ahead, tsc=0, prod HTTP/2 200).
2. **First substantive action: ask Terry for his one open comment on the Portfolio crowding fix (commit `9a5c952`).** He stated mid-S7 "I have one comment but lets compact first /sch" — comment unresolved. Don't proceed to other tickets until that's addressed.
3. After Terry's comment is resolved + shipped, two natural next moves:
   - Apply /lambo restructure to landing (fold score-math into hero as two-column, drop section padding, mono micro-facts on feature tiles). Concrete proposal in §9 #6.
   - OR pick the next blocked Linear ticket if Terry drops a spec (THS-75/76/77/79-82/85).
4. **Do not deploy from repo root.** `cd /Users/terryturner/Projects/ai-thesis/web` first, then `vercel deploy --prod --yes`.
