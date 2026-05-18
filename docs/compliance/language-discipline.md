# Compliance Language Discipline — THS-86

**Status:** LOCKED 2026-05-18 (S6).
**Owner:** Terry. Updates require Terry approval.
**Legal floor for:** marketing landing (THS-84), auth + billing (THS-85), every routine prompt, every user-facing UI string, every fixture memo.

---

## Position

AI Thesis is **explainable investment research software**. It produces factor scores, tier rankings, drift signals, and educational analysis. It is **not** an investment advisor, broker-dealer, or fiduciary. It does **not** recommend trades, manage portfolios on the user's behalf, or offer personalized investment advice.

Every routine output, UI string, marketing claim, and customer-facing artifact must hold this line.

## Why this matters

The U.S. Investment Advisers Act of 1940 + SEC Marketing Rule 206(4)-1 (effective Nov 2022) restrict what software-as-a-service products may say about investment performance, hypothetical results, and personalized recommendations. Software that crosses the line into "personalized investment advice" can be regulated as an Investment Adviser — registration, fiduciary duty, ADV filings, custody rules, full audit. None of which we want.

Staying on the research/educational side of the line means we explicitly **do not** tell users what to buy, sell, deploy, or hold. We **do** show them research outputs and let them decide.

## Allow list — preferred language

Use these patterns. They describe what the engine does, not what the user should do.

| Allowed | Example |
|---|---|
| **Composite / score / factor** | "Composite dropped 12 points week-over-week" |
| **Tier / tier transition** | "NVDA moved from High to Medium tier" |
| **Research note** | "Research note: insider buy cluster crossed threshold" |
| **Watchlist** | "Add to watchlist" |
| **Drift / drift observed** | "Insider drift signal — three sales over 30 days" |
| **Suggested review** | "Engine suggests reviewing position thesis" |
| **Educational analysis** | "Educational analysis: how concentration risk affects AIQ score" |
| **Factor decomposition** | "Driver: V factor improved +3.2 over 7 days" |
| **Scoring framework / ranking** | "Ranking by composite, filtered to L1 Compute" |
| **Engine flag / engine signal** | "Engine flag: broken thesis" |
| **Observation / observed pattern** | "Observed pattern: capex revisions correlate with composite drift" |
| **Backtest / simulation** | "Backtest: hypothetical performance, not advice" |
| **Cost basis / invested / allocated** | "$79,475 invested across 13 positions" |

## Ban list — never user-facing

These trip the line from research → advice. Never appear in production UI copy, routine prompts, or marketing claims.

| Banned | Why | Replacement |
|---|---|---|
| **buy** | Directive trade recommendation | "research note", "engine flag" |
| **sell** | Directive trade recommendation | "thesis weakening", "drift observed" |
| **deploy** (as directive verb) | "Deploy capital into X" → advice | "invested in", "allocated to" |
| **recommend** | Triggers IAR/RIA definition | "engine surfaces", "research suggests review" |
| **you should** | Personal directive | "research suggests review" |
| **outperform / outperformed** | Performance claim under 206(4)-1 | "scored higher", "ranked above" |
| **model portfolio** | Term-of-art for advisory product | "watchlist", "research universe" |
| **guaranteed / risk-free** | Forward-looking performance | n/a — never make this claim |
| **advisor / advisory / advice** | Defines us as IAR | "research", "research software", "analysis" |
| **best stocks / top picks** | Personalized recommendation | "highest-composite names", "Tier-A ranking" |
| **alpha generation** | Performance claim adjacent | "factor decomposition" |
| **trading signal** (alone) | Reads as directive | "research signal", "drift signal" |

## Edge cases — KEEP these

These appear similar to banned terms but are **factual descriptors of past events**, not directives. They stay.

- **"BUY / SELL"** as labels for SEC Form 4 transaction codes (P = purchase, S = sale). These describe past insider behavior reported to the SEC. Always factual, never directive.
  - Example: "NVDA · BUY · CFO · $2.1M · 2026-05-12" → describes a filed transaction.
