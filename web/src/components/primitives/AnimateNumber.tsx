"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * Compositor-friendly animated number primitive — counts from previous
 * value to current value over a short duration with an ease-out curve.
 * Used on hero metrics where the protagonist number deserves a deliberate
 * moment of arrival rather than a hard pop-in (AggregateBar, future
 * Dashboard KPI tiles).
 *
 * Cost characterization for the motion audit: the DOM text content is
 * re-rendered ~60 times/sec over `duration`, which technically lives in
 * paint (C-tier) — there's no S-tier digit-tape implementation here.
 * Bounded: ~48 paints total for an 800ms entrance, single element, no
 * layout cost. Acceptable. If we ever need true S-tier digit rolls, the
 * Motion+ AnimateNumber premium example does it via per-digit
 * `transform: translateY()` on a tape.
 *
 * `prefers-reduced-motion: reduce` snaps to the target value with no
 * animation. matchMedia is read once per value-change; the globals.css
 * @media block already collapses CSS animations site-wide as a safety net.
 */
type Props = {
  value: number;
  /** How to render the animated value as a string (e.g. `(n) => $${n.toFixed(0)}`). */
  format: (n: number) => string;
  /** Animation duration in ms. Default 800. */
  duration?: number;
  style?: CSSProperties;
  className?: string;
  /** ARIA label for screen readers — they get the final value, not the rolling intermediate. */
  ariaLabel?: string;
};

const EASE_OUT_CUBIC = (t: number) => 1 - Math.pow(1 - t, 3);

export function AnimateNumber({ value, format, duration = 800, style, className, ariaLabel }: Props) {
  // Start at 0 (or near-0 for negative targets) so the FIRST mount animates
  // 0 → value, not value → value. SSR paint will briefly show "0" before
  // hydration; the count-up reads as deliberate. fromRef carries forward
  // post-animation so subsequent value changes (e.g. /portfolio revalidate
  // every 5 min) interpolate from the previously settled value, not from 0.
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
    <span className={className} style={style} aria-label={ariaLabel ?? format(value)}>
      {format(display)}
    </span>
  );
}
