"use client";

import { useEffect, useState } from "react";

/**
 * Client-side reactive greeting. Server-rendered initial paint to avoid
 * a flash, then re-derives every 60s from current local time so the
 * 30-min page revalidate cache doesn't strand "Good evening" at noon.
 *
 * Computed in America/Chicago per spec §5.1 mock ("23:24 CT"). Switch
 * to user's local tz if/when the app supports multi-tz operators.
 */
const TZ = "America/Chicago";

function compute(): { greeting: string; dateLabel: string } {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    hour: "2-digit",
    hour12: false,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = parseInt(get("hour"), 10);
  const greeting =
    hour >= 5 && hour < 12 ? "Good morning"
    : hour >= 12 && hour < 17 ? "Good afternoon"
    : "Good evening";
  const dateLabel = `${get("weekday")}, ${get("month")} ${get("day")}, ${get("year")}`;
  return { greeting, dateLabel };
}

export function getServerGreeting() {
  return compute();
}

export function GreetingStrip({
  initialGreeting,
  initialDateLabel,
}: {
  initialGreeting: string;
  initialDateLabel: string;
}) {
  const [state, setState] = useState({ greeting: initialGreeting, dateLabel: initialDateLabel });
  useEffect(() => {
    setState(compute());
    const id = setInterval(() => setState(compute()), 60_000);
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
        {state.greeting}, Terry
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "var(--text-3)", fontFamily: "var(--m)" }}>
        <span>{state.dateLabel}</span>
      </div>
    </header>
  );
}
