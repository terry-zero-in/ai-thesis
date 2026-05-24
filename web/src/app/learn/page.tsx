import type { ReactNode } from "react";
import { NoRail } from "@/components/shell/NoRail";
import { PageHeader } from "@/components/primitives/PageHeader";
import { LearnTOC, type TocSection } from "./LearnTOC";

/**
 * /learn — the AI Thesis methodology page.
 *
 * Single scrolling reference page that explains every concept in the app:
 * what the algorithm does, what each factor measures, what every page is
 * for, how to act on signals. Modeled on Vercel / Stripe / Linear docs —
 * sticky TOC sidebar on the left, narrative-first sections on the right,
 * formula details one expansion away via native <details>.
 *
 * Voice posture: written for Mom/Dad first (plain English, analogies),
 * formulas demoted to <details> so a quant can verify but a non-quant
 * never has to look at them.
 *
 * Static content — no DB calls, no auth-gated data. Pure documentation
 * surface. Updates live alongside the algorithm + design spec.
 */

const SECTIONS: TocSection[] = [
  { id: "what", label: "What AI Thesis is", hint: "the 60-second version" },
  { id: "algorithm", label: "The algorithm", hint: "in plain English" },
  { id: "factors", label: "The four factors", hint: "Q · G · V · AIQ" },
  { id: "layers", label: "Layers (L1–L5)", hint: "how names get grouped" },
  { id: "tiers", label: "Tiers", hint: "High / Med / Low / Avoid" },
  { id: "macro", label: "Macro regime", hint: "when to de-rate" },
  { id: "adjustments", label: "Special adjustments", hint: "tax · depreciation" },
  { id: "pages", label: "How to read each page", hint: "what every screen does" },
  { id: "playbook", label: "Operator playbook", hint: "what to do when X" },
  { id: "glossary", label: "Glossary", hint: "every term, A–Z" },
];

export const metadata = {
  title: "Learn · AI Thesis",
  description:
    "How the AI Thesis algorithm works, what every score and signal means, and what to do when something changes.",
};

export default function LearnPage() {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <NoRail />
      <PageHeader
        eyebrow="Methodology"
        title="Learn"
        subtitle="How the engine scores, what the signals mean, and when to act."
      />

      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px 32px 80px",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "200px minmax(0, 720px)",
            gap: 56,
            maxWidth: 1000,
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          <LearnTOC sections={SECTIONS} />
          <article
            style={{
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--text-2)",
              fontFamily: "var(--f)",
              display: "flex",
              flexDirection: "column",
              gap: 56,
            }}
          >
            <WhatItIs />
            <Algorithm />
            <Factors />
            <Layers />
            <Tiers />
            <Macro />
            <Adjustments />
            <Pages />
            <Playbook />
            <Glossary />

            <Footer />
          </article>
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   1. What AI Thesis is
   ============================================================= */

function WhatItIs() {
  return (
    <Sec id="what" eyebrow="01" title="What AI Thesis is">
      <P>
        AI Thesis is a personal AI-investing copilot. It tracks ~50 public
        companies that sit somewhere in the artificial-intelligence buildout —
        chip designers, hyperscalers, app companies, power producers, incumbents
        with embedded AI — and gives each one a single <Em>score</Em> from 0 to
        100. The score is the engine&rsquo;s honest read on how attractive that
        name is right now, on the evidence available.
      </P>
      <P>It does three jobs, every day:</P>
      <List
        items={[
          {
            bold: "Scores.",
            body: "Every name gets a fresh Q · G · V · AIQ breakdown, a composite, and a tier (High / Medium / Low / Avoid). The math is shown — there is a Score Math drawer on every detail page that derives the headline from the four inputs end-to-end.",
          },
          {
            bold: "Monitors.",
            body: "When something material changes — earnings revisions, insider buying clusters, depreciation policy shifts, macro gauges tightening — the change shows up on the Decisions page as a small alert with the relevant context attached.",
          },
          {
            bold: "Proposes.",
            body: "When the alerts add up to a real decision (add a position, trim, exit, watch), the app drafts a memo with the rationale. You read it, you decide. The engine never trades anything.",
          },
        ]}
      />
      <Callout>
        <Em>What it is not:</Em> not a broker, not a trading bot, not a paid
        advisor, not a guarantee of anything. Every number on every page is
        research output — you make the decision.
      </Callout>
    </Sec>
  );
}

/* =============================================================
   2. The algorithm in plain English
   ============================================================= */

function Algorithm() {
  return (
    <Sec id="algorithm" eyebrow="02" title="The algorithm">
      <P>
        Behind every score is the same five-step computation. It looks like a
        lot, but the intuition is simple: <Em>take four quality measurements,
        weight them by what kind of company it is, then dock the score for
        risks the four measurements miss.</Em>
      </P>

      <OrderedSteps
        steps={[
          {
            label: "Step 1 — Score the four factors.",
            body: (
              <>
                For every name, the engine produces four 0–100 scores: <Em>Q</Em>{" "}
                (Quality), <Em>G</Em> (Growth), <Em>V</Em> (Valuation), and{" "}
                <Em>AIQ</Em> (AI Exposure Quality, scored by hand). What each
                one measures is laid out below in §03.
              </>
            ),
          },
          {
            label: "Step 2 — Weight them by layer.",
            body: (
              <>
                A power producer (L4) earns its keep through Quality and
                Valuation; an AI-native app (L3) earns it through Growth. Each
                of the five layers has its own weights, so the composite
                reflects how that <Em>kind</Em> of company actually creates
                value. See §04 for the full weight table.
              </>
            ),
          },
          {
            label: "Step 3 — Subtract concentration tax.",
            body: (
              <>
                If the name is heavily correlated to other things you own —
                NVDA when you already own AVGO and TSM, for example — that&rsquo;s
                a real risk the four factors don&rsquo;t see. The engine takes a
                small bite out of the composite to reflect it. Typically 1–5
                points.
              </>
            ),
          },
          {
            label: "Step 4 — Apply the macro multiplier.",
            body: (
              <>
                Only for names that survive into High-conviction territory
                (composite ≥ 75). If active managers are maximally exposed
                <Em>and</Em> retail is euphoric <Em>and</Em> Fear &amp; Greed is
                pegged at greed, the engine de-rates the most crowded book. See
                §06 for the gates and the multiplier curve.
              </>
            ),
          },
          {
            label: "Step 5 — Classify into a tier.",
            body: (
              <>
                Final score above 75 is <Em>High</Em>. 60–74 is <Em>Medium</Em>.
                45–59 is <Em>Low</Em>. Below 45 is <Em>Avoid</Em>. The tier is
                what tells you the <Em>action</Em>, not the score by itself.
              </>
            ),
          },
        ]}
      />

      <Formula>
        composite = (Q × wQ) + (G × wG) + (V × wV) + (AIQ × wAIQ)
        <br />
        composite_taxed = composite + concentration_tax{" "}
        <Faint>(tax is negative)</Faint>
        <br />
        final_score ={" "}
        <Em>
          composite_taxed ≥ 75 ? composite_taxed × macro_multiplier :
          composite_taxed
        </Em>
      </Formula>

      <Details summary="Worked example — NVDA on May 14, 2026">
        <P>
          NVDA scored <Mono>Q=88</Mono>, <Mono>G=95</Mono>, <Mono>V=60</Mono>,{" "}
          <Mono>AIQ=87</Mono>. On Layer 1 (Compute) the rescaled weights are
          Q&nbsp;0.275, G&nbsp;0.325, V&nbsp;0.175, AIQ&nbsp;0.225 (these are
          the v2 weights renormalized to sum to 1.0 because the engine
          doesn&rsquo;t score M and S yet).
        </P>
        <Formula compact>
          composite = 88·0.275 + 95·0.325 + 60·0.175 + 87·0.225 = 24.2 + 30.875
          + 10.5 + 19.575 = <Em>85.15</Em>
          <br />
          tax = −5 <Faint>(highest PC1 loading in the universe)</Faint>
          <br />
          composite_taxed = 85.15 − 5 = <Em>80.15</Em>
          <br />
          macro_multiplier = 0.95 <Faint>(1 of 3 gates hit, NAAIM &gt; 90)</Faint>
          <br />
          final_score = 80.15 × 0.95 = <Em>76.1</Em> → <Em>High</Em>
        </Formula>
        <P>
          The Score Math drawer on <Mono>/universe/NVDA</Mono> shows this
          derivation live, with every input clickable to its source page.
        </P>
      </Details>
    </Sec>
  );
}

