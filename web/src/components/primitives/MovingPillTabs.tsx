"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * MovingPillTabs — canonical panel-switcher tabs for the Hub.
 *
 * Use for: switching between different content panels on a single surface
 * (e.g., Prompt / Runs / Configuration on routine detail).
 *
 * Don't use for: filtering the same list (use static button pills, like the
 * catalog's All routines / Active / Disabled trio).
 *
 * The pill background slides between tab positions on switch. No framer-motion
 * dep — useLayoutEffect measures each tab's bounds; CSS transition on
 * transform + width handles the animation. First paint skips the transition
 * so the initial active tab doesn't animate in from origin.
 */
export interface MovingPillTab {
  title: string;
  value: string;
  meta?: number | string | null;
}

export function MovingPillTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: MovingPillTab[];
  value: string;
  onChange: (next: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pill, setPill] = useState<{ x: number; width: number }>({ x: 0, width: 0 });
  const [initialized, setInitialized] = useState(false);

  useLayoutEffect(() => {
    const activeBtn = tabRefs.current[value];
    const container = containerRef.current;
    if (!activeBtn || !container) return;
    const btnRect = activeBtn.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    setPill({
      x: btnRect.left - containerRect.left,
      width: btnRect.width,
    });
    if (!initialized) {
      requestAnimationFrame(() => setInitialized(true));
    }
  }, [value, initialized]);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        display: "inline-flex",
        gap: 2,
      }}
    >
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: "100%",
          width: pill.width,
          transform: `translateX(${pill.x}px)`,
          background: "var(--surface-2)",
          borderRadius: 999,
          transition: initialized
            ? "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), width 220ms cubic-bezier(0.32, 0.72, 0, 1)"
            : "none",
          opacity: initialized ? 1 : 0,
          pointerEvents: "none",
        }}
      />
      {tabs.map((t) => {
        const isActive = value === t.value;
        return (
          <button
            key={t.value}
            ref={(el) => {
              tabRefs.current[t.value] = el;
            }}
            onClick={() => onChange(t.value)}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-2)";
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.color = "var(--text-3)";
            }}
            style={{
              position: "relative",
              padding: "7px 14px",
              fontSize: 13,
              fontWeight: isActive ? 500 : 400,
              color: isActive ? "var(--text-1)" : "var(--text-3)",
              background: "transparent",
              border: 0,
              cursor: "pointer",
              letterSpacing: "-.011em",
              transition: "color var(--dur-fast) var(--ease-out)",
              zIndex: 1,
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 999,
              whiteSpace: "nowrap",
            }}
          >
            {t.title}
            {t.meta != null && (
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 11,
                  color: isActive ? "var(--text-3)" : "var(--text-4)",
                }}
              >
                {t.meta}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
