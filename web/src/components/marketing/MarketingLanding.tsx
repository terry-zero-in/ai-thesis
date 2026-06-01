import Link from "next/link";
import { WaitlistForm } from "./WaitlistForm";

/**
 * Marketing landing — paid-beta wedge for AI Thesis (THS-84).
 *
 * Surface contract:
 *   - Lives at "/" for unauthenticated visitors. Authed users at "/"
 *     see the dashboard (gate lives in src/app/page.tsx).
 *   - ConditionalShell suppresses the operator Shell on this surface so
 *     the landing renders fullscreen without sidebar/topbar.
 *
 * Signature patterns:
 *   1. Atmosphere-gradient hero (allowed ONLY on marketing per
 *      Iris × Voltage v1.1 — never on data pages).
 *   2. Score Math proof block (static AVGO 74.1 derivation) — proves
 *      "explainable" claim with the same primitive used in-product.
 *   3. Hairline-only section frame — no card chrome, sections flow on
 *      canvas, each anchored by an uppercase 11px mono label.
 *
 * Compliance floor (per THS-84 + docs/compliance/language-discipline.md):
 *   - No "buy/sell/deploy/recommend/outperform" verbs.
 *   - No hypothetical performance numbers.
 *   - "Research software" + "not personalized advice" stated explicitly.
 *
 * Voltage discipline: ONE Voltage CTA on this page (the waitlist
 * Notify-me button inside WaitlistForm). Every other action is a quiet
 * link in --text-2/3 or an Iris-bordered secondary.
 */
export function MarketingLanding() {
  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100%",
        background: "var(--jet)",
        color: "var(--text-1)",
        overflowX: "hidden",
      }}
    >
      <TopNav />
      <Hero />
      <SectionDivider />
      <FeatureGrid />
      <SectionDivider />
      <ScoreMathProof />
      <SectionDivider />
      <PricingTiles />
      <SectionDivider />
      <Disclaimers />
      <FooterStrip />
    </main>
  );
}

/* ---------------- Top nav ---------------- */

function TopNav() {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        height: 56,
        padding: "0 clamp(20px, 5vw, 48px)",
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: "rgba(5,6,8,.72)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <Link
        href="/"
        style={{
          display: "inline-flex",
          alignItems: "baseline",
          gap: 6,
          fontFamily: "var(--m)",
          fontSize: 14,
          color: "var(--text-1)",
          letterSpacing: ".02em",
          textDecoration: "none",
        }}
      >
        <span style={{ fontWeight: 600 }}>AI Thesis</span>
        <span style={{ color: "var(--text-3)", fontSize: 11 }}>v1 · paid beta</span>
      </Link>
      <nav
        style={{
          marginLeft: "auto",
          display: "inline-flex",
          alignItems: "center",
          gap: 22,
          fontFamily: "var(--m)",
          fontSize: 12.5,
        }}
      >
        <a href="#what" style={navLinkStyle}>What it does</a>
        <a href="#score-math" style={navLinkStyle}>How scoring works</a>
        <a href="#pricing" style={navLinkStyle}>Pricing</a>
        <Link
          href="/login"
          style={{
            ...navLinkStyle,
            color: "var(--text-1)",
            padding: "6px 12px",
            border: "1px solid var(--border)",
            borderRadius: 5,
          }}
        >
          Sign in
        </Link>
      </nav>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  color: "var(--text-2)",
  textDecoration: "none",
  letterSpacing: ".01em",
};

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section
      style={{
        position: "relative",
        padding: "clamp(60px, 10vw, 120px) clamp(20px, 5vw, 48px) clamp(80px, 12vw, 140px)",
        overflow: "hidden",
        // Atmosphere gradient — Basis Indigo, marketing-only. Radial soft glow
        // from top-center (deep-indigo #2C3C95 → #1A2156) falling to the rail
        // by ~70%. Layered over the near-black base without dominating.
        background:
          "radial-gradient(ellipse 90% 65% at 50% 0%, rgba(44,60,149,.55) 0%, rgba(26,33,86,.28) 32%, var(--jet) 70%)",
      }}
    >
      {/* Hairline horizon — single 1px iris-300 line at the very top,
          0.18 alpha, signals "we are different from a generic SaaS hero." */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            "linear-gradient(90deg, transparent 0%, rgba(82,54,220,.18) 30%, rgba(82,54,220,.32) 50%, rgba(82,54,220,.18) 70%, transparent 100%)",
        }}
      />
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 32,
        }}
      >
        <Eyebrow>Research terminal · AI infrastructure cycle</Eyebrow>
        <h1
          style={{
            fontFamily: "var(--f)",
            fontSize: "clamp(38px, 6.2vw, 64px)",
            fontWeight: 600,
            lineHeight: 1.05,
            letterSpacing: "-.018em",
            color: "var(--text-1)",
            margin: 0,
            maxWidth: 900,
          }}
        >
          The research terminal for the{" "}
          <span style={{ color: "var(--iris-200)" }}>AI infrastructure trade</span>.
        </h1>
        <p
          style={{
            fontFamily: "var(--f)",
            fontSize: "clamp(16px, 1.6vw, 19px)",
            lineHeight: 1.55,
            color: "var(--text-2)",
            margin: 0,
            maxWidth: 720,
          }}
        >
          Track the companies actually monetizing the AI buildout — with
          explainable factor scores, macro risk controls, and portfolio
          guardrails. Not a stock-picking app. A research instrument.
        </p>
        <div style={{ marginTop: 12 }}>
          <WaitlistForm />
        </div>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11.5,
            color: "var(--text-3)",
            letterSpacing: ".02em",
          }}
        >
          Research software · not personalized financial advice · no SEC-registered
          investment-adviser services
        </span>
      </div>
    </section>
  );
}

