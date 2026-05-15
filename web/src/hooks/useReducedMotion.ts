"use client";

import { useEffect, useState } from "react";

/**
 * Detect prefers-reduced-motion so JS-orchestrated stagger can collapse cleanly.
 * Verbatim port of useReducedMotion from stage3-common.jsx.
 */
export function useReducedMotion() {
  const [r, setR] = useState(() =>
    typeof window !== "undefined" &&
    typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    if (typeof matchMedia === "undefined") return;
    const m = matchMedia("(prefers-reduced-motion: reduce)");
    const h = (e: MediaQueryListEvent) => setR(e.matches);
    m.addEventListener?.("change", h);
    return () => m.removeEventListener?.("change", h);
  }, []);
  return r;
}

/**
 * Stagger helper — caps after N items, collapses under reduced-motion.
 * Verbatim port of staggerDelay from stage3-common.jsx.
 */
export function staggerDelay(idx: number, reduced: boolean, base = 30, cap = 8) {
  if (reduced) return 0;
  return Math.min(idx, cap) * (idx > cap ? 18 : base);
}