/* =============================================================
   3. The four factors
   ============================================================= */

function Factors() {
  return (
    <Sec id="factors" eyebrow="03" title="The four factors">
      <P>
        Four numbers carry the whole composite. Each is a 0–100 score and each
        measures something genuinely different. They were chosen because the
        academic evidence is strongest for these four and because they cover
        complementary failure modes — a name that is great on Q can still be
        rotten on V; a name that wins on G can still fail on AIQ.
      </P>

      <Factor
        letter="Q"
        name="Quality"
        anchor="quality"
        oneLiner="Is this a fundamentally good business?"
        body={
          <>
            <P>
              Q is the durable-economics score. Margins, return on invested
              capital, balance-sheet strength, business model defensibility.
              It&rsquo;s the factor with the longest empirical track record —
              AQR&rsquo;s Quality-Minus-Junk paper documents the premium
              across 24 countries over decades. A high Q means the company
              would still be a good business if you froze AI demand tomorrow.
            </P>
            <Details summary="What goes into Q">
              <List
                items={[
                  { bold: "Profitability:", body: "gross margin, operating margin, ROIC vs. cost of capital, FCF conversion." },
                  { bold: "Stability:", body: "earnings variability, revenue volatility, customer concentration." },
                  { bold: "Safety:", body: "leverage, interest coverage, distance to default, share dilution." },
                  { bold: "Payout:", body: "dividend or buyback yield as a signal of capital discipline." },
                ]}
              />
            </Details>
          </>
        }
      />

      <Factor
        letter="G"
        name="Growth"
        anchor="growth"
        oneLiner="Is the AI buildout actually showing up in the financials?"
        body={
          <>
            <P>
              G is the AI-leveraged growth score. Revenue acceleration, capex
              efficiency, segment-level AI revenue disclosure. The thesis here
              is Goldman&rsquo;s <Em>revealed phase shift</Em> — in 2026,
              hyperscaler pairwise correlation dropped from ~80% to ~20%
              because the market started discriminating on capex-to-AI-revenue
              conversion. Names that turn cash into revenue beat names that
              just spend.
            </P>
            <Details summary="What goes into G">
              <List
                items={[
                  { bold: "Revenue acceleration:", body: "YoY growth trajectory, sequential reacceleration." },
                  { bold: "AI segment disclosure:", body: "AI-attributable revenue called out in 10-Q / 10-K; trailing run-rate." },
                  { bold: "Capex efficiency:", body: "ΔRevenue / ΔCapex over the trailing 12 months." },
                  { bold: "Backlog / RPO:", body: "contracted future revenue (especially Power and L1)." },
                  { bold: "Guidance trend:", body: "raises vs. cuts; consensus revision breadth." },
                ]}
              />
            </Details>
          </>
        }
      />

      <Factor
        letter="V"
        name="Valuation"
        anchor="valuation"
        oneLiner="Is the price reasonable for what you&rsquo;re getting?"
        body={
          <>
            <P>
              V is the price-discipline score. Forward earnings multiple
              relative to growth, free-cash-flow yield, peer-relative valuation
              adjusted for quality. V is deliberately <Em>not</Em> a pure
              cheapness score — pure value has lost to growth in tech for a
              decade. It&rsquo;s growth-adjusted: PEG-style. Plus, for the six
              hyperscalers flagged for accounting risk, V is docked further by
              the depreciation penalty (see §07).
            </P>
            <Details summary="What goes into V">
              <List
                items={[
                  { bold: "Forward P/E vs. growth:", body: "PEG ratio, capped at 3." },
                  { bold: "FCF yield:", body: "trailing-twelve-month free-cash-flow / market cap." },
                  { bold: "Peer-relative multiple:", body: "name vs. layer-matched peers, normalized for growth." },
                  { bold: "Depreciation penalty:", body: "for hyperscalers that extended server useful lives — see §07." },
                  { bold: "Burry overstatement flag:", body: "ORCL and META get additional V hits per estimated earnings overstatement." },
                ]}
              />
            </Details>
          </>
        }
      />

      <Factor
        letter="AIQ"
        name="AI Exposure Quality"
        anchor="aiq"
        oneLiner="Is this real AI exposure, or just a narrative?"
        body={
          <>
            <P>
              AIQ is the one factor scored <Em>by hand</Em>. It&rsquo;s the
              quality of the company&rsquo;s actual AI exposure — not how loud
              its press release was, but whether AI is in the income statement,
              whether the moat is real, whether the cap-allocation makes sense,
              whether the accounting is clean. It&rsquo;s the factor where the
              engine&rsquo;s judgment about a name overrides what the filings
              alone would suggest.
            </P>
            <P>The score is a sum of six dimensions, each scored 0–20:</P>
            <List
              items={[
                {
                  bold: "1. Disclosure quality.",
                  body: "Does the company actually break out AI revenue / capex / segment performance? Or are we inferring?",
                },
                {
                  bold: "2. Defensibility.",
                  body: "What&rsquo;s the moat? CUDA. EUV monopoly. Hyperscaler distribution. Vertical specialization. The fewer substitutes, the higher the score.",
                },
                {
                  bold: "3. Customer concentration.",
                  body: "How many independent customers? A name where one hyperscaler is 40%+ of revenue scores worse than one with broad demand.",
                },
                {
                  bold: "4. Capital efficiency.",
                  body: "What does each dollar of capex / opex produce in revenue or backlog? This dimension is computed differently per layer — see §07.",
                },
                {
                  bold: "5. Independent demand.",
                  body: "Is demand structural (Power has it, AI-app SaaS has to earn it) or cyclical and AI-narrative-driven?",
                },
                {
                  bold: "6. Accounting integrity.",
                  body: "Useful-life extensions, aggressive recognition, stock-based comp as percent of FCF, related-party deals. The cleaner the books, the higher the score.",
                },
              ]}
            />
            <Callout>
              Edit any name&rsquo;s AIQ score on <Mono>/aiq/[ticker]</Mono>.
              Every edit is timestamped, attributed, and stored in{" "}
              <Mono>aiq_rubric</Mono> — the daily routine surfaces ones that
              look stale or contradicted by new filings as Drafts on{" "}
              <Mono>/aiq-drafts</Mono>.
            </Callout>
          </>
        }
      />
    </Sec>
  );
}