/* ---------------- Feature grid (4 tiles) ---------------- */

interface FeatureTile {
  label: string;
  title: string;
  body: string;
  detail: string;
}

const FEATURES: FeatureTile[] = [
  {
    label: "Universe",
    title: "50-name watchlist across the AI stack",
    body:
      "Hyperscalers, accelerators, fabs, networking, power, software. Each name carries an explicit factor decomposition and tier.",
    detail: "L1–L5 layer map · weekly composite refresh",
  },
  {
    label: "Scoring",
    title: "Composite scores that show their work",
    body:
      "Quality · Growth · Valuation · AIQ. Every headline number derives down to inputs in two clicks. No black box.",
    detail: "Tier-A weighted composite · macro-adjusted",
  },
  {
    label: "Decisions",
    title: "Tier transitions logged, not buried",
    body:
      "Composite movement and macro flips surface as receipts — alert, ack, archive. A research audit trail you can defend.",
    detail: "Form 4 cluster signals · regime gate flips",
  },
  {
    label: "Guardrails",
    title: "Portfolio caps the user controls",
    body:
      "Position size limits, concentration tax, reserve floor. Math is applied by the engine — you stay in the chair.",
    detail: "User-controlled portfolio tracking",
  },
];

function FeatureGrid() {
  return (
    <Section id="what" label="What it does">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 1,
          background: "var(--border-subtle)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {FEATURES.map((f) => (
          <FeatureCell key={f.label} f={f} />
        ))}
      </div>
    </Section>
  );
}

function FeatureCell({ f }: { f: FeatureTile }) {
  return (
    <article
      style={{
        background: "var(--canvas)",
        padding: "28px 26px 30px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        minHeight: 220,
      }}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 10.5,
          color: "var(--iris-200)",
          letterSpacing: ".10em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {f.label}
      </span>
      <h3
        style={{
          fontFamily: "var(--f)",
          fontSize: 17,
          fontWeight: 600,
          letterSpacing: "-.005em",
          color: "var(--text-1)",
          margin: 0,
          lineHeight: 1.3,
        }}
      >
        {f.title}
      </h3>
      <p
        style={{
          fontFamily: "var(--f)",
          fontSize: 13.5,
          lineHeight: 1.55,
          color: "var(--text-2)",
          margin: 0,
        }}
      >
        {f.body}
      </p>
      <span
        style={{
          marginTop: "auto",
          fontFamily: "var(--m)",
          fontSize: 11,
          color: "var(--text-3)",
          letterSpacing: ".02em",
        }}
      >
        {f.detail}
      </span>
    </article>
  );
}

/* ---------------- Score Math proof (static AVGO derivation) ---------------- */

/**
 * Static derivation example proving the engine is auditable. Numbers
 * use the actual L2 (accelerator) Tier-A weights from scoring-weights.ts
 * (Q=.39, G=.27, V=.17, AIQ=.17 — rescaled to sum 1.0). Inputs picked
 * so every weighted-row value is clean to one decimal AND the sum
 * exactly equals the displayed composite — the math reconciles
 * end-to-end (no .1 drift). The interactive ScoreMath popover lives
 * on every score in-product (THS-73); this is the marketing proof.
 */
