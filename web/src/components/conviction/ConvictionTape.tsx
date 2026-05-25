"use client";

import Link from "next/link";
import type { CSSProperties, JSX, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * ConvictionTape — Lambo Pass §G feature 2.
 *
 * A 1-line, 32px-tall horizontal tape that surfaces the 3-5 things the engine
 * wants the analyst to know that they didn't know yesterday. Auto-rotates
 * every 8s with a tiny progress sliver above. Hover pauses, clicking the
 * status dot pins (and persists to localStorage), arrow keys scrub.
 *
 * Industry-first claim: Bloomberg's news ticker is undifferentiated noise.
 * Alerts-inbox tools force you to read. The Conviction Tape is the engine's
 * voice in a single line — the senior-PM whisper to the junior analyst at
 * the open.
 *
 * Empty state collapses the tape to nothing (renders null). Silence is the
 * right answer when nothing's moved.
 *
 * NOTE: This component accepts items as a prop. Data wiring happens in
 * Wave 2 (Dashboard page agent will mount it above the PageHeader).
 */

export type TapeSeverity = "info" | "watch" | "warning" | "danger" | "success";

export interface TapeItem {
  id: string;
  severity: TapeSeverity;
  /** The primary line. Mono. May include unicode arrows (→) etc. */
  primary: ReactNode;
  /** Optional driver clause, e.g. "Q profitability" — rendered after primary with " · driver: " prefix. */
  driver?: string;
  /** Optional context clause (alternative to driver), e.g. "approaching -15% trim trigger". Prefix " · ". */
  context?: string;
  /** Action label, e.g. "trace", "open position", "open ticker", "open regime". */
  actionLabel: string;
  /** Where the action goes — either an href (renders as <Link>) or an onClick (renders as <button>). Pass exactly one. */
  actionHref?: string;
  actionOnClick?: () => void;
}

export interface ConvictionTapeProps {
  items: TapeItem[];
  /** Rotation interval in ms. Default 8000. */
  intervalMs?: number;
  /** Persist the last-pinned id under this localStorage key. Default "conviction-tape:pinned". Pass null to disable persistence. */
  pinStorageKey?: string | null;
}

const DEFAULT_INTERVAL = 8000;
const DEFAULT_PIN_KEY = "conviction-tape:pinned";

const SEVERITY_COLOR: Record<TapeSeverity, string> = {
  info: "var(--text-3)",
  watch: "var(--accent)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  success: "var(--success)",
};

// Filled dot (●) for severity items the analyst should act on. Outlined (○)
// for informational and watchlist items — same hierarchy Terry called out
// in the spec.
const SEVERITY_FILLED: Record<TapeSeverity, boolean> = {
  info: false,
  watch: false,
  warning: true,
  danger: true,
  success: true,
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export function ConvictionTape({
  items,
  intervalMs = DEFAULT_INTERVAL,
  pinStorageKey = DEFAULT_PIN_KEY,
}: ConvictionTapeProps): JSX.Element | null {
  const reducedMotion = usePrefersReducedMotion();

  // Hydrate pinned id + active idx from localStorage via lazy initializers so
  // we don't trigger a cascading setState inside an effect. The lazy init
  // closes over the FIRST `items` array — if items mutate later we re-clamp
  // the active index during render below.
  const [pinnedId, setPinnedId] = useState<string | null>(() => {
    if (pinStorageKey === null) return null;
    if (typeof window === "undefined") return null;
    try {
      const stored = window.localStorage.getItem(pinStorageKey);
      if (!stored) return null;
      return items.some((it) => it.id === stored) ? stored : null;
    } catch {
      return null;
    }
  });
  const [rawActiveIdx, setActiveIdx] = useState<number>(() => {
    if (pinStorageKey === null) return 0;
    if (typeof window === "undefined") return 0;
    try {
      const stored = window.localStorage.getItem(pinStorageKey);
      if (!stored) return 0;
      const idx = items.findIndex((it) => it.id === stored);
      return idx >= 0 ? idx : 0;
    } catch {
      return 0;
    }
  });
  const [isHovered, setIsHovered] = useState(false);
  // `progressTick` is bumped on every item change so the CSS transition
  // resets cleanly (we toggle the width key with this counter).
  const [progressTick, setProgressTick] = useState(0);

  // Clamp the active index during render rather than via a setState effect —
  // covers the case where `items` shrinks below the current activeIdx.
  const activeIdx = items.length === 0 ? 0 : rawActiveIdx % items.length;

  const isPinned = pinnedId !== null;
  const isPaused = isHovered || isPinned || reducedMotion;

  // Rotation timer. We re-create when interval, pause state, or items length
  // changes so the cleanup is clean.
  useEffect(() => {
    if (items.length <= 1) return;
    if (isPaused) return;
    const id = window.setInterval(() => {
      setActiveIdx((idx) => (idx + 1) % items.length);
      setProgressTick((t) => t + 1);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [items.length, intervalMs, isPaused]);

  const advance = useCallback(
    (delta: number) => {
      if (items.length === 0) return;
      setActiveIdx((idx) => {
        const next = (idx + delta + items.length) % items.length;
        return next;
      });
      setProgressTick((t) => t + 1);
    },
    [items.length],
  );

  const togglePin = useCallback(() => {
    const current = items[activeIdx];
    if (!current) return;
    setPinnedId((prev) => {
      const next = prev === current.id ? null : current.id;
      if (pinStorageKey !== null && typeof window !== "undefined") {
        try {
          if (next) window.localStorage.setItem(pinStorageKey, next);
          else window.localStorage.removeItem(pinStorageKey);
        } catch {
          // Storage may be unavailable — pin still works in-memory.
        }
      }
      return next;
    });
  }, [activeIdx, items, pinStorageKey]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        advance(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        advance(-1);
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        togglePin();
      }
    },
    [advance, togglePin],
  );

  const fireAction = useCallback(() => {
    const current = items[activeIdx];
    if (!current) return;
    if (current.actionOnClick) {
      current.actionOnClick();
    } else if (current.actionHref && typeof window !== "undefined") {
      window.location.href = current.actionHref;
    }
  }, [activeIdx, items]);

  const onRowClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      // Don't double-fire when the inner Link / button was clicked, or when
      // the dot (which pins) was clicked.
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-tape-dot]")) return;
      if (target?.closest("[data-tape-action]")) return;
      fireAction();
    },
    [fireAction],
  );

  // Empty state — silence is the right answer when nothing's moved.
  if (items.length === 0) return null;

  const current = items[activeIdx] ?? items[0];

  return (
    <div
      role="region"
      aria-label="Conviction tape — engine signals"
      style={{
        position: "relative",
        width: "100%",
        background: "var(--surface)",
        borderBottom: "1px solid var(--border-subtle)",
        userSelect: "none",
      }}
    >
      <ProgressSliver
        active={!isPaused && items.length > 1}
        intervalMs={intervalMs}
        tick={progressTick}
        reducedMotion={reducedMotion}
      />
      <div
        tabIndex={0}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onKeyDown={onKeyDown}
        onClick={onRowClick}
        style={{
          height: 32,
          padding: "0 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          whiteSpace: "nowrap",
          overflow: "hidden",
          fontFamily: "var(--m)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            minWidth: 0,
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          <StatusDot
            severity={current.severity}
            filled={SEVERITY_FILLED[current.severity]}
            pinned={isPinned}
            onClick={(e) => {
              e.stopPropagation();
              togglePin();
            }}
          />
          <span
            style={{
              fontFamily: "var(--m)",
              fontSize: 12,
              color: "var(--text-1)",
              fontVariantNumeric: "tabular-nums",
              letterSpacing: ".01em",
            }}
          >
            {current.primary}
          </span>
          {current.driver !== undefined && current.driver.length > 0 ? (
            <>
              <Separator />
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 11.5,
                  color: "var(--text-3)",
                }}
              >
                <span style={{ fontStyle: "italic" }}>driver:</span>
                {" "}
                {current.driver}
              </span>
            </>
          ) : null}
          {current.context !== undefined && current.context.length > 0 ? (
            <>
              <Separator />
              <span
                style={{
                  fontFamily: "var(--m)",
                  fontSize: 11.5,
                  color: "var(--text-3)",
                }}
              >
                {current.context}
              </span>
            </>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}
        >
          {isPinned ? (
            <span
              style={{
                fontFamily: "var(--m)",
                fontSize: 10.5,
                color: "var(--text-4)",
                letterSpacing: ".02em",
              }}
            >
              · pinned
            </span>
          ) : null}
          <ActionHint
            label={current.actionLabel}
            href={current.actionHref}
            onClick={current.actionOnClick}
          />
        </div>
      </div>
    </div>
  );
}

function StatusDot({
  severity,
  filled,
  pinned,
  onClick,
}: {
  severity: TapeSeverity;
  filled: boolean;
  pinned: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
}) {
  const color = SEVERITY_COLOR[severity];
  const baseStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: filled ? color : "transparent",
    border: filled ? "none" : `1px solid ${color}`,
    // 2px halo at the same color × 20% opacity. When pinned we firm the halo
    // up so the pinned item has a recognizable presence.
    boxShadow: `0 0 0 2px color-mix(in oklab, ${color} ${pinned ? 32 : 20}%, transparent)`,
    flexShrink: 0,
  };
  return (
    <button
      type="button"
      data-tape-dot
      onClick={onClick}
      aria-label={pinned ? "Unpin signal" : "Pin signal"}
      title={pinned ? "Unpin signal" : "Pin signal"}
      style={{
        background: "transparent",
        border: "none",
        padding: 4,
        margin: -4,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={baseStyle} />
    </button>
  );
}

function Separator() {
  return (
    <span
      aria-hidden
      style={{
        fontFamily: "var(--m)",
        fontSize: 11.5,
        color: "var(--text-4)",
      }}
    >
      ·
    </span>
  );
}

function ActionHint({
  label,
  href,
  onClick,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
}) {
  // Hover reveals underline + lifts color to text-1. We do this with inline
  // state since we can't add a Tailwind className per project conventions.
  const [hover, setHover] = useState(false);
  const style: CSSProperties = {
    fontFamily: "var(--m)",
    fontSize: 11,
    color: hover ? "var(--text-1)" : "var(--text-3)",
    textDecoration: hover ? "underline" : "none",
    textUnderlineOffset: 2,
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    whiteSpace: "nowrap",
    letterSpacing: ".01em",
  };
  const inner = (
    <>
      <span aria-hidden style={{ marginRight: 4 }}>→</span>
      {label}
    </>
  );
  const commonProps = {
    "data-tape-action": true,
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    style,
  } as const;
  if (href) {
    return (
      <Link href={href} {...commonProps}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      {...commonProps}
    >
      {inner}
    </button>
  );
}

function ProgressSliver({
  active,
  intervalMs,
  tick,
  reducedMotion,
}: {
  active: boolean;
  intervalMs: number;
  tick: number;
  reducedMotion: boolean;
}) {
  // The trick: we render an inner bar whose width animates 0% → 100% over
  // `intervalMs`. To reset between items we briefly flip width back to 0%
  // with no transition (keyed on `tick`), then let the next render animate
  // toward 100%. We use two passes via a ref + rAF to force the reset.
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastTickRef = useRef(tick);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    if (reducedMotion || !active) {
      el.style.transition = "none";
      el.style.width = "0%";
      return;
    }
    // Reset to 0 with no transition, then on the next frame animate to 100%.
    el.style.transition = "none";
    el.style.width = "0%";
    // Force layout flush so the next transition takes effect.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    el.offsetWidth;
    const raf = window.requestAnimationFrame(() => {
      const el2 = innerRef.current;
      if (!el2) return;
      el2.style.transition = `width ${intervalMs}ms linear`;
      el2.style.width = "100%";
    });
    lastTickRef.current = tick;
    return () => window.cancelAnimationFrame(raf);
  }, [tick, intervalMs, active, reducedMotion]);

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        height: 2,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <div
        ref={innerRef}
        style={{
          height: "100%",
          width: "0%",
          background: "var(--accent-soft)",
        }}
      />
    </div>
  );
}
