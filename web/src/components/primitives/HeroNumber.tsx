import { AnimateNumber, type AnimateNumberKind } from "./AnimateNumber";

/**
 * HeroNumber — the protagonist number on a page, rendered at hero scale.
 *
 * Signature pattern per docs/design/lambo-review-2026-05-17.md §4.2 (Pattern #1).
 * Per /lambo "the most important number on the screen should get at least 60%
 * empty space around it" and spec §1.7 "the score is the protagonist."
 *
 * Composition:
 *   {label} (optional small-caps header in --text-3)
 *   {value}{unit} [delta]      ← hero block, 48-56px JetBrains Mono
 *   {derivation chain}           ← 13px mono --text-3, shows the math
 *   {attribution}                ← 11px mono --text-4, source/version/timestamp
 *
 * Apply to: /universe/[ticker] Composite, /dashboard Portfolio Value,
 * /portfolio Portfolio Value, /regime Multiplier, /aiq/[ticker] Total.
 */
interface Delta {
  value: number;
  period: string;        // e.g. "7d", "30d", "wk"
}

interface HeroNumberProps {
  value: number | null;
  /** Prefix glued to value: "$", "€", "". Useful for currency hero (/portfolio Market Value). */
  prefix?: string;
  /** Suffix glued to value: "%", "×", "x", "". */
  unit?: string;
  /** Decimal places. Default 1. Pass 0 for integers, 2 for currency-like. */
  precision?: number;
  /** Optional 7-day / week-over-week / etc. delta. */
  delta?: Delta | null;
  /** Optional small-caps header above the value (e.g. "Composite", "Portfolio Value"). */
  label?: string;
  /**
   * Pre-formatted derivation chain (caller composes). Renders 13px mono --text-3
   * directly beneath the hero. Example: "Raw 87.0 · ×0.95 macro · = 82.6 effective".
   */
  derivation?: string;
  /**
   * Source / version / timestamp attribution. Renders 11px mono --text-4 beneath
   * derivation. Example: "scored 2026-05-09 · turnover-engine v3.2".
   */
  attribution?: string;
  /**
   * Hero size step. "lg" = 48px (default), "xl" = 56px, "xxl" = 64px.
   * /regime 0.95× uses xl; /universe/[ticker] Composite uses lg per spec §5.3.
   */
  size?: "lg" | "xl" | "xxl";
  /**
   * Optional color override for the value glyphs. Defaults to --text-1.
   * Use for severity-encoded heroes per /lambo "severity colors only at
   * severity moments" — e.g., /regime multiplier colors --warning when one
   * gate hit and --danger when two+ hit. The delta keeps its own success /
   * danger coloring independently.
   */
  valueColor?: string;
}

const SIZE_PX: Record<NonNullable<HeroNumberProps["size"]>, number> = {
  lg: 48,
  xl: 56,
  xxl: 64,
};

export function HeroNumber({
  value,
  prefix = "",
  unit = "",
  precision = 1,
  delta = null,
  label,
  derivation,
  attribution,
  size = "lg",
  valueColor = "var(--text-1)",
}: HeroNumberProps) {
  // For currency hero (prefix "$") use locale thousands separators.
  const formatted =
    value == null
      ? "—"
      : prefix === "$" || prefix === "€"
        ? value.toLocaleString("en-US", { maximumFractionDigits: precision, minimumFractionDigits: precision })
        : value.toFixed(precision);
  const valueStr = value == null ? "—" : `${prefix}${formatted}`;
  const deltaSign = delta == null ? null : delta.value > 0 ? "↑" : delta.value < 0 ? "↓" : "·";
  const deltaColor =
    delta == null ? "var(--text-3)" : delta.value > 0 ? "var(--success)" : delta.value < 0 ? "var(--danger)" : "var(--text-3)";

  // Map HeroNumber prefix/unit into an AnimateNumber kind for the count-up
  // primitive. Currency prefixes ("$"/"€") collapse to "usd" (no localized
  // €-prefix kind yet; current consumers are USD-only). Unit-based kinds
  // are anchored by their suffix glyph. Default = "decimal".
  // Note: the unit glyph is rendered separately below as a smaller sibling
  // span, so the AnimateNumber kind for unit cases is chosen to NOT emit
  // the unit (e.g. "multiplier" kind appends "×" — we use "decimal" when
  // there's a unit so AnimateNumber renders just the number and the
  // existing unit-span keeps its smaller scale).
  const animKind: AnimateNumberKind =
    prefix === "$" || prefix === "€"
      ? "usd"
      : "decimal";
  const animDecimals = prefix === "$" || prefix === "€" ? 0 : precision;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        // 60% breathing rule from /lambo — generous padding around hero blocks
        padding: "8px 0",
      }}
    >
      {label && (
        <div
          style={{
            fontSize: 10.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            letterSpacing: ".08em",
            textTransform: "uppercase",
          }}
        >
          {label}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
        <span
          style={{
            fontFamily: "var(--m)",
            fontSize: SIZE_PX[size],
            fontWeight: 600,
            color: valueColor,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
            letterSpacing: "-.018em",
          }}
        >
          {value == null ? (
            valueStr
          ) : (
            <AnimateNumber value={value} kind={animKind} decimals={animDecimals} />
          )}
          {value != null && unit && (
            <span style={{ fontSize: SIZE_PX[size] * 0.55, marginLeft: 2, color: "var(--text-2)", fontWeight: 500 }}>
              {unit}
            </span>
          )}
          {value == null && unit && (
            <span style={{ fontSize: SIZE_PX[size] * 0.55, marginLeft: 2, color: "var(--text-2)", fontWeight: 500 }}>
              {unit}
            </span>
          )}
        </span>
        {delta != null && value != null && delta.value !== 0 && (
          // Suppress the delta block when value is exactly 0 — "· 0 (since open)"
          // at 14px next to a 48px hero number reads as a malformed trailing
          // decimal (e.g. "$10,998 · 0" looks like "$10,998.0"). A zero delta
          // also carries no signal; the hero alone suffices.
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 14,
              color: deltaColor,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {deltaSign} {delta.value > 0 ? "+" : ""}
            {delta.value.toFixed(precision)} ({delta.period})
          </span>
        )}
      </div>
      {derivation && (
        <div
          style={{
            fontSize: 12.5,
            fontFamily: "var(--m)",
            color: "var(--text-3)",
            fontVariantNumeric: "tabular-nums",
            marginTop: 2,
          }}
        >
          {derivation}
        </div>
      )}
      {attribution && (
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--m)",
            color: "var(--text-4)",
            fontVariantNumeric: "tabular-nums",
            marginTop: -2,
          }}
        >
          {attribution}
        </div>
      )}
    </div>
  );
}