function ScoreMathProof() {
  const rows: Array<{
    factor: string;
    factorLabel: string;
    raw: number;
    weight: number;
    weighted: number;
  }> = [
    { factor: "Q", factorLabel: "Quality", raw: 90, weight: 0.39, weighted: 35.1 },
    { factor: "G", factorLabel: "Growth", raw: 80, weight: 0.27, weighted: 21.6 },
    { factor: "V", factorLabel: "Valuation", raw: 70, weight: 0.17, weighted: 11.9 },
    { factor: "AIQ", factorLabel: "AI Quality", raw: 80, weight: 0.17, weighted: 13.6 },
  ];
  const composite = rows.reduce((s, r) => s + r.weighted, 0); // 82.2
  const macroMult = 0.95;
  const final = +(composite * macroMult).toFixed(1); // 78.1 (82.2 × 0.95 = 78.09)

  return (
    <Section id="score-math" label="How the score works">
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px)",
          gap: 40,
          alignItems: "start",
        }}
        className="score-math-grid"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <h2
            style={{
              fontFamily: "var(--f)",
              fontSize: "clamp(22px, 3vw, 30px)",
              fontWeight: 600,
              letterSpacing: "-.01em",
              color: "var(--text-1)",
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Every score derives to its inputs.
          </h2>
          <p
            style={{
              fontFamily: "var(--f)",
              fontSize: 14.5,
              lineHeight: 1.6,
              color: "var(--text-2)",
              margin: 0,
              maxWidth: 540,
            }}
          >
            A composite isn&apos;t useful if you can&apos;t see where it came
            from. Every headline number in the product opens a derivation
            ladder: the raw factor inputs, the layer-specific weights, the
            macro multiplier, the tier classification. No black box, no
            opaque AI ranking — the math is yours to audit.
          </p>
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 11.5,
              color: "var(--text-3)",
              letterSpacing: ".02em",
            }}
          >
            Illustrative example · L2 (hyperscaler) Tier-A weights · macro
            ×0.95 (1 of 3 gates hit)
          </span>
        </div>

        {/* Static derivation ladder, mono throughout. */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            fontFamily: "var(--m)",
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "baseline",
              gap: 10,
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-1)" }}>AVGO</span>
            <span style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: ".04em" }}>
              L2 · accelerators
            </span>
            <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--text-4)" }}>
              example
            </span>
          </div>

          <LadderHeader />
          {rows.map((r) => (
            <LadderRow key={r.factor} r={r} />
          ))}

          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            <span>composite</span>
            <span style={{ color: "var(--text-1)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {composite.toFixed(1)}
            </span>
          </div>
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              fontSize: 12,
              color: "var(--text-2)",
            }}
          >
            <span>× macro {macroMult.toFixed(2)}</span>
            <span style={{ color: "var(--warning)", fontVariantNumeric: "tabular-nums" }}>
              −{(composite - composite * macroMult).toFixed(1)}
            </span>
          </div>
          <div
            style={{
              padding: "14px 16px",
              borderTop: "1px solid var(--border)",
              background: "rgba(82,54,220,.06)",
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--text-3)", letterSpacing: ".08em", textTransform: "uppercase" }}>
              final score
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: "var(--iris-200)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {final.toFixed(1)}
            </span>
          </div>
          <div
            style={{
              padding: "10px 16px",
              borderTop: "1px solid var(--border-subtle)",
              fontSize: 11,
              color: "var(--text-3)",
              display: "flex",
              justifyContent: "space-between",
            }}
          >
            <span>tier</span>
            <span style={{ color: "var(--accent)", letterSpacing: ".04em" }}>HIGH ≥ 75</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function LadderHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 56px 64px 64px",
        gap: 8,
        padding: "8px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 10,
        color: "var(--text-3)",
        letterSpacing: ".08em",
        textTransform: "uppercase",
      }}
    >
      <span>factor</span>
      <span style={{ textAlign: "right" }}>raw</span>
      <span style={{ textAlign: "right" }}>weight</span>
      <span style={{ textAlign: "right" }}>weighted</span>
    </div>
  );
}

