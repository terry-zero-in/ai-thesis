"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScoreMath, type ScoreMathInput } from "./ScoreMath";

/**
 * Click-to-open popover wrapper around <ScoreMath /> — THS-73.
 *
 * Wrap any composite/final-score number with this component to make it
 * source-traceable. Click reveals the full derivation ladder; ESC or
 * outside-click closes.
 *
 * Linear-class peel-back-the-layers pattern: surface stays calm at rest,
 * full audit-grade derivation is one click away. No drawer chrome,
 * no modal backdrop — anchored float positioned via fixed coords
 * computed from the trigger element.
 *
 * Usage:
 *   <ScoreMathPopover input={scoreMathInputFor(row)}>
 *     <span>{row.final_score.toFixed(1)}</span>
 *   </ScoreMathPopover>
 *
 * The wrapped child becomes a button. Caller controls its styling.
 */
export function ScoreMathPopover({
  input,
  children,
  ariaLabel,
}: {
  input: ScoreMathInput;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Compute fixed-position coordinates anchored under the trigger.
  // Right-align so the popover doesn't overflow the viewport on the right;
  // flip up if it would overflow the bottom.
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const POPOVER_W = 360;
    const POPOVER_H_EST = 460;
    const GAP = 6;
    let top = rect.bottom + GAP;
    let left = rect.right - POPOVER_W;
    if (left < 12) left = 12;
    if (top + POPOVER_H_EST > window.innerHeight - 12) {
      // Flip up
      top = rect.top - POPOVER_H_EST - GAP;
      if (top < 12) top = 12;
    }
    setCoords({ top, left });
  }, [open]);

  // ESC + outside-click close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popoverRef.current?.contains(t)) return;
      if (triggerRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel ?? `Open score math for ${input.ticker}`}
        aria-expanded={open}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          margin: 0,
          color: "inherit",
          font: "inherit",
          cursor: "pointer",
          // Sub-pixel hint that this is interactive: dotted underline that
          // appears only on hover. Linear-class — no permanent decoration,
          // affordance reveals on intent.
          textUnderlineOffset: 2,
        }}
        className="score-math-trigger"
      >
        {children}
      </button>
      {open && coords && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label={`Score math derivation for ${input.ticker}`}
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            width: 360,
            maxHeight: "calc(100vh - 24px)",
            overflowY: "auto",
            background: "var(--canvas)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            boxShadow: "0 12px 32px -8px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.02)",
            padding: 14,
            zIndex: 80,
            animation: "fadeUp var(--dur-fast) var(--ease-out) both",
          }}
        >
          <ScoreMath input={input} />
        </div>
      )}
    </>
  );
}