function Factor({
  letter,
  name,
  anchor,
  oneLiner,
  body,
}: {
  letter: string;
  name: string;
  anchor: string;
  oneLiner: string;
  body: ReactNode;
}) {
  return (
    <div
      id={`factor-${anchor}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "20px 0",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: ".02em",
          }}
        >
          {letter}
        </span>
        <span style={{ fontSize: 17, fontWeight: 600, color: "var(--text-1)" }}>
          {name}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>
          {oneLiner}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {body}
      </div>
    </div>
  );
}

/* =============================================================
   4. Layers
   ============================================================= */

function Layers() {
  return (
    <Sec id="layers" eyebrow="04" title="Layers (L1–L5)">
      <P>
        Every name in the universe sits in one of five layers. The layer is
        permanent — it&rsquo;s how the company makes money, not what the stock
        is doing today. The layer determines how the four factors get weighted,
        because what makes a great chip designer is different from what makes a
        great power producer.
      </P>

      <LayerCard
        code="L1"
        name="Compute"
        examples="NVDA · TSM · AVGO · ASML · LRCX · ANET"
        what="Companies that design or manufacture the silicon and networking gear AI runs on. Highest growth, highest cyclicality."
        weights="Q 0.275 · G 0.325 · V 0.175 · AIQ 0.225"
      />
      <LayerCard
        code="L2"
        name="Hyperscaler"
        examples="MSFT · GOOGL · AMZN · META · ORCL · IBM"
        what="Cloud + infrastructure owners. Capex-heavy. Quality and balance-sheet strength matter most because the capex risk is real."
        weights="Q 0.400 · G 0.275 · V 0.175 · AIQ 0.175"
      />
      <LayerCard
        code="L3"
        name="AI-Native App"
        examples="PLTR · CRWD · SNOW · ADBE"
        what="Companies whose product IS AI delivered as software. Growth carries the score because capital intensity is low."
        weights="Q 0.243 · G 0.405 · V 0.108 · AIQ 0.243"
      />
      <LayerCard
        code="L4"
        name="Power"
        examples="VST · GEV · VRT · CEG"
        what="The grid + cooling + generation that feeds the data centers. Long-cycle contracted revenue. Quality + Valuation matter most."
        weights="Q 0.357 · G 0.262 · V 0.214 · AIQ 0.167"
      />
      <LayerCard
        code="L5"
        name="Incumbent"
        examples="NOW · INTU"
        what="Established companies embedding AI into existing workflows. Lower growth, more durable revenue, valuation discipline matters."
        weights="Q 0.368 · G 0.237 · V 0.211 · AIQ 0.184"
      />

      <Details summary="Why the weights are different per layer">
        <P>
          The raw v2 weights are designed to sum to 100 with Momentum and
          Sentiment factors included. The engine doesn&rsquo;t score M or S
          yet, so the four Tier-A weights (Q, G, V, AIQ) get rescaled to sum
          to 1.0 for each layer — the table above shows the rescaled numbers
          that the live engine applies.
        </P>
        <P>
          The justification for the underlying tilts: AQR&rsquo;s Quality
          premium is the highest-evidence factor in financial economics, so Q
          is overweight relative to an equal-weight prior. Goldman&rsquo;s
          revealed phase shift makes G the active differentiator in 2026, so
          it&rsquo;s tilted up. Pure value has lost in tech for a decade, so V
          is tilted down. AIQ is the only factor without a published backtest
          but it&rsquo;s the engine&rsquo;s edge — it&rsquo;s held above
          equal-weight on conceptual grounds, below Q/G on lack of empirical
          track record.
        </P>
      </Details>
    </Sec>
  );
}

function LayerCard({
  code,
  name,
  examples,
  what,
  weights,
}: {
  code: string;
  name: string;
  examples: string;
  what: string;
  weights: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "56px 1fr",
        gap: 18,
        padding: "16px 0",
        borderTop: "1px solid var(--border-subtle)",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11,
            color: "var(--text-4)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          Layer
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--accent)",
            letterSpacing: ".02em",
            lineHeight: 1.1,
          }}
        >
          {code}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>
          {name}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
          {what}
        </div>
        <div
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--text-3)",
            letterSpacing: ".02em",
          }}
        >
          <span style={{ color: "var(--text-4)" }}>Examples · </span>
          {examples}
        </div>
        <div
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--text-3)",
            letterSpacing: ".02em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <span style={{ color: "var(--text-4)" }}>Tier-A weights · </span>
          {weights}
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   5. Tiers
   ============================================================= */

function Tiers() {
  return (
    <Sec id="tiers" eyebrow="05" title="Tiers">
      <P>
        The final score becomes a <Em>tier</Em>. The tier is what tells you
        what to do; the raw number is just where it came from.
      </P>

      <TierRow
        name="High"
        cutpoint="≥ 75"
        accentColor="var(--success)"
        action="Full position, conviction-sized."
        meaning="The four factors line up, the concentration tax didn&rsquo;t derail it, and the macro multiplier (if it applied) still left the name above the threshold. These are the names the engine has the most confidence in."
        notMeaning="Not a price target. Not a guarantee. A High-tier name can still drop 20% on an earnings miss — the score is about conviction, not certainty."
      />

      <TierRow
        name="Medium"
        cutpoint="60 – 74"
        accentColor="var(--text-1)"
        action="Partial position or watchlist."
        meaning="The name has real merit but one or more factors are below conviction, or it&rsquo;s a High-tier name that got de-rated by macro / concentration. Worth owning at a smaller size, or worth waiting for one factor to improve."
        notMeaning="Not 'mediocre.' Medium is the largest bucket — most good investments live here. The composition matters: a Medium that&rsquo;s strong on Q + G but weak on V is different from one strong on V alone."
      />

      <TierRow
        name="Low"
        cutpoint="45 – 59"
        accentColor="var(--warning)"
        action="Pass. Keep watching."
        meaning="Real weakness somewhere. Could be valuation, could be deteriorating quality, could be a concentration / accounting issue. The thesis hasn&rsquo;t broken yet but the evidence doesn&rsquo;t support a buy."
        notMeaning="Not a short signal. The engine doesn&rsquo;t short. Low means 'not enough reason to own,' not 'reason to bet against.'"
      />

      <TierRow
        name="Avoid"
        cutpoint="< 45"
        accentColor="var(--danger)"
        action="Don&rsquo;t own."
        meaning="Multiple factors are weak. Either quality has cratered, growth has stalled, valuation is unsupportable on any plausible assumption, or AIQ is concerningly low. The engine is saying: don&rsquo;t put money here."
        notMeaning="Not a permanent verdict. A name in Avoid can recover — but the engine wants to see two or more factors materially improve before letting it back into Medium."
      />
    </Sec>
  );
}

function TierRow({
  name,
  cutpoint,
  accentColor,
  action,
  meaning,
  notMeaning,
}: {
  name: string;
  cutpoint: string;
  accentColor: string;
  action: string;
  meaning: string;
  notMeaning: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "120px 1fr",
        gap: 18,
        padding: "16px 0",
        borderTop: "1px solid var(--border-subtle)",
        alignItems: "start",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: accentColor,
            letterSpacing: "-.01em",
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          final {cutpoint}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--text-1)",
          }}
        >
          {action}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
          {meaning}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
          <Em>Doesn&rsquo;t mean:</Em> {notMeaning}
        </div>
      </div>
    </div>
  );
}

/* =============================================================
   6. Macro regime
   ============================================================= */

function Macro() {
  return (
    <Sec id="macro" eyebrow="06" title="Macro regime — when to de-rate">
      <P>
        The four-factor composite says how good a business is on its own
        terms. It can&rsquo;t see the room. When every active manager is
        already maximally long and retail is euphoric, the next buyer
        doesn&rsquo;t exist — and the most crowded names are the most exposed
        to a tape that runs out of fuel.
      </P>
      <P>
        The macro multiplier is the engine&rsquo;s mechanical response. It
        watches three gauges. Each gauge is a single number with a documented
        threshold. The gate is a count, not a binary — the more gates hit, the
        deeper the de-rate.
      </P>

      <Gauges />

      <P style={{ marginTop: 6 }}>
        The multiplier only applies to names with composite ≥ 75 (the
        High-conviction names). Everything below 75 is unchanged by macro —
        the crowding risk doesn&rsquo;t live at the bottom of the book.
      </P>

      <SimpleTable
        header={["Gates hit", "Multiplier", "What it does"]}
        rows={[
          ["0 of 3", "1.00", "Full conviction — book unchanged."],
          ["1 of 3", "0.95", "Light de-rate on the top of the book."],
          ["2 of 3", "0.90", "Material de-rate — High-tier becomes Medium for borderline names."],
          ["3 of 3", "0.85", "Maximum de-rate — only the deepest convictions survive at High."],
        ]}
      />

      <Callout>
        Open <Mono>/regime</Mono> any time to see the live gauges, the
        current multiplier, and a 12-week history of how each gauge has moved.
      </Callout>
    </Sec>
  );
}

function Gauges() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <Gauge
        name="NAAIM Exposure Index"
        threshold="> 90"
        what="The National Association of Active Investment Managers surveys its members weekly. The index is the average % long-equity exposure across the membership. Above 90 means active managers are basically all-in."
        why="When pros are maxed, the marginal buyer is gone. This is the highest-signal gauge of the three."
      />
      <Gauge
        name="AAII Bull-Bear Spread"
        threshold="> +30, sustained 3 weeks"
        what="The American Association of Individual Investors surveys retail every week — bulls minus bears, as percentages. Long-term average is around +6%."
        why="Retail euphoria is a contrary indicator. The 3-week persistence requirement filters out single-week noise."
      />
      <Gauge
        name="CNN Fear & Greed Index"
        threshold="> 80, sustained"
        what="A composite of seven market indicators (volatility, breadth, put/call ratio, etc.) normalized to 0–100. 80+ is 'extreme greed.'"
        why="Captures the general mood in one number. Useful as a confirmation gauge — when all three of NAAIM / AAII / F&G align, the regime is genuinely tight."
      />
    </div>
  );
}

function Gauge({
  name,
  threshold,
  what,
  why,
}: {
  name: string;
  threshold: string;
  what: string;
  why: string;
}) {
  return (
    <div
      style={{
        padding: "14px 0",
        borderBottom: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-1)" }}>
          {name}
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--warning)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          gate · {threshold}
        </span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.6 }}>
        {what}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.6 }}>
        <Em>Why this matters:</Em> {why}
      </div>
    </div>
  );
}

/* =============================================================
   7. Special adjustments
   ============================================================= */

function Adjustments() {
  return (
    <Sec id="adjustments" eyebrow="07" title="Special adjustments">
      <P>
        Two corrections live outside the four factors because they&rsquo;re
        about portfolio + accounting reality, not about the business itself.
        Both are <Em>negative</Em> by design — they can pull the score down,
        never up.
      </P>

      <SubSec title="Concentration tax">
        <P>
          A high-quality, high-growth name is still risky if you already own
          three other names that all move together. The concentration tax is
          the engine&rsquo;s way of pricing that hidden risk into the score
          itself.
        </P>
        <P>
          It&rsquo;s computed from the name&rsquo;s loading on the universe&rsquo;s
          first principal component — essentially, &ldquo;how much does this
          name move with the rest of the L1 / hyperscaler cluster?&rdquo; —
          combined with
          how much of that cluster you already own.
        </P>
        <List
          items={[
            { bold: "Typical range:", body: "−1 to −5 points." },
            { bold: "Highest taxes:", body: "NVDA when you own AVGO and TSM. AMZN when you own MSFT and GOOGL." },
            { bold: "Lowest taxes:", body: "VST / GEV vs. the rest of the book — power moves on its own cycle." },
          ]}
        />
        <Callout>
          You see the tax on the Score Math drawer of every detail page,
          itemized as &ldquo;Concentration Tax&rdquo; with its source row in{" "}
          <Mono>concentration_history</Mono>.
        </Callout>
      </SubSec>

      <SubSec title="Depreciation penalty (the hyperscaler flag)">
        <P>
          In 2025–2026, six hyperscalers extended the useful life of their
          servers — META, MSFT, GOOGL, AMZN, ORCL, IBM. Longer useful life
          means less annual depreciation expense, which means higher reported
          GAAP earnings <Em>without</Em> any underlying improvement in
          economics. Michael Burry&rsquo;s Q3 2025 work estimates ORCL is
          26.9% earnings-overstated by 2028 and META is 20.8% overstated.
        </P>
        <P>
          The engine doesn&rsquo;t short these names — but it docks V (the
          valuation score) for them, because the GAAP earnings the V factor
          would normally reward aren&rsquo;t fully real.
        </P>
        <SimpleTable
          header={["Extension", "V penalty"]}
          rows={[
            ["No extension in 24 months", "0"],
            ["≤ 0.5 years extended", "−3"],
            ["0.5 – 1.0 years extended", "−5"],
            ["1.0 – 1.5 years extended", "−7"],
            ["> 1.5 years extended (e.g., Meta 4–5 yr → 5.5 yr+)", "−10"],
          ]}
        />
        <P>
          Plus an additional V hit for specifically-flagged overstatement
          risk: ORCL gets <Mono>−5</Mono>, META gets <Mono>−3</Mono>, any
          other disclosed hyperscaler extension gets <Mono>−2</Mono>. Total V
          penalty caps at −12 — the engine won&rsquo;t exclude a name
          mechanically, it just refuses to over-reward inflated earnings.
        </P>
        <Callout>
          The flag is informational on the Score Math drawer (&ldquo;already
          inside V&rdquo;). Open <Mono>/universe/META</Mono> or{" "}
          <Mono>/universe/ORCL</Mono>{" "}
          to see the depreciation flag with its source filing and effective
          date.
        </Callout>
      </SubSec>
    </Sec>
  );
}

function SubSec({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "16px 0 4px",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <h3
        style={{
          fontSize: 15,
          fontWeight: 600,
          color: "var(--text-1)",
          margin: 0,
          letterSpacing: "-.005em",
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

/* =============================================================
   8. How to read each page
   ============================================================= */

function Pages() {
  return (
    <Sec id="pages" eyebrow="08" title="How to read each page">
      <P>
        The app is organized around what you&rsquo;re doing — not around
        database tables. Each page answers a specific question.
      </P>
      <PageGuide
        path="/"
        name="Dashboard"
        question="What changed since yesterday, and what do I need to look at?"
        sections={[
          { name: "Today's Thesis card", what: "five lines summarizing macro state, portfolio posture, current bias, watchlist pressure, and the action you need to take today." },
          { name: "KPI row", what: "portfolio value, P&L since cost, exposure %, cash. Mono numerals, hover for source." },
          { name: "Score Movers", what: "names whose composite moved most in either direction since the last engine run. Click any row for the Score Math drawer." },
          { name: "Top Positions", what: "your portfolio, ranked by weight. Reconciles to your account total." },
        ]}
      />
      <PageGuide
        path="/universe"
        name="Universe"
        question="What does the engine think about every name?"
        sections={[
          { name: "The 50-name table", what: "every name with current Q · G · V · AIQ · Composite · Tier. Sortable. Type-ahead filter." },
          { name: "Live / Stubbed strip", what: "shows which factors are computed from live data (Q, G, V from scores_history) vs. which are still using static seeds (AIQ until the next routine fires)." },
          { name: "Layer / Tier filter chips", what: "in the right rail. Toggle to narrow." },
        ]}
      />
      <PageGuide
        path="/universe/[ticker]"
        name="Universe → Detail"
        question="Why is this score what it is, and what changed?"
        sections={[
          { name: "Name header", what: "ticker, layer label, current tier, Score Math drawer trigger." },
          { name: "Portfolio context strip", what: "is this in your book? At what weight? At what cost?" },
          { name: "Score sparkline", what: "12-week history of composite + final score. Hover shows the as_of." },
          { name: "Factor panels", what: "Q · G · V · AIQ each in its own card with sub-components and trend." },
          { name: "Depreciation flags list", what: "if the name is a flagged hyperscaler — every extension event with filing source." },
          { name: "Form 4 section", what: "recent insider transactions (buys + sells). Cluster patterns get highlighted." },
        ]}
      />
      <PageGuide
        path="/aiq"
        name="AIQ Editor"
        question="What&rsquo;s the manual AIQ score for this name, and why?"
        sections={[
          { name: "The cockpit", what: "the six AIQ dimensions for the selected name, each editable 0–20. Save commits an audit row with a change-reason." },
          { name: "Confidence pill", what: "operator self-rated confidence in the current AIQ — low / medium / high." },
          { name: "Last-change reason", what: "free-text note attached to the most recent save." },
        ]}
      />
      <PageGuide
        path="/aiq-drafts"
        name="AIQ Drafts"
        question="What AIQ changes is the engine proposing?"
        sections={[
          { name: "Pending tab", what: "AI-drafted AIQ revisions sitting in aiq_draft_queue. Each card shows the proposed diff + the trigger reason." },
          { name: "Accepted / Rejected tabs", what: "history of what you accepted or threw out." },
        ]}
      />
      <PageGuide
        path="/decisions"
        name="Decisions"
        question="What needs my attention right now?"
        sections={[
          { name: "Alert feed", what: "thesis-broken pulses (position_pulse), score moves, insider clusters, macro gate changes. Sorted by severity." },
          { name: "Acknowledge / defer", what: "every alert has an action — read it, decide, dismiss." },
        ]}
      />
      <PageGuide
        path="/memos"
        name="Memos"
        question="When the engine wants me to act, what&rsquo;s the rationale?"
        sections={[
          { name: "Drafted memos", what: "Claude-written decision memos for add / trim / exit / watch. Cite the trigger and the data." },
          { name: "Memo state", what: "draft → reviewed → accepted → executed (manual)." },
        ]}
      />
      <PageGuide
        path="/portfolio"
        name="Portfolio"
        question="What do I actually own?"
        sections={[
          { name: "Position table", what: "every position with current weight, cost basis, P&L, and the tier of the underlying name." },
          { name: "Target vs. current", what: "where the engine thinks each name should be sized, vs. where you have it." },
        ]}
      />
      <PageGuide
        path="/regime"
        name="Regime"
        question="What's the macro state, and what's the multiplier doing to my book?"
        sections={[
          { name: "Three gauge cards", what: "NAAIM · AAII · F&G — current reading, threshold, history sparkline." },
          { name: "Multiplier ladder", what: "0 / 1 / 2 / 3 gates with current state highlighted." },
          { name: "Affected positions", what: "names with composite ≥ 75 whose final score is changing because of macro." },
        ]}
      />
      <PageGuide
        path="/proposals"
        name="Proposals"
        question="What names is the engine thinking about adding to the universe?"
        sections={[
          { name: "Universe-add candidates", what: "from the monthly curator routine. Each card shows the proposed layer, initial Q/G/V/AIQ estimates, and why this name is on the radar." },
        ]}
      />
      <PageGuide
        path="/backtest"
        name="Backtest"
        question="If we had run this engine historically, how would it have done?"
        sections={[
          { name: "Run rows", what: "each backtest is a row — start date, end date, total return, Sharpe, max drawdown, turnover, hit rate." },
          { name: "Sparkline", what: "cumulative-return path inline." },
          { name: "Expand", what: "monthly return + turnover series." },
        ]}
      />
    </Sec>
  );
}

function PageGuide({
  path,
  name,
  question,
  sections,
}: {
  path: string;
  name: string;
  question: string;
  sections: Array<{ name: string; what: string }>;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "16px 0",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 12,
            color: "var(--accent)",
            background: "rgba(77, 91, 255, .08)",
            padding: "2px 8px",
            borderRadius: 4,
            letterSpacing: ".02em",
          }}
        >
          {path}
        </span>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-1)" }}>
          {name}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-3)", fontStyle: "italic" }}>
          {question}
        </span>
      </div>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {sections.map((s) => (
          <li
            key={s.name}
            style={{
              fontSize: 12.5,
              color: "var(--text-2)",
              lineHeight: 1.6,
              paddingLeft: 14,
              position: "relative",
            }}
          >
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 8,
                width: 4,
                height: 4,
                background: "var(--text-4)",
                borderRadius: "50%",
              }}
            />
            <Em>{s.name}.</Em> {s.what}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* =============================================================
   9. Operator playbook
   ============================================================= */

function Playbook() {
  return (
    <Sec id="playbook" eyebrow="09" title="The operator playbook">
      <P>
        Concrete scenarios. When you see X, do Y. These are the patterns the
        engine surfaces most often, with the action that&rsquo;s usually right.
      </P>
      <Play
        when="A name&rsquo;s final score drops 5+ points week-over-week."
        action="Open the detail page → Score Math drawer. Find the factor that moved (Q, G, V, AIQ, or macro). Read the most recent memo for that name. If no memo exists yet, the engine will draft one within 24h — wait for it before acting."
      />
      <Play
        when="Macro tightens — gates go from 1 to 2 or 2 to 3."
        action="Open /regime to see which gauge moved. Trim the most-crowded High-tier names first (the ones with the largest concentration tax). The multiplier is doing some of the work for you mechanically, but human-trimming is the discretionary overlay."
      />
      <Play
        when="Insider buying cluster: 3+ insiders buy ≥$1M in 90 days."
        action="Add to watchlist if the name isn&rsquo;t in the universe. If it&rsquo;s already in the universe and you don&rsquo;t own it, run the Score Math drawer and check whether the V factor is supportive. Cluster buying near multi-year lows in V is one of the higher-signal patterns in the dataset."
      />
      <Play
        when="Insider selling cluster: 3+ insiders sell ≥$5M in 60 days, excluding 10b5-1."
        action="Don&rsquo;t reflexively trim — look at the context. Diversification sells are noise. Sells into strength after a big run are also weak signal. Concentrated sells from C-suite into earnings prints are the pattern that matters; treat those as a yellow flag pending the next earnings result."
      />
      <Play
        when="Depreciation flag raised on a hyperscaler you own."
        action="The V hit is already baked into the next score recompute. If the new V drops the name out of the tier you sized it for, the engine will draft a memo. Otherwise, no action — the penalty is the engine&rsquo;s response."
      />
      <Play
        when="Concentration tax on a name you&rsquo;re about to add exceeds −5."
        action="Reconsider. The tax is telling you the new position is mostly a leveraged bet on something you already own. Either size smaller or pick a different name in the same layer that&rsquo;s less correlated."
      />
      <Play
        when="A new memo appears on /memos."
        action="Read it end-to-end before any action. Memos cite the specific trigger and the relevant rows from concentration_history, scores_history, or position_pulse — verify the rationale matches what you see on the source pages. Then accept, defer, or reject."
      />
      <Play
        when="An AIQ draft appears on /aiq-drafts."
        action="The daily routine flagged the existing AIQ as stale or contradicted by new evidence. Open the draft, compare the proposed dimension changes against the current values, and either accept (commits to aiq_rubric with attribution) or reject (logs the rejection and keeps the current value)."
      />
      <Play
        when="You disagree with the engine about a name."
        action="That&rsquo;s expected — the engine is research, you make the call. The right way to express disagreement is to override the AIQ score on /aiq/[ticker] with a reason in the last-change-reason field. Don&rsquo;t fight the engine implicitly by ignoring its score; tell it why and let the change propagate."
      />
    </Sec>
  );
}

function Play({ when, action }: { when: string; action: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "14px 0",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text-1)",
          lineHeight: 1.55,
        }}
      >
        <Em>When · </Em>
        {when}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>
        <Em>Do · </Em>
        {action}
      </div>
    </div>
  );
}

/* =============================================================
   10. Glossary
   ============================================================= */

const GLOSSARY: Array<{ term: string; def: string }> = [
  { term: "AAII Bull-Bear Spread", def: "Weekly retail-investor sentiment survey from the American Association of Individual Investors. Bulls % minus bears %. Long-term mean ~+6%. Macro gate fires above +30 sustained for 3 weeks." },
  { term: "AIQ", def: "AI Exposure Quality. The one factor scored by hand. Sum of six 0–20 dimensions: disclosure, defensibility, concentration, capital efficiency, independent demand, accounting integrity. Range 0–100." },
  { term: "AIQ Draft", def: "An engine-proposed change to a name&rsquo;s AIQ score, generated by the daily routine when fresh evidence contradicts the current value. Lives in aiq_draft_queue. Surfaced on /aiq-drafts." },
  { term: "AIQ Rubric", def: "The current AIQ scores per name, with attribution, timestamp, confidence, and last-change reason. The single source of truth for AIQ. Stored in aiq_rubric." },
  { term: "As_of", def: "The week the engine is currently reporting on. Every row in scores_history has an as_of; that&rsquo;s the date the engine computed the snapshot." },
  { term: "Backlog / RPO", def: "Remaining Performance Obligations — contracted future revenue not yet recognized. A G-factor input, especially material in L1 and L4." },
  { term: "Bear case", def: "The thesis that the AI buildout is over-capitalized, hyperscaler GAAP earnings are inflated by depreciation policy, and the cycle ends with a multiple compression in 2027–2028. Built into the engine via the depreciation penalty and the overstatement flags." },
  { term: "Burry overstatement flag", def: "Per Michael Burry&rsquo;s Q3 2025 estimates: ORCL 26.9% earnings-overstated by 2028, META 20.8% overstated. Translates into −5 / −3 V-score additions on top of the depreciation penalty." },
  { term: "Capex efficiency", def: "ΔRevenue ÷ ΔCapex over the trailing 12 months. The Goldman 'revealed phase shift' metric — how much actual revenue each dollar of capex produces. Inputs to G and AIQ dimension 4." },
  { term: "CNN Fear & Greed Index", def: "Composite of seven market-stress indicators normalized to 0–100. 80+ is 'extreme greed.' The third macro gate." },
  { term: "Composite", def: "The weighted average of Q · G · V · AIQ using the name&rsquo;s layer weights. Pre-tax, pre-multiplier. 0–100." },
  { term: "Composite (taxed)", def: "Composite + concentration tax. Tax is negative, so this is the same as composite minus the tax amount." },
  { term: "Concentration tax", def: "Penalty applied to the composite based on how correlated the name is to the rest of the universe (first principal component loading). Range typically −1 to −5. Lives in concentration_history." },
  { term: "Daily batch routine", def: "The Anthropic Claude Code routine that runs every weekday at 06:30 UTC. Pulls insider Form 4 filings, computes macro state, generates AIQ drafts for stale names, drafts memos when alerts cross thresholds." },
  { term: "Decisions", def: "The /decisions page. Every actionable alert in one feed: thesis-broken pulses, score moves, insider clusters, macro changes." },
  { term: "Depreciation flag", def: "Hyperscaler row in depreciation_flags indicating a server-useful-life extension event. Carries the penalty_v, extension_years, and source filing URL." },
  { term: "Depreciation penalty", def: "Adjustment applied inside the V factor for hyperscalers that extended useful lives. Scales by extension magnitude. See §07." },
  { term: "Engine version", def: "Current engine is v1.0 = Tier-A Composite (Q · G · V · AIQ + macro multiplier + concentration tax). v2 will add M (momentum) and S (sentiment) as score-contributing factors once the data pipelines are live." },
  { term: "F&G", def: "Shorthand for CNN Fear & Greed Index." },
  { term: "Final score", def: "The post-tax, post-macro-multiplier number that maps to the tier. The headline." },
  { term: "Form 4", def: "SEC filing required when an insider (officer, director, 10%+ holder) transacts in the company&rsquo;s stock. Buys and sells both. Source for insider-cluster detection." },
  { term: "G", def: "Growth factor. AI-leveraged revenue growth, capex efficiency, backlog, segment-level AI disclosure. 0–100." },
  { term: "Hyperscaler", def: "Layer 2. Cloud + AI infrastructure owners. MSFT, GOOGL, AMZN, META, ORCL, IBM." },
  { term: "Layer", def: "Permanent classification of a company by what it does. L1 Compute, L2 Hyperscaler, L3 AI-Native App, L4 Power, L5 Incumbent. Determines factor weights." },
  { term: "Macro gate", def: "One of the three gauges (NAAIM, AAII, F&G). Each is binary — hit or not. Count drives the multiplier." },
  { term: "Macro multiplier", def: "0.85 – 1.00 number that scales the composite for High-tier names (composite ≥ 75) based on how many macro gates are hit." },
  { term: "Memo", def: "Claude-drafted decision rationale for an action on a specific name (add / trim / exit / watch). Lives on /memos. State: draft → reviewed → accepted → executed." },
  { term: "Momentum (M)", def: "v2 factor not yet in the live engine. 25% price 12-1 / 40% earnings surprise / 35% revision breadth. Qualitative annotation until the engine pipeline is live." },
  { term: "Mono Meta Spine", def: "The horizontal mono-typography strip below page titles. Shows the per-page instrumentation — counts, freshness, primary actions." },
  { term: "NAAIM Exposure Index", def: "Weekly survey of National Association of Active Investment Managers members. Average % long-equity exposure. Above 90 means managers are basically all-in. First macro gate." },
  { term: "PC1", def: "First principal component of the universe&rsquo;s returns. The dominant 'AI factor' — names load on it based on how much they move with the cluster as a whole. Drives the concentration tax." },
  { term: "PEG", def: "Price/Earnings/Growth ratio. Forward P/E divided by expected growth rate. A core V input." },
  { term: "Q", def: "Quality factor. Margins, ROIC, balance-sheet strength, business defensibility. The highest-evidence factor (AQR QMJ). 0–100." },
  { term: "Routines", def: "Anthropic Claude Code automations that run on schedule. Daily batch (every weekday), weekly rescore (Saturdays), monthly curator (1st of month), position pulse (twice daily during market hours)." },
  { term: "Score Math drawer", def: "Side panel on every detail page that derives the headline score from the four inputs end-to-end. Q + G + V + AIQ → composite → tax → multiplier → final. Each row links back to its source." },
  { term: "Scores history", def: "scores_history table. One row per ticker per week. Carries every factor score and the derived composite + final + tier for that as_of." },
  { term: "Sentiment (S)", def: "v2 factor not yet in the live engine. Sell-side revision delta, options skew, short interest SUSI z-score, insider Form 4. Qualitative until pipeline is live." },
  { term: "SUE", def: "Standardized Unexpected Earnings. (Reported EPS − consensus) ÷ standard deviation of past surprises. The 'earnings momentum' part of M." },
  { term: "Thesis-broken", def: "Verdict from the position_pulse routine when a position&rsquo;s composite drops far enough that the original buy thesis no longer holds. Triggers a memo." },
  { term: "Tier", def: "Final-score band: High (≥75), Medium (60–74), Low (45–59), Avoid (<45). The action label." },
  { term: "Tier-A factors", def: "The four factors the live engine scores: Q, G, V, AIQ. As opposed to Tier-B (M and S) which require additional pipelines." },
  { term: "Universe", def: "The ~50 names currently tracked. Lives in the universe table. New names added via /proposals → engine accept." },
  { term: "V", def: "Valuation factor. Forward P/E vs. growth, FCF yield, peer-relative multiple. Penalized for depreciation policy on hyperscalers. 0–100." },
];

function Glossary() {
  return (
    <Sec id="glossary" eyebrow="10" title="Glossary">
      <P>Every term that appears in the app, with a one-line definition.</P>
      <dl
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 0,
          margin: 0,
          padding: 0,
        }}
      >
        {GLOSSARY.map((g) => (
          <div
            key={g.term}
            style={{
              display: "grid",
              gridTemplateColumns: "180px 1fr",
              gap: 18,
              padding: "12px 0",
              borderTop: "1px solid var(--border-subtle)",
              alignItems: "start",
            }}
          >
            <dt
              style={{
                fontFamily: "var(--m)",
                fontSize: 12,
                color: "var(--text-1)",
                fontWeight: 500,
                letterSpacing: ".01em",
              }}
            >
              {g.term}
            </dt>
            <dd
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--text-2)",
                lineHeight: 1.65,
              }}
            >
              {g.def}
            </dd>
          </div>
        ))}
      </dl>
    </Sec>
  );
}

/* =============================================================
   Footer
   ============================================================= */

function Footer() {
  return (
    <footer
      style={{
        marginTop: 32,
        paddingTop: 24,
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 11.5,
        color: "var(--text-4)",
        fontFamily: "var(--m)",
        lineHeight: 1.7,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      <div>
        Source: docs/AI-Thesis-v2-Algorithm-and-Deployment.md ·
        docs/AI-Thesis-v2-Master-Design-Spec.md
      </div>
      <div>
        Engine version v1.0 · Tier-A Composite (Q + G + V + AIQ + macro
        multiplier + concentration tax). M and S enter the composite in v2
        once the data pipelines are live.
      </div>
      <div style={{ marginTop: 4 }}>
        Research output, not investment advice. Every position decision is
        yours.
      </div>
    </footer>
  );
}

/* =============================================================
   Shared primitives — inline so the section structure stays readable
   ============================================================= */

function Sec({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        scrollMarginTop: 24,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11,
            color: "var(--text-4)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        <h2
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text-1)",
            letterSpacing: "-.015em",
            margin: 0,
            lineHeight: 1.2,
          }}
        >
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function P({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <p
      style={{
        margin: 0,
        fontSize: 14,
        lineHeight: 1.7,
        color: "var(--text-2)",
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function Em({ children }: { children: ReactNode }) {
  return (
    <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{children}</span>
  );
}

function Faint({ children }: { children: ReactNode }) {
  return (
    <span style={{ color: "var(--text-4)", fontStyle: "italic" }}>{children}</span>
  );
}

function Mono({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--m)",
        fontSize: "0.92em",
        color: "var(--text-1)",
        background: "var(--surface-1)",
        padding: "1px 5px",
        borderRadius: 3,
        letterSpacing: ".01em",
      }}
    >
      {children}
    </span>
  );
}

function List({
  items,
}: {
  items: Array<{ bold: string; body: string }>;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {items.map((it) => (
        <li
          key={it.bold}
          style={{
            fontSize: 13.5,
            color: "var(--text-2)",
            lineHeight: 1.65,
            paddingLeft: 14,
            position: "relative",
          }}
        >
          <span
            aria-hidden
            style={{
              position: "absolute",
              left: 0,
              top: 9,
              width: 4,
              height: 4,
              background: "var(--accent)",
              borderRadius: "50%",
            }}
          />
          <Em>{it.bold}</Em> {it.body}
        </li>
      ))}
    </ul>
  );
}

function OrderedSteps({
  steps,
}: {
  steps: Array<{ label: string; body: ReactNode }>;
}) {
  return (
    <ol
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {steps.map((step, i) => (
        <li
          key={step.label}
          style={{
            display: "grid",
            gridTemplateColumns: "28px 1fr",
            gap: 14,
            alignItems: "start",
          }}
        >
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 11,
              color: "var(--text-4)",
              fontVariantNumeric: "tabular-nums",
              paddingTop: 3,
              letterSpacing: ".04em",
            }}
          >
            0{i + 1}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13.5, fontWeight: 500, color: "var(--text-1)" }}>
              {step.label}
            </span>
            <span style={{ fontSize: 13, color: "var(--text-2)", lineHeight: 1.65 }}>
              {step.body}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Formula({
  children,
  compact = false,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <pre
      style={{
        margin: 0,
        padding: compact ? "10px 14px" : "14px 16px",
        background: "var(--surface-1)",
        border: "1px solid var(--border-subtle)",
        borderLeft: "2px solid var(--accent)",
        borderRadius: 4,
        fontFamily: "var(--m)",
        fontSize: 12.5,
        lineHeight: 1.8,
        color: "var(--text-1)",
        whiteSpace: "pre-wrap",
        overflowX: "auto",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </pre>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "rgba(77, 91, 255, .04)",
        border: "1px solid rgba(77, 91, 255, .18)",
        borderRadius: 4,
        fontSize: 13,
        lineHeight: 1.6,
        color: "var(--text-2)",
      }}
    >
      {children}
    </div>
  );
}

function Details({
  summary,
  children,
}: {
  summary: string;
  children: ReactNode;
}) {
  return (
    <details
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: 4,
        background: "var(--surface-1)",
      }}
    >
      <summary
        style={{
          padding: "8px 12px",
          fontSize: 12,
          fontFamily: "var(--m)",
          color: "var(--text-3)",
          letterSpacing: ".02em",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        {summary}
      </summary>
      <div
        style={{
          padding: "4px 14px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        {children}
      </div>
    </details>
  );
}

function SimpleTable({
  header,
  rows,
}: {
  header: string[];
  rows: string[][];
}) {
  return (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 12.5,
        fontFamily: "var(--m)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <thead>
        <tr>
          {header.map((h, i) => (
            <th
              key={h}
              style={{
                textAlign: i === 0 ? "left" : "left",
                padding: "8px 10px",
                fontSize: 10.5,
                textTransform: "uppercase",
                letterSpacing: ".08em",
                color: "var(--text-3)",
                fontWeight: 500,
                borderBottom: "1px solid var(--border-subtle)",
                whiteSpace: "nowrap",
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} style={{ borderTop: "1px solid var(--border-subtle)" }}>
            {row.map((cell, ci) => (
              <td
                key={ci}
                style={{
                  textAlign: ci === 0 ? "left" : "left",
                  padding: "8px 10px",
                  color: ci === 0 ? "var(--text-1)" : "var(--text-2)",
                  whiteSpace: "nowrap",
                }}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