function LadderRow({
  r,
}: {
  r: { factor: string; factorLabel: string; raw: number; weight: number; weighted: number };
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 56px 64px 64px",
        gap: 8,
        padding: "8px 16px",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: 12,
        color: "var(--text-2)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      <span>
        <span style={{ color: "var(--text-1)", fontWeight: 600 }}>{r.factor}</span>{" "}
        <span style={{ color: "var(--text-3)" }}>· {r.factorLabel}</span>
      </span>
      <span style={{ textAlign: "right", color: "var(--text-1)" }}>{r.raw}</span>
      <span style={{ textAlign: "right" }}>{r.weight.toFixed(2)}</span>
      <span style={{ textAlign: "right", color: "var(--text-1)" }}>{r.weighted.toFixed(1)}</span>
    </div>
  );
}

/* ---------------- Pricing ---------------- */

interface PriceTier {
  tier: "starter" | "pro" | "advisor";
  enumKey: string;
  name: string;
  price: number;
  cadence: string;
  pitch: string;
  features: string[];
  recommended?: boolean;
  postV1?: boolean;
}

const TIERS: PriceTier[] = [
  {
    tier: "starter",
    enumKey: "free → starter",
    name: "Starter",
    price: 49,
    cadence: "per month",
    pitch: "Research access for the curious operator.",
    features: [
      "Universe + composite scores",
      "Weekly memo · daily morning brief",
      "Dashboard + score history",
      "Educational research framing",
    ],
    recommended: true,
  },
  {
    tier: "pro",
    enumKey: "subscription_tier: pro",
    name: "Pro",
    price: 79,
    cadence: "per month",
    pitch: "Full research instrument with portfolio guardrails.",
    features: [
      "Everything in Starter",
      "Decisions inbox + tier-transition alerts",
      "AIQ editor + proposals queue",
      "Portfolio guardrail caps",
    ],
  },
  {
    tier: "advisor",
    enumKey: "subscription_tier: advisor",
    name: "Advisor",
    price: 199,
    cadence: "per month",
    pitch: "Client-ready memos for the registered RIA.",
    features: [
      "Everything in Pro",
      "Printable memos + client commentary",
      "Multi-portfolio tracking",
      "Priority methodology support",
    ],
    postV1: true,
  },
];

function PricingTiles() {
  return (
    <Section id="pricing" label="Pricing">
      <p
        style={{
          fontFamily: "var(--f)",
          fontSize: 14.5,
          lineHeight: 1.55,
          color: "var(--text-2)",
          margin: "0 0 20px",
          maxWidth: 620,
        }}
      >
        Three tiers, monthly billing, cancel anytime. The Starter plan is
        the entry to the research instrument; Pro adds workflow surfaces;
        Advisor is post-v1 for RIA-licensed users.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
          gap: 16,
        }}
      >
        {TIERS.map((t) => (
          <PriceTile key={t.tier} t={t} />
        ))}
      </div>
    </Section>
  );
}

