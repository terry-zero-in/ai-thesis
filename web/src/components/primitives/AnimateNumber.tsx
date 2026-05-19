"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Compositor-friendly animated number primitive — counts from previous
 * value to current value over a short duration with an ease-out curve.
 * Used on hero metrics where the protagonist number deserves a deliberate
 * moment of arrival rather than a hard pop-in.
 *
 * **All props serializable** so this component can be rendered directly by
 * Server Components without forcing a `"use client"` parent. Earlier API
 * passed a function `format` prop which broke the RSC boundary (functions
 * don't serialize). Kind-based API was introduced to fix that and
 * propagate motion across server-rendered pages (Dashboard / Regime).
 *
 * Cost characterization: DOM text content re-renders ~60 times/sec over
 * `duration` — paint-tier (C). Bounded: ~48 paints / 800ms / single
 * element / no layout. Genuine S-tier digit rolls would need per-digit
 * `transform: translateY()` on a tape (Motion+ premium example).
 *
 * `prefers-reduced-motion: reduce` snaps to the target value via
 * matchMedia. globals.css @media block also collapses CSS animations
 * site-wide as a safety net.
 */
export type AnimateNumberKind = "usd" | "usd-signed" | "pct-signed" | "multiplier" | "int" | "decimal";

type Props = {
  value: number;
  /**
   * Serializable formatter selector — passed across the RSC boundary safely.
   *   usd          → "$77,992"                (locale, no decimals)
   *   usd-signed   → "+$1,240" / "-$1,483"    (locale, no decimals, explicit sign)
   *   pct-signed   → "+0.51%" / "-2.30%"      (decimals = `decimals`, default 2)
   *   multiplier   → "0.95×"                  (decimals = `decimals`, default 2)
   *   int          → "78"                     (rounded)
   *   decimal      → "78.4"                   (decimals = `decimals`, default 1)
   */
  kind: AnimateNumberKind;
  /** Decimal places for pct-signed / multiplier / decimal kinds. */
  decimals?: number;
  /** Animation duration in ms. Default 800. */
  duration?: number;
  style?: CSSProperties;
  className?: string;
  /** ARIA label for screen readers — they get the final value, not the rolling intermediate. */
  ariaLabel?: string;
};

const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);

function fmtUsd(n: number, signed: boolean): string {
  const sign = n < 0 ? "-" : signed && n > 0 ? "+" : "";
  const body = Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0, minimumFractionDigits: 0 });
  return `${sign}$${body}`;
}

function formatBy(kind: AnimateNumberKind, n: number, decimals?: number): string {
  switch (kind) {
    case "usd":
      return fmtUsd(n, false);
    case "usd-signed":
      return fmtUsd(n, true);
    case "pct-signed":
      return `${n >= 0 ? "+" : ""}${n.toFixed(decimals ?? 2)}%`;
    case "multiplier":
      return `${n.toFixed(decimals ?? 2)}×`;
    case "int":
      return Math.round(n).toString();
    case "decimal":
      return n.toFixed(decimals ?? 1);
  }
}

export function AnimateNumber({ value, kind, decimals, duration = 800, style, className, ariaLabel }: Props) {
  // Start at 0 so the FIRST mount animates 0 → value, not value → value.
  // SSR briefly paints "0" formatted by `kind` before hydration; the
  // count-up reads as deliberate arrival. fromRef carries forward
  // post-animation so subsequent value changes (e.g. revalidate every
  // 5 min) interpolate from the previously settled value, not from 0.
  const [display, setDisplay] = useState<number>(0);
  const fromRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    let startTime: number | null = null;
    const step = (t: number) => {
      if (startTime === null) startTime = t;
      const elapsed = t - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = EASE_OUT_CUBIC(progress);
      const current = from + (to - from) * eased;
      setDisplay(current);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(to);
        fromRef.current = to;
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [value, duration]);

  return (
    <span className={className} style={style} aria-label={ariaLabel ?? formatBy(kind, value, decimals)}>
      {formatBy(kind, display, decimals)}
    </span>
  );
}