- **"insider buy cluster" / "insider sell cluster"** — observed insider trading patterns. Always past-tense, always third-party (the insider), never the user.
- **Internal code identifiers** like `total_deployed`, `isBuy`, `transaction_code === "P"` — code-only, never rendered to users.

## Required disclosures

### Global footer disclosure

Every page must render the global `<FooterDisclosure />` component. Single source of truth at `web/src/components/shell/FooterDisclosure.tsx`.

Text (LOCKED — do not edit without legal review):

> AI Thesis is research and analysis software, not an investment advisor or broker-dealer. Nothing on this site is personalized investment advice, an offer to buy or sell securities, or a recommendation. Hypothetical performance does not predict future results. Past insider transactions reported under SEC Form 4 are public-record descriptions of past events. Consult a licensed advisor before making investment decisions.

### Backtest pages

Any page displaying backtested / hypothetical performance must additionally show, near the headline metric:

> Hypothetical performance · derived from historical inputs · not indicative of future results · not advice

### Routine output (every email / pulse / brief)

The model's system prompt must enforce research framing (see `docs/routines/01-daily-batch.md` §3 line 21 for canonical phrasing). Every output we publish to a user surface must include the global footer disclosure at minimum.

### Marketing landing (THS-84)

The signup page and any pricing/feature page must include:

- Footer disclosure (global component, full text)
- Hero subhead must avoid all banned terms
- "How it works" copy must use allow-list language
- Pricing CTA cannot say "Start investing" / "Start trading" — must say "Start research" or "Start your research subscription"

## Routine prompt review (verified 2026-05-18)

| Routine | Compliance check | Status |
|---|---|---|
| `01-daily-batch.md` | Line 21 enforces research framing + explicit ban list | ✅ Locked |
| `02-weekly-rescore.md` | Line 19 enforces research framing | ✅ Locked |
| `03-monthly-curator.md` | Line 19 + 23 enforce observational framing | ✅ Locked |
| `04-position-pulse.md` | Line 26 enforces no "should sell" / "exit" language | ✅ Locked |

## UI scrub log (2026-05-18 — THS-86 commit)

| Location | Before | After | Rationale |
|---|---|---|---|
| `portfolio/page.tsx:77` subtitle | "Live deployment · single book · manual cost-basis entry" | "Live tracking · single book · manual cost-basis entry" | "Deployment" reads as active/directive |
| `portfolio/AggregateBar.tsx` Total Capital sub | "single-book deployment cap" | "single-book capital cap" | Same |
| `portfolio/AggregateBar.tsx` middle tile label | "Deployed" | "Invested" | "Deployed" as verb is on ban list; "Invested" is the industry-standard descriptor |
| `portfolio/AddPositionForm.tsx:247` submit button | "Buy" (dollar mode) / "Add position" (shares mode) | "Add position" (both modes) | "Buy" on a CTA is directive |
| `lib/memos-data.ts:81,85` fixture memo headline | "Cut TSM by half on accelerating high-book correlation; redeploy to ANET + ASML." | "TSM thesis weakening — high-book correlation accelerating. Watchlist review suggested for ANET, ASML." | Memo fixture text appears in demo workspace; "Cut" / "redeploy" are directives |

## Self-audit before any release

Before pushing any commit that touches UI strings, marketing copy, routine prompts, or memo fixtures, grep:

```bash
grep -rni --include="*.tsx" --include="*.ts" --include="*.md" \
  -E "\b(you should|recommend(s|ed|ation)?|outperform|model portfolio|guaranteed?|risk[- ]free|advisor|advisory|deploy(ment|ed|s)?\b)" \
  web/src docs/routines docs/compliance
```

Any hit must be either (a) on the keep list above, (b) inside a code comment, or (c) inside this discipline document itself. Otherwise scrub.

## Open follow-ups

- **THS-84 marketing landing** — must use this language end-to-end. Footer disclosure mandatory above the fold and in footer.
- **THS-85 auth + Stripe** — Stripe product description, signup checkbox text, and welcome email all need compliance review before billing goes live.
- **Backtest page (THS-87)** — needs the hypothetical-performance disclosure inline near headline metrics, not just in footer.