function PriceTile({ t }: { t: PriceTier }) {
  const isRec = !!t.recommended;
  return (
    <article
      style={{
        background: "var(--canvas)",
        border: `1px solid ${isRec ? "var(--accent-border)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "22px 22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
      }}
    >
      {isRec && (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 18,
            padding: "2px 8px",
            background: "var(--canvas)",
            border: "1px solid var(--accent-border)",
            borderRadius: 4,
            fontFamily: "var(--m)",
            fontSize: 10,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: "var(--iris-200)",
            fontWeight: 600,
          }}
        >
          Recommended
        </span>
      )}
      {t.postV1 && (
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 18,
            padding: "2px 8px",
            background: "var(--canvas)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontFamily: "var(--m)",
            fontSize: 10,
            letterSpacing: ".10em",
            textTransform: "uppercase",
            color: "var(--text-3)",
          }}
        >
          Post-v1
        </span>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11,
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {t.enumKey}
        </span>
        <h3
          style={{
            fontFamily: "var(--f)",
            fontSize: 22,
            fontWeight: 600,
            color: "var(--text-1)",
            margin: 0,
            letterSpacing: "-.005em",
          }}
        >
          {t.name}
        </h3>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 34,
            fontWeight: 600,
            color: "var(--text-1)",
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          ${t.price}
        </span>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 12,
            color: "var(--text-3)",
            letterSpacing: ".02em",
          }}
        >
          {t.cadence}
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--f)",
          fontSize: 13.5,
          color: "var(--text-2)",
          lineHeight: 1.5,
          margin: 0,
        }}
      >
        {t.pitch}
      </p>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: "4px 0 0",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {t.features.map((f) => (
          <li
            key={f}
            style={{
              display: "grid",
              gridTemplateColumns: "14px 1fr",
              gap: 8,
              alignItems: "baseline",
              fontFamily: "var(--f)",
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.5,
            }}
          >
            <span
              aria-hidden
              style={{
                color: "var(--iris-200)",
                fontFamily: "var(--m)",
                fontSize: 11,
              }}
            >
              ›
            </span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

/* ---------------- Honest disclaimers ---------------- */

function Disclaimers() {
  return (
    <Section label="Honest disclaimers">
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          maxWidth: 760,
        }}
      >
        <DisclaimerItem
          head="Research software."
          body="AI Thesis is a research and analysis instrument. Nothing on this site or in the product is personalized investment advice, an offer to buy or sell securities, or a recommendation."
        />
        <DisclaimerItem
          head="Educational analysis only."
          body="Factor scores, composites, and tier classifications are quantitative research outputs. They are not endorsements of any security and are not tailored to your circumstances."
        />
        <DisclaimerItem
          head="No SEC-registered investment-adviser services."
          body="We are not an SEC- or state-registered investment adviser or broker-dealer. Consult a licensed advisor before making investment decisions."
        />
        <DisclaimerItem
          head="No hypothetical performance claims."
          body="Past insider transactions reported under SEC Form 4 are public-record descriptions of past events. We do not publish hypothetical or backtested performance numbers in marketing copy."
        />
      </ul>
    </Section>
  );
}

function DisclaimerItem({ head, body }: { head: string; body: string }) {
  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr",
        gap: 16,
        alignItems: "baseline",
        padding: "12px 0",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <span
        style={{
          fontFamily: "var(--m)",
          fontSize: 12,
          color: "var(--iris-200)",
          letterSpacing: ".02em",
          fontWeight: 600,
          minWidth: 160,
        }}
      >
        {head}
      </span>
      <span
        style={{
          fontFamily: "var(--f)",
          fontSize: 13.5,
          color: "var(--text-2)",
          lineHeight: 1.55,
        }}
      >
        {body}
      </span>
    </li>
  );
}

/* ---------------- Footer ---------------- */

function FooterStrip() {
  return (
    <footer
      role="contentinfo"
      style={{
        marginTop: 80,
        padding: "32px clamp(20px, 5vw, 48px) 40px",
        borderTop: "1px solid var(--border-subtle)",
        background: "rgba(11,12,15,.6)",
        display: "flex",
        flexWrap: "wrap",
        gap: 28,
        alignItems: "baseline",
        fontFamily: "var(--m)",
        fontSize: 11.5,
        color: "var(--text-3)",
      }}
    >
      <span style={{ color: "var(--text-2)", fontWeight: 600, letterSpacing: ".02em" }}>
        AI Thesis
      </span>
      <a href="#what" style={footerLinkStyle}>What it does</a>
      <a href="#score-math" style={footerLinkStyle}>Methodology</a>
      <a href="#pricing" style={footerLinkStyle}>Pricing</a>
      <Link href="/login" style={footerLinkStyle}>Sign in</Link>
      <span style={{ marginLeft: "auto", color: "var(--text-4)", letterSpacing: ".02em" }}>
        Research software · not an investment adviser
      </span>
    </footer>
  );
}

const footerLinkStyle: React.CSSProperties = {
  color: "var(--text-3)",
  textDecoration: "none",
  letterSpacing: ".02em",
};

/* ---------------- shared chrome ---------------- */

function Section({
  id,
  label,
  children,
}: {
  id?: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      style={{
        scrollMarginTop: 72,
        padding: "clamp(60px, 8vw, 110px) clamp(20px, 5vw, 48px)",
        maxWidth: 1200,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 14,
          paddingBottom: 16,
          marginBottom: 28,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: 11,
            color: "var(--text-3)",
            letterSpacing: ".10em",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          {label}
        </span>
      </div>
      {children}
    </section>
  );
}

function SectionDivider() {
  return (
    <div
      aria-hidden
      style={{
        height: 1,
        background:
          "linear-gradient(90deg, transparent 0%, var(--border-subtle) 20%, var(--border-subtle) 80%, transparent 100%)",
        margin: "0 auto",
        maxWidth: 1200,
      }}
    />
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: "var(--m)",
        fontSize: 11,
        color: "var(--iris-200)",
        letterSpacing: ".14em",
        textTransform: "uppercase",
        fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
