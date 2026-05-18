"use client";

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

/**
 * Btn — port of stage3-common.jsx Btn, extended with `voltage` variant per
 * Iris × Voltage v1.0 system (locked 2026-05-18, S4).
 *
 * States: rest · hover (bg 80ms) · active/pressed (translateY 1px, 60ms ease-in)
 *         · focus-visible (ring 140ms, applied globally) · disabled (opacity .6, not-allowed).
 *
 * Variants:
 *   • voltage — THE primary CTA per page. Neon chartreuse pill (9999px radius),
 *               voltage-ink text. Rule: max one per visible page state.
 *   • primary — Iris-tier action (was Apex blue). Data-grid radius 5px.
 *               Use when Voltage is already taken on the page.
 *   • ghost   — transparent rest, tinted hover.
 *   • danger  — destructive action.
 *   • default — neutral elevated surface.
 *
 * Sizes: sm · default.
 */
export interface BtnProps {
  children: ReactNode;
  voltage?: boolean;
  primary?: boolean;
  ghost?: boolean;
  danger?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export function Btn({ children, voltage, primary, ghost, danger, onClick, disabled, size, type = "button" }: BtnProps) {
  const [h, setH] = useState(false);
  const [p, setP] = useState(false);
  const pad = voltage
    ? (size === "sm" ? "6px 14px" : "8px 18px")
    : (size === "sm" ? "5px 9px" : "6px 11px");
  const fs = size === "sm" ? 11 : 12;
  const borderC = voltage
    ? "transparent"
    : danger
      ? "var(--danger)"
      : primary
        ? h
          ? "var(--accent-hover)"
          : "var(--accent)"
        : "var(--border)";
  const bg = disabled
    ? "var(--surface)"
    : voltage
      ? p
        ? "var(--voltage-lo)"
        : h
          ? "var(--voltage-hi)"
          : "var(--voltage)"
      : danger
        ? h
          ? "color-mix(in oklab, var(--danger) 85%, #000)"
          : "var(--danger)"
        : primary
          ? p
            ? "var(--accent-pressed)"
            : h
              ? "var(--accent-hover)"
              : "var(--accent)"
          : ghost
            ? h
              ? "rgba(255,255,255,.04)"
              : "transparent"
            : h
              ? "var(--hover-lift)"
              : "var(--elevated)";
  const co = disabled
    ? "var(--text-4)"
    : voltage
      ? "var(--voltage-ink)"
      : primary || danger
        ? "var(--on-accent)"
        : ghost
          ? h
            ? "var(--text-1)"
            : "var(--text-3)"
          : h
            ? "var(--text-1)"
            : "var(--text-2)";
  const style: CSSProperties = {
    padding: pad,
    borderRadius: voltage ? 9999 : 5,
    fontSize: fs,
    fontWeight: voltage ? 600 : 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    letterSpacing: voltage ? "0" : "-.011em",
    border: ghost || voltage ? "1px solid transparent" : `1px solid ${borderC}`,
    background: bg,
    color: co,
    opacity: disabled ? 0.6 : 1,
    transition:
      "background var(--dur-instant) var(--ease-out),color var(--dur-instant) var(--ease-out),border-color var(--dur-fast) var(--ease-out),transform 60ms var(--ease-in),box-shadow var(--dur-fast) var(--ease-out)",
    cursor: disabled ? "not-allowed" : "pointer",
    transform: p ? "translateY(1px)" : "translateY(0)",
    userSelect: "none",
  };
  return (
    <button
      type={type}
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => {
        setH(false);
        setP(false);
      }}
      onMouseDown={() => !disabled && setP(true)}
      onMouseUp={() => setP(false)}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (!disabled && (e.key === " " || e.key === "Enter")) setP(true);
      }}
      onKeyUp={() => setP(false)}
      aria-disabled={disabled || undefined}
      style={style}
    >
      {children}
    </button>
  );
}
