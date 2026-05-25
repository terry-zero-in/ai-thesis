"use client";

import { useEffect, useState } from "react";
import { computeGreeting, type GreetingResult } from "./greeting-compute";

/**
 * Client-side reactive greeting. Server-rendered initial paint via the
 * `initial*` props (page calls computeGreeting() server-side), then
 * re-derives every 1s after hydration so the seconds-precision market
 * countdown and the wall-clock display flicker live ("this page is
 * alive" affordance per /lambo institutional-texture). The 30-min page
 * revalidate cache no longer strands "Good evening" at noon.
 *
 * Layout:
 *   Line 1: "Good evening, Terry"                        — 22px Geist
 *   Line 2: dateLabel · marketLabel · wallClock · [dot]  — 12px mono
 *
 * Dot is green-pulsing when market open, dim grey when closed — single
 * "is the market live right now" signal at the right edge of the meta line.
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
  const [state, setState] = useState<GreetingResult>({
    greeting: initialGreeting,
    dateLabel: initialDateLabel,
    marketLabel: initialMarketLabel,
    // Server-render placeholders — replaced on first client tick (≤1s).
    // Empty so we don't leak a stale clock; the dash spacer collapses.
    wallClock: "",
    marketOpen: false,
  });

  useEffect(() => {
    // First-tick swap from server-rendered placeholders to real clock /
    // market state. SSR can't compute either (no window, no Date.now drift
    // tolerance), so we render shell-safe defaults and correct on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(computeGreeting());
    const id = setInterval(() => setState(computeGreeting()), 1000);
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
        <Sep />
        <span style={{ color: "var(--text-2)" }}>{state.marketLabel}</span>
        {state.wallClock && (
          <>
            <Sep />
            <span
              style={{
                color: "var(--text-3)",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: ".02em",
              }}
              title="Wall-clock time (Chicago)"
            >
              {state.wallClock}
            </span>
          </>
        )}
        <MarketDot open={state.marketOpen} />
      </div>
    </header>
  );
}

function Sep() {
  return (
    <span aria-hidden style={{ color: "var(--text-4)" }}>
      ·
    </span>
  );
}

function MarketDot({ open }: { open: boolean }) {
  return (
    <span
      aria-hidden
      title={open ? "NYSE regular session" : "NYSE closed"}
      style={{
        marginLeft: 4,
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: open ? "var(--success)" : "var(--text-4)",
        boxShadow: open ? "0 0 0 0 var(--success)" : "none",
        animation: open ? "marketDotPulse 1.6s ease-out infinite" : "none",
        display: "inline-block",
        flexShrink: 0,
      }}
    />
  );
}
