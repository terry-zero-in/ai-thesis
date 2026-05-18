"use client";

import { useEffect, useState } from "react";
import { computeGreeting } from "./greeting-compute";

/**
 * Client-side reactive greeting. Server-rendered initial paint via the
 * `initial*` props (page calls computeGreeting() server-side), then
 * re-derives every 60s after hydration so the 30-min page revalidate
 * cache doesn't strand "Good evening" at noon.
 *
 * Three lines:
 *   1. "Good evening, Terry"  — 22px Geist, time-of-day flavor
 *   2. "Monday, May 18"        — 12px mono, --text-3
 *   3. "NYSE open · 2h 14m to close" — 12px mono, --text-2, market clock
 */
export function GreetingStrip({
  initialGreeting,
  initialDateLabel,
  initialMarketLabel,
}: {
  initialGreeting: string;
  initialDateLabel: string;
  initialMarketLabel: string;
}) {
  const [state, setState] = useState({
    greeting: initialGreeting,
    dateLabel: initialDateLabel,
    marketLabel: initialMarketLabel,
  });
  useEffect(() => {
    setState(computeGreeting());
    const id = setInterval(() => setState(computeGreeting()), 60_000);
    return () => clearInterval(id);
  }, []);
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        paddingBottom: 4,
      }}
    >
      <h1
        style={{
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: "-.014em",
          color: "var(--text-1)",
          fontFamily: "var(--f)",
          lineHeight: 1.2,
        }}
      >
        {state.greeting}
      </h1>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12,
          color: "var(--text-3)",
          fontFamily: "var(--m)",
        }}
      >
        <span>{state.dateLabel}</span>
        <span aria-hidden style={{ color: "var(--text-4)" }}>·</span>
        <span style={{ color: "var(--text-2)" }}>{state.marketLabel}</span>
      </div>
    </header>
  );
}
