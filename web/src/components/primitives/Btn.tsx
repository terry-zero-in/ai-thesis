"use client";

import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";

/**
 * Btn — verbatim port of stage3-common.jsx Btn.
 * States: rest · hover (bg 80ms) · active/pressed (translateY 1px, 60ms ease-in)
 *         · focus-visible (ring 140ms, applied globally) · disabled (opacity .6, not-allowed).
 *
 * Variants: primary · ghost · danger · default. Sizes: sm · default.
 */
export interface BtnProps {
  children: ReactNode;
  primary?: boolean;
  ghost?: boolean;
  danger?: boolean;
  disabled?: boolean;
  size?: "sm" | "default";
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export function Btn({ children, primary, ghost, danger, onClick, disabled, size, type = "button" }: BtnProps) {
  const [h, setH] = useState(false);
  const [p, setP] = useState(false);
  const pad = size === "sm" ? "5px 9px" : "6px 11px";
  const fs = size === "sm" ? 11 : 12;
  const borderC = danger
    ? "var(--danger)"
    : primary
      ? h
        ? "var(--accent-hover)"
        : "var(--accent)"
      : "var(--border)";
  const bg = disabled
    ? "var(--surface)"
    : danger
      ? h
        ? "#d04545"
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
    borderRadius: 5,
    fontSize: fs,
    fontWeight: 500,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    whiteSpace: "nowrap",
    letterSpacing: "-.011em",
    border: ghost ? "1px solid transparent" : `1px solid ${borderC}`,
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
