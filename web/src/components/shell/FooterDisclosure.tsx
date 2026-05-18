/**
 * Global compliance footer disclosure — THS-86.
 *
 * Rendered once at the bottom of every page via Shell.tsx. Text is LOCKED;
 * any change requires Terry approval per docs/compliance/language-discipline.md.
 *
 * Style: quiet chrome — mono 10.5px --text-4 on a hairline-divided strip
 * inside the canvas (NOT a fixed banner). Reads as required regulatory
 * fineprint, not as marketing. Reticle/Linear-class restraint.
 *
 * "Research, not advice" is the legal floor — see SEC Marketing Rule
 * 206(4)-1 and Investment Advisers Act of 1940 §202(a)(11).
 */
export function FooterDisclosure() {
  return (
    <footer
      role="contentinfo"
      style={{
        flexShrink: 0,
        padding: "10px 28px 12px",
        borderTop: "1px solid var(--border-subtle)",
        fontSize: 10.5,
        lineHeight: 1.55,
        color: "var(--text-4)",
        fontFamily: "var(--m)",
        letterSpacing: ".01em",
        background: "var(--canvas)",
      }}
    >
      <span style={{ color: "var(--text-3)", fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase" }}>
        Disclosure
      </span>{" "}
      AI Thesis is research and analysis software, not an investment advisor
      or broker-dealer. Nothing on this site is personalized investment
      advice, an offer to buy or sell securities, or a recommendation.
      Hypothetical performance does not predict future results. Past insider
      transactions reported under SEC Form 4 are public-record descriptions
      of past events. Consult a licensed advisor before making investment
      decisions.
    </footer>
  );
}
